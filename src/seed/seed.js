/**
 * Yangi sxema seed:
 *   1. DB to'liq tozalanadi
 *   2. Viloyat (Farg'ona), Tumanlar
 *   3. MFY'lar — fergana-mahallas.geojson dan import (74 ta)
 *   4. DeviceModel'lar (4 ta)
 *   5. User'lar: admin, rahbar, 2 ishchi
 *   6. Device'lar (2 ta, ishchilarga biriktirilgan)
 *   7. Hudud'lar (3 ta, har biriga avto-Point lar)
 *
 * Reading yo'q — mobile orqali to'planadi.
 *
 * Ishga tushirish:
 *   npm run seed
 */
import '../config/mongoose-plugin.js';
import { connectDB } from '../config/db.js';
import { Viloyat } from '../models/Viloyat.js';
import { Tuman } from '../models/Tuman.js';
import { MFY } from '../models/MFY.js';
import { Hudud } from '../models/Hudud.js';
import { Point } from '../models/Point.js';
import { Visit } from '../models/Visit.js';
import { Device } from '../models/Device.js';
import { DeviceModel } from '../models/DeviceModel.js';
import { User } from '../models/User.js';
import { Reading } from '../models/Reading.js';
import { Alert } from '../models/Alert.js';
import { Log } from '../models/Log.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cyrillicToLatin, slugify } from '../utils/translit.js';
import {
  polygonAreaM2, polygonCenter, metersToLatDeg, metersToLngDeg,
} from '../utils/geo.js';
import { generatePoints, recommendedPointCount } from '../utils/poissonDisk.js';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* ── Konstantalar ──────────────────────────────────────────────────────── */

const FARGONA_TUMANLAR = [
  { nameUz: "Farg'ona shahri",     nameRu: 'г. Фергана',           nameEn: 'Fergana City'        },
  { nameUz: "Farg'ona tumani",     nameRu: 'Ферганский район',     nameEn: 'Fergana District'    },
  { nameUz: "Bag'dod tumani",      nameRu: 'Багдадский район',     nameEn: 'Bagdod District'     },
  { nameUz: 'Beshariq tumani',     nameRu: 'Бешарыкский район',    nameEn: 'Beshariq District'   },
  { nameUz: "Buvayda tumani",      nameRu: 'Бувайдинский район',   nameEn: 'Buvayda District'    },
  { nameUz: "Dang'ara tumani",     nameRu: 'Дангаринский район',   nameEn: "Dang'ara District"   },
  { nameUz: 'Furqat tumani',       nameRu: 'Фуркатский район',     nameEn: 'Furqat District'     },
  { nameUz: 'Oltiariq tumani',     nameRu: 'Алтыарыкский район',   nameEn: 'Oltiariq District'   },
  { nameUz: "O'zbekiston tumani",  nameRu: 'Узбекистанский район', nameEn: 'Uzbekiston District' },
  { nameUz: "Qo'shtepa tumani",    nameRu: 'Куштепинский район',   nameEn: "Qo'shtepa District"  },
  { nameUz: 'Rishton tumani',      nameRu: 'Риштанский район',     nameEn: 'Rishtan District'    },
  { nameUz: "So'x tumani",         nameRu: 'Сохский район',        nameEn: "So'x District"       },
  { nameUz: 'Toshloq tumani',      nameRu: 'Ташлакский район',     nameEn: 'Toshloq District'    },
  { nameUz: "Uchko'prik tumani",   nameRu: 'Учкупрыкский район',   nameEn: "Uchko'prik District" },
  { nameUz: 'Yozyovon tumani',     nameRu: 'Язъяванский район',    nameEn: 'Yozyovon District'   },
];

/** MFY rangini index bo'yicha aniqlash (xaritada turli MFY larni ajratish uchun) */
const COLOR_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#a855f7',
];

const DEVICE_MODELS_SEED = [
  {
    name: 'SoilMaster Pro X1',
    description: 'Professional tuproq sensori — standart field nomlari',
    expectedIntervalSec: 60,
    fieldMap: { moisture: 'moisture', temperature: 'temperature', nitrogen: 'nitrogen', phosphorus: 'phosphorus', potassium: 'potassium', ph: 'ph', ec: 'ec' },
  },
  {
    name: 'AgriSense 5000',
    description: 'Qishloq xo\'jaligi datchigi — boshqacha kalit nomlari',
    expectedIntervalSec: 300,
    fieldMap: { moisture: 'soil_moisture', temperature: 'soil_temp', nitrogen: 'N', phosphorus: 'P', potassium: 'K', ph: 'pH_val', ec: 'ec_val' },
  },
  {
    name: 'EcoSoil V3',
    description: 'Ekonomik model — alohida kalit nomlari',
    expectedIntervalSec: 600,
    fieldMap: { moisture: 'water_pct', temperature: 'temp_c', nitrogen: 'n_mg', phosphorus: 'p_mg', potassium: 'k_mg', ph: 'ph', ec: 'ec' },
  },
  {
    name: 'TerraScan 7',
    description: 'Faqat moisture + temperature + pH qo\'llaydi',
    expectedIntervalSec: 180,
    fieldMap: { moisture: 'moisture', temperature: 'temperature', nitrogen: '', phosphorus: '', potassium: '', ph: 'ph', ec: '' },
  },
];

const USERS_SEED = [
  { username: 'admin',   fullName: 'Admin Adminov',         email: 'admin@admin.uz',     password: 'admin123',   role: 'admin'  },
  { username: 'rahbar',  fullName: "Rahbar Rahbarov",       email: 'rahbar@rahbar.uz',   password: 'rahbar123',  role: 'rahbar' },
  { username: 'ishchi1', fullName: 'Aliyev Vali',           email: null,                 password: 'ishchi123',  role: 'ishchi', phone: '+998901234567' },
  { username: 'ishchi2', fullName: 'Karimov Bekzod',        email: null,                 password: 'ishchi123',  role: 'ishchi', phone: '+998901234568' },
];

/* ── Yordamchi: MFY ichida random rectangular hudud polygon ────────────── */
function generateHududPolygonInside(mfy, halfSizeM = 30) {
  const { lat, lng } = mfy.center;
  const dLat = metersToLatDeg(halfSizeM);
  const dLng = metersToLngDeg(halfSizeM, lat);
  // Soat strelkasi yo'nalishida 5 nuqtali yopiq polygon
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ]],
  };
}

/* ── Asosiy seed funktsiyasi ───────────────────────────────────────────── */
// Eksport — admin seed endpoint orqali ham chaqirilishi uchun
export async function runSeed({ skipConnect = false } = {}) {
  return runInternal({ skipConnect });
}

async function run() {
  return runInternal({ skipConnect: false });
}

async function runInternal({ skipConnect }) {
  if (!skipConnect) await connectDB();
  console.log('✓ MongoDB ulanish OK\n');

  console.log('🗑  Eski DB to\'liq tozalanyapti (kolleksiyalar + indekslar)...');
  await mongoose.connection.dropDatabase();
  // Yangi schema indekslarini majburan yaratamiz
  await Promise.all([
    Viloyat.init(), Tuman.init(), MFY.init(), Hudud.init(), Point.init(), Visit.init(),
    Device.init(), DeviceModel.init(), User.init(), Reading.init(), Alert.init(), Log.init(),
  ]);
  console.log('  ✓ Tozalandi va yangi indekslar yaratildi\n');

  // 1. Viloyat
  console.log("📍 Viloyat: Farg'ona");
  const fargona = await Viloyat.create({
    code: 'fargona', nameUz: "Farg'ona", nameRu: 'Фергана', nameEn: 'Fergana',
    centerLat: 40.3894, centerLng: 71.7867,
  });
  console.log(`  ✓ ${fargona.nameUz}\n`);

  // 2. Tumanlar
  console.log(`🏘  Tumanlar (${FARGONA_TUMANLAR.length} ta)`);
  const tumans = await Tuman.insertMany(
    FARGONA_TUMANLAR.map((t) => ({ ...t, viloyat: fargona._id })),
  );
  console.log(`  ✓ ${tumans.length} tuman\n`);

  // 3. MFY (geojson dan)
  console.log('🗺  MFY larni geojson dan import qilish...');
  const geojsonPath = path.join(__dirname, 'data', 'fergana-mahallas.geojson');
  const fc = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  const mfyDocs = [];
  const usedCodes = new Set();
  for (let i = 0; i < fc.features.length; i++) {
    const f = fc.features[i];
    const cyrName = f.properties.name?.trim() || `MFY ${i + 1}`;
    const latName = cyrillicToLatin(cyrName).trim();
    let baseCode = slugify(cyrName) || `mfy-${i + 1}`;
    // Duplicate'ga qarshi: suffix qo'shamiz
    let code = baseCode;
    let n = 2;
    while (usedCodes.has(code)) {
      code = `${baseCode}-${n++}`;
    }
    usedCodes.add(code);
    const polygon = f.geometry;
    const center = polygonCenter(polygon);
    mfyDocs.push({
      nameUz: latName,
      nameRu: cyrName,
      nameEn: latName,
      code,
      tuman: null, // admin keyin biriktirishi mumkin
      color: COLOR_PALETTE[i % COLOR_PALETTE.length],
      polygon,
      center,
    });
  }
  const mfys = await MFY.insertMany(mfyDocs);
  console.log(`  ✓ ${mfys.length} MFY import qilindi\n`);

  // 4. DeviceModel
  console.log(`📱 DeviceModel'lar (${DEVICE_MODELS_SEED.length} ta)`);
  const deviceModels = await DeviceModel.insertMany(DEVICE_MODELS_SEED);
  console.log(`  ✓ ${deviceModels.length} model\n`);

  // 5. Userlar
  console.log(`👤 User'lar (${USERS_SEED.length} ta)`);
  const users = {};
  for (const u of USERS_SEED) {
    const payload = {
      username: u.username,
      fullName: u.fullName,
      role:     u.role,
      phone:    u.phone || '',
      viloyat:  u.role === 'admin' ? null : fargona._id,
    };
    // Email faqat berilgan bo'lsa qo'shamiz (ishchi'larda yo'q — sparse index uchun)
    if (u.email) payload.email = u.email;
    const doc = new User(payload);
    await doc.setPassword(u.password);
    await doc.save();
    users[u.username] = doc;
    console.log(`  + ${u.role.padEnd(7)} ${u.username.padEnd(10)} (parol: ${u.password})`);
  }
  console.log('');

  // 6. Devices (har ishchiga 1 ta)
  console.log('📡 Device\'lar');
  const dev1 = await Device.create({
    serialNumber: 'DEV-00001',
    apiKey: crypto.randomBytes(32).toString('hex'),
    model:       deviceModels[0].name,
    deviceModel: deviceModels[0]._id,
    assignedTo:  users.ishchi1._id,
  });
  const dev2 = await Device.create({
    serialNumber: 'DEV-00002',
    apiKey: crypto.randomBytes(32).toString('hex'),
    model:       deviceModels[1].name,
    deviceModel: deviceModels[1]._id,
    assignedTo:  users.ishchi2._id,
  });
  console.log(`  + ${dev1.serialNumber} → ishchi1`);
  console.log(`  + ${dev2.serialNumber} → ishchi2\n`);

  // 7. Hudud'lar — 3 ta random MFY ichida, har biriga auto-Point
  console.log("🟩 Hudud'lar va Point'lar");
  const pickedMfys = pickRandom(mfys, 3);
  const hududCategories = ['garden', 'park', 'field'];
  const hududNames = [
    { nameUz: "Markaziy bog'",        nameRu: 'Центральный парк',   nameEn: 'Central Garden' },
    { nameUz: "Yoshlar maydoni",      nameRu: 'Молодёжная площадь', nameEn: 'Youth Square'   },
    { nameUz: "Suv havzasi atrofi",   nameRu: 'У водоёма',          nameEn: 'Near Reservoir' },
  ];

  const createdHududs = [];
  for (let i = 0; i < pickedMfys.length; i++) {
    const mfy = pickedMfys[i];
    const polygon = generateHududPolygonInside(mfy, 35); // ~70x70 m kvadrat
    const area = polygonAreaM2(polygon);
    const center = polygonCenter(polygon);

    const hudud = await Hudud.create({
      ...hududNames[i],
      mfy: mfy._id,
      category: hududCategories[i],
      polygon,
      center,
      areaM2: Math.round(area),
      createdBy: users.admin._id,
    });

    // Avto-nuqtalar
    const maxPts = recommendedPointCount(area, env.POINT_DENSITY_PER_SQM);
    const pts = generatePoints(polygon, {
      minDistM: env.POINT_MIN_SPACING_M,
      maxPoints: maxPts,
    });
    await Point.insertMany(pts.map((p, j) => ({
      hudud: hudud._id,
      lat:   p.lat,
      lng:   p.lng,
      order: j + 1,
    })));

    createdHududs.push(hudud);
    console.log(`  + ${hudud.nameUz}  → MFY: ${mfy.nameUz}  (~${Math.round(area)} m², ${pts.length} nuqta)`);
  }
  console.log('');

  // 8. Ishchilarga hududlarni biriktirish
  console.log('🔗 Hududlarni ishchilarga biriktirish');
  users.ishchi1.assignedHududs = [createdHududs[0]._id, createdHududs[1]._id];
  await users.ishchi1.save();
  users.ishchi2.assignedHududs = [createdHududs[2]._id];
  await users.ishchi2.save();
  console.log(`  + ishchi1 → 2 hudud`);
  console.log(`  + ishchi2 → 1 hudud\n`);

  console.log('═══════════════════════════════════════════');
  console.log('✓ SEED TUGADI');
  console.log('═══════════════════════════════════════════');
  console.log(`  Viloyat:       1`);
  console.log(`  Tumanlar:      ${tumans.length}`);
  console.log(`  MFY:           ${mfys.length}`);
  console.log(`  DeviceModel:   ${deviceModels.length}`);
  console.log(`  User:          ${USERS_SEED.length}`);
  console.log(`  Device:        2`);
  console.log(`  Hudud:         ${createdHududs.length}`);
  console.log(`  Point (jami):  ${await Point.countDocuments()}`);
  console.log('');
  console.log('Login:');
  console.log("  admin   / admin123     (web)");
  console.log("  rahbar  / rahbar123    (web)");
  console.log("  ishchi1 / ishchi123    (mobile)");
  console.log("  ishchi2 / ishchi123    (mobile)");
  console.log('═══════════════════════════════════════════\n');

  // Endpoint orqali chaqirilsa — disconnect/exit qilmaymiz (server ishlashda davom etadi)
  if (!skipConnect) {
    await mongoose.disconnect();
    process.exit(0);
  }
  return { hududs: createdHududs.length, points: await Point.countDocuments() };
}

function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

// MUHIM: top-level run() FAQAT fayl to'g'ridan-to'g'ri ishga tushganda (`npm run seed`)
// bajariladi. Boshqa modul (masalan admin.routes.js) bu faylni import qilsa,
// run() ishlamaydi — aks holda server boot'da DB tozalanib process.exit bo'lardi
// va Render deploy fail bo'lardi.
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  run().catch((err) => {
    console.error('SEED XATO:', err);
    process.exit(1);
  });
}
