import mongoose from 'mongoose';

/**
 * Qurilma modeli — har xil qurilmalar har xil kalit nomda data jo'natadi.
 * fieldMap: bizning standart parametr → qurilmaning kalit nomi
 * Bo'sh string ('') = qurilma bu parametrni jo'natmaydi → ingest da o'tkazib yuboriladi
 */
const deviceModelSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    /** Qurilma har necha sekundda data jo'natadi (default: 5 minut) */
    expectedIntervalSec: { type: Number, default: 300, min: 10 },
    fieldMap: {
      moisture:    { type: String, default: 'moisture' },
      temperature: { type: String, default: 'temperature' },
      nitrogen:    { type: String, default: 'nitrogen' },
      phosphorus:  { type: String, default: 'phosphorus' },
      potassium:   { type: String, default: 'potassium' },
      ph:          { type: String, default: 'ph' },
      ec:          { type: String, default: 'ec' },
    },
  },
  { timestamps: true },
);

export const DeviceModel = mongoose.model('DeviceModel', deviceModelSchema);
