import mongoose from 'mongoose';

export const isValidUserId = (userId) => mongoose.isValidObjectId(userId);
