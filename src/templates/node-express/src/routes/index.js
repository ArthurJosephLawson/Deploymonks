import { Router } from 'express';

import { getInfo } from '../controllers/healthController.js';
import healthRoutes from './healthRoutes.js';

const router = Router();

router.get('/', (req, res) => {
  res.status(200).json({
    project: '{{PROJECT_NAME}}',
    message: 'Scaffolded by DeployMonk',
    docs: '/api/health',
  });
});

router.get('/api/info', getInfo);
router.use('/api', healthRoutes);

export default router;
