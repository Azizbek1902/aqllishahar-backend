import { Router } from 'express';
import * as ctrl from '../controllers/points.controller.js';
import { authRequired } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authRequired);

router.post('/:id/relocate', ctrl.relocate);

export default router;
