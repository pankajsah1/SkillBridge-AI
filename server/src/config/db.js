/**
 * MongoDB connection handling via Mongoose.
 *
 * Design choice: a failed database connection does NOT kill the process in
 * development. The HTTP server still starts, and `GET /api/v1/health` reports
 * `database: "disconnected"`. That way a Mongo problem shows up as a clear,
 * readable status instead of a crash loop while you are still setting up.
 */

import mongoose from 'mongoose';
import { env, isProduction } from './env.js';

const READY_STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/** Human-readable state of the current Mongoose connection. */
export const getDatabaseStatus = () =>
  READY_STATE_LABELS[mongoose.connection.readyState] ?? 'unknown';

export const isDatabaseConnected = () => mongoose.connection.readyState === 1;

/**
 * Attempts to connect to MongoDB.
 * @returns {Promise<boolean>} true when connected, false when unreachable.
 */
export const connectDatabase = async () => {
  if (!env.mongoUri) {
    console.error('[db] MONGODB_URI is not set — skipping connection attempt.');
    return false;
  }

  // Fail fast rather than hanging for the default 30s.
  mongoose.set('strictQuery', true);

  try {
    const connection = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });

    console.log(
      `[db] Connected -> host=${connection.connection.host} db=${connection.connection.name}`,
    );
    return true;
  } catch (error) {
    console.error(`[db] Connection failed: ${error.message}`);
    console.error('[db] Check that MongoDB is running and MONGODB_URI is correct.');

    // In production a database-less API is useless, so surface it hard.
    if (isProduction) throw error;

    return false;
  }
};

/** Closes the connection cleanly (used by graceful shutdown). */
export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
  console.log('[db] Connection closed.');
};

// Surface connection drops that happen after a successful initial connect.
mongoose.connection.on('error', (error) => {
  console.error(`[db] Runtime connection error: ${error.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[db] Disconnected from MongoDB.');
});

export default connectDatabase;
