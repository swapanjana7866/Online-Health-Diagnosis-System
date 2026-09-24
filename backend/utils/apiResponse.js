/**
 * Standardized Success Response Helper
 */
export const sendSuccess = (res, statusCode = 200, message = 'Success', data = null) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    error: null
  });
};

/**
 * Standardized Error Response Helper
 */
export const sendError = (res, statusCode = 400, message = 'Error', error = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    error
  });
};
