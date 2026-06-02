import mongoose from 'mongoose';

/**
 * Alert — threshold buzilgan o'qishlar uchun ogohlantirish.
 * Endi Point/Hudud darajasida (sensor o'rniga).
 */
const alertSchema = new mongoose.Schema(
  {
    point:   { type: mongoose.Schema.Types.ObjectId, ref: 'Point',  required: true, index: true },
    hudud:   { type: mongoose.Schema.Types.ObjectId, ref: 'Hudud',  required: true, index: true },
    mfy:     { type: mongoose.Schema.Types.ObjectId, ref: 'MFY',    required: true, index: true },
    viloyat: { type: mongoose.Schema.Types.ObjectId, ref: 'Viloyat', required: true, index: true },
    device:  { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
    worker:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',   default: null },
    reading: { type: mongoose.Schema.Types.ObjectId, ref: 'Reading', default: null },
    parameter: {
      type: String,
      enum: ['moisture', 'temperature', 'nitrogen', 'phosphorus', 'potassium', 'ph', 'ec'],
      required: true,
    },
    status: { type: String, enum: ['critical', 'warning', 'optimal', 'high'], required: true },
    value: { type: Number, required: true },
    messageKey: { type: String, default: 'alert.warningMessage' },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const Alert = mongoose.model('Alert', alertSchema);
