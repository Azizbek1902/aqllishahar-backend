import { Router } from 'express';
import * as ctrl from '../controllers/workers.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authRequired } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();
router.use(authRequired);

// Admin va rahbar ko'rishi mumkin (read), faqat admin yarata/o'chira oladi
router.get('/',    ctrl.list);
router.get('/:id', ctrl.get);
router.post('/',     requireRole('admin'), validate(ctrl.createWorkerSchema), ctrl.create);
router.put('/:id',   requireRole('admin'), validate(ctrl.updateWorkerSchema), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

export default router;
