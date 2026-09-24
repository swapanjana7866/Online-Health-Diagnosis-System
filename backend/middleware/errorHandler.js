import { sendError } from '../utils/apiResponse.js';

/**
 * Global Express Error Handling Middleware
 */
export const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'production') {
    console.error('SERVER ERROR:', err);
  }

  const errorDetails = {
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  };

  return sendError(res, statusCode, message, errorDetails);
};
