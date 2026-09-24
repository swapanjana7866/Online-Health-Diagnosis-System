import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendError } from '../utils/apiResponse.js';

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return sendError(res, 401, 'Authentication token is required', {
      code: 'AUTH_TOKEN_MISSING'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      return sendError(res, 401, 'User associated with this token no longer exists', {
        code: 'AUTH_USER_NOT_FOUND'
      });
    }
    next();
  } catch (err) {
    return sendError(res, 401, 'Invalid or expired authentication token', {
      code: 'AUTH_TOKEN_INVALID',
      details: err.message
    });
  }
};

export default protect;
