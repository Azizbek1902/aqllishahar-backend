import { Router } from 'express';
import * as ctrl from '../controllers/alerts.controller.js';
import { authRequired } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authRequired);

router.get('/', ctrl.list);
router.patch('/:id/read', ctrl.markRead);
router.patch('/read-all', ctrl.markAllRead);

export default router;
