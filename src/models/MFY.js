import mongoose from 'mongoose';

/**
 * MFY — Mahalla Fuqarolari Yig'ini.
 * Farg'ona mahallalari (74 ta) geojson'dan import qilinadi.
 * Faqat ko'rsatish uchun (admin xaritada chizish va rahbar ko'rishi uchun).
 * Hudud yaratilganda admin tomonidan parent sifatida tanlanadi.
 */
const mfySchema = new mongoose.Schema(
  {
    nameUz: { type: String, required: true, trim: true, index: true },
    nameRu: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    code:   { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    tuman:  { type: mongoose.Schema.Types.ObjectId, ref: 'Tuman', default: null, index: true },
    color:  { type: String, default: '#3b82f6' },          // xaritada chiziq rangi
    // GeoJSON Polygon: { type: 'Polygon', coordinates: [[[lng, lat], ...]] }
    polygon: {
      type: { type: String, enum: ['Polygon'], default: 'Polygon' },
      coordinates: { type: [[[Number]]], required: true },
    },
    // Tezroq xaritada o'rta nuqta label uchun
    center: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
  },
  { timestamps: true }
);

// 2dsphere indeks — kelajakda geo so'rovlar (nuqta MFY ichidami?) uchun
mfySchema.index({ polygon: '2dsphere' });

export const MFY = mongoose.model('MFY', mfySchema);
