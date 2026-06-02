import { Router } from 'express';
import * as ctrl from '../controllers/hudud.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authRequired } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();
router.use(authRequired);

router.get('/',    ctrl.list);
router.get('/:id', ctrl.get);
router.post('/',                 requireRole('admin'), validate(ctrl.createHududSchema), ctrl.create);
router.put('/:id',               requireRole('admin'), validate(ctrl.updateHududSchema), ctrl.update);
router.delete('/:id',            requireRole('admin'), ctrl.remove);
router.post('/:id/reset-points', requireRole('admin'), ctrl.resetPoints);

export default router;
