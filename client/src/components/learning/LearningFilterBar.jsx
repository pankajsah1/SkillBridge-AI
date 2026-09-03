/**
 * The filter bar over the learning catalogue.
 *
 * Five dimensions, because those are the ones his brief names for discovery:
 * programme type, level, delivery mode and skills, plus a free-text search the
 * server runs over title, description, provider and instructor.
 *
 * DELIBERATELY NOT A WIDENED StudentFilterBar. That bar filters opportunities by
 * type, location, work mode and skills, and it also serves the academician browse
 * list — adding a `level` dimension and swapping location for delivery mode would
 * mean a flag on every control saying which of three audiences it belongs to, and
 * would put a Step 8 change inside a working Step 6/7 component. The anatomy is
 * copied on purpose so the two bars feel like the same product: same card, same
 * grid, same skill disclosure, same "Clear filters (N)".
 *
 * NO "SORT BY BEST MATCH" HERE EITHER. The relevance question is answered by the
 * "Recommended for you" strip above the list, which is the server's ranking against
 * this student's real gaps. A second ordering invented in the browser from whatever
 * page happens to be loaded would compete with it and lose.
 *
 * The skills panel is a disclosure rather than three dozen permanent checkboxes, for
 * the reason the opportunity bar gives: the catalogue is long enough to bury the
 * other four controls.
 *
 * `SearchInput` is imported from components/opportunities/ rather than copied. It is
 * a debounced text input with no opportunity vocabulary in it; moving it to
 * components/ui/ would be a rename across working files for tidiness alone.
 */

import { useId, useMemo, useState } from 'react';

import {
  DELIVERY_MODE_LABELS,
  DELIVERY_MODE_ORDER,
  LEARNING_PROGRAM_TYPE_LABELS,
  LEARNING_PROGRAM_TYPE_ORDER,
  PROGRAM_LEVEL_LABELS,
  PROGRAM_LEVEL_ORDER,
} from '../../constants/learning.js';
import SearchInput from '../opportunities/SearchInput.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import { Spinner } from '../ui/Spinner.jsx';

/** All three option lists come from the constants, so the UI cannot offer a value
 *  the API would reject — and the order is the constants' display order. */
const typeOptions = LEARNING_PROGRAM_TYPE_ORDER.map((type) => ({
  value: type,
  label: LEARNING_PROGRAM_TYPE_LABELS[type],
}));

const levelOptions = PROGRAM_LEVEL_ORDER.map((level) => ({
  value: level,
  label: PROGRAM_LEVEL_LABELS[level],
}));

const deliveryModeOptions = DELIVERY_MODE_ORDER.map((mode) => ({
  value: mode,
  label: DELIVERY_MODE_LABELS[mode],
}));

/** Same rule as the profile UI and the opportunity bar: the first tag names the group. */
const domainOf = (skill) => skill.tags?.[0] ?? 'Other';

function Chevron({ isOpen }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LearningFilterBar({
  filters,
  /** (partialFilters) => void */
  onChange,
  /** (skillId) => void */
  onToggleSkill,
  onClear,
  hasActiveFilters = false,
  activeFilterCount = 0,
  /** The catalogue, from GET /skills. */
  catalogue = [],
  isLoadingCatalogue = false,
  catalogueError = null,
  disabled = false,
}) {
  const panelId = `learning-skill-filter-${useId()}`;

  const [isSkillPanelOpen, setIsSkillPanelOpen] = useState(false);
  /** Narrows the checkbox list. Purely local — no request, so no debounce. */
  const [skillQuery, setSkillQuery] = useState('');

  const byId = useMemo(() => {
    const map = new Map();
    for (const skill of catalogue) map.set(skill.id, skill);
    return map;
  }, [catalogue]);

  /**
   * The catalogue, grouped by domain and narrowed by the local query. A ticked skill
   * stays listed even when the query excludes it, so a filter in force is never
   * invisible.
   */
  const grouped = useMemo(() => {
    const needle = skillQuery.trim().toLowerCase();
    const groups = new Map();

    for (const skill of catalogue) {
      const isSelected = filters.skills.includes(skill.id);
      const matches = !needle || skill.name.toLowerCase().includes(needle);
      if (!matches && !isSelected) continue;

      const domain = domainOf(skill);
      if (!groups.has(domain)) groups.set(domain, []);
      groups.get(domain).push(skill);
    }

    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalogue, skillQuery, filters.skills]);

  const selectedSkills = filters.skills.map((id) => ({
    id,
    // The id is the fallback: the catalogue may not have arrived yet, and a chip
    // must never render as "undefined".
    name: byId.get(id)?.name ?? 'Skill',
  }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <SearchInput
            value={filters.search}
            onChange={(search) => onChange({ search })}
            label="Search programs"
            placeholder="Title, provider or instructor"
            disabled={disabled}
          />
        </div>

        <Select
          label="Program type"
          name="learningType"
          value={filters.type}
          onChange={(event) => onChange({ type: event.target.value })}
          options={typeOptions}
          placeholder="Any type"
          disabled={disabled}
        />

        <Select
          label="Level"
          name="learningLevel"
          value={filters.level}
          onChange={(event) => onChange({ level: event.target.value })}
          options={levelOptions}
          placeholder="Any level"
          disabled={disabled}
        />

        <div className="lg:col-span-2">
          <Select
            label="Delivery mode"
            name="learningDeliveryMode"
            value={filters.deliveryMode}
            onChange={(event) => onChange({ deliveryMode: event.target.value })}
            options={deliveryModeOptions}
            placeholder="Any delivery mode"
            disabled={disabled}
          />
        </div>

        <div className="flex items-end lg:col-span-2">
          <button
            type="button"
            onClick={() => setIsSkillPanelOpen((previous) => !previous)}
            aria-expanded={isSkillPanelOpen}
            aria-controls={panelId}
            disabled={disabled}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
          >
            <span className="flex items-center gap-2">
              Skills taught
              {filters.skills.length > 0 ? (
                <Badge variant="primary" size="sm">
                  {filters.skills.length}
                </Badge>
              ) : null}
            </span>

            <Chevron isOpen={isSkillPanelOpen} />
          </button>
        </div>
      </div>

      {/* The chips stay visible when the panel is closed: a filter that is in
          force and invisible is how someone concludes the list is broken. */}
      {selectedSkills.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Filtering by:</span>

          {selectedSkills.map((skill) => (
            <Badge
              key={skill.id}
              variant="primary"
              size="sm"
              removable
              onRemove={() => onToggleSkill(skill.id)}
              removeLabel={`Remove the ${skill.name} filter`}
            >
              {skill.name}
            </Badge>
          ))}
        </div>
      ) : null}

      {isSkillPanelOpen ? (
        <div id={panelId} className="mt-4 border-t border-slate-100 pt-4">
          {catalogueError ? (
            <p className="text-xs text-error-600">
              The skill list could not be loaded, so skills cannot be used as a filter right now.
              The other filters still work.
            </p>
          ) : isLoadingCatalogue ? (
            <div className="flex items-center gap-2.5 text-sm text-slate-500">
              <Spinner size="sm" />
              Loading the skill catalogue…
            </div>
          ) : (
            <>
              <div className="max-w-sm">
                <Input
                  label="Find a skill"
                  name="learningSkillFilterQuery"
                  value={skillQuery}
                  onChange={(event) => setSkillQuery(event.target.value)}
                  placeholder="Type to narrow the list"
                  // Verified against buildProgramDiscoveryFilter: the server uses
                  // `$in` over targetSkills, so a second tick widens the results
                  // rather than narrowing them. Saying so prevents the reasonable
                  // assumption that it works the other way.
                  hint="Shows programs that teach any skill you tick."
                />
              </div>

              {grouped.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No skill in the catalogue matches “{skillQuery.trim()}”.
                </p>
              ) : (
                <div className="mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
                  {grouped.map(([domain, skills]) => (
                    <fieldset key={domain}>
                      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {domain}
                      </legend>

                      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {skills.map((skill) => (
                          <label
                            key={skill.id}
                            className="flex cursor-pointer items-center gap-2.5 py-0.5 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={filters.skills.includes(skill.id)}
                              onChange={() => onToggleSkill(skill.id)}
                              disabled={disabled}
                              className="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="min-w-0 truncate">{skill.name}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {/* Only offered when there is something to clear, and it says how much it
          will clear — "Clear filters (3)" is a different promise from one. */}
      {hasActiveFilters ? (
        <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={disabled}>
            Clear filters{activeFilterCount > 1 ? ` (${activeFilterCount})` : ''}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
