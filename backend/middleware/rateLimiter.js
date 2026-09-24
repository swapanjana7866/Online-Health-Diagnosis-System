import rateLimit from 'express-rate-limit';
import { RATE_LIMIT_AUTH_WINDOW_MS, RATE_LIMIT_AUTH_MAX } from '../config/constants.js';

export const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
      data: null,
      error: { code: 'AUTH_RATE_LIMIT_EXCEEDED' }
    });
  }
});
