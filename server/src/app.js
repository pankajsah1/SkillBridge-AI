/**
 * Express application setup.
 *
 * This module builds and returns the app but never calls `listen()`. Keeping
 * those separate means tests (and future scripts) can import the app without
 * binding a port. `server.js` owns the listening.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, isDevelopment } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js';

const createApp = () => {
  const app = express();

  // ---------- Security & parsing ----------
  app.use(helmet());

  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ---------- Request logging (development only) ----------
  if (isDevelopment) {
    app.use(morgan('dev'));
  }

  // ---------- Routes ----------
  // A tiny root route so hitting the bare host is not a confusing 404.
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'SkillBridge AI API',
      data: {
        health: `${env.apiPrefix}/health`,
        docs: 'See README.md',
      },
    });
  });

  app.use(env.apiPrefix, apiRoutes);

  // ---------- Error handling (must stay last) ----------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
export { createApp };
