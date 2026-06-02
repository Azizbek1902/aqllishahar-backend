import mongoose from 'mongoose';

/**
 * Reading — har bir Point dan olingan o'qish.
 * Endi ishchi orqali olinadi: device + point + visit + worker bog'lanadi.
 *
 * Eski sxemadagi 'sensor' o'rniga 'device' ishlatildi.
 * GPS koordinata (gpsLat/gpsLng) — ishchi qayerdan yuborganini audit qilish uchun.
 */
const readingSchema = new mongoose.Schema(
  {
    device:  { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    point:   { type: mongoose.Schema.Types.ObjectId, ref: 'Point',  required: true, index: true },
    visit:   { type: mongoose.Schema.Types.ObjectId, ref: 'Visit',  required: true, index: true },
    worker:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true, index: true },
    hudud:   { type: mongoose.Schema.Types.ObjectId, ref: 'Hudud',  required: true, index: true },
    mfy:     { type: mongoose.Schema.Types.ObjectId, ref: 'MFY',    required: true, index: true },
    viloyat: { type: mongoose.Schema.Types.ObjectId, ref: 'Viloyat', required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    // Sensor parametrlari
    moisture:    Number,
    temperature: Number,
    nitrogen:    Number,
    phosphorus:  Number,
    potassium:   Number,
    ph:          Number,
    ec:          Number,
    // Ishchi yuborgan paytdagi GPS — point bilan solishtirib tekshiriladi
    gpsLat: { type: Number, required: true },
    gpsLng: { type: Number, required: true },
  },
  { timestamps: false }
);

readingSchema.index({ point: 1, timestamp: -1 });
readingSchema.index({ hudud: 1, timestamp: -1 });
readingSchema.index({ worker: 1, timestamp: -1 });

export const Reading = mongoose.model('Reading', readingSchema);
