import { Router } from 'express';
import * as ctrl from '../controllers/deviceModels.controller.js';
import { authRequired } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();
router.use(authRequired);

router.get('/',     ctrl.list);
router.get('/:id',  ctrl.getOne);
router.post('/',    requireRole('admin'), ctrl.create);
router.put('/:id',  requireRole('admin'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

export default router;
