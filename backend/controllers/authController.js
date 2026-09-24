import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS } from '../config/constants.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'carepath_default_secret_key_32chars', {
    expiresIn: JWT_EXPIRES_IN
  });
};

const formatPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  age: user.age,
  gender: user.gender,
  dateOfBirth: user.dateOfBirth,
  bloodType: user.bloodType,
  allergies: user.allergies,
  createdAt: user.createdAt
});

/**
 * Register a new user
 * POST /api/auth/register (or /api/auth/signup)
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, age, gender } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 409, 'An account with this email address already exists', {
        code: 'AUTH_EMAIL_ALREADY_EXISTS'
      });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      age: age ? Number(age) : undefined,
      gender: gender || undefined
    });

    const token = createToken(user._id);

    return sendSuccess(res, 201, 'User registered successfully', {
      token,
      user: formatPublicUser(user)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Legacy alias for register
 */
export const signup = register;

/**
 * Authenticate existing user
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return sendError(res, 401, 'Invalid email or password', {
        code: 'AUTH_INVALID_CREDENTIALS'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 401, 'Invalid email or password', {
        code: 'AUTH_INVALID_CREDENTIALS'
      });
    }

    const token = createToken(user._id);

    return sendSuccess(res, 200, 'Login successful', {
      token,
      user: formatPublicUser(user)
    });
  } catch (error) {
    next(error);
  }
};
