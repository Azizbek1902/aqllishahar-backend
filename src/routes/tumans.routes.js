import { Router } from 'express';
import * as ctrl from '../controllers/tumans.controller.js';
import { authRequired } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authRequired);

router.get('/',        ctrl.list);
router.get('/:id',     ctrl.get);
router.post('/',       ctrl.create);
router.put('/:id',     ctrl.update);
router.delete('/:id',  ctrl.remove);

export default router;
