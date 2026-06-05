import mongoose from 'mongoose';
import { Point } from '../models/Point.js';
import { Hudud } from '../models/Hudud.js';
import { Visit } from '../models/Visit.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';
import { pointInPolygon, polygonBbox, distanceMeters } from '../utils/geo.js';
import { env } from '../config/env.js';
import { serialize } from '../utils/serialize.js';

const MIN_RELOCATE_SPACING_M = 5;  // yangi nuqta eski nuqtalardan kamida shu masofa
const MAX_RELOCATE_ATTEMPTS = 100; // hudud kichik bo'lsa ham urinish chegarasi

/**
 * POST /api/points/:id/relocate
 * Ishchi nuqtani qayta joylashtiradi (suv/daraxt ustida bo'lsa).
 *
 * Yangi joy:
 *   - Hudud polygon ichida
 *   - Boshqa nuqtalardan ≥ MIN_RELOCATE_SPACING_M
 *   - Eski joyidan kamida 5m uzoq (xuddi shu joyga qaytarmasin)
 *   - Random (uniform) — fraud'ga qarshi maxsus algoritm shart emas
 *
 * Ruxsat: ishchi bo'lsa va shu hudud uchun active visit bo'lsa.
 */
export const relocate = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ishchi') throw new ApiError(403, 'error.forbidden');
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'error.notFound');

  const point = await Point.findById(id).populate('hudud');
  if (!point) throw new ApiError(404, 'error.notFound');
  if (point.status === 'done') {
    throw new ApiError(400, 'point.error.alreadyDone', "Bu nuqtadan allaqachon data olingan");
  }

  // Worker shu hududga biriktirilganmi + active visit bormi?
  const activeVisit = await Visit.findOne({
    worker: req.user._id, hudud: point.hudud._id, status: 'active',
  }).lean();
  if (!activeVisit) {
    throw new ApiError(403, 'point.error.noActiveVisit',
      "Bu hudud uchun ochiq tashrif yo'q — avval 'Keldim' bosing");
  }

  // Hudud ichida random nuqta tanlash
  const polygon = point.hudud.polygon;
  const bbox = polygonBbox(polygon);
  const others = await Point.find({
    hudud: point.hudud._id,
    _id: { $ne: point._id },
  }).select('lat lng').lean();

  const tooClose = (lat, lng) => {
    if (distanceMeters(lat, lng, point.lat, point.lng) < MIN_RELOCATE_SPACING_M) return true;
    for (const o of others) {
      if (distanceMeters(lat, lng, o.lat, o.lng) < MIN_RELOCATE_SPACING_M) return true;
    }
    return false;
  };

  let newLat = null, newLng = null;
  for (let i = 0; i < MAX_RELOCATE_ATTEMPTS; i++) {
    const lat = bbox.minLat + Math.random() * (bbox.maxLat - bbox.minLat);
    const lng = bbox.minLng + Math.random() * (bbox.maxLng - bbox.minLng);
    if (!pointInPolygon(lat, lng, polygon)) continue;
    if (tooClose(lat, lng)) continue;
    newLat = lat; newLng = lng;
    break;
  }
  if (newLat == null) {
    throw new ApiError(409, 'point.error.noSpaceAvailable',
      "Hududda joy topilmadi — barcha qulay joylar band yoki hudud juda kichik");
  }

  point.lat = newLat;
  point.lng = newLng;
  await point.save();

  res.json({ point: serialize(point.toObject()) });
});
