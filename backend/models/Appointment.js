import mongoose from 'mongoose';
import { APPOINTMENT_STATUSES } from '../config/constants.js';

const appointmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true
    },
    doctorName: {
      type: String,
      required: true,
      trim: true
    },
    specialty: {
      type: String,
      required: true,
      trim: true
    },
    appointmentDate: {
      type: Date,
      required: true
    },
    timeSlot: {
      type: String,
      required: true,
      trim: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 300
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: APPOINTMENT_STATUSES[0]
    }
  },
  { timestamps: true }
);

appointmentSchema.index({ user: 1, appointmentDate: -1 });

export default mongoose.model('Appointment', appointmentSchema);
