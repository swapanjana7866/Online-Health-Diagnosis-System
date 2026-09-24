import mongoose from 'mongoose';

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing. Create backend/.env from backend/.env.example.');
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
