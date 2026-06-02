import mongoose from 'mongoose';
import { Hudud } from '../models/Hudud.js';
import { Point } from '../models/Point.js';
import { Device } from '../models/Device.js';
import { User } from '../models/User.js';
import { Visit } from '../models/Visit.js';
import { Reading } from '../models/Reading.js';
import { Alert } from '../models/Alert.js';
import { MFY } from '../models/MFY.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { getOverallStatus } from '../utils/sensorStatus.js';
import { serialize } from '../utils/serialize.js';
import { viloyatScope } from '../utils/scope.js';

/** Rahbar — viloyatga cheklash (fail-closed: viloyatsiz rahbar → bo'sh) */
const scopeFilter = (req) => viloyatScope(req);
// Hech qachon mos kelmaydigan id — viloyatsiz rahbar uchun fail-closed
const IMPOSSIBLE_ID = new mongoose.Types.ObjectId('000000000000000000000000');

/**
 * Asosiy dashboard summary:
 *  - Hududlar (jami, faol)
 *  - Nuqtalar (jami, tugagan)
 *  - Qurilmalar (jami, online)
 *  - Ishchilar (jami, faol)
 *  - Active visit'lar
 *  - O'rtacha namlik (oxirgi 7 kun)
 *  - So'nggi alertlar (5 ta)
 */
export const summary = asyncHandler(async (req, res) => {
  const scope = scopeFilter(req);

  // Filter'larni rahbar uchun viloyat bo'yicha cheklash
  const workerFilter = { role: 'ishchi' };
  const deviceFilter = {};
  const hududFilter  = {};
  const visitFilter  = {};
  let   pointFilter  = {};
  if (req.user.role === 'rahbar') {
    // Viloyatsiz rahbar — IMPOSSIBLE_ID bilan hamma narsa bo'sh chiqadi (fail-closed)
    const vil = req.user.viloyat ?? IMPOSSIBLE_ID;
    workerFilter.viloyat = vil;
    const { Tuman } = await import('../models/Tuman.js');
    const tumans = await Tuman.find({ viloyat: vil }).select('_id').lean();
    const mfys = await MFY.find({
      $or: [{ tuman: { $in: tumans.map((t) => t._id) } }, { tuman: null }],
    }).select('_id').lean();
    hududFilter.mfy = { $in: mfys.map((m) => m._id) };
    const hududsInScope = await Hudud.find(hududFilter).select('_id').lean();
    const hududIds = hududsInScope.map((h) => h._id);
    pointFilter.hudud = { $in: hududIds };
    visitFilter.hudud = { $in: hududIds };
    const workers = await User.find(workerFilter).select('_id').lean();
    deviceFilter.assignedTo = { $in: workers.map((w) => w._id) };
  }

  const [hududsTotal, hududsActive, pointsTotal, pointsDone, devicesTotal, devicesOnline,
    workersTotal, workersActive, visitsActive] = await Promise.all([
    Hudud.countDocuments(hududFilter),
    Hudud.countDocuments({ ...hududFilter, status: 'active' }),
    Point.countDocuments(pointFilter),
    Point.countDocuments({ ...pointFilter, status: 'done' }),
    Device.countDocuments(deviceFilter),
    Device.countDocuments({ ...deviceFilter, isOnline: true }),
    User.countDocuments(workerFilter),
    User.countDocuments({ ...workerFilter, isActive: true }),
    Visit.countDocuments({ ...visitFilter, status: 'active' }),
  ]);

  // Oxirgi 7 kunda o'rtacha namlik (rahbar uchun viloyat bilan cheklash)
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const moistureAgg = await Reading.aggregate([
    { $match: { ...scope, timestamp: { $gte: weekAgo }, moisture: { $exists: true } } },
    { $group: { _id: null, avg: { $avg: '$moisture' }, count: { $sum: 1 } } },
  ]);
  const avgMoisture = moistureAgg[0]?.avg ?? 0;

  // Status taqsimoti — oxirgi 7 kun reading'larining overallStatus'i
  const recentReadings = await Reading.find({ ...scope, timestamp: { $gte: weekAgo } })
    .select('moisture temperature nitrogen phosphorus potassium ph ec')
    .lean();
  const statusCounts = { critical: 0, warning: 0, optimal: 0, high: 0 };
  recentReadings.forEach((r) => statusCounts[getOverallStatus(r)]++);

  // 7 kunlik trend
  const trend = await Reading.aggregate([
    { $match: { ...scope, timestamp: { $gte: weekAgo } } },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        moisture:    { $avg: '$moisture' },
        temperature: { $avg: '$temperature' },
      } },
    { $sort: { _id: 1 } },
  ]);

  const recentAlerts = await Alert.find({ ...scope })
    .populate('hudud', 'nameUz nameRu nameEn category')
    .populate('mfy',   'nameUz nameRu nameEn code')
    .populate('point', 'lat lng order')
    .populate('device', 'serialNumber model')
    .populate('worker', 'fullName username')
    .sort('-createdAt')
    .limit(5)
    .lean();

  res.json({
    stats: {
      hududsTotal, hududsActive,
      pointsTotal, pointsDone,
      devicesTotal, devicesOnline,
      workersTotal, workersActive,
      visitsActive,
      avgMoisture,
    },
    statusCounts,
    trend: trend.map((t) => ({
      date: t._id,
      moisture:    Math.round(t.moisture ?? 0),
      temperature: Math.round(t.temperature ?? 0),
    })),
    recentAlerts: serialize(recentAlerts),
  });
});

/** Hudud'lar ro'yxati — o'rtacha namlik, nuqta statistikasi bilan */
export const hududsOverview = asyncHandler(async (req, res) => {
  const hududs = await Hudud.find({ status: 'active' }, { polygon: 0 })
    .populate('mfy', 'nameUz nameRu nameEn code')
    .lean();
  if (hududs.length === 0) return res.json({ hududs: [] });

  const ids = hududs.map((h) => h._id);
  const aggs = await Reading.aggregate([
    { $match: { hudud: { $in: ids } } },
    { $group: {
        _id: '$hudud',
        avgMoisture:    { $avg: '$moisture' },
        avgTemperature: { $avg: '$temperature' },
        count: { $sum: 1 },
      } },
  ]);
  const byHudud = new Map(aggs.map((a) => [a._id.toString(), a]));

  const pointStats = await Point.aggregate([
    { $match: { hudud: { $in: ids } } },
    { $group: { _id: { hudud: '$hudud', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const pointsByHudud = new Map();
  for (const ps of pointStats) {
    const id = ps._id.hudud.toString();
    const entry = pointsByHudud.get(id) ?? { pending: 0, done: 0 };
    entry[ps._id.status] = ps.count;
    pointsByHudud.set(id, entry);
  }

  const list = hududs.map((h) => {
    const a = byHudud.get(h._id.toString());
    const p = pointsByHudud.get(h._id.toString()) ?? { pending: 0, done: 0 };
    return {
      ...h,
      avgMoisture: a?.avgMoisture ?? null,
      avgTemperature: a?.avgTemperature ?? null,
      readingCount: a?.count ?? 0,
      points: p,
    };
  });
  res.json({ hududs: serialize(list) });
});

/** MFY'lar bo'yicha statistika (xarita ostida ko'rsatish uchun) */
export const mfyOverview = asyncHandler(async (req, res) => {
  const mfys = await MFY.find({}, { polygon: 0 }).lean();
  const ids = mfys.map((m) => m._id);

  const hududCounts = await Hudud.aggregate([
    { $match: { mfy: { $in: ids } } },
    { $group: { _id: '$mfy', count: { $sum: 1 } } },
  ]);
  const hududByMfy = new Map(hududCounts.map((h) => [h._id.toString(), h.count]));

  const readingAgg = await Reading.aggregate([
    { $match: { mfy: { $in: ids } } },
    { $group: { _id: '$mfy', avgMoisture: { $avg: '$moisture' }, count: { $sum: 1 } } },
  ]);
  const readingsByMfy = new Map(readingAgg.map((r) => [r._id.toString(), r]));

  const list = mfys.map((m) => {
    const r = readingsByMfy.get(m._id.toString());
    return {
      ...m,
      hududCount:   hududByMfy.get(m._id.toString()) ?? 0,
      avgMoisture:  r?.avgMoisture ?? null,
      readingCount: r?.count ?? 0,
    };
  });
  res.json({ mfys: serialize(list) });
});
