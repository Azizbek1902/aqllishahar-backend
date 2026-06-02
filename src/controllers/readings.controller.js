import mongoose from 'mongoose';
import { Reading }  from '../models/Reading.js';
import { Point }    from '../models/Point.js';
import { Hudud }    from '../models/Hudud.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';
import { viloyatScope, viloyatMatches } from '../utils/scope.js';

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

/* ── Bitta nuqtaning o'qishlari tarixi ─────────────────────────────────── */
export const pointHistory = asyncHandler(async (req, res) => {
  const { pointId } = req.params;
  if (!mongoose.isValidObjectId(pointId)) throw new ApiError(404, 'error.notFound');
  const days  = Math.min(Number(req.query.days) || 30, 365);
  const since = new Date(Date.now() - days * 86_400_000);
  const point = await Point.findById(pointId).lean();
  if (!point) throw new ApiError(404, 'error.notFound');
  // IDOR himoyasi — rahbar boshqa viloyat nuqtasini so'rasa 404
  await assertHududScope(req, point.hudud);
  const readings = await Reading.find({ point: pointId, ...scopeFilter(req), timestamp: { $gte: since } })
    .sort('timestamp')
    .lean();
  res.json({ readings, point });
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
