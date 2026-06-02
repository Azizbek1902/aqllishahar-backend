import mongoose from 'mongoose';
import { Tuman } from '../models/Tuman.js';
import { Viloyat } from '../models/Viloyat.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { ApiError } from '../middleware/error.middleware.js';

export const list = asyncHandler(async (req, res) => {
  const filter = {};
  // ObjectId validatsiya — NoSQL injection oldini oladi
  if (req.query.viloyatId && mongoose.isValidObjectId(req.query.viloyatId)) {
    filter.viloyat = req.query.viloyatId;
  }
  const tumans = await Tuman.find(filter).sort('nameUz');
  res.json({ tumans });
});

export const get = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'tuman.notFound', 'Tuman not found');
  const tuman = await Tuman.findById(req.params.id);
  if (!tuman) throw new ApiError(404, 'tuman.notFound', 'Tuman not found');
  res.json({ tuman });
});

/** lat/lng diapazon tekshiruvi — noto'g'ri markaz koordinatasini bloklaydi */
function validCoord(lat, lng) {
  if (lat === undefined && lng === undefined) return true;
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export const create = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'auth.error.forbidden', 'Forbidden');
  const { nameUz, nameRu, nameEn, code, viloyatId, centerLat, centerLng } = req.body;
  if (!nameUz || !nameRu || !nameEn) {
    throw new ApiError(400, 'form.error.fillAllLanguages', 'All language fields required');
  }
  if (!mongoose.isValidObjectId(viloyatId)) throw new ApiError(404, 'viloyat.notFound', 'Viloyat not found');
  if (!validCoord(centerLat, centerLng)) throw new ApiError(400, 'error.validation', 'Invalid center coordinates');
  const viloyat = await Viloyat.findById(viloyatId);
  if (!viloyat) throw new ApiError(404, 'viloyat.notFound', 'Viloyat not found');

  const tuman = await Tuman.create({
    nameUz, nameRu, nameEn,
    code: code || undefined,
    viloyat: viloyatId,
    centerLat: centerLat ?? undefined,
    centerLng: centerLng ?? undefined,
  });
  res.status(201).json({ tuman });
});

export const update = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'auth.error.forbidden', 'Forbidden');
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'tuman.notFound', 'Tuman not found');
  if (!validCoord(req.body.centerLat, req.body.centerLng)) {
    throw new ApiError(400, 'error.validation', 'Invalid center coordinates');
  }
  // Faqat KELGAN maydonlarni o'rnatamiz — partial update'da undefined bilan clobber bo'lmasligi uchun
  const allowed = ['nameUz', 'nameRu', 'nameEn', 'code', 'centerLat', 'centerLng'];
  const $set = {};
  for (const k of allowed) if (req.body[k] !== undefined) $set[k] = req.body[k];
  const tuman = await Tuman.findByIdAndUpdate(
    req.params.id,
    { $set },
    { new: true, runValidators: true },
  );
  if (!tuman) throw new ApiError(404, 'tuman.notFound', 'Tuman not found');
  res.json({ tuman });
});

export const remove = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'auth.error.forbidden', 'Forbidden');
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'tuman.notFound', 'Tuman not found');
  const tuman = await Tuman.findByIdAndDelete(req.params.id);
  if (!tuman) throw new ApiError(404, 'tuman.notFound', 'Tuman not found');
  res.json({ ok: true });
});
