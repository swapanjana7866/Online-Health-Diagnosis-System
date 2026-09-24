import { validationResult } from 'express-validator';
import { sendError } from '../utils/apiResponse.js';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg
    }));

    return sendError(res, 400, formattedErrors[0]?.message || 'Validation failed', {
      details: formattedErrors
    });
  }
  next();
};
