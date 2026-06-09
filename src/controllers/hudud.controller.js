import Joi from 'joi';
import mongoose from 'mongoose';
import { Hudud } from '../models/Hudud.js';
import { Point } from '../models/Point.js';
import { MFY } from '../models/MFY.js';
import { Log } from '../models/Log.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';
import { polygonAreaM2, polygonCenter, pointInPolygon } from '../utils/geo.js';
import { generatePoints, recommendedPointCount } from '../utils/poissonDisk.js';
import { env } from '../config/env.js';
import { serialize } from '../utils/serialize.js';

/** Polygon [[lng, lat], ...] tashqi halqa Joi sxemasi */
const polygonRingSchema = Joi.array().items(
  Joi.array().length(2).items(Joi.number()),
).min(4).required();

export const createHududSchema = Joi.object({
  nameUz:   Joi.string().min(2).required(),
  nameRu:   Joi.string().min(2).required(),
  nameEn:   Joi.string().min(2).required(),
  mfyId:    Joi.string().hex().length(24).required(),
  category: Joi.string().valid('street', 'park', 'garden', 'square', 'field').required(),
  // GeoJSON Polygon coordinates: [[[lng, lat], ...]]
  polygon:  Joi.array().items(polygonRingSchema).min(1).max(1).required(),
  pointToleranceM: Joi.number().min(0.5).max(50).optional(),
  hududToleranceM: Joi.number().min(1).max(200).optional(),
});

export const updateHududSchema = Joi.object({
  nameUz:   Joi.string().min(2),
  nameRu:   Joi.string().min(2),
  nameEn:   Joi.string().min(2),
  category: Joi.string().valid('street', 'park', 'garden', 'square', 'field'),
  status:   Joi.string().valid('active', 'archived'),
  pointToleranceM: Joi.number().min(0.5).max(50).allow(null),
  hududToleranceM: Joi.number().min(1).max(200).allow(null),
});

export const list = asyncHandler(async (req, res) => {
  const { mfyId, status, category } = req.query;
  const filter = {};
  if (mfyId)    filter.mfy = mfyId;
  if (status)   filter.status = status;
  if (category) filter.category = category;

  // Rahbar — viloyat scope. Hozir loyiha faqat Farg'ona uchun, MFY'lar tumanlar bilan
  // hali bog'lanmagan (seed default null). Tuman.viloyat orqali filtr, agar topilsa.
  // Topilmasa rahbar barcha MFY'lar hududini ko'radi (Farg'ona-only MVP shartida xato yo'q).
  if (req.user.role === 'rahbar' && req.user.viloyat) {
    const { Tuman } = await import('../models/Tuman.js');
    const tumans = await Tuman.find({ viloyat: req.user.viloyat }).select('_id').lean();
    const tumanIds = tumans.map((t) => t._id);
    const mfys = await MFY.find({
      $or: [{ tuman: { $in: tumanIds } }, { tuman: null }],
    }).select('_id').lean();
    filter.mfy = { $in: mfys.map((m) => m._id) };
  }

  // Xarita polygon chizishi uchun ?withPolygon=1 bilan polygon ham qaytariladi.
  // Oddiy ro'yxat sahifalari uchun polygon kerak emas (yengilroq javob).
  const projection = req.query.withPolygon ? {} : { polygon: 0 };
  const hududs = await Hudud.find(filter, projection)
    .populate('mfy', 'nameUz nameRu nameEn code')
    .sort('-createdAt')
    .lean();

  // Har bir hudud uchun nuqta soni
  const ids = hududs.map((h) => h._id);
  const pointCounts = await Point.aggregate([
    { $match: { hudud: { $in: ids } } },
    { $group: { _id: { hudud: '$hudud', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const byHudud = new Map();
  for (const pc of pointCounts) {
    const id = pc._id.hudud.toString();
    const entry = byHudud.get(id) ?? { pending: 0, done: 0, total: 0 };
    entry[pc._id.status] = pc.count;
    entry.total = (entry.total ?? 0) + pc.count;
    byHudud.set(id, entry);
  }
  const enriched = hududs.map((h) => ({
    ...h,
    points: byHudud.get(h._id.toString()) ?? { pending: 0, done: 0, total: 0 },
  }));

  res.json({ hududs: serialize(enriched), total: enriched.length });
});

/** Bitta hudud — polygon va nuqtalar bilan */
export const get = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const hudud = await Hudud.findById(req.params.id).populate('mfy').lean();
  if (!hudud) throw new ApiError(404, 'error.notFound');
  const points = await Point.find({ hudud: hudud._id }).sort('order').lean();
  res.json({ hudud: serialize(hudud), points: serialize(points) });
});

/**
 * Yangi hudud yarat — backend avtomatik nuqtalarni generatsiya qiladi.
 * Polygon admin xaritada chizadi (klik-klik).
 */
export const create = asyncHandler(async (req, res) => {
  const data = req.body;

  // MFY mavjudligini tekshiramiz va polygon shu MFY ichidaligini ham
  const mfy = await MFY.findById(data.mfyId).lean();
  if (!mfy) throw new ApiError(400, 'error.notFound', 'MFY not found');

  const polygon = { type: 'Polygon', coordinates: data.polygon };
  const area = polygonAreaM2(polygon);
  if (area < 50) {
    throw new ApiError(400, 'hudud.error.tooSmall', 'Hudud juda kichik (< 50 m²)');
  }

  // Markaz MFY ichidami?
  const center = polygonCenter(polygon);
  if (!pointInPolygon(center.lat, center.lng, mfy.polygon)) {
    throw new ApiError(400, 'hudud.error.outsideMfy', "Hudud markazi tanlangan MFY ichida emas");
  }

  // Hududni saqlaymiz
  const hudud = await Hudud.create({
    nameUz:   data.nameUz,
    nameRu:   data.nameRu,
    nameEn:   data.nameEn,
    mfy:      data.mfyId,
    category: data.category,
    polygon,
    center,
    areaM2:   Math.round(area),
    pointToleranceM: data.pointToleranceM ?? null,
    hududToleranceM: data.hududToleranceM ?? null,
    createdBy: req.user._id,
  });

  // Avtomatik nuqtalar generatsiya
  const maxPoints = recommendedPointCount(area, env.POINT_DENSITY_PER_SQM);
  const generated = generatePoints(polygon, {
    minDistM:  env.POINT_MIN_SPACING_M,
    maxPoints,
  });
  const pointDocs = generated.map((p, i) => ({
    hudud: hudud._id,
    lat: p.lat,
    lng: p.lng,
    order: i + 1,
  }));
  if (pointDocs.length === 0) {
    throw new ApiError(400, 'hudud.error.noPoints', "Hududda hech qanday nuqta generatsiya qilinmadi");
  }
  await Point.insertMany(pointDocs);

  await Log.create({
    user: req.user._id,
    userName: req.user.fullName,
    actionKey: 'log.actions.hududCreated',
    target: hudud.nameUz,
  });

  // To'liq qaytaramiz
  const full = await Hudud.findById(hudud._id).populate('mfy').lean();
  const points = await Point.find({ hudud: hudud._id }).sort('order').lean();
  res.status(201).json({ hudud: serialize(full), points: serialize(points) });
});

export const update = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const hudud = await Hudud.findById(req.params.id);
  if (!hudud) throw new ApiError(404, 'error.notFound');

  // Faqat ruxsat berilgan maydonlar (polygon o'zgartirilmaydi — qayta chizish kerak)
  ['nameUz', 'nameRu', 'nameEn', 'category', 'status', 'pointToleranceM', 'hududToleranceM']
    .forEach((k) => {
      if (req.body[k] !== undefined) hudud[k] = req.body[k];
    });
  await hudud.save();

  await Log.create({
    user: req.user._id,
    userName: req.user.fullName,
    actionKey: 'log.actions.hududEdited',
    target: hudud.nameUz,
  });
  res.json({ hudud: hudud.toObject() });
});

export const remove = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const hudud = await Hudud.findByIdAndDelete(req.params.id);
  if (!hudud) throw new ApiError(404, 'error.notFound');
  await Point.deleteMany({ hudud: hudud._id });
  await Log.create({
    user: req.user._id,
    userName: req.user.fullName,
    actionKey: 'log.actions.hududDeleted',
    target: hudud.nameUz,
  });
  res.json({ ok: true });
});

/**
 * Hududni "qayta tashrif"ga tayyorlash — barcha nuqtalarni pending ga qaytaradi.
 * Hozircha sodda; keyinroq sxedula bilan to'ldiriladi.
 */
export const resetPoints = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const hudud = await Hudud.findById(req.params.id);
  if (!hudud) throw new ApiError(404, 'error.notFound');
  const r = await Point.updateMany(
    { hudud: hudud._id },
    { $set: { status: 'pending', lastReading: null, lastVisitedAt: null } },
  );
  res.json({ ok: true, reset: r.modifiedCount });
});
