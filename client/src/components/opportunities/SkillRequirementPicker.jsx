/**
 * Picks skills for an opportunity from the shared catalogue.
 *
 * THE CATALOGUE IS THE ONLY SOURCE OF SKILLS. An employer chooses from the same
 * list students pick their own skills from, which is what makes later matching
 * possible at all: two spellings of "MongoDB" cannot be compared, and if only one
 * exists to pick, no second one can be created. RULES.md section 14 asks for
 * exactly this, and there is deliberately no free-text escape hatch here.
 *
 * The list itself is fetched once by the form and passed in, not fetched here —
 * required and preferred skills would otherwise request the same catalogue twice
 * on every visit.
 *
 * REQUIRED VS PREFERRED. A required skill must state the level expected, because
 * "we require React" with no bar says nothing an applicant can measure themselves
 * against and nothing the later matching step can measure a gap against. A
 * preferred skill needs none: "React would be nice" is a complete thought. The
 * server enforces the same asymmetry, so this is not a UI-only nicety.
 */

import { useMemo, useState } from 'react';

import { levelLabelForScore, styleForScore } from '../../constants/skills.js';
import SkillLevelPicker from '../profile/SkillLevelPicker.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Select from '../ui/Select.jsx';
import { Spinner } from '../ui/Spinner.jsx';

export default function SkillRequirementPicker({
  label,
  description,
  /** `[{ skillId, requiredLevel? }]` */
  entries = [],
  onChange,
  /** The catalogue, from GET /skills. */
  catalogue = [],
  isLoadingCatalogue = false,
  catalogueError = null,
  /** Whether each entry must state a level. */
  withLevel = false,
  /** Ids used by the other list — they cannot be chosen here. */
  excludeIds = [],
  max,
  /** Server and client messages, keyed by the API's field paths. */
  errors = {},
  /** The field path this list reports under: `requiredSkills` or `preferredSkills`. */
  field,
  disabled = false,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState({ skillId: '', requiredLevel: '' });
  const [draftError, setDraftError] = useState(null);

  /** The entry whose level is being changed, or null. */
  const [editingId, setEditingId] = useState(null);
  const [editingLevel, setEditingLevel] = useState('');

  const byId = useMemo(() => {
    const map = new Map();
    for (const skill of catalogue) map.set(skill.id, skill);
    return map;
  }, [catalogue]);

  const isFull = typeof max === 'number' && entries.length >= max;

  /**
   * What is still choosable: not already in this list, and not in the other one.
   *
   * Excluding the other list here is what makes the "a skill cannot be both
   * required and preferred" rule unreachable through the UI. The server still
   * enforces it, because a stale tab could hold an out-of-date list.
   */
  const options = useMemo(() => {
    const taken = new Set([...entries.map((entry) => entry.skillId), ...excludeIds]);

    return catalogue
      .filter((skill) => !taken.has(skill.id))
      .map((skill) => ({
        value: skill.id,
        label: `${skill.name}${skill.tags?.length ? ` · ${skill.tags[0]}` : ''}`,
      }));
  }, [catalogue, entries, excludeIds]);

  const resetDraft = () => {
    setDraft({ skillId: '', requiredLevel: '' });
    setDraftError(null);
    setIsAdding(false);
  };

  const add = () => {
    if (!draft.skillId) {
      setDraftError('Choose a skill.');
      return;
    }

    if (withLevel && draft.requiredLevel === '') {
      setDraftError('Choose the level you expect.');
      return;
    }

    const entry = withLevel
      ? { skillId: draft.skillId, requiredLevel: Number(draft.requiredLevel) }
      : { skillId: draft.skillId };

    onChange([...entries, entry]);
    resetDraft();
  };

  const remove = (skillId) => {
    onChange(entries.filter((entry) => entry.skillId !== skillId));
    if (editingId === skillId) setEditingId(null);
  };

  const commitLevel = () => {
    onChange(
      entries.map((entry) =>
        entry.skillId === editingId ? { ...entry, requiredLevel: Number(editingLevel) } : entry,
      ),
    );
    setEditingId(null);
  };

  const listError = errors[field];

  return (
    <fieldset disabled={disabled}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <legend className="text-sm font-medium text-slate-700">{label}</legend>
        {typeof max === 'number' ? (
          <span className="text-xs tabular-nums text-slate-400">
            {entries.length}/{max}
          </span>
        ) : null}
      </div>

      {description ? <p className="mb-2.5 text-xs text-slate-500">{description}</p> : null}

      {catalogueError ? (
        <p className="mb-2.5 text-xs text-error-600">
          The skill list could not be loaded, so skills cannot be chosen right now.
        </p>
      ) : null}

      {isLoadingCatalogue ? (
        <div className="flex items-center gap-2.5 py-2 text-sm text-slate-500">
          <Spinner size="sm" />
          Loading the skill catalogue…
        </div>
      ) : null}

      {entries.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {entries.map((entry, index) => {
            const skill = byId.get(entry.skillId);
            const isEditingThis = editingId === entry.skillId;
            const entryError =
              errors[`${field}[${index}]`] ?? errors[`${field}[${index}].requiredLevel`];

            return (
              <li key={entry.skillId} className="rounded-lg border border-slate-200 px-3.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="min-w-0 truncate text-sm font-medium text-slate-900">
                    {/* An id here means the catalogue has not arrived yet, or the
                        skill was removed from it after this posting was written. */}
                    {skill?.name ?? 'Skill'}
                  </span>

                  <div className="flex shrink-0 items-center gap-2">
                    {withLevel && entry.requiredLevel !== undefined ? (
                      <Badge variant="outline" size="sm" className={styleForScore(entry.requiredLevel).chip}>
                        {levelLabelForScore(entry.requiredLevel)} expected
                      </Badge>
                    ) : null}

                    {withLevel ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (isEditingThis) {
                            setEditingId(null);
                            return;
                          }
                          setEditingId(entry.skillId);
                          setEditingLevel(entry.requiredLevel ?? '');
                        }}
                      >
                        {isEditingThis ? 'Close' : 'Change'}
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-error-600 hover:bg-error-50"
                      onClick={() => remove(entry.skillId)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                {entryError ? <p className="mt-1.5 text-xs text-error-600">{entryError}</p> : null}

                {isEditingThis ? (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <SkillLevelPicker
                      name={`${field}-level-${entry.skillId}`}
                      value={editingLevel}
                      onChange={setEditingLevel}
                      label={`Level expected in ${skill?.name ?? 'this skill'}`}
                      compact
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={commitLevel} disabled={editingLevel === ''}>
                        Save level
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {isAdding ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
          <div className="space-y-3">
            <Select
              label="Skill"
              name={`${field}-skill`}
              value={draft.skillId}
              onChange={(event) => {
                setDraft((previous) => ({ ...previous, skillId: event.target.value }));
                setDraftError(null);
              }}
              options={options}
              placeholder="Choose a skill"
              hint="Skills come from the shared catalogue, so every posting uses the same names."
            />

            {withLevel ? (
              <SkillLevelPicker
                name={`${field}-new-level`}
                value={draft.requiredLevel}
                onChange={(level) => {
                  setDraft((previous) => ({ ...previous, requiredLevel: level }));
                  setDraftError(null);
                }}
                label="Level expected"
                compact
              />
            ) : null}

            {draftError ? <p className="text-xs text-error-600">{draftError}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={add}>
                Add skill
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={resetDraft}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setIsAdding(true)}
          disabled={isLoadingCatalogue || Boolean(catalogueError) || isFull || options.length === 0}
        >
          {entries.length === 0 ? 'Add a skill' : 'Add another skill'}
        </Button>
      )}

      {listError ? <p className="mt-2 text-xs text-error-600">{listError}</p> : null}

      {!isLoadingCatalogue && !catalogueError && options.length === 0 && !isFull ? (
        <p className="mt-2 text-xs text-slate-500">
          Every skill in the catalogue is already listed in one of the two lists.
        </p>
      ) : null}
    </fieldset>
  );
}
