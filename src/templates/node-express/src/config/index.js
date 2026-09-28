import 'dotenv/config';

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const toBool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
};

export const config = Object.freeze({
  projectName: '{{PROJECT_NAME}}',
  author: '{{AUTHOR_NAME}}',
  version: '0.1.0',
  env: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '127.0.0.1',
  port: toInt(process.env.PORT, {{DEFAULT_PORT}}),
  logRequests: toBool(process.env.LOG_REQUESTS, true),
});

export default config;
