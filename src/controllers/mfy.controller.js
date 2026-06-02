import { MFY } from '../models/MFY.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';
import { serialize } from '../utils/serialize.js';

/**
 * MFY admin tomonidan boshqarilmaydi — geojson dan seed bilan keladi.
 * Faqat o'qish endpoint'lari kerak (xarita uchun).
 */

export const list = asyncHandler(async (req, res) => {
  const { tumanId, includePolygon } = req.query;
  const filter = {};
  if (tumanId) filter.tuman = tumanId;

  // polygon katta — kerak bo'lmasa frontendga yuborma
  const projection = includePolygon === 'true'
    ? undefined
    : { polygon: 0 };

  const mfys = await MFY.find(filter, projection).populate('tuman').sort('nameUz').lean();
  res.json({ mfys: serialize(mfys), total: mfys.length });
});

/** Bitta MFY (xarita uchun polygon bilan) */
export const get = asyncHandler(async (req, res) => {
  const mfy = await MFY.findById(req.params.id).populate('tuman').lean();
  if (!mfy) throw new ApiError(404, 'error.notFound');
  res.json({ mfy: serialize(mfy) });
});

/**
 * Xarita uchun barcha MFY polygon'lari (GeoJSON FeatureCollection formatida).
 * Bitta so'rovda Leaflet/react-leaflet uchun tayyor.
 */
export const geojson = asyncHandler(async (req, res) => {
  const mfys = await MFY.find({}, 'nameUz nameRu nameEn code color polygon center').lean();
  const features = mfys.map((m) => ({
    type: 'Feature',
    properties: {
      id: m._id.toString(),
      nameUz: m.nameUz,
      nameRu: m.nameRu,
      nameEn: m.nameEn,
      code:   m.code,
      color:  m.color,
      center: m.center,
    },
    geometry: m.polygon,
  }));
  res.json({ type: 'FeatureCollection', features });
});
