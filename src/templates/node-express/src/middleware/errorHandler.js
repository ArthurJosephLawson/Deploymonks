import logger from '../utils/logger.js';

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = Number.isInteger(error?.status) ? error.status : 500;
  logger.error('unhandled error', {
    method: req.method,
    path: req.originalUrl,
    message: error?.message ?? 'unknown error',
  });

  res.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : 'Request Error',
    message: error?.message ?? 'unknown error',
  });
};

export default errorHandler;
