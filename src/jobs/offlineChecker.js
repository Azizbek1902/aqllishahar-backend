import { Device } from '../models/Device.js';

/**
 * Uzoq vaqt data jo'natmagan qurilmalarni offline ga belgilaydi.
 *
 * Yangi sxema: Device portativ — ishchi orasida ham offline turaverishi mumkin
 * (faqat tashrif paytida data jo'natadi). Shuning uchun tolerance ancha katta:
 *   - Ishchi har kuni ishlaydi deb 2 soat sukunatdan keyin offline qilamiz
 *   - Bu admin paneldagi vizual ko'rsatkich uchun
 */

const OFFLINE_AFTER_MS = 2 * 60 * 60 * 1000; // 2 soat
const CHECK_EVERY_MS = 60 * 1000;

export async function runOfflineCheck() {
  const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS);

  const result = await Device.updateMany(
    { isOnline: true, lastSeenAt: { $lt: cutoff } },
    { isOnline: false },
  );

  if (result.modifiedCount > 0) {
    console.log(`[offlineChecker] ${result.modifiedCount} qurilma → offline`);
  }

  return result.modifiedCount;
}

export function startOfflineChecker() {
  setTimeout(() => {
    runOfflineCheck().catch((err) => console.error('[offlineChecker] error:', err.message));
    setInterval(() => {
      runOfflineCheck().catch((err) => console.error('[offlineChecker] error:', err.message));
    }, CHECK_EVERY_MS);
  }, 10_000);
  console.log('[offlineChecker] started — every 60s (offline after 2h silence)');
}
