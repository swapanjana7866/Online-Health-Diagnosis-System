import { Router } from 'express';
import protect from '../middleware/authMiddleware.js';
import { createDiagnosis, getDiagnoses, getDiagnosis } from '../controllers/diagnosisController.js';

const router = Router();
router.use(protect);
router.route('/').get(getDiagnoses).post(createDiagnosis);
router.get('/:id', getDiagnosis);
export default router;
