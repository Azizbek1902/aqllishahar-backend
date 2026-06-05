import './config/mongoose-plugin.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { app } from './app.js';
import { startOfflineChecker } from './jobs/offlineChecker.js';
import { startDailyReset } from './jobs/dailyReset.js';

async function start() {
  await connectDB();
  // Bir martalik index migratsiyasi: eski {worker:1} unique index'ni o'chiramiz
  // (yangi {worker+hudud:1} unique multi-visit'ni qo'llab-quvvatlaydi).
  try {
    const mongoose = (await import('mongoose')).default;
    const idx = await mongoose.connection.db.collection('visits').indexes();
    for (const i of idx) {
      if (i.name !== '_id_' && i.key && Object.keys(i.key).length === 1 && i.key.worker === 1 && i.unique) {
        console.log('[migration] eski Visit indeksini o\'chiramiz:', i.name);
        await mongoose.connection.db.collection('visits').dropIndex(i.name);
      }
    }
    // Yangi indexlarni yaratish
    const { Visit } = await import('./models/Visit.js');
    await Visit.syncIndexes();
  } catch (e) {
    console.warn('[migration] xato (e\'tiborsiz qoldirish mumkin):', e.message);
  }
  // Explicit '0.0.0.0' — Windows'da IPv4 + IPv6 ikkalasiga ham
  // bog'lanishni kafolatlaydi (LAN'dan telefon kira oladi)
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`✓ Server: http://0.0.0.0:${env.PORT}`);
    console.log(`  Env: ${env.NODE_ENV}`);
  });
  startOfflineChecker();
  startDailyReset();
}

start();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
