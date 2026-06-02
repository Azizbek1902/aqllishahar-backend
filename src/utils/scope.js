import mongoose from 'mongoose';

/**
 * Rahbar uchun viloyat-scoping filtri (fail-CLOSED).
 *
 * Muammo: ko'p joyda `if (role === 'rahbar' && req.user.viloyat)` ishlatilardi —
 * agar rahbar viloyati `null` bo'lsa (admin xato sozlasa), shart `false` bo'lib
 * filtr `{}` ga aylanib, rahbar BARCHA viloyat ma'lumotini ko'rardi (fail-open).
 *
 * Bu yerda aksincha: rahbar HAR DOIM viloyatga bog'lanadi; viloyati yo'q bo'lsa
 * hech qachon mos kelmaydigan ObjectId qaytadi → bo'sh natija (fail-closed).
 * Admin uchun bo'sh filtr (hamma narsa).
 *
 * @param {object} req — Express req (req.user kerak)
 * @param {string} field — hujjatdagi viloyat maydoni nomi (default 'viloyat')
 */
const IMPOSSIBLE_ID = new mongoose.Types.ObjectId('000000000000000000000000');

export function viloyatScope(req, field = 'viloyat') {
  if (req.user?.role === 'rahbar') {
    return { [field]: req.user.viloyat ?? IMPOSSIBLE_ID };
  }
  return {};
}

/**
 * Rahbarning viloyati berilgan viloyatga mosligini tekshiradi.
 * Admin uchun har doim true. Rahbar viloyatsiz bo'lsa har doim false.
 */
export function viloyatMatches(req, viloyatId) {
  if (req.user?.role !== 'rahbar') return true;
  if (!req.user.viloyat || !viloyatId) return false;
  return String(req.user.viloyat) === String(viloyatId);
}
