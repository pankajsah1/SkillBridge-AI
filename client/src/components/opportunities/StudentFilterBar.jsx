/**
 * The filter bar over the student's browse list.
 *
 * Four dimensions, because those are the four in his brief and in PHASES.md
 * PHASE 3: opportunity type, location, skills and work mode — plus a free-text
 * search over the title, description and location.
 *
 * DELIBERATELY NOT THE SAME BAR AS OwnerFilterBar. A student cannot filter by
 * status, because the only postings they are ever shown are open ones; an employer
 * has no use for filtering their own five postings by work mode. One shared bar
 * would need a flag on every control saying which audience it belongs to, and the
 * two lists would end up offering filters that do nothing.
 *
 * There is no "sort by best match" here and no relevance ordering. The API sorts
 * the list by deadline, soonest first, and does not compute a match score yet, so
 * offering one would mean inventing it in the browser — a number a student would
 * reasonably read as a verified fit.
 *
 * The skills filter is a disclosure rather than 36 checkboxes on permanent display:
 * the catalogue is long enough to bury the other four controls, and skills are the
 * filter people reach for last.
 */

import { useId, useMemo, useState } from 'react';

import {
  OPPORTUNITY_TYPE_LABELS,
  OPPORTUNITY_TYPE_ORDER,
  WORK_MODE_LABELS,
  WORK_MODE_ORDER,
} from '../../constants/opportunities.js';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import SearchInput from './SearchInput.jsx';

const typeOptions = OPPORTUNITY_TYPE_ORDER.map((type) => ({
  value: type,
  label: OPPORTUNITY_TYPE_LABELS[type],
}));

const workModeOptions = WORK_MODE_ORDER.map((mode) => ({
  value: mode,
  label: WORK_MODE_LABELS[mode],
}));

/** Same rule as the profile UI: the first tag names the group. */
const domainOf = (skill) => skill.tags?.[0] ?? 'Other';

const PinIcon = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Z" strokeLinecap="round" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

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

export default function StudentFilterBar({
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
  const panelId = `skill-filter-${useId()}`;

  const [isSkillPanelOpen, setIsSkillPanelOpen] = useState(false);
  /** Narrows the checkbox list. Purely local — no request, so no debounce. */
  const [skillQuery, setSkillQuery] = useState('');

  const byId = useMemo(() => {
    const map = new Map();
    for (const skill of catalogue) map.set(skill.id, skill);
    return map;
  }, [catalogue]);

  /**
   * The catalogue, grouped by domain and narrowed by the local query.
   *
   * A selected skill stays listed even when the query excludes it, so unticking is
   * never more than clearing the box away — the chips above can also do it, but a
   * checkbox that vanishes while still in force is the kind of thing that gets read
   * as a bug.
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
            label="Search opportunities"
            placeholder="Role, keyword or company location"
            disabled={disabled}
          />
        </div>

        <Select
          label="Opportunity type"
          name="studentType"
          value={filters.type}
          onChange={(event) => onChange({ type: event.target.value })}
          options={typeOptions}
          placeholder="Any type"
          disabled={disabled}
        />

        <Select
          label="Work mode"
          name="studentWorkMode"
          value={filters.workMode}
          onChange={(event) => onChange({ workMode: event.target.value })}
          options={workModeOptions}
          placeholder="Any work mode"
          disabled={disabled}
        />

        <div className="lg:col-span-2">
          <SearchInput
            value={filters.location}
            onChange={(location) => onChange({ location })}
            label="Location"
            placeholder="City or state, e.g. Bengaluru"
            icon={PinIcon}
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
              Skills
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
                  name="skillFilterQuery"
                  value={skillQuery}
                  onChange={(event) => setSkillQuery(event.target.value)}
                  placeholder="Type to narrow the list"
                  // Verified against buildDiscoveryFilter: the server uses `$in`
                  // across both skill lists, so more than one tick widens the
                  // results rather than narrowing them. Saying so prevents the
                  // reasonable assumption that it works the other way.
                  hint="Shows opportunities asking for any skill you tick, required or preferred."
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
