import Joi from 'joi';
import mongoose from 'mongoose';
import { Visit } from '../models/Visit.js';
import { Hudud } from '../models/Hudud.js';
import { Point } from '../models/Point.js';
import { User } from '../models/User.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';
import { distanceMeters, pointInPolygon } from '../utils/geo.js';
import { env } from '../config/env.js';
import { serialize } from '../utils/serialize.js';

/**
 * Visit — ishchining hududga tashrifi.
 * Bu controller faqat ishchi rolida ishlatiladi.
 */

export const startVisitSchema = Joi.object({
  hududId:     Joi.string().hex().length(24).required(),
  lat:         Joi.number().required(),
  lng:         Joi.number().required(),
  gpsAccuracy: Joi.number().min(0).max(200).optional(),
});

/** GET /api/visits/my — ishchining biriktirilgan hududlari + active visit */
export const myAssignments = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ishchi') throw new ApiError(403, 'error.forbidden');

  // Biriktirilgan hududlar (foydalanuvchi modelida `assignedHududs` massivi)
  const me = await User.findById(req.user._id).populate({
    path: 'assignedHududs',
    populate: { path: 'mfy', select: 'nameUz nameRu nameEn code' },
  }).lean();
  const hududs = me?.assignedHududs ?? [];

  // Har bir hudud uchun nuqta statistikasi
  const ids = hududs.map((h) => h._id);
  const pointStats = await Point.aggregate([
    { $match: { hudud: { $in: ids } } },
    { $group: { _id: { hudud: '$hudud', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const byHudud = new Map();
  for (const ps of pointStats) {
    const id = ps._id.hudud.toString();
    const entry = byHudud.get(id) ?? { pending: 0, done: 0 };
    entry[ps._id.status] = ps.count;
    byHudud.set(id, entry);
  }
  const enriched = hududs.map((h) => ({
    ...h,
    points: byHudud.get(h._id.toString()) ?? { pending: 0, done: 0 },
  }));

  // Active visit (agar bor bo'lsa)
  const activeVisit = await Visit.findOne({ worker: req.user._id, status: 'active' })
    .populate({ path: 'hudud', populate: { path: 'mfy' } })
    .lean();

  res.json({
    hududs: serialize(enriched),
    activeVisit: serialize(activeVisit),
    config: {
      pointToleranceM: env.GPS_POINT_TOLERANCE_M,
      hududToleranceM: env.GPS_HUDUD_TOLERANCE_M,
    },
  });
});

/**
 * POST /api/visits/start — "Keldim" bosilganda.
 *  - GPS ni tekshirib, hudud chegarasidan ≤ hududToleranceM ekanligiga ishonch hosil qilamiz
 *  - Ishchi bir paytda bir necha active visit'ga ega bo'lishi mumkin (har xil hudud uchun).
 *    Faqat bir hudud uchun 2 ta active visit yo'q (eski qaytaradi).
 */
export const start = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ishchi') throw new ApiError(403, 'error.forbidden');

  const { hududId, lat, lng, gpsAccuracy } = req.body;
  if (!mongoose.isValidObjectId(hududId)) throw new ApiError(404, 'error.notFound');

  // Ishchi shu hududga biriktirilganmi?
  const me = await User.findById(req.user._id).select('assignedHududs').lean();
  const allowed = (me?.assignedHududs ?? []).some((id) => id.toString() === hududId);
  if (!allowed) throw new ApiError(403, 'visit.error.notAssigned', "Bu hudud sizga biriktirilmagan");

  // Aynan SHU hudud uchun active visit bormi? — bo'lsa eskisini qaytaramiz (yangi yaratmaymiz)
  const sameActive = await Visit.findOne({ worker: req.user._id, hudud: hududId, status: 'active' });
  if (sameActive) {
    const hudud = await Hudud.findById(hududId).lean();
    const points = await Point.find({ hudud: hududId }).sort('order').lean();
    return res.json({
      visit: serialize(sameActive.toObject()),
      hudud: serialize(hudud),
      points: serialize(points),
      config: { pointToleranceM: env.GPS_POINT_TOLERANCE_M, hududToleranceM: env.GPS_HUDUD_TOLERANCE_M },
    });
  }

  const hudud = await Hudud.findById(hududId).lean();
  if (!hudud) throw new ApiError(404, 'error.notFound');
  if (hudud.status !== 'active') {
    throw new ApiError(400, 'visit.error.hududInactive', "Hudud faol emas");
  }

  // GPS check 1: ishchi hudud ichida yoki yaqinida (≤ tolerance metr) bo'lishi kerak
  // Adaptive tolerance (CAP bilan): max(belgilangan, min(gpsAccuracy, CAP))
  const baseTolerance = hudud.hududToleranceM ?? env.GPS_HUDUD_TOLERANCE_M;
  const acc = Number(gpsAccuracy);
  const expanded = Number.isFinite(acc) ? Math.min(acc, env.GPS_HUDUD_TOLERANCE_MAX_M) : 0;
  const toleranceM = Math.max(baseTolerance, expanded);
  const inside = pointInPolygon(lat, lng, hudud.polygon);
  if (!inside) {
    // Polygon ichida bo'lmasa — eng yaqin chetidan masofani tekshiramiz
    const minDist = nearestEdgeDistance(lat, lng, hudud.polygon);
    if (minDist > toleranceM) {
      throw new ApiError(403, 'visit.error.tooFar',
        `Hudud chegarasidan ${Math.round(minDist)} m uzoqdasiz (limit ${toleranceM.toFixed(1)} m)`);
    }
  }

  // Nuqtalar sonini olamiz (UI uchun)
  const pointsTotal = await Point.countDocuments({ hudud: hudud._id });
  const pointsDone  = await Point.countDocuments({ hudud: hudud._id, status: 'done' });

  const visit = await Visit.create({
    worker: req.user._id,
    hudud: hudud._id,
    arrivedGps: { lat, lng },
    pointsTotal,
    pointsDone,
  });

  const points = await Point.find({ hudud: hudud._id }).sort('order').lean();
  res.status(201).json({
    visit: serialize(visit.toObject()),
    hudud: serialize(hudud),
    points: serialize(points),
    config: {
      pointToleranceM: hudud.pointToleranceM ?? env.GPS_POINT_TOLERANCE_M,
      hududToleranceM: toleranceM,
    },
  });
});

/** Active visit holatini olish (ishchi yangi sessiya boshlasa) */
export const getActive = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ishchi') throw new ApiError(403, 'error.forbidden');
  // hududId berilgan bo'lsa — aynan shu hudud uchun active visit (multi-visit qo'llab-quvvatlash)
  const filter = { worker: req.user._id, status: 'active' };
  if (req.query.hududId && mongoose.isValidObjectId(req.query.hududId)) {
    filter.hudud = req.query.hududId;
  }
  const visit = await Visit.findOne(filter)
    .sort('-startedAt') // hududId berilmasa eng so'nggini olamiz
    .populate({ path: 'hudud', populate: { path: 'mfy' } })
    .lean();
  if (!visit) return res.json({ visit: null });
  const points = await Point.find({ hudud: visit.hudud._id }).sort('order').lean();
  res.json({
    visit: serialize(visit),
    points: serialize(points),
    config: {
      pointToleranceM: visit.hudud.pointToleranceM ?? env.GPS_POINT_TOLERANCE_M,
      hududToleranceM: visit.hudud.hududToleranceM ?? env.GPS_HUDUD_TOLERANCE_M,
    },
  });
});

/** Visit ni qo'lda tugatish (admin yoki ishchi o'zi bekor qiladi — rahbar emas) */
export const cancel = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'error.notFound');
  // Rahbar — visit bekor qila olmaydi (read-only)
  if (req.user.role === 'rahbar') throw new ApiError(403, 'error.forbidden');
  const visit = await Visit.findById(id);
  if (!visit) throw new ApiError(404, 'error.notFound');
  // Ishchi — faqat o'z visit'ini bekor qiladi
  if (req.user.role === 'ishchi' && visit.worker.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'error.forbidden');
  }
  if (visit.status !== 'active') {
    return res.json({ visit: visit.toObject() });
  }
  visit.status = 'cancelled';
  visit.completedAt = new Date();
  await visit.save();
  res.json({ visit: serialize(visit.toObject()) });
});

/** Admin uchun barcha visitlar tarixi, rahbar — o'z viloyati */
export const list = asyncHandler(async (req, res) => {
  if (req.user.role === 'ishchi') throw new ApiError(403, 'error.forbidden');
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  const IMPOSSIBLE_ID = new mongoose.Types.ObjectId('000000000000000000000000');
  // Rahbar — faqat o'z viloyati ishchilarining visit'lari (fail-closed)
  let allowedWorkerIds = null;
  if (req.user.role === 'rahbar') {
    const vil = req.user.viloyat ?? IMPOSSIBLE_ID;
    const workersInViloyat = await User.find({ role: 'ishchi', viloyat: vil }).select('_id').lean();
    allowedWorkerIds = workersInViloyat.map((w) => String(w._id));
    filter.worker = { $in: workersInViloyat.map((w) => w._id) };
  }
  // B7: workerId rahbar scope'ini BEKOR QILMASLIGI kerak — ruxsat etilganlar ichidan
  if (req.query.workerId && mongoose.isValidObjectId(req.query.workerId)) {
    if (allowedWorkerIds && !allowedWorkerIds.includes(String(req.query.workerId))) {
      filter.worker = IMPOSSIBLE_ID; // rahbar boshqa viloyat ishchisini so'radi → bo'sh
    } else {
      filter.worker = req.query.workerId;
    }
  }
  if (req.query.hududId && mongoose.isValidObjectId(req.query.hududId)) filter.hudud = req.query.hududId;
  const ALLOWED_VISIT_STATUS = ['active', 'completed', 'cancelled'];
  if (req.query.status && ALLOWED_VISIT_STATUS.includes(String(req.query.status))) {
    filter.status = String(req.query.status);
  }
  const total = await Visit.countDocuments(filter);
  const visits = await Visit.find(filter)
    .populate('worker', 'fullName username')
    .populate({ path: 'hudud', populate: { path: 'mfy', select: 'nameUz nameRu nameEn' } })
    .sort('-startedAt')
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  res.json({ visits: serialize(visits), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

/* ── Helper: nuqtadan polygonning eng yaqin chetigacha masofa (metr) ── */
function nearestEdgeDistance(lat, lng, polygon) {
  const ring = polygon?.coordinates?.[0] ?? [];
  let min = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    const d = pointToSegmentDistance(lat, lng, lat1, lng1, lat2, lng2);
    if (d < min) min = d;
  }
  return min;
}

function pointToSegmentDistance(plat, plng, alat, alng, blat, blng) {
  // Soddalashtirilgan: kichik masofalarda taxminiy planar
  const A = { x: alng, y: alat };
  const B = { x: blng, y: blat };
  const P = { x: plng, y: plat };
  const ab = { x: B.x - A.x, y: B.y - A.y };
  const len2 = ab.x * ab.x + ab.y * ab.y;
  let t = len2 === 0 ? 0 : ((P.x - A.x) * ab.x + (P.y - A.y) * ab.y) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = A.x + ab.x * t;
  const cy = A.y + ab.y * t;
  return distanceMeters(plat, plng, cy, cx);
}
