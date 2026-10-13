import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import Doctor from '../models/Doctor.js';
import Appointment from '../models/Appointment.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { APPOINTMENT_STATUSES, DEFAULT_DOCTOR_AVAILABILITY_SLOTS } from '../config/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const doctorControlPath = path.resolve(__dirname, '../config/doctors-control.json');
const bookingsControlPath = path.resolve(__dirname, '../config/bookings-control.json');

const readBookingControl = () => {
  try {
    const control = JSON.parse(fs.readFileSync(bookingsControlPath, 'utf8'));
    if (!control || typeof control !== 'object' || Array.isArray(control)) return {};
    return control;
  } catch (_error) {
    return {};
  }
};
const hasBookingEntry = (control, bookingId) =>
  Object.prototype.hasOwnProperty.call(control, bookingId);

const toBookingControlEntry = (appointment, patientName = appointment.user?.name || '') => {
  const appointmentDate = appointment.appointmentDate ? new Date(appointment.appointmentDate) : null;
  return {
    bookingId: appointment._id.toString(),
    patientName,
    doctorName: appointment.doctorName,
    specialty: appointment.specialty,
    date: appointmentDate && !Number.isNaN(appointmentDate.getTime())
      ? appointmentDate.toISOString().slice(0, 10)
      : '',
    time: appointment.timeSlot,
    reason: appointment.reason || '',
    status: 'pending'
  };
};

const writeBookingControl = (control) => {
  try {
    fs.writeFileSync(bookingsControlPath, `${JSON.stringify(control, null, 2)}\n`, 'utf8');
  } catch (_error) {
    // File errors never interrupt booking or appointment requests.
  }
};

const addBookingToControl = (appointment, patientName) => {
  try {
    const control = readBookingControl();
    const bookingId = appointment._id.toString();
    if (hasBookingEntry(control, bookingId)) return;

    control[bookingId] = toBookingControlEntry(appointment, patientName);
    writeBookingControl(control);
  } catch (_error) {
    // Booking creation remains successful if the local approval file is unavailable.
  }
};

export const syncBookingControl = async () => {
  try {
    const appointments = await Appointment.find({}).populate('user', 'name').lean();
    const control = readBookingControl();
    let changed = false;

    appointments.forEach((appointment) => {
      const bookingId = appointment._id.toString();
      if (hasBookingEntry(control, bookingId)) return;
      control[bookingId] = toBookingControlEntry(appointment);
      changed = true;
    });

    if (changed) writeBookingControl(control);
  } catch (_error) {
    // Keep startup and list requests available if the control file cannot be synced.
  }
};

const readDoctorAvailabilityControl = () => {
  try {
    const control = JSON.parse(fs.readFileSync(doctorControlPath, 'utf8'));
    if (!control || typeof control !== 'object' || Array.isArray(control)) return null;
    return control;
  } catch (_error) {
    return null;
  }
};

const getDoctorAvailability = (doctor, control) =>
  control && typeof control[doctor.name] === 'boolean' ? control[doctor.name] : doctor.available;

const ensureControlDoctors = async (control) => {
  if (!control) return;

  for (const [name, available] of Object.entries(control)) {
    if (!name.trim() || typeof available !== 'boolean') continue;

    const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'doctor';
    const nameHash = createHash('sha256').update(name).digest('hex').slice(0, 10);

    await Doctor.findOneAndUpdate(
      { name },
      {
        $setOnInsert: {
          name,
          specialty: 'General Physician',
          email: `${nameSlug}.${nameHash}@doctors-control.local`,
          available: true,
          rating: 4.5,
          consultationFee: 50,
          availabilitySlots: DEFAULT_DOCTOR_AVAILABILITY_SLOTS,
          description: 'Provides general healthcare consultations for common health concerns.'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
};

const defaultDoctors = [
  {
    name: 'Dr. Maya Patel',
    specialty: 'Pulmonologist',
    email: 'maya.patel@carepath.health',
    available: true,
    rating: 4.9,
    consultationFee: 49,
    availabilitySlots: DEFAULT_DOCTOR_AVAILABILITY_SLOTS,
    description: 'Focuses on preventive care, routine checkups, and early symptom triage.'
  },
  {
    name: 'Dr. Aiden Brooks',
    specialty: 'Cardiologist',
    email: 'aiden.brooks@carepath.health',
    available: true,
    rating: 4.8,
    consultationFee: 79,
    availabilitySlots: ['09:30', '11:00', '15:00'],
    description: 'Supports chest-related concerns, heart rhythm questions, and follow-up monitoring.'
  },
  {
    name: 'Dr. Sofia Nguyen',
    specialty: 'Dermatologist',
    email: 'sofia.nguyen@carepath.health',
    available: true,
    rating: 4.7,
    consultationFee: 64,
    availabilitySlots: ['08:30', '12:00', '13:30'],
    description: 'Reviews skin, allergic, and rash-related symptoms with practical care guidance.'
  },
  {
    name: 'Dr. Liam Hassan',
    specialty: 'Pulmonologist',
    email: 'liam.hassan@carepath.health',
    available: true,
    rating: 4.9,
    consultationFee: 82,
    availabilitySlots: ['10:00', '11:30', '17:00'],
    description: 'Helps with respiratory symptoms, chest discomfort, and breathing pattern concerns.'
  },
  {
    name: 'Dr. SWAPAN JANA',
    specialty: 'Gastroenterologist',
    email: 'swapan.jana@carepath.health',
    available: true,
    rating: 4.9,
    consultationFee: 100,
    availabilitySlots: ['11:00', '13:30', '17:00'],
    description: 'Provides primary healthcare consultations for common illnesses, fever, cold, cough, infections, and general health concerns.'
  },{
  name: 'Dr. Arjun Sharma',
  specialty: 'Neurologist',
  email: 'arjun.sharma@carepath.health',
  available: true,
  rating: 4.8,
  consultationFee: 90,
  availabilitySlots: ['09:00', '12:30', '16:00'],
  description: 'Provides consultations for heart health, blood pressure concerns, and cardiovascular risk assessment.'
},
{
  name: 'Dr. Emily Carter',
  specialty: 'Neurologist',
  email: 'emily.carter@carepath.health',
  available: true,
  rating: 4.8,
  consultationFee: 85,
  availabilitySlots: ['10:00', '13:00', '15:30'],
  description: 'Evaluates headaches, dizziness, nerve-related symptoms, and other neurological concerns.'
},
{
  name: 'Dr. Priya Patel',
  specialty: 'Pediatrician',
  email: 'priya.patel@carepath.health',
  available: true,
  rating: 4.9,
  consultationFee: 70,
  availabilitySlots: ['09:30', '12:00', '17:30'],
  description: 'Provides healthcare consultations for children, including common illnesses, growth, and preventive care.'
},
{
  name: 'Dr. Daniel Kim',
  specialty: 'Orthopedic',
  email: 'daniel.kim@carepath.health',
  available: true,
  rating: 4.7,
  consultationFee: 80,
  availabilitySlots: ['08:30', '11:00', '16:30'],
  description: 'Consults on joint pain, bone injuries, muscle problems, and mobility concerns.'
},
{
  name: 'Dr. Aisha Rahman',
  specialty: 'Gynecologist',
  email: 'aisha.rahman@carepath.health',
  available: true,
  rating: 4.9,
  consultationFee: 85,
  availabilitySlots: ['10:30', '13:30', '18:00'],
  description: 'Provides consultations for menstrual health, reproductive health, and common gynecological concerns.'
},
{
  name: 'Dr. Michael Brown',
  specialty: 'ENT',
  email: 'michael.brown@carepath.health',
  available: true,
  rating: 4.6,
  consultationFee: 75,
  availabilitySlots: ['09:00', '12:30', '15:00'],
  description: 'Evaluates digestive concerns, including acidity, abdominal discomfort, and changes in bowel habits.'
},
{
  name: 'Dr. Olivia Wilson',
  specialty: 'Pediatrician',
  email: 'olivia.wilson@carepath.health',
  available: true,
  rating: 4.8,
  consultationFee: 65,
  availabilitySlots: ['08:00', '11:30', '14:30'],
  description: 'Provides consultations for eye irritation, vision concerns, and common eye conditions.'
},
{
  name: 'Dr. Ethan Davis',
  specialty: 'Psychiatrist',
  email: 'ethan.davis@carepath.health',
  available: true,
  rating: 4.7,
  consultationFee: 60,
  availabilitySlots: ['09:30', '13:00', '17:00'],
  description: 'Evaluates ear pain, hearing concerns, sinus problems, and throat-related symptoms.'
},
{
  name: 'Dr. Meera Das',
  specialty: 'Dermatologist',
  email: 'meera.das@carepath.health',
  available: true,
  rating: 4.8,
  consultationFee: 90,
  availabilitySlots: ['10:00', '14:00', '18:30'],
  description: 'Provides mental health consultations for stress, anxiety, mood concerns, and emotional well-being.'
},
{
  name: 'Dr. Noah Martin',
  specialty: 'Urologist',
  email: 'noah.martin@carepath.health',
  available: true,
  rating: 4.7,
  consultationFee: 80,
  availabilitySlots: ['09:00', '12:00', '16:00'],
  description: 'Evaluates urinary symptoms, bladder concerns, and other urological health conditions.'
}
];

const ensureDoctorSeed = async () => {
  const count = await Doctor.countDocuments();
  if (count > 0) return;
  await Doctor.insertMany(defaultDoctors);
};

export const getDoctors = async (_req, res, next) => {
  try {
    await ensureDoctorSeed();
    const control = readDoctorAvailabilityControl();
    await ensureControlDoctors(control);
    const doctors = await Doctor.find({}).sort({ specialty: 1, name: 1 }).lean();
    const doctorsWithAvailability = doctors.map((doctor) => ({
      ...doctor,
      available: getDoctorAvailability(doctor, control)
    }));
    return sendSuccess(res, 200, 'Doctors retrieved successfully', { doctors: doctorsWithAvailability });
  } catch (error) {
    next(error);
  }
};

export const getAppointments = async (req, res, next) => {
  try {
    await syncBookingControl();
    const appointments = await Appointment.find({ user: req.user._id })
      .sort({ appointmentDate: 1 })
      .lean();
    const bookingControl = readBookingControl();
    const appointmentsWithStatus = appointments.map((appointment) => ({
      ...appointment,
      status: bookingControl[appointment._id.toString()]?.status === 'approved' ? 'approved' : 'pending'
    }));

    return sendSuccess(res, 200, 'Appointments retrieved successfully', { appointments: appointmentsWithStatus });
  } catch (error) {
    next(error);
  }
};

export const createAppointment = async (req, res, next) => {
  try {
    const { doctorId, date, timeSlot, reason } = req.body;

    if (!doctorId || !date || !timeSlot) {
      return sendError(res, 400, 'Doctor, date, and time slot are required', {
        code: 'APPOINTMENT_MISSING_REQUIRED_FIELDS'
      });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return sendError(res, 404, 'Selected doctor was not found', {
        code: 'DOCTOR_NOT_FOUND'
      });
    }

    const control = readDoctorAvailabilityControl();
    if (getDoctorAvailability(doctor, control) === false) {
      return sendError(res, 400, `${doctor.name} is currently marked as unavailable for appointments in the system. Please select an available doctor.`, {
        code: 'DOCTOR_UNAVAILABLE'
      });
    }

    if (!doctor.availabilitySlots?.includes(timeSlot)) {
      return sendError(res, 400, 'Selected time slot is not available for this doctor', {
        code: 'APPOINTMENT_TIME_SLOT_UNAVAILABLE'
      });
    }

    const dateString = `${date}T${timeSlot}:00`;
    const appointmentDate = new Date(dateString);

    if (Number.isNaN(appointmentDate.getTime())) {
      return sendError(res, 400, 'Please choose a valid appointment date and time', {
        code: 'APPOINTMENT_INVALID_DATE'
      });
    }

    const appointment = await Appointment.create({
      user: req.user._id,
      doctor: doctor._id,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      appointmentDate,
      timeSlot,
      reason: reason?.trim() || 'Follow-up consultation',
      status: APPOINTMENT_STATUSES[0]
    });
    addBookingToControl(appointment, req.user.name);

    return sendSuccess(res, 201, 'Appointment booked successfully', { appointment });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return sendError(res, 400, error.message, { details: error.errors });
    }
    next(error);
  }
};
