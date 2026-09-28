#!/usr/bin/env node

import app from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';

const server = app.listen(config.port, config.host, () => {
  logger.info(`${config.projectName} is listening`, {
    url: `http://${config.host}:${config.port}`,
    env: config.env,
  });
});

server.on('error', (error) => {
  logger.error('server failed to start', { message: error.message });
  process.exitCode = 1;
});

const shutdown = (signal) => {
  logger.info('shutting down', { signal });
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { server };
