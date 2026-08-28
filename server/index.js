import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import pool from './config/database.js';
import startAutomationSchedules from './schedules/automation.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import paymentRoutes from './routes/payments.js';
import automationRoutes from './routes/automation.js';
import bidRoutes from './routes/bids.js';
import messageRoutes from './routes/messages.js';
import reviewRoutes from './routes/reviews.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import { verifyToken } from './middleware/auth.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:3000';

// Socket.io setup
const io = new Server(httpServer, {
  cors: { origin: allowedOrigin, methods: ['GET', 'POST'], credentials: true }
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('user_online', (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit('user_status', { userId, status: 'online' });
  });

  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
  });

  socket.on('send_message', (data) => {
    io.to(`conversation_${data.conversationId}`).emit('new_message', data);
  });

  socket.on('typing', (data) => {
    socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
      userId: data.userId,
      conversationId: data.conversationId
    });
  });

  socket.on('stop_typing', (data) => {
    socket.to(`conversation_${data.conversationId}`).emit('user_stop_typing', {
      userId: data.userId
    });
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        io.emit('user_status', { userId, status: 'offline' });
        break;
      }
    }
  });
});

// Attach io to app for use in routes
app.set('io', io);

// Middleware
app.use(helmet());
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Content-Forge.pro API is running', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/automation', verifyToken, automationRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Mount bid sub-routes on projects (e.g. POST /api/projects/:projectId/bids)
app.post('/api/projects/:projectId/bids', (req, res, next) => {
  req.url = `/projects/${req.params.projectId}/bids`;
  next();
}, bidRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Content-Forge.pro API Server`);
  console.log(`📍 Running on http://localhost:${PORT}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
  console.log(`💬 Socket.io: enabled`);
  console.log(`🤖 Automation: enabled\n`);

  // Start automated tasks
  startAutomationSchedules();
});

export default app;
