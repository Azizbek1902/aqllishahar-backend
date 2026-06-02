import { Router } from 'express';
import * as ctrl from '../controllers/devices.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authRequired } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();
router.use(authRequired);

router.get('/my',  ctrl.myDevice);             // ishchi: o'z qurilmasi
router.get('/',    ctrl.list);
router.get('/:id', ctrl.get);
router.post('/',                  requireRole('admin'), validate(ctrl.createDeviceSchema), ctrl.create);
router.put('/:id',                requireRole('admin'), validate(ctrl.updateDeviceSchema), ctrl.update);
router.delete('/:id',             requireRole('admin'), ctrl.remove);
router.post('/:id/regenerate-key', requireRole('admin'), ctrl.regenerateApiKey);

export default router;
