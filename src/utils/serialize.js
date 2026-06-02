/**
 * Lean Mongo objektlarini client-friendly shaklga aylantirish:
 *   - `_id: ObjectId` → `id: "string"`
 *   - `__v` o'chiriladi
 *   - rekursiv ravishda populate qilingan sub-doc'larga ham qo'llaniladi
 *
 * Mongoose `toJSON` transform faqat full doc'lar uchun ishlaydi, lean uchun emas.
 * Shuning uchun lean natijalarni qo'lda transform qilamiz.
 */
export function serialize(input) {
  if (input == null) return input;
  if (Array.isArray(input)) return input.map(serialize);
  if (input instanceof Date) return input.toISOString();
  if (typeof input !== 'object') return input;
  // Mongo ObjectId — string ga aylantirish
  if (input.toHexString && typeof input.toHexString === 'function') {
    return input.toString();
  }

  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === '__v' || k === 'passwordHash') continue;
    if (k === '_id') {
      out.id = serialize(v);
      continue;
    }
    out[k] = serialize(v);
  }
  return out;
}
