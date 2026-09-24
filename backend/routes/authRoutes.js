import { Router } from 'express';
import { body } from 'express-validator';
import { register, signup, login } from '../controllers/authController.js';
import { validate } from '../middleware/validateMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { PASSWORD_REGEX, PASSWORD_ERROR_MESSAGE } from '../config/constants.js';

const router = Router();

const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .matches(PASSWORD_REGEX)
    .withMessage(PASSWORD_ERROR_MESSAGE),
  body('age')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 120 })
    .withMessage('Age must be between 0 and 120'),
  body('gender')
    .optional({ checkFalsy: true })
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('Gender must be one of: male, female, other, prefer_not_to_say'),
  validate
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

// Register routes
router.post('/register', authLimiter, registerValidation, register);
router.post('/signup', authLimiter, registerValidation, signup);

// Login route
router.post('/login', authLimiter, loginValidation, login);

export default router;
