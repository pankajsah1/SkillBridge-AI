/**
 * Proficiency picker — the five named tiers from constants/skills.js.
 *
 * Named tiers rather than a 0-100 slider or number box, even though the API
 * stores a number. TRD.md section 21 anticipates exactly this ("the frontend can
 * convert scores into human-readable levels"), and the reason is that nobody can
 * honestly tell 71 from 73 about their own React ability. Each tier commits the
 * midpoint of its band, so a stored score always maps back to the tier it was
 * chosen from.
 *
 * Radio inputs rather than styled divs, so arrow keys move between options and
 * the group is announced as one control.
 */

import { PROFICIENCY_LEVELS, LEVEL_STYLES, levelKeyForScore } from '../../constants/skills.js';

export default function SkillLevelPicker({
  value,
  onChange,
  name,
  label = 'Your current level',
  error,
  disabled = false,
  compact = false,
}) {
  // Works whether the caller holds a tier key or a raw score.
  const selectedKey =
    value === '' || value === null || value === undefined ? '' : levelKeyForScore(value);

  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">{label}</legend>

      <div className={compact ? 'flex flex-wrap gap-1.5' : 'grid gap-2 sm:grid-cols-2'}>
        {PROFICIENCY_LEVELS.map((band) => {
          const isSelected = selectedKey === band.key;
          const styles = LEVEL_STYLES[band.key];

          return (
            <label
              key={band.key}
              className={[
                'flex cursor-pointer items-center gap-2.5 rounded-lg border transition',
                compact ? 'px-2.5 py-1.5' : 'p-3',
                isSelected
                  ? 'border-primary-300 bg-primary-50/60'
                  : 'border-slate-200 bg-white hover:border-slate-300',
                disabled ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              <input
                type="radio"
                name={name}
                value={band.score}
                checked={isSelected}
                // The number is what reaches the API; the label is what the
                // student reasoned about.
                onChange={() => onChange(band.score)}
                disabled={disabled}
                className="h-4 w-4 shrink-0 border-slate-300 text-primary-600 focus:ring-primary-500"
              />

              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${styles.bar}`} aria-hidden="true" />
                  <span className="text-sm font-medium text-slate-900">{band.label}</span>
                </span>

                {compact ? null : (
                  <span className="mt-0.5 block text-xs text-slate-500">{band.hint}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {error ? <p className="mt-1.5 text-xs text-error-600">{error}</p> : null}
    </fieldset>
  );
}
