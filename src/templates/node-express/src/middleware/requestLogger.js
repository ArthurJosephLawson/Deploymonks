import config from '../config/index.js';
import logger from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  if (!config.logRequests) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
};

export default requestLogger;
