import { Router } from 'express';
import * as ctrl from '../controllers/users.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authRequired } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authRequired, requireRole('admin'));
router.get('/', ctrl.list);
router.post('/', validate(ctrl.createUserSchema), ctrl.create);
router.put('/:id', validate(ctrl.updateUserSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
