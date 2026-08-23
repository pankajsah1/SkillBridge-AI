/**
 * Server entry point.
 *
 * Responsibilities: validate configuration, attempt the database connection,
 * start listening, and shut down cleanly.
 */

import createApp from './app.js';
import { env, validateEnv } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';

const startServer = async () => {
  validateEnv();

  // Attempt the DB connection but do not abort startup in development —
  // /health will report the real state either way.
  const dbConnected = await connectDatabase();

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log('');
    console.log('  SkillBridge AI — API server');
    console.log(`  Environment : ${env.nodeEnv}`);
    console.log(`  Listening   : http://localhost:${env.port}`);
    console.log(`  Health      : http://localhost:${env.port}${env.apiPrefix}/health`);
    console.log(`  Database    : ${dbConnected ? 'connected' : 'NOT connected'}`);
    console.log('');

    if (!dbConnected) {
      console.warn('  MongoDB is not connected. The API will run, but any');
      console.warn('  database-backed route will fail until it is available.');
      console.warn('  Run `npm run db:check` to diagnose.');
      console.log('');
    }
  });

  // ---------- Graceful shutdown ----------
  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received — shutting down.`);

    server.close(async () => {
      await disconnectDatabase();
      console.log('[server] Closed.');
      process.exit(0);
    });

    // Don't hang forever if a connection refuses to close.
    setTimeout(() => {
      console.error('[server] Forced exit after timeout.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled promise rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('[server] Uncaught exception:', error);
    process.exit(1);
  });

  return server;
};

startServer().catch((error) => {
  console.error('[server] Failed to start:', error);
  process.exit(1);
});
