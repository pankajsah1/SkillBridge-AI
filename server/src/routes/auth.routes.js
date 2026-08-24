/**
 * Auth routes, mounted at `${API_PREFIX}/auth` by routes/index.js.
 *
 * Middleware order per route is deliberate:
 *   validate -> handler                    (public: reject bad input early)
 *   authenticate -> handler                (protected: prove identity first)
 *   authenticate -> allowRoles -> handler  (401 before 403)
 */

import { Router } from 'express';

import { getMe, login, logout, register } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateLogin, validateRegister } from '../validators/auth.validator.js';

const router = Router();

// ---------------------------------------------------------------- public
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);

// ------------------------------------------------------------- protected
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
