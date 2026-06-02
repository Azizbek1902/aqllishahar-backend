import mongoose from 'mongoose';

/**
 * Point — Hudud ichidagi data olish nuqtasi.
 * Hudud yaratilganda avtomatik (Poisson-disk algoritmi) generatsiya qilinadi.
 *
 * MVP: bitta hudud bir martalik tashrif qilinadi.
 * Keyinroq re-visit qo'shilganda admin status'ni 'pending' ga qaytaradi.
 */
const pointSchema = new mongoose.Schema(
  {
    hudud:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hudud', required: true, index: true },
    lat:    { type: Number, required: true },
    lng:    { type: Number, required: true },
    order:  { type: Number, required: true },                    // ko'rsatish tartibi (1, 2, 3, ...)
    status: { type: String, enum: ['pending', 'done'], default: 'pending', index: true },
    // Oxirgi yuborilgan reading va kim yuborgani — tezroq query uchun
    lastReading: { type: mongoose.Schema.Types.ObjectId, ref: 'Reading', default: null },
    lastVisitedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

pointSchema.index({ hudud: 1, order: 1 });

export const Point = mongoose.model('Point', pointSchema);
