/**
 * One-time script to create (or reset) the SuperAdmin account.
 * Run from the backend/ directory:
 *   node seeds/createAdmin.js
 *
 * Safe to re-run — upserts by username, so it won't create duplicates.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import SuperAdmin from '../models/SuperAdmin.js';

const USERNAME = 'admin';
const PASSWORD = 'AdminPass123!';

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('[FATAL] MONGO_URI is not set in .env');
  process.exit(1);
}

await mongoose.connect(uri);
console.log('[db] Connected');

// Delete any existing admin with this username (handles corrupt documents too)
await SuperAdmin.deleteMany({ username: USERNAME });

const admin = new SuperAdmin({ username: USERNAME, password: PASSWORD });
await admin.save();  // pre-save hook hashes the password automatically

console.log(`[ok] SuperAdmin "${USERNAME}" created successfully`);
console.log('     Login with:', USERNAME, '/', PASSWORD);
console.log('     Change this password after first login.');

await mongoose.disconnect();
