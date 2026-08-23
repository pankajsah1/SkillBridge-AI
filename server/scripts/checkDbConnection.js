/**
 * Standalone MongoDB connectivity check.
 *
 *   npm run db:check
 *
 * Useful for isolating database problems from API problems: it connects,
 * reports the server version and collection count, then exits. Exit code 0
 * means the connection works, 1 means it does not.
 */

import mongoose from 'mongoose';
import { env, validateEnv } from '../src/config/env.js';

const redact = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

const run = async () => {
  console.log('SkillBridge AI — MongoDB connection check\n');

  validateEnv();

  if (!env.mongoUri) {
    console.error('FAIL  MONGODB_URI is not set in server/.env');
    process.exit(1);
  }

  console.log(`URI   ${redact(env.mongoUri)}`);
  console.log('...   connecting (8s timeout)\n');

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });

    const { host, name, db } = mongoose.connection;
    const admin = db.admin();
    const { version } = await admin.serverStatus();
    const collections = await db.listCollections().toArray();

    console.log('PASS  Connected successfully');
    console.log(`      Host        : ${host}`);
    console.log(`      Database    : ${name}`);
    console.log(`      Mongo server: v${version}`);
    console.log(`      Collections : ${collections.length}`);
    console.log('\nDatabase connectivity is working.');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`FAIL  ${error.message}\n`);
    console.error('Common causes:');
    console.error('  • Local MongoDB is not running (start the MongoDB service).');
    console.error('  • Atlas: your current IP is not in Network Access allowlist.');
    console.error('  • Atlas: wrong username/password, or password not URL-encoded.');
    console.error('  • Typo in MONGODB_URI in server/.env.');

    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

run();
