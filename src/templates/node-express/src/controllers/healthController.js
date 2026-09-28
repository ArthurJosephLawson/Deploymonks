import config from '../config/index.js';

const startedAt = new Date();

export const getHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    project: config.projectName,
    version: config.version,
    uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
    timestamp: new Date().toISOString(),
  });
};

export const getInfo = (req, res) => {
  res.status(200).json({
    project: config.projectName,
    author: config.author,
    env: config.env,
    port: config.port,
  });
};

export default { getHealth, getInfo };
