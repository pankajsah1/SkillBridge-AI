/**
 * Skill and career-role catalogue reads.
 *
 * One service for both because they are the same kind of thing — shared,
 * seeded, read-only reference data — and splitting sixty lines across two files
 * would be the "microservice-like structure" his section 6 warns against.
 *
 * READ-ONLY ON PURPOSE. TRD.md section 30 reserves POST/PATCH/DELETE on
 * /skills and /career-roles for admins, and his section 2 says not to build
 * admin CRUD in this step. Roles and skills come from `npm run seed`.
 *
 * This is what makes the "one source of truth" rule work: the frontend holds no
 * copy of either list, it fetches them from here.
 */

import AppError from '../utils/AppError.js';
import Skill from '../models/Skill.js';
import CareerRole from '../models/CareerRole.js';

/**
 * GET /skills
 *
 * Returns the whole active catalogue, unpaginated. That is a deliberate choice
 * rather than an oversight: the seed holds a few dozen skills, the skill picker
 * needs all of them at once to filter client-side, and paginating a list this
 * size would add a page-state bug surface for no benefit. If the catalogue ever
 * grows past a few hundred, buildPagination() in utils/apiResponse.js is ready.
 *
 * Optional filters mirror the two fields the UI groups by.
 */
export const listSkills = async ({ category, tag, search } = {}) => {
  const filter = { isActive: true };

  if (category) filter.category = category;
  if (tag) filter.tags = tag;

  if (search) {
    // Escaped so a user typing "C++" cannot break the query or write a regex.
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = new RegExp(escaped, 'i');
  }

  const skills = await Skill.find(filter).sort({ category: 1, name: 1 });

  return skills.map((skill) => skill.toPublicObject());
};

/** GET /skills/:id */
export const getSkillById = async (id) => {
  const skill = await Skill.findOne({ _id: id, isActive: true });

  if (!skill) {
    throw AppError.notFound('That skill could not be found.');
  }

  return skill.toPublicObject();
};

/**
 * GET /career-roles
 *
 * The list deliberately does NOT populate requiredSkills. A student choosing a
 * career goal needs titles and descriptions; dragging every role's full skill
 * blueprint along would multiply the payload for data the picker never shows.
 * The detail endpoint populates it.
 */
export const listCareerRoles = async ({ category } = {}) => {
  const filter = { isActive: true };
  if (category) filter.category = category;

  const roles = await CareerRole.find(filter).sort({ category: 1, title: 1 });

  return roles.map((role) => {
    const plain = role.toPublicObject();
    // requiredSkillCount survives; the unpopulated requirement list would only
    // be a list of opaque ids, so it is dropped rather than sent as noise.
    delete plain.requiredSkills;
    return plain;
  });
};

/**
 * GET /career-roles/:id
 *
 * Populates the blueprint so the client can show "React — Advanced expected"
 * without a second request per skill.
 */
export const getCareerRoleById = async (id) => {
  const role = await CareerRole.findOne({ _id: id, isActive: true }).populate({
    path: 'requiredSkills.skillId',
    select: 'name slug category tags',
  });

  if (!role) {
    throw AppError.notFound('That career role could not be found.');
  }

  return role.toPublicObject();
};

export default { listSkills, getSkillById, listCareerRoles, getCareerRoleById };
