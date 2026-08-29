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

  /**
   * Body parsing.
   *
   * Both parsers are content-type gated: `express.json()` only consumes
   * `application/json`, `express.urlencoded()` only
   * `application/x-www-form-urlencoded`. Anything else is passed along with its
   * stream unread.
   *
   * THAT IS WHAT MAKES PORTFOLIO UPLOADS WORK. Document uploads send raw bytes
   * with a binary content type (`application/pdf`, `image/png`, ...), so neither
   * parser touches them and `document.service.js` can read the stream itself
   * under its own byte cap. Adding a catch-all body parser here — `express.raw()`
   * without a `type`, say — would consume that stream first and defeat the upload
   * size limit, since the body would already be buffered before any check ran.
   *
   * The 1mb cap applies to JSON bodies only; uploads are capped separately and
   * more strictly by UPLOAD_LIMITS.
   */
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  /**
   * NO STATIC FILE MIDDLEWARE, deliberately.
   *
   * `express.static('uploads')` would be the obvious way to serve portfolio
   * documents and would also make every student's uploaded file readable by
   * anyone who knows or guesses its name, with no authentication at all. Files
   * are served instead by an authenticated controller that will only return a
   * document referenced by the requesting student's own profile.
   */

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
