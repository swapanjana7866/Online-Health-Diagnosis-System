import { Router } from 'express';
import protect from '../middleware/authMiddleware.js';
import requireAdmin from '../middleware/adminMiddleware.js';
import {
  getAllAppointments,
  getAllDoctors,
  addDoctor,
  removeDoctor,
  updateBookingStatus,
  updateDoctorAvailability
} from '../controllers/adminController.js';

const router = Router();

router.use(protect, requireAdmin);
router.get('/appointments', getAllAppointments);
router.get('/doctors', getAllDoctors);
router.post('/doctors', addDoctor);
router.delete('/doctors/:id', removeDoctor);
router.put('/doctors/:name/availability', updateDoctorAvailability);
router.put('/bookings/:id/status', updateBookingStatus);

export default router;
