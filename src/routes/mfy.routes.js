import { Router } from 'express';
import * as ctrl from '../controllers/mfy.controller.js';
import { authRequired } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authRequired);

router.get('/',         ctrl.list);
router.get('/geojson',  ctrl.geojson);
router.get('/:id',      ctrl.get);

export default router;
