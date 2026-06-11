import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

const childSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  username:    { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 50 },
  password:    { type: String, required: true },
  therapistId: { type: String, required: true, index: true },
}, { timestamps: true });

// Hash password before saving (only when modified)
childSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  next();
});

// Constant-time password comparison
childSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Never include password in JSON responses
childSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    return ret;
  },
});

const Child = mongoose.model('Child', childSchema);
export default Child;
