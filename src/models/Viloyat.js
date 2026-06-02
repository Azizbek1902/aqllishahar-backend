import mongoose from 'mongoose';

const viloyatSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    nameUz: { type: String, required: true },
    nameRu: { type: String, required: true },
    nameEn: { type: String, required: true },
    centerLat: { type: Number, required: true },
    centerLng: { type: Number, required: true },
  },
  { timestamps: true }
);

export const Viloyat = mongoose.model('Viloyat', viloyatSchema);
