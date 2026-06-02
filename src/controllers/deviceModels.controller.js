import Joi from 'joi';
import { DeviceModel } from '../models/DeviceModel.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';

const PARAMS = ['moisture', 'temperature', 'nitrogen', 'phosphorus', 'potassium', 'ph', 'ec'];

const schema = Joi.object({
  name:                Joi.string().trim().required(),
  description:         Joi.string().allow('').default(''),
  expectedIntervalSec: Joi.number().integer().min(10).max(86400).default(300),
  fieldMap:    Joi.object(
    Object.fromEntries(PARAMS.map((p) => [p, Joi.string().allow('').default(p)]))
  ).default(),
});

export const list = asyncHandler(async (_req, res) => {
  const models = await DeviceModel.find().sort('name');
  res.json({ models });
});

export const getOne = asyncHandler(async (req, res) => {
  const model = await DeviceModel.findById(req.params.id);
  if (!model) throw new ApiError(404, 'error.notFound');
  res.json({ model });
});

export const create = asyncHandler(async (req, res) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) throw new ApiError(400, 'error.validation', error.message);
  const model = await DeviceModel.create(value);
  res.status(201).json({ model });
});

export const update = asyncHandler(async (req, res) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) throw new ApiError(400, 'error.validation', error.message);
  const model = await DeviceModel.findByIdAndUpdate(req.params.id, value, { new: true });
  if (!model) throw new ApiError(404, 'error.notFound');
  res.json({ model });
});

export const remove = asyncHandler(async (req, res) => {
  const model = await DeviceModel.findByIdAndDelete(req.params.id);
  if (!model) throw new ApiError(404, 'error.notFound');
  res.json({ ok: true });
});
