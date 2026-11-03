import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import {
  getDoctors
} from './doctorController.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const doctorControlPath = path.resolve(__dirname, '../config/doctors-control.json');
const bookingControlPath = path.resolve(__dirname, '../config/bookings-control.json');

const readControlFile = async (filePath) => {
  let contents;
  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    contents = '{}\n';
  }
  const parsed = JSON.parse(contents);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Control file must contain a JSON object');
  }
  return { contents, control: parsed };
};

const writeControlFile = async (filePath, control, originalContents) => {
  const indent = originalContents.match(/\n([ \t]+)"/)?.[1] || '  ';
  const newline = originalContents.includes('\r\n') ? '\r\n' : '\n';
  const serialized = `${JSON.stringify(control, null, indent).replace(/\n/g, newline)}${newline}`;
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, serialized, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
};

export const getAllAppointments = async (_req, res, next) => {
  try {
    const appointments = await Appointment.find({})
      .populate('user', 'name')
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    return sendSuccess(res, 200, 'All appointments retrieved successfully', {
      appointments: appointments.map((appointment) => ({
        ...appointment,
        patientName: appointment.user?.name || 'Unknown patient',
        status: appointment.status === 'approved' ? 'approved' : 'pending'
      }))
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllDoctors = async (_req, res, next) => {
  return getDoctors(_req, res, next);
};

export const addDoctor = async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const specialty = typeof req.body?.specialty === 'string' ? req.body.specialty.trim() : '';

  if (!name || !specialty) {
    return sendError(res, 400, 'Doctor name and specialty are required');
  }

  try {
    const doctor = await Doctor.create({
      name,
      specialty,
      email: `doctor.${randomUUID()}@doctors-control.local`,
      available: true
    });
    return sendSuccess(res, 201, 'Doctor added successfully', { doctor });
  } catch (error) {
    return next(error);
  }
};

export const removeDoctor = async (req, res, next) => {
  const { id } = req.params;

  try {
    const doctor = await Doctor.findById(id).select('_id name').lean();
    if (!doctor) return sendError(res, 404, 'Doctor was not found');

    const existingAppointment = await Appointment.exists({ doctor: doctor._id });
    if (existingAppointment) {
      return sendError(res, 409, 'This doctor has existing bookings and cannot be removed');
    }

    const { control: bookings } = await readControlFile(bookingControlPath);
    if (Object.values(bookings).some((booking) => booking.doctorName === doctor.name)) {
      return sendError(res, 409, 'This doctor has existing bookings and cannot be removed');
    }

    const { contents: doctorContents, control: doctorControl } = await readControlFile(doctorControlPath);
    delete doctorControl[doctor.name];
    await writeControlFile(doctorControlPath, doctorControl, doctorContents);
    await Doctor.findByIdAndDelete(id);

    return sendSuccess(res, 200, 'Doctor removed successfully', { id });
  } catch (error) {
    return next(error);
  }
};

export const updateDoctorAvailability = async (req, res, next) => {
  const { name } = req.params;
  const { available } = req.body || {};
  if (!name?.trim() || typeof available !== 'boolean') {
    return sendError(res, 400, 'Doctor name and a boolean availability value are required');
  }

  try {
    const doctor = await Doctor.findOne({ name: name.trim() }).select('_id name').lean();
    const { contents, control } = await readControlFile(doctorControlPath);
    if (!doctor && !Object.prototype.hasOwnProperty.call(control, name.trim())) {
      return sendError(res, 404, 'Doctor was not found');
    }
    control[doctor?.name || name.trim()] = available;
    await writeControlFile(doctorControlPath, control, contents);
    return sendSuccess(res, 200, 'Doctor availability updated successfully', {
      name: doctor?.name || name.trim(), available
    });
  } catch (error) {
    return next(error);
  }
};

export const updateBookingStatus = async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!id?.trim() || !['approved', 'pending'].includes(status)) {
    return sendError(res, 400, 'Booking ID and status must be approved or pending');
  }

  try {
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).lean();
    if (!appointment) return sendError(res, 404, 'Booking was not found');
    return sendSuccess(res, 200, 'Booking status updated successfully', {
      bookingId: appointment._id.toString(), status: appointment.status
    });
  } catch (error) {
    return next(error);
  }
};
