import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    available: { type: Boolean, default: true },
    rating: { type: Number, min: 0, max: 5, default: 5 }
  },
  { timestamps: true }
);

export default mongoose.model('Doctor', doctorSchema);
