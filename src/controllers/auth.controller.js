import Joi from 'joi';
import { User } from '../models/User.js';
import { signToken } from '../utils/jwt.js';
import { ApiError, asyncHandler } from '../middleware/error.middleware.js';

/**
 * Login — bitta endpoint, lekin `client` (web|mobile) bilan rol cheklovi.
 * - client=web    → admin va rahbar kira oladi, ishchi rad etiladi
 * - client=mobile → faqat ishchi kira oladi, admin/rahbar rad etiladi
 * - client yo'q   → barchasi qabul (backward compat)
 */
export const loginSchema = Joi.object({
  identifier: Joi.string().min(2).required(),
  password:   Joi.string().min(4).required(),
  client:     Joi.string().valid('web', 'mobile').optional(),
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, password, client } = req.body;
  const id = identifier.toLowerCase().trim();
  const user = await User.findOne({
    $or: [{ email: id }, { username: id }],
  }).select('+passwordHash');

  if (!user || !user.isActive) {
    throw new ApiError(401, 'auth.error.invalidCredentials', 'Invalid credentials');
  }
  const ok = await user.checkPassword(password);
  if (!ok) {
    throw new ApiError(401, 'auth.error.invalidCredentials', 'Invalid credentials');
  }

  // Rol cheklovi
  if (client === 'web' && user.role === 'ishchi') {
    throw new ApiError(403, 'auth.error.workerWebDenied',
      "Ishchi hisobiga faqat mobile ilova orqali kirish mumkin");
  }
  if (client === 'mobile' && user.role !== 'ishchi') {
    throw new ApiError(403, 'auth.error.adminMobileDenied',
      "Bu hisob mobile ilovaga kira olmaydi");
  }

  user.lastLoginAt = new Date();
  await user.save();
  const token = signToken({ sub: user._id.toString(), role: user.role });
  res.json({ token, user: user.toPublic() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toPublic() });
});
