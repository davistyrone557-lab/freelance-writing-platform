import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import pool from './config/database.js';
import startAutomationSchedules from './schedules/automation.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import paymentRoutes from './routes/payments.js';
import automationRoutes from './routes/automation.js';
import { verifyToken } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'FreelanceWriting.pro API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/automation', verifyToken, automationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 FreelanceWriting.pro API Server`);
  console.log(`📍 Running on http://localhost:${PORT}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
  console.log(`🤖 Automation enabled: YES\n`);
  
  // Start automated tasks
  startAutomationSchedules();
});

export default app;
