import { Log } from '../models/Log.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { regexEscape } from '../utils/regexEscape.js';

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = {};
  if (req.query.search) {
    const re = new RegExp(regexEscape(req.query.search), 'i');
    filter.$or = [{ userName: re }, { actionKey: re }, { target: re }];
  }
  const total = await Log.countDocuments(filter);
  const logs = await Log.find(filter)
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  res.json({ logs, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
});
