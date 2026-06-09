import { Router } from 'express';
import * as ctrl from '../controllers/readings.controller.js';
import { authRequired } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authRequired);

router.get('/my',             ctrl.myReadings);     // ishchi o'z tarixi
router.get('/points-latest',  ctrl.pointsLatest);   // xarita: nuqtalar + oxirgi reading
router.get('/point/:pointId', ctrl.pointHistory);
router.get('/hudud/:hududId', ctrl.hududHistory);
router.get('/aggregate',      ctrl.aggregate);

export default router;
