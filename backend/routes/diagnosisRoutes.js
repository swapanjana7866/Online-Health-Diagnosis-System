import { Router } from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  createDiagnosis,
  getDiagnoses,
  getDiagnosis,
  deleteDiagnosis,
  getSymptoms
} from '../controllers/diagnosisController.js';

const router = Router();

// Publicly accessible symptom taxonomy for selection
router.get('/symptoms', getSymptoms);

// Protected diagnosis lifecycle endpoints
router.use(protect);

router.post('/predict', createDiagnosis);
router.get('/history', getDiagnoses);

router.route('/')
  .get(getDiagnoses)
  .post(createDiagnosis);

router.route('/:id')
  .get(getDiagnosis)
  .delete(deleteDiagnosis);

export default router;
