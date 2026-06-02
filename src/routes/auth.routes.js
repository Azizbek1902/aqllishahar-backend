import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authRequired } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', validate(ctrl.loginSchema), ctrl.login);
router.get('/me', authRequired, ctrl.me);

export default router;
