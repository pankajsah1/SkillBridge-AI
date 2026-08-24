/**
 * Catalogue routes — `${API_PREFIX}/skills` and `${API_PREFIX}/career-roles`.
 *
 * Both mount points come from TRD.md section 30. Exported separately so
 * routes/index.js keeps its flat, scannable `mounts` list.
 *
 * AUTHENTICATED BUT NOT ROLE-RESTRICTED. Reference data is not sensitive, so
 * there is no reason to gate it by role — and later steps need it from other
 * roles anyway (an INDUSTRY user posting an opportunity will pick required
 * skills from this same catalogue). Requiring a token rather than leaving it
 * public keeps the API's default closed, which is the habit worth having.
 *
 * WRITE ENDPOINTS ARE ABSENT ON PURPOSE. TRD.md section 30 reserves POST, PATCH
 * and DELETE for admins, and his section 2 defers admin CRUD. Skills and roles
 * are created by `npm run seed`.
 */

import { Router } from 'express';

import {
  getCareerRole,
  getCareerRoles,
  getSkill,
  getSkills,
} from '../controllers/catalogue.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateObjectIdParam } from '../validators/studentProfile.validator.js';

export const skillRoutes = Router();

skillRoutes.use(authenticate);
skillRoutes.get('/', getSkills);
skillRoutes.get('/:id', validateObjectIdParam('id'), getSkill);

export const careerRoleRoutes = Router();

careerRoleRoutes.use(authenticate);
careerRoleRoutes.get('/', getCareerRoles);
careerRoleRoutes.get('/:id', validateObjectIdParam('id'), getCareerRole);

export default { skillRoutes, careerRoleRoutes };
