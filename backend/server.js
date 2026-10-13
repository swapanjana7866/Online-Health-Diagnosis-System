import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import diagnosisRoutes from './routes/diagnosisRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { getSymptoms } from './controllers/diagnosisController.js';
import { syncBookingControl } from './controllers/doctorController.js';
import { validatePredictionEnvironment } from './services/predictionService.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sendSuccess, sendError } from './utils/apiResponse.js';

const app = express();
const basePort = Number(process.env.PORT) || 5000;

// Security & Parsing Middleware (helmet sets safe HTTP security headers per CODING_STANDARDS §5)
app.use(helmet());
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
app.use('/api/diagnosis', diagnosisRoutes);
app.get('/api/symptoms', getSymptoms);
app.use('/api/chat', chatRoutes);
app.use('/api', doctorRoutes);

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
  // Environment integrity (ARCHITECTURE §6.4): fail fast on missing required secrets
  if (!process.env.JWT_SECRET) {
    console.error('[API Gateway] JWT_SECRET is missing. Create backend/.env from backend/.env.example.');
    process.exit(1);
  }

  // Validate prediction provider configuration up front (non-fatal warnings —
  // requests degrade gracefully to the ML/heuristic engine when Gemini is unconfigured)
  const { provider, warnings } = validatePredictionEnvironment();
  console.log(`[API Gateway] Prediction provider: ${provider}`);
  warnings.forEach((warning) => console.warn(`[API Gateway] ${warning}`));

  await connectDB();
  await syncBookingControl();

  const listenOnPort = (port, attempt = 0) => {
    server = app.listen(port, () => {
      console.log(`[API Gateway] Listening on port ${port}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE' && attempt < 9) {
        console.warn(`[API Gateway] Port ${port} is busy. Retrying on ${port + 1}...`);
        listenOnPort(port + 1, attempt + 1);
        return;
      }

      console.error('[API Gateway] Failed to start server:', error.message);
      process.exit(1);
    });
  };

  listenOnPort(basePort);
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
