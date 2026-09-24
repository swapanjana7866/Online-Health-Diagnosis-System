import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import diagnosisRoutes from './routes/diagnosisRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sendSuccess, sendError } from './utils/apiResponse.js';

const app = express();
const port = process.env.PORT || 5000;

// Security & Parsing Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Health Check Probe
app.get('/api/health', (_req, res) => {
  return sendSuccess(res, 200, 'Health diagnosis API service is healthy', {
    status: 'ok',
    service: 'health-diagnosis-api',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/diagnoses', diagnosisRoutes);

// 404 Route Handler
app.use((req, res) => {
  return sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found`, {
    code: 'ROUTE_NOT_FOUND'
  });
});

// Centralized Error Handler
app.use(errorHandler);

let server;
const start = async () => {
  await connectDB();
  server = app.listen(port, () => {
    console.log(`[API Gateway] Listening on port ${port}`);
  });
};

// Graceful Shutdown
const handleShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

start();
