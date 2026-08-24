/**
 * Skills section — the student's skills, grouped, with add / update / remove.
 *
 * The selectable skills come from GET /skills. Students choose from the
 * catalogue instead of typing free text, which is what actually delivers RULES.md
 * section 14's "consistent skill representation": if only one spelling of
 * "MongoDB" exists to pick, no second one can be created. PHASES.md explicitly
 * allows a predefined list for the MVP.
 *
 * Grouping follows DESIGN.md section 24: category as the heading, then the
 * domain tag as the sub-heading, then the skill with its proficiency.
 */

import { useEffect, useMemo, useState } from 'react';

import { fetchSkills } from '../../api/catalogue.api.js';
import {
  SKILL_CATEGORY_LABELS,
  SKILL_CATEGORY_ORDER,
  levelLabelForScore,
  sourceLabel,
  styleForScore,
} from '../../constants/skills.js';
import { isValid, validateSkillSelection } from '../../utils/profileValidation.js';
import Alert from '../ui/Alert.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';
import Select from '../ui/Select.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import SkillLevelPicker from './SkillLevelPicker.jsx';

/** First tag wins as the sub-heading; skills with no tags fall into "Other". */
const domainOf = (skill) => skill.tags?.[0] ?? 'Other';

export default function SkillsSection({
  profile,
  isSaving = false,
  onAdd,
  onUpdateLevel,
  onRemove,
}) {
  const [catalogue, setCatalogue] = useState([]);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(true);
  const [catalogueError, setCatalogueError] = useState(null);

  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState({ skillId: '', level: '' });
  const [draftErrors, setDraftErrors] = useState({});

  /** The skill currently being re-levelled, or null. */
  const [editingSkillId, setEditingSkillId] = useState(null);
  const [editingLevel, setEditingLevel] = useState('');

  const mySkills = useMemo(() => profile?.skills ?? [], [profile?.skills]);

  useEffect(() => {
    let isActive = true;

    (async () => {
      setIsLoadingCatalogue(true);
      setCatalogueError(null);
      try {
        const loaded = await fetchSkills();
        if (isActive) setCatalogue(loaded);
      } catch (error) {
        if (isActive) setCatalogueError(error);
      } finally {
        if (isActive) setIsLoadingCatalogue(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  /**
   * Catalogue entries the student has not already added.
   *
   * Filtering here means the duplicate 409 is close to unreachable through the
   * UI — but the server still enforces it, because a stale tab could hold an
   * out-of-date list.
   */
  const availableOptions = useMemo(() => {
    const taken = new Set(mySkills.map((entry) => entry.skillId));

    return catalogue
      .filter((skill) => !taken.has(skill.id))
      .map((skill) => ({
        value: skill.id,
        label: `${skill.name}${skill.tags?.length ? ` · ${skill.tags[0]}` : ''}`,
      }));
  }, [catalogue, mySkills]);

  /** category -> domain -> skills, for the display list. */
  const groupedSkills = useMemo(() => {
    const byCategory = new Map();

    for (const entry of mySkills) {
      const category = entry.category ?? 'technical';
      if (!byCategory.has(category)) byCategory.set(category, new Map());

      const domain = domainOf(entry);
      const byDomain = byCategory.get(category);
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain).push(entry);
    }

    // Highest level first inside each domain, so strengths lead.
    for (const byDomain of byCategory.values()) {
      for (const list of byDomain.values()) list.sort((a, b) => b.level - a.level);
    }

    return SKILL_CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => [
      category,
      [...byCategory.get(category).entries()].sort(([a], [b]) => a.localeCompare(b)),
    ]);
  }, [mySkills]);

  const resetDraft = () => {
    setDraft({ skillId: '', level: '' });
    setDraftErrors({});
    setIsAdding(false);
  };

  const handleAdd = async () => {
    const errors = validateSkillSelection(draft);
    if (!isValid(errors)) {
      setDraftErrors(errors);
      return;
    }

    try {
      await onAdd({ skillId: draft.skillId, level: Number(draft.level) });
      resetDraft();
    } catch {
      // Parent shows the banner. The draft is kept so a 409 (or a network blip)
      // does not make the student re-pick the skill and the level.
    }
  };

  const startEditing = (entry) => {
    setEditingSkillId(entry.skillId);
    setEditingLevel(entry.level);
  };

  const handleUpdate = async () => {
    try {
      await onUpdateLevel(editingSkillId, Number(editingLevel));
      setEditingSkillId(null);
    } catch {
      // Stay open so the choice is not lost.
    }
  };

  const handleRemove = async (entry) => {
    // A native confirm rather than a modal component: it is one destructive
    // action in the whole step, and a bespoke dialog would be more code than the
    // interaction warrants.
    const name = entry.name ?? 'this skill';
    if (!window.confirm(`Remove ${name} from your skills?`)) return;

    try {
      await onRemove(entry.skillId);
    } catch {
      // Parent shows the banner.
    }
  };

  const action =
    isAdding || isLoadingCatalogue || catalogueError ? null : (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsAdding(true)}
        disabled={availableOptions.length === 0}
      >
        Add a skill
      </Button>
    );

  return (
    <Card
      id="skills"
      title="Your skills"
      description="Add the skills you have and how confident you are with each one."
      action={action}
    >
      {catalogueError ? (
        <Alert variant="error" title="Could not load the skill list" message={catalogueError.message} />
      ) : null}

      {isAdding ? (
        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <div className="space-y-4">
            <Select
              label="Skill"
              name="skillId"
              value={draft.skillId}
              onChange={(event) => {
                setDraft((previous) => ({ ...previous, skillId: event.target.value }));
                setDraftErrors((previous) => ({ ...previous, skillId: undefined }));
              }}
              options={availableOptions}
              placeholder="Choose a skill"
              error={draftErrors.skillId}
              hint="Skills come from the shared catalogue, so everyone's profile uses the same names."
              disabled={isSaving}
              required
            />

            <SkillLevelPicker
              name="new-skill-level"
              value={draft.level}
              onChange={(level) => {
                setDraft((previous) => ({ ...previous, level }));
                setDraftErrors((previous) => ({ ...previous, level: undefined }));
              }}
              error={draftErrors.level}
              disabled={isSaving}
            />

            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={handleAdd} isLoading={isSaving}>
                {isSaving ? 'Adding…' : 'Add skill'}
              </Button>
              <Button size="sm" variant="secondary" onClick={resetDraft} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isLoadingCatalogue && mySkills.length === 0 ? (
        <div className="flex items-center gap-2.5 py-2 text-sm text-slate-500">
          <Spinner size="sm" />
          Loading skills…
        </div>
      ) : mySkills.length === 0 ? (
        <EmptyState
          title="No skills added yet"
          description="Start with three or four you use most. You can refine the levels whenever you like."
          action={
            !isAdding ? (
              <Button size="sm" onClick={() => setIsAdding(true)} disabled={availableOptions.length === 0}>
                Add your first skill
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-6">
          {groupedSkills.map(([category, domains]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-slate-900">
                {SKILL_CATEGORY_LABELS[category] ?? category}
              </h3>

              <div className="mt-3 space-y-4">
                {domains.map(([domain, entries]) => (
                  <div key={domain}>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {domain}
                    </p>

                    <ul className="mt-2 space-y-2">
                      {entries.map((entry) => {
                        const isEditingThis = editingSkillId === entry.skillId;
                        const styles = styleForScore(entry.level);

                        return (
                          <li
                            key={entry.skillId}
                            className="rounded-lg border border-slate-200 px-3.5 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-medium text-slate-900">
                                  {entry.name ?? 'Skill'}
                                </span>
                                {/* Says how the number was arrived at, so a
                                    self-reported level is never mistaken for a
                                    verified one. */}
                                <Badge variant={entry.verified ? 'success' : 'neutral'} size="sm">
                                  {entry.verified ? 'Verified' : sourceLabel(entry.source)}
                                </Badge>
                              </div>

                              <div className="flex shrink-0 items-center gap-3">
                                <Badge variant="outline" size="sm" className={styles.chip}>
                                  {levelLabelForScore(entry.level)}
                                </Badge>

                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      isEditingThis ? setEditingSkillId(null) : startEditing(entry)
                                    }
                                    disabled={isSaving}
                                  >
                                    {isEditingThis ? 'Close' : 'Change level'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-error-600 hover:bg-error-50"
                                    onClick={() => handleRemove(entry)}
                                    disabled={isSaving}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <ProgressBar
                              value={entry.level}
                              size="sm"
                              className="mt-2.5"
                              barClassName={styles.bar}
                              valueLabel={`${entry.level}%`}
                            />

                            {isEditingThis ? (
                              <div className="mt-3 border-t border-slate-100 pt-3">
                                <SkillLevelPicker
                                  name={`level-${entry.skillId}`}
                                  value={editingLevel}
                                  onChange={setEditingLevel}
                                  label={`Update your level in ${entry.name ?? 'this skill'}`}
                                  disabled={isSaving}
                                  compact
                                />

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button size="sm" onClick={handleUpdate} isLoading={isSaving}>
                                    {isSaving ? 'Saving…' : 'Save level'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setEditingSkillId(null)}
                                    disabled={isSaving}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoadingCatalogue && !catalogueError && availableOptions.length === 0 && mySkills.length > 0 ? (
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
          You have added every skill in the catalogue.
        </p>
      ) : null}
    </Card>
  );
}
