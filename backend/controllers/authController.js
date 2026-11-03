import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS } from '../config/constants.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const createToken = (id, role = 'user') => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Fail fast instead of silently signing with an insecure default.
    throw new Error('JWT_SECRET is not configured. Set it in backend/.env.');
  }
  return jwt.sign({ ...(id ? { id } : {}), role }, jwtSecret, {
    expiresIn: JWT_EXPIRES_IN
  });
};

const formatPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: 'user',
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
      role: 'user',
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

let adminConfigWarningLogged = false;

const constantTimeMatch = (submitted, configured) => {
  const submittedDigest = createHash('sha256').update(submitted).digest();
  const configuredDigest = createHash('sha256').update(configured).digest();
  return timingSafeEqual(submittedDigest, configuredDigest);
};

const cleanConfiguredValue = (value) => {
  const trimmed = value.trim();
  const first = trimmed[0];
  const last = trimmed.at(-1);
  const isQuoted = (first === '"' && last === '"') || (first === "'" && last === "'");
  return (isQuoted ? trimmed.slice(1, -1) : trimmed).trim();
};

export const adminLogin = async (req, res, next) => {
  try {
    const adminId = cleanConfiguredValue(process.env.ADMIN_ID || '');
    const adminPassword = cleanConfiguredValue(process.env.ADMIN_PASSWORD || '');

    if (!adminId || !adminPassword) {
      if (!adminConfigWarningLogged) {
        console.warn('[Admin login] ADMIN_ID or ADMIN_PASSWORD is missing; admin login is disabled.');
        adminConfigWarningLogged = true;
      }
      return sendError(res, 401, 'Invalid admin credentials', {
        code: 'AUTH_INVALID_ADMIN_CREDENTIALS'
      });
    }

    const submittedId = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
    const submittedPassword = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const idMatches = constantTimeMatch(submittedId.toLowerCase(), adminId.toLowerCase());
    const passwordMatches = constantTimeMatch(submittedPassword, adminPassword);

    if (!(idMatches & passwordMatches)) {
      return sendError(res, 401, 'Invalid admin credentials', {
        code: 'AUTH_INVALID_ADMIN_CREDENTIALS'
      });
    }

    const token = createToken(null, 'admin');
    return sendSuccess(res, 200, 'Admin login successful', {
      token,
      user: { name: 'Administrator', role: 'admin' }
    });
  } catch (error) {
    return next(error);
  }
};
