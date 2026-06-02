import { Router } from 'express';
import * as ctrl from '../controllers/viloyatlar.controller.js';
import { authRequired } from '../middleware/auth.middleware.js';

const router = Router();
router.get('/', authRequired, ctrl.list);
export default router;
