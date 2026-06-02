import { Router } from 'express';
import * as ctrl from '../controllers/visit.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authRequired } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authRequired);

router.get('/my',       ctrl.myAssignments);   // ishchi: o'z hududlari
router.get('/active',   ctrl.getActive);       // ishchi: active visit
router.post('/start',   validate(ctrl.startVisitSchema), ctrl.start);  // ishchi: "Keldim"
router.post('/:id/cancel', ctrl.cancel);
router.get('/',         ctrl.list);            // admin: tarix

export default router;
