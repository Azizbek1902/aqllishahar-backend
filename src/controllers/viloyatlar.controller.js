import { Viloyat } from '../models/Viloyat.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const list = asyncHandler(async (_req, res) => {
  const items = await Viloyat.find().sort('nameUz');
  res.json({ viloyatlar: items });
});
