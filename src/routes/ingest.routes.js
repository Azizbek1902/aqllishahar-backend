import { Router } from 'express';
import { ingest } from '../controllers/ingest.controller.js';
import { authRequired } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

/**
 * POST /ingest — sensor data qabul qilish.
 * Avval ishchи JWT bilan login bo'lishi shart (mobile orqali).
 * Device apiKey + JWT user-device mosligi kontrolerда tekshiriladi.
 */
router.post('/', authRequired, requireRole('ishchi'), ingest);

export default router;
