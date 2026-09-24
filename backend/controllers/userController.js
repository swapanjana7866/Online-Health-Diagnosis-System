import { sendSuccess, sendError } from '../utils/apiResponse.js';

const formatPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  age: user.age,
  gender: user.gender,
  dateOfBirth: user.dateOfBirth,
  bloodType: user.bloodType,
  allergies: user.allergies,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

/**
 * Get authenticated user profile
 * GET /api/users/me (or /api/users/profile)
 */
export const getProfile = async (req, res) => {
  return sendSuccess(res, 200, 'User profile fetched successfully', {
    user: formatPublicUser(req.user)
  });
};

/**
 * Update authenticated user profile
 * PUT /api/users/me (or /api/users/profile)
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, age, gender, dateOfBirth, bloodType, allergies } = req.body;

    if (name) req.user.name = name;
    if (age !== undefined) req.user.age = age ? Number(age) : undefined;
    if (gender !== undefined) req.user.gender = gender;
    if (dateOfBirth !== undefined) req.user.dateOfBirth = dateOfBirth;
    if (bloodType !== undefined) req.user.bloodType = bloodType;
    if (allergies !== undefined) req.user.allergies = allergies;

    const updatedUser = await req.user.save();

    return sendSuccess(res, 200, 'User profile updated successfully', {
      user: formatPublicUser(updatedUser)
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return sendError(res, 400, error.message, { details: error.errors });
    }
    next(error);
  }
};
