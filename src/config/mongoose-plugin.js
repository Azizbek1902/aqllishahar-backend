import mongoose from 'mongoose';

mongoose.plugin((schema) => {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_, ret) => {
      if (ret._id) ret.id = ret._id.toString();
      delete ret._id;
      delete ret.passwordHash;
    },
  });
  schema.set('toObject', {
    virtuals: true,
    versionKey: false,
    transform: (_, ret) => {
      if (ret._id) ret.id = ret._id.toString();
      delete ret._id;
      delete ret.passwordHash;
    },
  });
});
