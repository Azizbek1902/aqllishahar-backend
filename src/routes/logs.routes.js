import { Router } from 'express';
import * as ctrl from '../controllers/logs.controller.js';
import { authRequired } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();
router.get('/', authRequired, requireRole('admin'), ctrl.list);
export default router;
