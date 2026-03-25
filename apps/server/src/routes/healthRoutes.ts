import { Router } from 'express';

const BUILD_SHA = process.env.BUILD_SHA || 'dev';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: BUILD_SHA,
    timestamp: new Date().toISOString(),
  });
});

export default router;
