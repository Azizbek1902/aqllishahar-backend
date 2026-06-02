import Joi from 'joi';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Hudud } from '../models/Hudud.js';
import { Device } from '../models/Device.js';
import { Log } from '../models/Log.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';
import { regexEscape } from '../utils/regexEscape.js';

/**
 * Workers — `ishchi` rolidagi User'lar bilan ishlash.
 * Foydalanuvchi modelida yashaydi (role='ishchi'), lekin alohida endpoint'lar bilan boshqariladi.
 */

export const createWorkerSchema = Joi.object({
  fullName: Joi.string().min(2).required(),
  username: Joi.string().min(3).pattern(/^[a-z0-9_.]+$/).required(),
  password: Joi.string().min(4).required(),
  phone:    Joi.string().allow('').optional(),
  viloyatId: Joi.string().hex().length(24).optional(),
  tumanId:   Joi.string().hex().length(24).allow(null, '').optional(),
  assignedHududIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
});

export const updateWorkerSchema = Joi.object({
  fullName: Joi.string().min(2),
  username: Joi.string().min(3).pattern(/^[a-z0-9_.]+$/),
  password: Joi.string().min(4).allow(''),
  phone:    Joi.string().allow(''),
  viloyatId: Joi.string().hex().length(24).allow(null, ''),
  tumanId:   Joi.string().hex().length(24).allow(null, ''),
  assignedHududIds: Joi.array().items(Joi.string().hex().length(24)),
  isActive: Joi.boolean(),
});

export const list = asyncHandler(async (req, res) => {
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = { role: 'ishchi' };
  // Rahbar — faqat o'z viloyati ishchilarini ko'radi (fail-closed: viloyatsiz → bo'sh)
  if (req.user.role === 'rahbar') {
    filter.viloyat = req.user.viloyat ?? new mongoose.Types.ObjectId('000000000000000000000000');
  }
  if (req.query.search) {
    const re = new RegExp(regexEscape(req.query.search), 'i');
    filter.$or = [{ fullName: re }, { username: re }, { phone: re }];
  }
  const total = await User.countDocuments(filter);
  const workers = await User.find(filter)
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('assignedHududs', 'nameUz nameRu nameEn')
    .populate('viloyat');

  // Har bir ishchi uchun device biriktirilganmi
  const ids = workers.map((w) => w._id);
  const devices = await Device.find({ assignedTo: { $in: ids } }).select('serialNumber assignedTo model').lean();
  const deviceByWorker = new Map(devices.map((d) => [d.assignedTo.toString(), d]));

  res.json({
    workers: workers.map((w) => ({
      ...w.toPublic(),
      device: deviceByWorker.get(w._id.toString()) ?? null,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const get = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const filter = { _id: req.params.id, role: 'ishchi' };
  // Rahbar — faqat o'z viloyati ishchisi (fail-closed: viloyatsiz → topilmaydi)
  if (req.user.role === 'rahbar') {
    filter.viloyat = req.user.viloyat ?? new mongoose.Types.ObjectId('000000000000000000000000');
  }
  const worker = await User.findOne(filter)
    .populate({ path: 'assignedHududs', populate: { path: 'mfy', select: 'nameUz nameRu nameEn' } });
  if (!worker) throw new ApiError(404, 'error.notFound');
  // apiKey — faqat admin ko'radi (rahbar uchun ko'rinmasin)
  const deviceQuery = Device.findOne({ assignedTo: worker._id });
  if (req.user.role === 'admin') deviceQuery.select('+apiKey');
  const device = await deviceQuery.lean();
  res.json({ worker: worker.toPublic(), device });
});

export const create = asyncHandler(async (req, res) => {
  const { fullName, username, password, phone, viloyatId, tumanId, assignedHududIds } = req.body;
  const exists = await User.findOne({ username });
  if (exists) throw new ApiError(409, 'user.error.usernameTaken');

  // Hududlar mavjudligini tekshiramiz
  if (assignedHududIds?.length) {
    const found = await Hudud.countDocuments({ _id: { $in: assignedHududIds } });
    if (found !== assignedHududIds.length) throw new ApiError(400, 'hudud.error.notFound');
  }

  const worker = new User({
    fullName,
    username,
    role: 'ishchi',
    viloyat: viloyatId ?? null,
    tuman:   tumanId   ?? null,
    phone:   phone ?? '',
    assignedHududs: assignedHududIds ?? [],
  });
  await worker.setPassword(password);
  await worker.save();
  await Log.create({
    user: req.user._id,
    userName: req.user.fullName,
    actionKey: 'log.actions.workerCreated',
    target: worker.username,
  });
  res.status(201).json({ worker: worker.toPublic() });
});

export const update = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const worker = await User.findOne({ _id: req.params.id, role: 'ishchi' });
  if (!worker) throw new ApiError(404, 'error.notFound');

  if (req.body.fullName !== undefined) worker.fullName = req.body.fullName;
  if (req.body.username !== undefined) worker.username = req.body.username;
  if (req.body.phone    !== undefined) worker.phone    = req.body.phone;
  if (req.body.viloyatId !== undefined) worker.viloyat = req.body.viloyatId || null;
  if (req.body.tumanId   !== undefined) worker.tuman   = req.body.tumanId   || null;
  if (req.body.isActive  !== undefined) worker.isActive = req.body.isActive;
  if (req.body.assignedHududIds !== undefined) {
    if (req.body.assignedHududIds.length) {
      const found = await Hudud.countDocuments({ _id: { $in: req.body.assignedHududIds } });
      if (found !== req.body.assignedHududIds.length) throw new ApiError(400, 'hudud.error.notFound');
    }
    worker.assignedHududs = req.body.assignedHududIds;
  }
  if (req.body.password) await worker.setPassword(req.body.password);
  await worker.save();
  await Log.create({
    user: req.user._id,
    userName: req.user.fullName,
    actionKey: 'log.actions.workerEdited',
    target: worker.username,
  });
  res.json({ worker: worker.toPublic() });
});

export const remove = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const worker = await User.findOneAndDelete({ _id: req.params.id, role: 'ishchi' });
  if (!worker) throw new ApiError(404, 'error.notFound');
  // Device dan ham ajratamiz
  await Device.updateMany({ assignedTo: worker._id }, { $set: { assignedTo: null } });
  await Log.create({
    user: req.user._id,
    userName: req.user.fullName,
    actionKey: 'log.actions.workerDeleted',
    target: worker.username,
  });
  res.json({ ok: true });
});
