import './config/mongoose-plugin.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { app } from './app.js';
import { startOfflineChecker } from './jobs/offlineChecker.js';

async function start() {
  await connectDB();
  // Explicit '0.0.0.0' — Windows'da IPv4 + IPv6 ikkalasiga ham
  // bog'lanishni kafolatlaydi (LAN'dan telefon kira oladi)
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`✓ Server: http://0.0.0.0:${env.PORT}`);
    console.log(`  Env: ${env.NODE_ENV}`);
  });
  startOfflineChecker();
}

start();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
