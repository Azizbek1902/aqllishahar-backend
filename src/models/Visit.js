import mongoose from 'mongoose';

/**
 * Visit — ishchining bir hududga tashrifi.
 * "Keldim" bosilganda ochiladi, barcha Point'lar tugagach yopiladi.
 *
 * Cheklash: bitta ishchining bir vaqtning o'zida faqat 1 ta active Visit'i bo'lishi mumkin.
 * Bu controller darajasida tekshiriladi (partial unique index ham qo'yiladi).
 */
const visitSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
    hudud:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hudud', required: true, index: true },
    startedAt:   { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
      index: true,
    },
    // Ishchi "Keldim" bosgan paytdagi GPS — keyin audit uchun
    arrivedGps: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    // Tugatilgan nuqtalar soni — tezroq UI uchun
    pointsTotal: { type: Number, default: 0 },
    pointsDone:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Bitta worker bir vaqtning o'zida faqat 1 ta active visit qila oladi.
// Partial index — faqat status='active' bo'lganlar uchun unique
visitSchema.index(
  { worker: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

export const Visit = mongoose.model('Visit', visitSchema);
