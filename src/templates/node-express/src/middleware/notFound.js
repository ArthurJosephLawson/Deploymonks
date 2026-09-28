import logger from '../utils/logger.js';

export const notFoundHandler = (req, res) => {
  logger.warn('route not found', { method: req.method, path: req.originalUrl });
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
};

export default notFoundHandler;
