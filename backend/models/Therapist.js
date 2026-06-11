import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

const therapistSchema = new mongoose.Schema({
  therapistId: { type: String, required: true, unique: true, trim: true },
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  username:    { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 50 },
  password:    { type: String, required: true },
}, { timestamps: true });

therapistSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  next();
});

therapistSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

therapistSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    return ret;
  },
});

const Therapist = mongoose.model('Therapist', therapistSchema);
export default Therapist;
