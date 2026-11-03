import { sendError } from '../utils/apiResponse.js';

const requireAdmin = (req, res, next) => {
  if (req.authRole !== 'admin') {
    return sendError(res, 403, 'Administrator access is required', {
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  return next();
};

export default requireAdmin;
