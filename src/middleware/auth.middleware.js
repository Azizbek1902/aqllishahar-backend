import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/User.js';
import { ApiError } from './error.middleware.js';

export async function authRequired(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'auth.error.tokenMissing', 'Token missing');
    }
    const token = header.slice(7);
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new ApiError(401, 'auth.error.userInactive', 'User inactive or not found');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err.status ? err : new ApiError(401, 'auth.error.invalidToken', 'Invalid token'));
  }
}
