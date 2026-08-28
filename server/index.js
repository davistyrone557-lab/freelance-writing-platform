import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pool from './config/database.js';
import startAutomationSchedules from './schedules/automation.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import paymentRoutes from './routes/payments.js';
import automationRoutes from './routes/automation.js';
import bidsRoutes from './routes/bids.js';
import messagesRoutes from './routes/messages.js';
import usersRoutes from './routes/users.js';
import reviewsRoutes from './routes/reviews.js';
import adminRoutes from './routes/admin.js';
import notificationsRoutes from './routes/notifications.js';
import { verifyToken } from './middleware/auth.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:3000';
const socketOrigin = process.env.SOCKET_CORS_ORIGIN || clientOrigin;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getConversationRoom = (userA, userB) => `conversation:${[userA, userB].sort((a, b) => Number(a) - Number(b)).join('-')}`;

const io = new Server(httpServer, {
  cors: {
    origin: socketOrigin,
    credentials: true
  }
});

io.use((socket, next) => {
  const authHeader = socket.handshake.auth?.token || socket.handshake.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return next(new Error('Unauthorized socket connection'));
  }
});

io.on('connection', (socket) => {
  if (socket.data.user?.id) {
    socket.join(`user:${socket.data.user.id}`);
  }

  socket.on('join-room', (roomId) => {
    const normalizedRoomId = String(roomId || '');
    const selfRoom = `user:${socket.data.user.id}`;
    const conversationMatch = normalizedRoomId.match(/^conversation:(\d+)-(\d+)$/);

    const canJoinConversation = conversationMatch
      ? [conversationMatch[1], conversationMatch[2]].includes(String(socket.data.user.id))
      : false;

    if (normalizedRoomId === selfRoom || canJoinConversation) {
      socket.join(normalizedRoomId);
      return;
    }

    socket.emit('error', { message: 'Unauthorized room access' });
  });

  socket.on('send-message', async (payload = {}) => {
    if (!socket.data.user?.id) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const recipientId = Number(payload.recipientId);
    const content = payload.content?.trim();
    if (!recipientId || !content) {
      socket.emit('error', { message: 'recipientId and content are required' });
      return;
    }

    try {
      const senderResult = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [socket.data.user.id]);
      const senderName = `${senderResult.rows[0]?.first_name || ''} ${senderResult.rows[0]?.last_name || ''}`.trim();
      const result = await pool.query(
        'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3) RETURNING *',
        [socket.data.user.id, recipientId, content]
      );

      await pool.query(
        'INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6)',
        [recipientId, 'New message', `${senderName} sent you a message.`, 'message', result.rows[0].id, 'message']
      );

      const roomId = payload.roomId || getConversationRoom(socket.data.user.id, recipientId);
      io.to(`user:${socket.data.user.id}`).emit('new-message', { ...result.rows[0], roomId });
      io.to(`user:${recipientId}`).emit('new-message', { ...result.rows[0], roomId });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('typing', ({ roomId, recipientId, isTyping }) => {
    if (roomId) {
      socket.to(String(roomId)).emit('typing', { userId: socket.data.user?.id, recipientId, isTyping: Boolean(isTyping) });
    }
  });

  socket.on('read-message', async ({ messageId, senderId }) => {
    if (!socket.data.user?.id || !messageId) {
      return;
    }

    try {
      const result = await pool.query(
        'UPDATE messages SET is_read = TRUE WHERE id = $1 AND recipient_id = $2 RETURNING *',
        [messageId, socket.data.user.id]
      );

      if (result.rows[0]) {
        io.to(`user:${senderId}`).emit('message-read', { messageId, readBy: socket.data.user.id });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
});

app.use(helmet());
app.use(cors({
  origin: clientOrigin,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Content-Forge.pro API is running' });
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/automation', verifyToken, automationRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', bidsRoutes);
app.use('/api', reviewsRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

if (process.argv[1] === __filename) {
  httpServer.listen(PORT, () => {
    console.log('\n🚀 Content-Forge.pro API Server');
    console.log(`📍 Running on http://localhost:${PORT}`);
    console.log(`🔗 API URL: http://localhost:${PORT}/api`);
    console.log(`🤖 Automation enabled: YES`);
    console.log('⚡ Socket.io enabled: YES\n');
    startAutomationSchedules();
  });
}

export { app, httpServer, io };
export default app;
