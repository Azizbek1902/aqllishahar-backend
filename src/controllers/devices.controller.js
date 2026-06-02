import crypto from 'crypto';
import Joi from 'joi';
import mongoose from 'mongoose';
import { Device } from '../models/Device.js';
import { User } from '../models/User.js';
import { DeviceModel } from '../models/DeviceModel.js';
import { Log } from '../models/Log.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';
import { regexEscape } from '../utils/regexEscape.js';
import { serialize } from '../utils/serialize.js';

/**
 * Devices — portativ qurilmalar.
 * Har bir qurilma 1:1 ishchi bilan biriktirilishi mumkin (yoki null = skladda).
 */

export const createDeviceSchema = Joi.object({
  serialNumber:  Joi.string().required(),
  deviceModelId: Joi.string().hex().length(24).required(),
  assignedTo:    Joi.string().hex().length(24).allow(null, '').optional(),
});

export const updateDeviceSchema = Joi.object({
  serialNumber:  Joi.string(),
  deviceModelId: Joi.string().hex().length(24),
  assignedTo:    Joi.string().hex().length(24).allow(null, ''),
  isActive:      Joi.boolean(),
});

export const list = asyncHandler(async (req, res) => {
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.search) {
    const re = new RegExp(regexEscape(req.query.search), 'i');
    filter.$or = [{ serialNumber: re }, { model: re }];
  }
  if (req.query.assignedTo === 'none')   filter.assignedTo = null;
  if (req.query.assignedTo === 'any')    filter.assignedTo = { $ne: null };
  if (mongoose.isValidObjectId(req.query.assignedTo)) filter.assignedTo = req.query.assignedTo;

  const total   = await Device.countDocuments(filter);
  const devices = await Device.find(filter)
    .populate('deviceModel', 'name fieldMap expectedIntervalSec')
    .populate('assignedTo', 'fullName username')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  res.json({
    devices: serialize(devices),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const get = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const query = Device.findById(req.params.id)
    .populate('deviceModel')
    .populate('assignedTo', 'fullName username');
  if (req.user.role === 'admin') query.select('+apiKey');
  const device = await query.lean();
  if (!device) throw new ApiError(404, 'error.notFound');
  res.json({ device: serialize(device) });
});

export const create = asyncHandler(async (req, res) => {
  const { serialNumber, deviceModelId, assignedTo } = req.body;

  const dm = await DeviceModel.findById(deviceModelId).lean();
  if (!dm) throw new ApiError(400, 'deviceModel.error.notFound');

  // Ishchi mavjudligini tekshiramiz (agar berilsa)
  if (assignedTo) {
    const worker = await User.findOne({ _id: assignedTo, role: 'ishchi' }).lean();
    if (!worker) throw new ApiError(400, 'worker.error.notFound');
    // 1:1 — bu ishchida boshqa qurilma yo'qmi?
    const existing = await Device.findOne({ assignedTo: worker._id }).lean();
    if (existing) throw new ApiError(409, 'device.error.workerHasDevice',
      "Bu ishchida allaqachon qurilma bor");
  }

  const device = await Device.create({
    serialNumber,
    model:        dm.name,
    deviceModel:  dm._id,
    assignedTo:   assignedTo || null,
    apiKey:       crypto.randomBytes(32).toString('hex'),
  });

  await Log.create({
    user: req.user._id,
    userName: req.user.fullName,
    actionKey: 'log.actions.deviceCreated',
    target: device.serialNumber,
  });
  const full = await Device.findById(device._id).select('+apiKey').populate('deviceModel').populate('assignedTo', 'fullName username').lean();
  res.status(201).json({ device: serialize(full) });
});

export const update = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const device = await Device.findById(req.params.id);
  if (!device) throw new ApiError(404, 'error.notFound');

  if (req.body.serialNumber !== undefined) device.serialNumber = req.body.serialNumber;
  if (req.body.deviceModelId !== undefined) {
    const dm = await DeviceModel.findById(req.body.deviceModelId).lean();
    if (!dm) throw new ApiError(400, 'deviceModel.error.notFound');
    device.deviceModel = dm._id;
    device.model = dm.name;
  }
  if (req.body.assignedTo !== undefined) {
    const newWorker = req.body.assignedTo || null;
    if (newWorker) {
      const worker = await User.findOne({ _id: newWorker, role: 'ishchi' }).lean();
      if (!worker) throw new ApiError(400, 'worker.error.notFound');
      const existing = await Device.findOne({ assignedTo: worker._id, _id: { $ne: device._id } }).lean();
      if (existing) throw new ApiError(409, 'device.error.workerHasDevice');
    }
    device.assignedTo = newWorker;
  }
  if (req.body.isActive !== undefined) device.isActive = req.body.isActive;
  await device.save();
  await Log.create({
    user: req.user._id,
    userName: req.user.fullName,
    actionKey: 'log.actions.deviceEdited',
    target: device.serialNumber,
  });
  const full = await Device.findById(device._id).populate('deviceModel').populate('assignedTo', 'fullName username').lean();
  res.json({ device: serialize(full) });
});

export const remove = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const device = await Device.findByIdAndDelete(req.params.id);
  if (!device) throw new ApiError(404, 'error.notFound');
  await Log.create({
    user: req.user._id,
    userName: req.user.fullName,
    actionKey: 'log.actions.deviceDeleted',
    target: device.serialNumber,
  });
  res.json({ ok: true });
});

export const regenerateApiKey = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'error.notFound');
  const device = await Device.findByIdAndUpdate(
    req.params.id,
    { apiKey: crypto.randomBytes(32).toString('hex') },
    { new: true },
  ).select('+apiKey');
  if (!device) throw new ApiError(404, 'error.notFound');
  await Log.create({
    user: req.user._id,
    userName: req.user.fullName,
    actionKey: 'log.actions.deviceEdited',
    target: device.serialNumber,
  });
  res.json({ apiKey: device.apiKey });
});

/** Ishchining mobile da o'z qurilmasini ko'rishi (apiKey bilan — ingest uchun kerak) */
export const myDevice = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ishchi') throw new ApiError(403, 'error.forbidden');
  const device = await Device.findOne({ assignedTo: req.user._id })
    .select('+apiKey')
    .populate('deviceModel')
    .lean();
  if (!device) throw new ApiError(404, 'device.error.notAssigned',
    "Sizga qurilma biriktirilmagan");
  res.json({ device: serialize(device) });
});
