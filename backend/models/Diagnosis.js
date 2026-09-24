import mongoose from 'mongoose';

const diagnosisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    symptoms: [{ type: String, required: true }],
    duration: { type: String, required: true },
    severity: { type: String, enum: ['mild', 'moderate', 'severe'], required: true },
    notes: { type: String, trim: true },
    possibleConditions: [{ name: String, likelihood: String }],
    recommendation: { type: String },
    status: { type: String, enum: ['completed', 'reviewing'], default: 'completed' }
  },
  { timestamps: true }
);

export default mongoose.model('Diagnosis', diagnosisSchema);
