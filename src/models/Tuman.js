import mongoose from 'mongoose';

const tumanSchema = new mongoose.Schema(
  {
    nameUz: { type: String, required: true },
    nameRu: { type: String, required: true },
    nameEn: { type: String, required: true },
    viloyat: { type: mongoose.Schema.Types.ObjectId, ref: 'Viloyat', required: true, index: true },
    centerLat: { type: Number },
    centerLng: { type: Number },
  },
  { timestamps: true },
);

export const Tuman = mongoose.model('Tuman', tumanSchema);
