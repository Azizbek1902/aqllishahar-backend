import { Router } from 'express';
import * as ctrl from '../controllers/dashboard.controller.js';
import { authRequired } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authRequired);

router.get('/summary',  ctrl.summary);
router.get('/hududs',   ctrl.hududsOverview);
router.get('/mfy',      ctrl.mfyOverview);

export default router;
