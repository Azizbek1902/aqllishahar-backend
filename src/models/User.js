import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    // Email — admin/rahbar uchun majburiy, ishchi uchun ixtiyoriy
    // (default qiymat YO'Q — sparse index ishlashi uchun, ishchida email umuman bo'lmaydi)
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'rahbar', 'ishchi'], required: true, index: true },
    viloyat: { type: mongoose.Schema.Types.ObjectId, ref: 'Viloyat', default: null },
    tuman:   { type: mongoose.Schema.Types.ObjectId, ref: 'Tuman',   default: null },
    // Ishchi uchun biriktirilgan hududlar (mobile da shu ro'yxat ko'rinadi)
    assignedHududs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hudud' }],
    phone: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/**
 * Populate qilingan obyektni ham, oddiy ObjectId ni ham xex string'ga aylantiradi.
 * Populate qilingan dokument uchun `.toString()` butun obyektni string'ga aylantirib yuborardi —
 * shu sababli avval `._id` ni olib, keyin string'ga aylantiramiz.
 */
function idStr(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (v._id != null) return v._id.toString();
  if (typeof v.toString === 'function') return v.toString();
  return String(v);
}

userSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    fullName: this.fullName,
    username: this.username,
    email: this.email,
    role: this.role,
    viloyatId: idStr(this.viloyat),
    tumanId:   idStr(this.tuman),
    assignedHududIds: (this.assignedHududs ?? []).map(idStr),
    phone: this.phone,
    avatarUrl: this.avatarUrl,
    isActive: this.isActive,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
