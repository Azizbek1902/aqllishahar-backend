import { Router } from 'express';
import { ingest } from '../controllers/ingest.controller.js';

const router = Router();

router.post('/', ingest);

export default router;
