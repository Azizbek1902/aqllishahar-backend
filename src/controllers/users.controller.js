import Joi from 'joi';
import { User } from '../models/User.js';
import { Log } from '../models/Log.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';
import { regexEscape } from '../utils/regexEscape.js';

export const createUserSchema = Joi.object({
  fullName: Joi.string().min(2).required(),
  username: Joi.string().min(3).pattern(/^[a-z0-9_.]+$/).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(4).required(),
  role: Joi.string().valid('admin', 'rahbar').required(),
  viloyatId: Joi.string().hex().length(24).when('role', { is: 'rahbar', then: Joi.required() }),
  tumanId:   Joi.string().hex().length(24).allow(null, '').optional(),
});

export const updateUserSchema = Joi.object({
  fullName: Joi.string().min(2),
  username: Joi.string().min(3).pattern(/^[a-z0-9_.]+$/),
  email: Joi.string().email(),
  password: Joi.string().min(4).allow(''),
  role: Joi.string().valid('admin', 'rahbar'),
  viloyatId: Joi.string().hex().length(24).allow(null, ''),
  tumanId:   Joi.string().hex().length(24).allow(null, ''),
  isActive: Joi.boolean(),
});

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  // users endpoint faqat admin/rahbar uchun (ishchi alohida /api/workers da)
  const filter = { role: { $in: ['admin', 'rahbar'] } };
  if (req.query.search) {
    const re = new RegExp(regexEscape(req.query.search), 'i');
    filter.$or = [{ fullName: re }, { username: re }, { email: re }];
  }
  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('viloyat');
  res.json({
    users: users.map((u) => u.toPublic()),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const create = asyncHandler(async (req, res) => {
  const { fullName, username, email, password, role, viloyatId, tumanId } = req.body;
  const exists = await User.findOne({ $or: [{ email }, { username }] });
  if (exists) throw new ApiError(409, 'user.error.emailTaken', 'Email or username already taken');
  const user = new User({ fullName, username, email, role, viloyat: viloyatId ?? null, tuman: tumanId ?? null });
  await user.setPassword(password);
  await user.save();
  await Log.create({ user: req.user._id, userName: req.user.fullName, actionKey: 'log.actions.userCreated', target: email });
  res.status(201).json({ user: user.toPublic() });
});

export const update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+passwordHash');
  if (!user) throw new ApiError(404, 'error.notFound');
  if (req.body.fullName !== undefined) user.fullName = req.body.fullName;
  if (req.body.username !== undefined) user.username = req.body.username;
  if (req.body.email !== undefined) user.email = req.body.email;
  if (req.body.role !== undefined) user.role = req.body.role;
  if (req.body.viloyatId !== undefined) user.viloyat = req.body.viloyatId || null;
  if (req.body.tumanId !== undefined)   user.tuman   = req.body.tumanId   || null;
  if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
  if (req.body.password) {
    await user.setPassword(req.body.password);
  }
  await user.save();
  await Log.create({ user: req.user._id, userName: req.user.fullName, actionKey: 'log.actions.userEdited', target: user.email });
  res.json({ user: user.toPublic() });
});

export const remove = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(400, 'user.error.cannotDeleteSelf', 'Cannot delete yourself');
  }
  const u = await User.findByIdAndDelete(req.params.id);
  if (!u) throw new ApiError(404, 'error.notFound');
  await Log.create({ user: req.user._id, userName: req.user.fullName, actionKey: 'log.actions.userDeleted', target: u.email });
  res.json({ ok: true });
});
