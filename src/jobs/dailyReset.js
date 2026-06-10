import { Point } from '../models/Point.js';
import { Visit } from '../models/Visit.js';

/**
 * Kunlik reset — har kuni belgilangan soatda (default 00:00, "ertalab 12")
 * barcha nuqtalarni qayta o'lchashga tayyorlaydi:
 *   - Point.status: 'done' → 'pending'  (qayta data olinadi)
 *   - Ochiq (active) tashriflar yopiladi (yangi kun, yangi tashrif)
 *
 * Reading'lar (o'lchov tarixi) SAQLANADI — admin/rahbar trendni ko'radi.
 * Point.lastReading ham saqlanadi (yangi o'lchov olinguncha oxirgi qiymat ko'rinadi).
 *
 * Soat .env orqali sozlanadi: DAILY_RESET_HOUR (0-23). Default 0 = yarim tun.
 */

// O'zbekiston UTC+5 (DST yo'q). Reset O'zbekiston yarim tunida bo'lishi kerak.
const UZ_OFFSET_MS = 5 * 60 * 60 * 1000;
// Render UTC. Default 19:00 UTC = O'zbekistonda 00:00 (yarim tun).
const RESET_HOUR = Number(process.env.DAILY_RESET_HOUR ?? 19);
const CHECK_EVERY_MS = 60 * 1000; // har daqiqa tekshiramiz

let lastResetDay = null; // 'YYYY-MM-DD' — bir kunda ikki marta reset bo'lmasligi uchun

/** O'zbekiston bo'yicha bugungi kun boshlanishi — UTC instant sifatida. */
export function startOfTodayUz() {
  const uzNow = new Date(Date.now() + UZ_OFFSET_MS);
  const uzMidnight = Date.UTC(uzNow.getUTCFullYear(), uzNow.getUTCMonth(), uzNow.getUTCDate(), 0, 0, 0, 0);
  return new Date(uzMidnight - UZ_OFFSET_MS);
}

/**
 * LAZY RESET — eski (kecha va undan oldin o'lchangan) nuqtalarni 'pending' qiladi.
 * Cron'ga tayanmaydi: ishchi ilovani ochganda chaqiriladi → Render uxlasa ham ishlaydi.
 * Faqat lastVisitedAt bugundan oldin bo'lganlar (O'zbekiston vaqti) reset bo'ladi.
 */
export async function resetStalePoints(filter = {}) {
  const since = startOfTodayUz();
  const res = await Point.updateMany(
    { ...filter, status: 'done', lastVisitedAt: { $ne: null, $lt: since } },
    { $set: { status: 'pending' } },
  );
  return res.modifiedCount;
}

/** TO'LIQ RESET — barcha 'done' nuqtalarni 'pending' (yarim tun cron / qo'lda). */
export async function runDailyReset() {
  const pts = await Point.updateMany({ status: 'done' }, { $set: { status: 'pending' } });
  const vis = await Visit.updateMany(
    { status: 'active' },
    { $set: { status: 'completed', completedAt: new Date() } },
  );
  console.log(`[dailyReset] ${pts.modifiedCount} nuqta → pending, ${vis.modifiedCount} tashrif yopildi`);
  return pts.modifiedCount;
}

function tick() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  // Belgilangan soatga yetdi va bugun hali reset qilinmagan bo'lsa
  if (now.getHours() === RESET_HOUR && lastResetDay !== today) {
    lastResetDay = today;
    runDailyReset().catch((err) => console.error('[dailyReset] error:', err.message));
  }
}

export function startDailyReset() {
  setInterval(tick, CHECK_EVERY_MS);
  console.log(`[dailyReset] started — har kuni soat ${RESET_HOUR}:00 da nuqtalar qayta o'lchashga tayyorlanadi`);
}
