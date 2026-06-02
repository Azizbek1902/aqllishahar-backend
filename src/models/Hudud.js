import mongoose from 'mongoose';

/**
 * Hudud — admin xaritada chizgan polygon (namlik tekshirish maydoni).
 * Bitta MFY ichida bir nechta Hudud bo'lishi mumkin.
 * Yaratilganda backend avtomatik Point'lar generatsiya qiladi (Poisson-disk).
 *
 * Status:
 *   - active     — ishchi tashrif buyurishi mumkin
 *   - archived   — endi ishlatilmaydi (admin arxivlagan)
 */
const hududSchema = new mongoose.Schema(
  {
    nameUz: { type: String, required: true, trim: true },
    nameRu: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    mfy:    { type: mongoose.Schema.Types.ObjectId, ref: 'MFY', required: true, index: true },
    category: {
      type: String,
      enum: ['street', 'park', 'garden', 'square', 'field'],
      required: true,
    },
    // GeoJSON Polygon
    polygon: {
      type: { type: String, enum: ['Polygon'], default: 'Polygon' },
      coordinates: { type: [[[Number]]], required: true },
    },
    // Hisoblangan markaz va maydon (m²) — performance uchun saqlanadi
    center: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    areaM2: { type: Number, required: true },
    // Sozlamalar — bo'sh bo'lsa .env defaultlari ishlatiladi
    pointToleranceM: { type: Number, default: null },   // null = .env GPS_POINT_TOLERANCE_M
    hududToleranceM: { type: Number, default: null },   // null = .env GPS_HUDUD_TOLERANCE_M
    status:    { type: String, enum: ['active', 'archived'], default: 'active', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

hududSchema.index({ polygon: '2dsphere' });

export const Hudud = mongoose.model('Hudud', hududSchema);
