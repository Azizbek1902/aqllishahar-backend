export class ApiError extends Error {
  constructor(status, messageKey, message) {
    super(message ?? messageKey);
    this.status = status;
    this.messageKey = messageKey;
  }
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { messageKey: 'error.notFound', message: 'Route not found' } });
}

export function errorHandler(err, _req, res, _next) {
  // Mongoose CastError (noto'g'ri ObjectId) → 404
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(404).json({ error: { messageKey: 'error.notFound', message: 'Resource not found' } });
  }
  // Mongoose Duplicate key error → 409
  if (err.code === 11000) {
    return res.status(409).json({ error: { messageKey: 'error.duplicate', message: 'Duplicate value' } });
  }

  const status = err.status || 500;
  const messageKey = err.messageKey || 'error.unknown';
  const payload = {
    error: {
      messageKey,
      message: err.message,
    },
  };
  if (process.env.NODE_ENV === 'development' && status >= 500) {
    payload.error.stack = err.stack;
  }
  res.status(status).json(payload);
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
