import mongoose from 'mongoose';
import { Reading }  from '../models/Reading.js';
import { Point }    from '../models/Point.js';
import { Hudud }    from '../models/Hudud.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';
import { viloyatScope, viloyatMatches } from '../utils/scope.js';
import { getParameterStatus } from '../utils/thresholdCheck.js';

const PARAMS = ['moisture', 'temperature', 'nitrogen', 'phosphorus', 'potassium', 'ph', 'ec'];

/** Rahbar — faqat o'z viloyatidagi data (fail-closed: viloyatsiz rahbar → bo'sh) */
const scopeFilter = (req) => viloyatScope(req);

/**
 * Hududning viloyatini Hudud→MFY→Tuman→Viloyat zanjiri orqali aniqlaydi.
 * Rahbar shu hududni ko'rishga haqlimi tekshiradi; haqsiz bo'lsa 404 (mavjudlikni oshkor qilmaslik).
 */
async function assertHududScope(req, hududId) {
  if (req.user.role !== 'rahbar') return; // admin — cheklovsiz
  const hudud = await Hudud.findById(hududId)
    .populate({ path: 'mfy', select: 'tuman', populate: { path: 'tuman', select: 'viloyat' } })
    .lean();
  const vil = hudud?.mfy?.tuman?.viloyat;
  if (!viloyatMatches(req, vil)) throw new ApiError(404, 'error.notFound');
}

/**
 * Rahbar/admin ko'ra oladigan active hudud ID'lari (xarita uchun).
 * Admin — barchasi; rahbar — Hudud→MFY→Tuman→Viloyat zanjiri mos kelganlari.
 */
async function getScopedActiveHududs(req, extraFilter = {}) {
  const hududs = await Hudud.find({ status: 'active', ...extraFilter })
    .populate({ path: 'mfy', select: 'tuman nameUz nameRu nameEn', populate: { path: 'tuman', select: 'viloyat' } })
    .select('nameUz nameRu nameEn mfy category')
    .lean();
  if (req.user.role !== 'rahbar') return hududs;
  return hududs.filter((h) => viloyatMatches(req, h?.mfy?.tuman?.viloyat));
}

/** Reading'dagi 7 parametr ichidan eng yomon (dominant) holatni topadi. */
function dominantStatus(reading) {
  if (!reading) return null;
  const order = { critical: 4, warning: 3, high: 2, optimal: 1 };
  let worst = null;
  for (const p of PARAMS) {
    const v = reading[p];
    if (v == null) continue;
    const r = getParameterStatus(p, v);
    if (!r) continue;
    if (!worst || (order[r.status] || 0) > (order[worst] || 0)) worst = r.status;
  }
  return worst;
}

/** dateFrom/dateTo (YYYY-MM-DD) yoki days fallback → {$gte, $lte} oralig'i. */
function dateRangeFilter(query, defaultDays = 30) {
  const { dateFrom, dateTo } = query;
  if (dateFrom && dateTo) {
    const since = new Date(dateFrom);
    const until = new Date(dateTo);
    if (!isNaN(since) && !isNaN(until)) {
      until.setHours(23, 59, 59, 999);
      return { $gte: since, $lte: until };
    }
  }
  const days = Math.min(Number(query.days) || defaultDays, 365);
  return { $gte: new Date(Date.now() - days * 86_400_000) };
}

/* ── Bitta nuqtaning o'qishlari tarixi ─────────────────────────────────── */
export const pointHistory = asyncHandler(async (req, res) => {
  const { pointId } = req.params;
  if (!mongoose.isValidObjectId(pointId)) throw new ApiError(404, 'error.notFound');
  const point = await Point.findById(pointId).lean();
  if (!point) throw new ApiError(404, 'error.notFound');
  // IDOR himoyasi — rahbar boshqa viloyat nuqtasini so'rasa 404
  await assertHududScope(req, point.hudud);
  const readings = await Reading.find({
    point: pointId, ...scopeFilter(req), timestamp: dateRangeFilter(req.query),
  })
    .populate('worker', 'fullName username')
    .populate('device', 'serialNumber')
    .sort('-timestamp')
    .limit(500)
    .lean();
  res.json({ readings, point });
});

/* ── Ishchining O'Z o'qishlari (mobile tarix) ──────────────────────────── */
export const myReadings = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ishchi') throw new ApiError(403, 'error.forbidden');
  const page  = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const filter = { worker: req.user._id, timestamp: dateRangeFilter(req.query, 90) };
  const [readings, total] = await Promise.all([
    Reading.find(filter)
      .populate('point', 'lat lng order')
      .populate({ path: 'hudud', select: 'nameUz nameRu nameEn' })
      .sort('-timestamp')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Reading.countDocuments(filter),
  ]);
  res.json({ readings, total, page, limit, totalPages: Math.ceil(total / limit) });
});

/* ── Xarita uchun: barcha active hudud nuqtalari + oxirgi reading ──────── */
export const pointsLatest = asyncHandler(async (req, res) => {
  const extra = {};
  if (req.query.hududId && mongoose.isValidObjectId(req.query.hududId)) {
    extra._id = new mongoose.Types.ObjectId(req.query.hududId);
  }
  const hududs   = await getScopedActiveHududs(req, extra);
  const hududIds = hududs.map((h) => h._id);
  const hududMap = new Map(hududs.map((h) => [String(h._id), h]));

  const points = await Point.find({ hudud: { $in: hududIds } })
    .populate('lastReading', 'moisture temperature nitrogen phosphorus potassium ph ec timestamp source')
    .select('hudud lat lng order status lastReading lastVisitedAt')
    .sort('order')
    .lean();

  const out = points.map((p) => {
    const r = p.lastReading;
    const h = hududMap.get(String(p.hudud));
    return {
      id:     p._id,
      hudud:  p.hudud,
      hududName: h ? { uz: h.nameUz, ru: h.nameRu, en: h.nameEn } : null,
      lat:    p.lat,
      lng:    p.lng,
      order:  p.order,
      status: p.status,                 // pending | done (tashrif holati)
      lastVisitedAt: p.lastVisitedAt,
      latest: r ? {
        timestamp:   r.timestamp,
        moisture:    r.moisture ?? null,
        temperature: r.temperature ?? null,
        nitrogen:    r.nitrogen ?? null,
        phosphorus:  r.phosphorus ?? null,
        potassium:   r.potassium ?? null,
        ph:          r.ph ?? null,
        ec:          r.ec ?? null,
        source:      r.source ?? 'device',
        status:      dominantStatus(r), // optimal | warning | critical | high
      } : null,
    };
  });

  res.json({ points: out, hududs });
});

/* ── Bitta hududning o'qishlari (barcha nuqtalardan) ────────────────────── */
export const hududHistory = asyncHandler(async (req, res) => {
  const { hududId } = req.params;
  if (!mongoose.isValidObjectId(hududId)) throw new ApiError(404, 'error.notFound');
  const days  = Math.min(Number(req.query.days) || 30, 365);
  const since = new Date(Date.now() - days * 86_400_000);
  const hudud = await Hudud.findById(hududId).lean();
  if (!hudud) throw new ApiError(404, 'error.notFound');
  // IDOR himoyasi — rahbar boshqa viloyat hududini so'rasa 404
  await assertHududScope(req, hududId);
  const readings = await Reading.find({ hudud: hududId, ...scopeFilter(req), timestamp: { $gte: since } })
    .populate('point', 'lat lng order')
    .populate('worker', 'fullName username')
    .sort('-timestamp')
    .limit(500)
    .lean();
  res.json({ readings, hudud });
});

/* ── Aggregatsiya: parametr bo'yicha vaqt ichida o'rta qiymat ──────────── */
const ALLOWED_PARAMS = ['moisture', 'temperature', 'nitrogen', 'phosphorus', 'potassium', 'ph', 'ec'];
const ALLOWED_GRANULARITIES = ['hour', 'day', 'month'];

export const aggregate = asyncHandler(async (req, res) => {
  // Whitelist — NoSQL injection'ga qarshi himoya
  const rawParam = String(req.query.parameter || 'moisture');
  const rawGran  = String(req.query.granularity || 'day');
  const param       = ALLOWED_PARAMS.includes(rawParam) ? rawParam : 'moisture';
  const granularity = ALLOWED_GRANULARITIES.includes(rawGran) ? rawGran : 'day';
  const days        = Math.min(Number(req.query.days) || 7, 365);

  const filter = { ...scopeFilter(req) };
  if (req.query.hududId && mongoose.isValidObjectId(req.query.hududId)) filter.hudud = new mongoose.Types.ObjectId(req.query.hududId);
  if (req.query.mfyId   && mongoose.isValidObjectId(req.query.mfyId))   filter.mfy   = new mongoose.Types.ObjectId(req.query.mfyId);

  let since, until;
  if (req.query.dateFrom && req.query.dateTo) {
    since = new Date(req.query.dateFrom);
    until = new Date(req.query.dateTo);
    until.setHours(23, 59, 59, 999);
  } else {
    since = new Date(Date.now() - days * 86_400_000);
    until = new Date();
  }
  filter.timestamp = { $gte: since, $lte: until };

  const fmt = granularity === 'hour'  ? '%Y-%m-%dT%H:00'
            : granularity === 'month' ? '%Y-%m'
            : '%Y-%m-%d';

  const raw = await Reading.aggregate([
    { $match: filter },
    {
      $group: {
        _id:   { $dateToString: { format: fmt, date: '$timestamp' } },
        value: { $avg: `$${param}` },
        min:   { $min: `$${param}` },
        max:   { $max: `$${param}` },
        count: { $sum: 1 },
      },
    },
    { $sort:  { _id: 1 } },
    { $limit: 500 },
  ]);

  const points = raw.map((p) => ({
    timestamp: p._id,
    value: p.value != null ? +p.value.toFixed(2) : null,
    min:   p.min   != null ? +p.min.toFixed(2)   : null,
    max:   p.max   != null ? +p.max.toFixed(2)   : null,
    count: p.count,
  }));

  res.json({ points, granularity, parameter: param });
});
