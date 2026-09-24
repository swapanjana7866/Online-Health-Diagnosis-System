import { Router } from 'express';
import { body } from 'express-validator';
import protect from '../middleware/authMiddleware.js';
import { getProfile, updateProfile } from '../controllers/userController.js';
import { validate } from '../middleware/validateMiddleware.js';

const router = Router();

const updateValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
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

router.use(protect);

// Support both PRD standard (/me) and alias (/profile)
router.get('/me', getProfile);
router.put('/me', updateValidation, updateProfile);

router.get('/profile', getProfile);
router.put('/profile', updateValidation, updateProfile);

export default router;
