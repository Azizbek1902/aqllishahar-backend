import mongoose from 'mongoose';
import { Alert } from '../models/Alert.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';
import { serialize } from '../utils/serialize.js';
import { viloyatScope } from '../utils/scope.js';

/** Rahbar — faqat o'z viloyat alertlari (fail-closed), admin — barchasi */
const scopeFilter = (req) => viloyatScope(req);

// NoSQL operator injection'ga qarshi — faqat shu qiymatlar ruxsat etiladi
const ALLOWED_PARAMS  = ['moisture', 'temperature', 'nitrogen', 'phosphorus', 'potassium', 'ph', 'ec'];
const ALLOWED_STATUS  = ['optimal', 'warning', 'critical', 'high'];

export const list = asyncHandler(async (req, res) => {
  const filter = scopeFilter(req);
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  if (req.query.status) {
    // Whitelist — faqat ma'lum status qiymatlari (operator injection emas)
    const statuses = String(req.query.status).split(',').map((s) => s.trim())
      .filter((s) => ALLOWED_STATUS.includes(s));
    if (statuses.length === 1) filter.status = statuses[0];
    else if (statuses.length > 1) filter.status = { $in: statuses };
  }
  // `?parameter[$ne]=x` kabi operator injection'ni bloklaymiz — qat'iy whitelist
  if (req.query.parameter && ALLOWED_PARAMS.includes(String(req.query.parameter))) {
    filter.parameter = String(req.query.parameter);
  }
  if (req.query.hududId && mongoose.isValidObjectId(req.query.hududId)) {
    filter.hudud = req.query.hududId;
  }
  if (req.query.mfyId && mongoose.isValidObjectId(req.query.mfyId)) {
    filter.mfy = req.query.mfyId;
  }
  if (req.query.unread === 'true') filter.isRead = false;

  const total  = await Alert.countDocuments(filter);
  const alerts = await Alert.find(filter)
    .populate({ path: 'point',  select: 'lat lng order' })
    .populate({ path: 'hudud',  select: 'nameUz nameRu nameEn category center' })
    .populate({ path: 'mfy',    select: 'nameUz nameRu nameEn code' })
    .populate({ path: 'device', select: 'serialNumber model' })
    .populate({ path: 'worker', select: 'fullName username' })
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Tab badge'lar uchun — status bo'yicha umumiy son (status filtersiz, lekin
  // scope + hudud/mfy ichida). Frontend client-side sanamasligi uchun.
  const baseFilter = { ...filter };
  delete baseFilter.status; // status tab tanlovidan qat'i nazar har birини sanaymiz
  const [grouped, unreadCount, allCount] = await Promise.all([
    Alert.aggregate([{ $match: baseFilter }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Alert.countDocuments({ ...baseFilter, isRead: false }),
    Alert.countDocuments(baseFilter),
  ]);
  const counts = { all: allCount, critical: 0, warning: 0, high: 0, optimal: 0, unread: unreadCount };
  for (const g of grouped) if (g._id in counts) counts[g._id] = g.n;

  res.json({
    alerts: serialize(alerts),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    counts,
  });
});

export const markRead = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const alert = await Alert.findOneAndUpdate(
    { _id: req.params.id, ...scopeFilter(req) },
    { isRead: true },
    { new: true },
  );
  if (!alert) throw new ApiError(404, 'error.notFound');
  res.json({ alert });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Alert.updateMany({ ...scopeFilter(req), isRead: false }, { isRead: true });
  res.json({ ok: true });
});
