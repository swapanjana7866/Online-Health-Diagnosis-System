import rateLimit from 'express-rate-limit';
import {
  CHAT_RATE_LIMIT_MAX,
  CHAT_RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_AUTH_WINDOW_MS,
  RATE_LIMIT_AUTH_MAX
} from '../config/constants.js';

export const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      message:
        'Too many authentication attempts. Please try again after 15 minutes.',
      data: null,
      error: { code: 'AUTH_RATE_LIMIT_EXCEEDED' }
    });
  }
});

export const chatLimiter = rateLimit({
  windowMs: CHAT_RATE_LIMIT_WINDOW_MS,
  max: CHAT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many chat requests. Please try again later.',
      data: null,
      error: { code: 'CHAT_RATE_LIMIT_EXCEEDED' }
    });
  }
});