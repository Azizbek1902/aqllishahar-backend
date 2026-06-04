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

const RESET_HOUR = Number(process.env.DAILY_RESET_HOUR ?? 0);
const CHECK_EVERY_MS = 60 * 1000; // har daqiqa tekshiramiz

let lastResetDay = null; // 'YYYY-MM-DD' — bir kunda ikki marta reset bo'lmasligi uchun

export async function runDailyReset() {
  // Nuqtalarni qayta o'lchashga tayyorlash
  const pts = await Point.updateMany({ status: 'done' }, { $set: { status: 'pending' } });
  // Ochiq tashriflarni yopish (kun tugadi)
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
