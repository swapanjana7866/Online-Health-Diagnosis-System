import mongoose from 'mongoose';
import { DEFAULT_DOCTOR_AVAILABILITY_SLOTS, DEFAULT_DOCTOR_CONSULTATION_FEE } from '../config/constants.js';

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    available: { type: Boolean, default: true },
    rating: { type: Number, min: 0, max: 5, default: 5 },
    consultationFee: { type: Number, min: 0, default: DEFAULT_DOCTOR_CONSULTATION_FEE },
    description: { type: String, trim: true },
    availabilitySlots: {
      type: [String],
      default: DEFAULT_DOCTOR_AVAILABILITY_SLOTS
    }
  },
  { timestamps: true }
);

export default mongoose.model('Doctor', doctorSchema);
