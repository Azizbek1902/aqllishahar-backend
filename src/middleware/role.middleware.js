import { ApiError } from './error.middleware.js';

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'auth.error.notAuthenticated'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'auth.error.forbidden', 'Forbidden'));
    }
    next();
  };
}

export function viloyatScope(req, _res, next) {
  if (req.user?.role === 'rahbar' && req.user.viloyat) {
    req.viloyatScope = req.user.viloyat;
  }
  next();
}
