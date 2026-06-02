import mongoose from 'mongoose';

/**
 * Device — portativ tuproq datchigi. Eski "Sensor" ning o'rnida.
 * Doim ishchida (1:1) — alohida joyga bog'lanmagan.
 * Har bir ingest so'rovida GPS koordinata yuboriladi, backend Point bilan solishtirib tekshiradi.
 */
const deviceSchema = new mongoose.Schema(
  {
    serialNumber: { type: String, required: true, unique: true, index: true },
    apiKey:       { type: String, unique: true, sparse: true, select: false },
    model:        { type: String, required: true },                                    // display name (deviceModel.name nusxasi)
    deviceModel:  { type: mongoose.Schema.Types.ObjectId, ref: 'DeviceModel', default: null },
    // 1:1 — har qurilma bir ishchiga biriktiriladi (kerak bo'lsa null bo'lishi mumkin: sklad)
    assignedTo:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    battery:      { type: Number, min: 0, max: 100, default: 100 },
    signal:       { type: Number, min: 0, max: 100, default: 100 },
    lastSeenAt:   { type: Date, default: null },
    isOnline:     { type: Boolean, default: false },
    isActive:     { type: Boolean, default: true },                                    // false = ishlatilmaydi
  },
  { timestamps: true }
);

// Bitta ishchining bir vaqtning o'zida faqat 1 ta qurilmasi bo'lishi mumkin (1:1 cheklov)
deviceSchema.index(
  { assignedTo: 1 },
  { unique: true, partialFilterExpression: { assignedTo: { $type: 'objectId' } } }
);

export const Device = mongoose.model('Device', deviceSchema);
