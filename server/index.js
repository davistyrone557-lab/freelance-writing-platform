import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
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
import { rateLimitAuth } from './middleware/auth.js';

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

// Authenticate socket connections via JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id, 'userId:', socket.userId);

  // Register online status using authenticated userId from token
  onlineUsers.set(socket.userId, socket.id);
  io.emit('user_status', { userId: socket.userId, status: 'online' });

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
    onlineUsers.delete(socket.userId);
    io.emit('user_status', { userId: socket.userId, status: 'offline' });
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

// General rate limit: 200 requests per minute per IP
const generalRateLimit = rateLimitAuth(200, 60000);
// Strict rate limit for auth endpoints: 10 per minute
const authRateLimit = rateLimitAuth(10, 60000);

// Routes
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/projects', generalRateLimit, projectRoutes);
app.use('/api/payments', generalRateLimit, paymentRoutes);
app.use('/api/automation', generalRateLimit, automationRoutes);
app.use('/api/bids', generalRateLimit, bidRoutes);
app.use('/api/messages', generalRateLimit, messageRoutes);
app.use('/api/reviews', generalRateLimit, reviewRoutes);
app.use('/api/users', generalRateLimit, userRoutes);
app.use('/api/admin', generalRateLimit, adminRoutes);

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
