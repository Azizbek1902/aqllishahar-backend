import express from 'express';
import { authRequired } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { runSeed } from '../seed/seed.js';

const router = express.Router();

/**
 * POST /api/admin/reseed
 * DB ni to'liq tozalab qaytadan seed qilаdi (mavjud env qiymatlari bilan).
 * FAQAT admin.
 *
 * Ishlatish (admin sifatида web'da login bo'lgandan keyin DevTools console'da):
 *   fetch('/api/admin/reseed', {
 *     method:'POST',
 *     headers:{Authorization:'Bearer '+localStorage.getItem('token')}
 *   }).then(r=>r.json()).then(console.log)
 */
router.post('/reseed', authRequired, requireRole('admin'), async (req, res) => {
  // Uzoq vaqt ketishi mumkin — request timeout'ni katta qilamiz
  req.setTimeout(180000);
  res.setTimeout(180000);
  try {
    const t0 = Date.now();
    await runSeed({ skipConnect: true });
    const dt = Date.now() - t0;
    res.json({ ok: true, durationMs: dt, message: 'Seed tugadi' });
  } catch (e) {
    console.error('Reseed error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
