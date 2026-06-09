import mongoose from 'mongoose';
import crypto from 'crypto';
import { Device } from '../models/Device.js';
import { Point } from '../models/Point.js';
import { Visit } from '../models/Visit.js';
import { Reading } from '../models/Reading.js';
import { Hudud } from '../models/Hudud.js';
import { Alert } from '../models/Alert.js';
import { User } from '../models/User.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';
import { getParameterStatus } from '../utils/thresholdCheck.js';
import { distanceMeters } from '../utils/geo.js';
import { env } from '../config/env.js';

/** Timing-safe apiKey taqqoslash (timing attack'larga qarshi) */
function safeKeyEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const PARAMETERS = ['moisture', 'temperature', 'nitrogen', 'phosphorus', 'potassium', 'ph', 'ec'];

/**
 * POST /ingest
 * Mobile ilovadan kelgan reading.
 *
 * Body:
 *  {
 *    serialNumber: "DEV-001",
 *    pointId:      "<point id>",
 *    gpsLat:       40.39,
 *    gpsLng:       71.78,
 *    // qurilma fieldMap'iga mos parametrlar (yoki standart nomlar)
 *    moisture: 55.3, temperature: 24.5, ...
 *    battery: 87, signal: 92
 *  }
 *
 * Headers: `x-sensor-key: <device apiKey>`
 *
 * Validatsiya:
 *  1. apiKey to'g'rimi
 *  2. device biror ishchiga biriktirilganmi
 *  3. pointId ga tegishli hudud uchun shu ishchining active visit'i bormi
 *  4. point hali pending mi (allaqachon done bo'lmagan)
 *  5. GPS koordinata point.lat/lng dan ≤ tolerance metr
 */
export const ingest = asyncHandler(async (req, res) => {
  const apiKey = req.headers['x-sensor-key'] || req.body.apiKey;
  const { serialNumber, pointId, gpsLat, gpsLng, gpsAccuracy, battery, signal } = req.body;
  // Manba: demo (generatsiya) yoki device (real qurilma)
  const source = req.body.source === 'demo' ? 'demo' : 'device';

  if (!serialNumber || !apiKey) {
    throw new ApiError(400, 'error.missingFields', 'serialNumber and apiKey are required');
  }
  if (!pointId || !mongoose.isValidObjectId(pointId)) {
    throw new ApiError(400, 'ingest.error.invalidPoint', 'Valid pointId required');
  }
  // ANTI-FRAUD: Infinity/NaN `typeof === 'number'` dan o'tib ketadi va keyin
  // `distM > tolerance` solishtiruvi NaN bilan `false` bo'lib GPS tekshiruvi
  // jim o'tib ketardi. Shu sababli finite + real-dunyo diapazonini tekshiramiz.
  if (!Number.isFinite(gpsLat) || !Number.isFinite(gpsLng)
      || gpsLat < -90 || gpsLat > 90 || gpsLng < -180 || gpsLng > 180) {
    throw new ApiError(400, 'ingest.error.invalidGps', 'gpsLat/gpsLng must be finite and in valid range');
  }

  /* 1. Device + apiKey tekshiruvi */
  const device = await Device.findOne({ serialNumber })
    .populate('deviceModel', 'fieldMap')
    .select('+apiKey');
  if (!device)               throw new ApiError(404, 'error.deviceNotFound', `Device not found: ${serialNumber}`);
  if (!device.apiKey)        throw new ApiError(403, 'error.apiKeyNotSet', 'API key not configured');
  if (!safeKeyEquals(device.apiKey, apiKey)) throw new ApiError(401, 'error.unauthorized', 'Invalid API key');
  if (!device.assignedTo)    throw new ApiError(403, 'device.error.notAssigned',
    'Device is not assigned to any worker');
  if (!device.isActive)      throw new ApiError(403, 'device.error.inactive', 'Device is inactive');

  /* 1b. User-Device mosligi — JWT'дagi ishchи AYNAN shu qurilmaga biriktirilganmi? */
  if (device.assignedTo.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'ingest.error.notYourDevice',
      'Bu qurilma sizgа biriktirilmagan');
  }

  /* 2. Point va Hudud */
  const point = await Point.findById(pointId).populate('hudud').lean();
  if (!point) throw new ApiError(404, 'ingest.error.pointNotFound');
  if (point.status === 'done') {
    throw new ApiError(409, 'ingest.error.pointAlreadyDone',
      'Bu nuqtadan allaqachon data olingan');
  }

  /* 3. Active visit borligi */
  const visit = await Visit.findOne({
    worker: device.assignedTo,
    hudud:  point.hudud._id,
    status: 'active',
  });
  if (!visit) throw new ApiError(403, 'ingest.error.noActiveVisit',
    'Bu hududga active visit yo\'q — avval "Keldim" tugmasini bosing');

  /* 4. GPS tekshiruvi — adaptive tolerance (CAP bilan).
   * Formula: max(belgilangan_tolerance, min(gpsAccuracy, CAP))
   * Ochiq joyda GPS ±3m → 5m qattiq. Yopiq joyda GPS ±20m → 12m'da to'xtaydi (cheksiz emas). */
  const baseTolerance = point.hudud.pointToleranceM ?? env.GPS_POINT_TOLERANCE_M;
  const acc = Number(req.body.gpsAccuracy);
  const expanded = Number.isFinite(acc) ? Math.min(acc, env.GPS_POINT_TOLERANCE_MAX_M) : 0;
  const effectiveTolerance = Math.max(baseTolerance, expanded);
  const distM = distanceMeters(gpsLat, gpsLng, point.lat, point.lng);
  if (distM > effectiveTolerance) {
    throw new ApiError(403, 'ingest.error.tooFarFromPoint',
      `Nuqtadan ${distM.toFixed(1)} m uzoqdasiz (limit ${effectiveTolerance.toFixed(1)} m)`);
  }

  /* 5. fieldMap orqali parametrlarni o'qiymiz */
  const fm = device.deviceModel?.fieldMap ?? null;
  const readingData = {};
  for (const param of PARAMETERS) {
    const deviceKey = fm ? fm[param] : param;
    if (!deviceKey) continue;
    const v = req.body[deviceKey];
    // Faqat number yoki numeric string qabul qilamiz (boolean'lar va obyektlar emas)
    if ((typeof v === 'number' || typeof v === 'string') && v !== '' && !isNaN(Number(v))) {
      readingData[param] = Number(v);
    }
  }
  if (Object.keys(readingData).length === 0) {
    throw new ApiError(400, 'error.noReadings', 'No valid parameter readings provided');
  }

  /* 6. ATOMIC point update — race condition'ga qarshi.
   * Parallel ikkita ingest kelganda faqat birinchisi muvaffaq bo'ladi,
   * ikkinchisi `null` qaytaradi (status allaqachon 'done'). */
  const timestamp = new Date();
  const claimedPoint = await Point.findOneAndUpdate(
    { _id: point._id, status: 'pending' },
    { status: 'done', lastVisitedAt: timestamp },
    { new: true },
  );
  if (!claimedPoint) {
    throw new ApiError(409, 'ingest.error.pointAlreadyDone',
      'Bu nuqtadan allaqachon data olingan (parallel so\'rov)');
  }

  /* Worker viloyat — Reading.viloyat required. Worker yoki MFY orqali olamiz. */
  const worker = await User.findById(device.assignedTo).select('viloyat').lean();
  const viloyat = worker?.viloyat;
  if (!viloyat) {
    // Point.status ni qaytarib qo'yamiz (rollback)
    await Point.findByIdAndUpdate(point._id, { status: 'pending', lastVisitedAt: null });
    throw new ApiError(500, 'error.workerNoViloyat',
      'Ishchining viloyati belgilanmagan — admin sozlashi kerak');
  }

  /* Reading yozish */
  let reading;
  try {
    reading = await Reading.create({
      device:  device._id,
      point:   point._id,
      visit:   visit._id,
      worker:  device.assignedTo,
      hudud:   point.hudud._id,
      mfy:     point.hudud.mfy,
      viloyat,
      timestamp,
      gpsLat,
      gpsLng,
      gpsAccuracy: Number.isFinite(Number(gpsAccuracy)) ? Number(gpsAccuracy) : null,
      source,
      ...readingData,
    });
  } catch (err) {
    // Reading yaratish muvaffaqiyatsiz — Point ni rollback qilamiz
    await Point.findByIdAndUpdate(point._id, { status: 'pending', lastVisitedAt: null });
    throw err;
  }

  /* Point ga oxirgi reading havolasini qo'shamiz */
  await Point.findByIdAndUpdate(point._id, { lastReading: reading._id });

  /* 7. Visit yangilash — ATOMIC.
   * Parallel ikkita ingest (bir hududning turli nuqtalari) eski `visit` doc'ni
   * o'qib `save()` qilsa lost-update bo'lardi. countDocuments DB'dan haqiqiy
   * sonni oladi, findOneAndUpdate atomik yozadi (faqat hali active bo'lsa). */
  const updatedDone  = await Point.countDocuments({ hudud: point.hudud._id, status: 'done' });
  const updatedTotal = await Point.countDocuments({ hudud: point.hudud._id });
  const isCompleted  = updatedTotal > 0 && updatedDone >= updatedTotal;
  const updatedVisit = await Visit.findOneAndUpdate(
    { _id: visit._id, status: 'active' },
    {
      pointsDone:  updatedDone,
      pointsTotal: updatedTotal,
      ...(isCompleted ? { status: 'completed', completedAt: timestamp } : {}),
    },
    { new: true },
  ) ?? visit; // agar boshqa parallel so'rov allaqachon yopgan bo'lsa — eski doc

  /* 8. Device yangilash (battery/signal/lastSeen) */
  const devUpdate = { lastSeenAt: timestamp, isOnline: true };
  if (battery !== undefined && !isNaN(Number(battery))) devUpdate.battery = Math.min(100, Math.max(0, Number(battery)));
  if (signal  !== undefined && !isNaN(Number(signal)))  devUpdate.signal  = Math.min(100, Math.max(0, Number(signal)));
  await Device.findByIdAndUpdate(device._id, devUpdate);

  /* 9. Alert upsert (threshold buzilganlarda) */
  for (const [param, value] of Object.entries(readingData)) {
    const result = getParameterStatus(param, value);
    if (!result) continue;
    if (result.status === 'optimal') {
      await Alert.updateMany(
        { point: point._id, parameter: param, isRead: false },
        { $set: { isRead: true } },
      );
    } else {
      await Alert.findOneAndUpdate(
        { point: point._id, parameter: param, isRead: false },
        {
          $set: {
            point:   point._id,
            hudud:   point.hudud._id,
            mfy:     point.hudud.mfy,
            viloyat: reading.viloyat,
            device:  device._id,
            worker:  device.assignedTo,
            reading: reading._id,
            parameter: param,
            status:    result.status,
            value,
            messageKey: result.messageKey,
            isRead: false,
          },
        },
        { upsert: true, new: true },
      );
    }
  }

  res.json({
    ok: true,
    timestamp,
    received: Object.keys(readingData),
    pointStatus: 'done',
    visit: {
      id:          updatedVisit._id,
      status:      updatedVisit.status,
      pointsDone:  updatedVisit.pointsDone,
      pointsTotal: updatedVisit.pointsTotal,
    },
    // To'liq saqlangan reading — mobile darrov ko'rsатиши/tarixga qo'shishi uchun
    reading: {
      id:          reading._id,
      timestamp:   reading.timestamp,
      gpsLat:      reading.gpsLat,
      gpsLng:      reading.gpsLng,
      gpsAccuracy: reading.gpsAccuracy,
      source:      reading.source,
      moisture:    reading.moisture ?? null,
      temperature: reading.temperature ?? null,
      nitrogen:    reading.nitrogen ?? null,
      phosphorus:  reading.phosphorus ?? null,
      potassium:   reading.potassium ?? null,
      ph:          reading.ph ?? null,
      ec:          reading.ec ?? null,
    },
  });
});

