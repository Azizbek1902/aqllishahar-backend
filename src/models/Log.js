import mongoose from 'mongoose';

const logSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    actionKey: { type: String, required: true },
    target: { type: String, default: '' },
  },
  { timestamps: true }
);

logSchema.index({ createdAt: -1 });

export const Log = mongoose.model('Log', logSchema);
