import { Router } from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  createAppointment,
  getAppointments,
  getDoctors
} from '../controllers/doctorController.js';

const router = Router();

router.use(protect);
router.get('/doctors', getDoctors);
router.get('/appointments', getAppointments);
router.post('/appointments', createAppointment);

export default router;
