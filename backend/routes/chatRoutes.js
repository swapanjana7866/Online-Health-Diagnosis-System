import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import User from '../models/User.js';
import { handleChatMessage } from '../controllers/chatController.js';
import { chatLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  CHAT_MAX_HISTORY_ENTRIES,
  CHAT_MAX_MESSAGE_LENGTH,
  CHAT_MAX_SYMPTOMS
} from '../config/constants.js';

const router = Router();

/**
 * Optional-auth middleware.
 * If a valid Bearer token is present, attaches req.user so the diagnosis
 * can be persisted. If no token or invalid token → continues anonymously.
 */
const optionalAuth = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).lean();
    } catch (_e) {
      // Invalid token → proceed without user (anonymous mode)
    }
  }
  next();
};

const normalizeConversationHistory = (req, _res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {};
  const rawHistory = req.body?.conversationHistory;
  if (!Array.isArray(rawHistory)) {
    req.body.conversationHistory = [];
    return next();
  }

  const normalizedHistory = rawHistory.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];

    const role = String(entry.role || '').trim().toLowerCase();
    if (!['user', 'assistant', 'bot', 'model', 'ai'].includes(role)) return [];

    const text = [entry.text, entry.content, entry.message, entry.parts]
      .map((value) => Array.isArray(value)
        ? value.map((part) => typeof part === 'string' ? part : part?.text || '').join('')
        : typeof value === 'string'
          ? value
          : value && typeof value === 'object'
            ? String(value.text || '')
            : '')
      .find((value) => value.trim()) || '';
    const content = text.trim();

    if (!content || /^❌/u.test(content) || /invalid/i.test(content)) return [];

    return [{
      role: role === 'user' ? 'user' : 'assistant',
      content: content.slice(0, 1500)
    }];
  });

  req.body.conversationHistory = normalizedHistory.slice(-CHAT_MAX_HISTORY_ENTRIES);
  next();
};

/**
 * POST /api/chat/message
 * Works both for logged-in users (persists diagnosis to DB)
 * and anonymous visitors (stateless evaluation only).
 */
router.post(
  '/message',
  chatLimiter,
  normalizeConversationHistory,
  [
    body().custom((payload) => payload && typeof payload === 'object' && !Array.isArray(payload))
      .withMessage('Request body must be an object'),
    body('action').optional().isIn(['evaluate']).withMessage('Action must be evaluate'),
    body('message').custom((value, { req }) => {
      if (req.body.action === 'evaluate' && (value === undefined || value === '')) return true;
      return typeof value === 'string' &&
        value.trim().length > 0 &&
        value.trim().length <= CHAT_MAX_MESSAGE_LENGTH;
    }).withMessage(`Message must be between 1 and ${CHAT_MAX_MESSAGE_LENGTH} characters`),
    body('currentSymptoms').optional().isArray({ max: CHAT_MAX_SYMPTOMS })
      .withMessage(`At most ${CHAT_MAX_SYMPTOMS} symptoms may be submitted`)
      .bail()
      .custom((symptoms) => symptoms.every((symptom) =>
        typeof symptom === 'string' && symptom.length > 0 && symptom.length <= 80
      ))
      .withMessage('Symptoms must be non-empty strings of at most 80 characters'),
    body('duration').optional().isString().bail().trim().isLength({ max: 100 })
      .withMessage('Duration must be at most 100 characters'),
    body('notes').optional().isString().bail().trim().isLength({ max: 500 })
      .withMessage('Notes must be at most 500 characters'),
    validate
  ],
  optionalAuth,
  handleChatMessage
);

export default router;
