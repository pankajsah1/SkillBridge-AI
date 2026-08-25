/**
 * The three charts on the institution dashboard, drawn in CSS.
 *
 * NO CHART LIBRARY, AND THAT IS A DECISION RATHER THAN A SHORTCUT. Everything here
 * is a horizontal proportion — a share of a cohort, a share of postings — which is
 * a div with a width. Adding a charting dependency would ship a canvas renderer,
 * a tooltip engine and an axis system to draw eight rectangles, and would take the
 * numbers out of the DOM where a screen reader can reach them.
 *
 * EVERY BAR CARRIES ITS NUMBER AS TEXT. DESIGN.md section 40: meaning must survive
 * without colour. A bar is decoration; the figure beside it is the data.
 *
 * NOTHING HERE COMPUTES A STATISTIC. Shares, averages and gaps all arrive from the
 * server already worked out. These components choose a width and a colour, so a
 * chart can never disagree with the number printed next to it.
 */

/** Bar colour by band, coolest to warmest. Keyed to PROFICIENCY_LEVELS. */
const BAND_FILL = {
  BEGINNER: 'bg-slate-400',
  BASIC: 'bg-warning-400',
  INTERMEDIATE: 'bg-primary-400',
  ADVANCED: 'bg-primary-600',
  EXPERT: 'bg-success-600',
};

/** Clamped so a stray value can never draw past its track. */
const width = (share) => `${Math.min(Math.max(Number(share) || 0, 0), 100)}%`;

/**
 * One labelled row: caption, bar, figure.
 *
 * `fill` rather than a variant name, because the three charts colour their rows on
 * three different rules — band, cohort size, and gap severity — and inventing a
 * shared vocabulary for that would be a worse abstraction than a class name.
 */
export function BarRow({ label, sublabel, share, figure, fill = 'bg-primary-600' }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-slate-700">
          {label}
          {sublabel ? <span className="text-slate-400"> · {sublabel}</span> : null}
        </span>

        <span className="shrink-0 text-xs font-medium tabular-nums text-slate-600">{figure}</span>
      </div>

      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${fill}`} style={{ width: width(share) }} />
      </div>
    </div>
  );
}

/**
 * Readiness distribution across the five proficiency bands.
 *
 * Bands with nobody in them still draw, at zero width. A distribution that hides
 * its empty bands reads as if those bands do not exist, and "no student has reached
 * Expert" is the most actionable row on the chart.
 */
export function ReadinessChart({ bands = [], assessed = 0 }) {
  if (assessed === 0) {
    return (
      <p className="text-sm text-slate-600">
        No student has been assessed yet, so there is no readiness distribution to show. Readiness
        appears here as students complete skill assessments.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {bands.map((band) => (
        <BarRow
          key={band.key}
          label={band.label}
          sublabel={`${band.min}–${band.max}%`}
          share={band.share}
          figure={
            band.students === 0
              ? 'none'
              : `${band.students} ${band.students === 1 ? 'student' : 'students'} · ${band.share}%`
          }
          fill={BAND_FILL[band.key] ?? 'bg-primary-600'}
        />
      ))}

      <p className="pt-1 text-xs text-slate-400">
        Shares are of the {assessed} {assessed === 1 ? 'student' : 'students'} who have been
        assessed. Students who have not been assessed are counted separately above, never as 0%.
      </p>
    </div>
  );
}

/**
 * Readiness by branch, bars scaled to cohort size.
 *
 * TWO NUMBERS PER ROW, AND THE BAR IS THE COHORT NOT THE SCORE. The bar length is
 * how many students the branch has, because that is what makes an average
 * trustworthy or not — a 90% average over two students should not draw the longest
 * bar on the page.
 */
export function BranchChart({ branches = [], totalStudents = 0 }) {
  if (branches.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No student in this cohort has filled in a branch yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {branches.map((row) => (
        <BarRow
          key={row.branch}
          label={row.branch}
          sublabel={`${row.students} ${row.students === 1 ? 'student' : 'students'}`}
          share={totalStudents > 0 ? (row.students / totalStudents) * 100 : 0}
          figure={
            typeof row.averageReadiness === 'number'
              ? `${row.averageReadiness}% avg readiness`
              : 'not assessed yet'
          }
          fill="bg-primary-500"
        />
      ))}
    </div>
  );
}

/**
 * The skill gap table: what employers ask for against what this cohort has.
 *
 * TWO BARS PER SKILL, STACKED, SHARING ONE SCALE. Demand above, supply below, both
 * as a percentage — so the visual gap between the two bars *is* the gap number on
 * the right. A single bar of the difference would be smaller and would lose the two
 * facts that produced it.
 */
export function SkillGapChart({ gaps = [], livePostings = 0, students = 0 }) {
  if (gaps.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        There are no live postings with skill requirements to compare against yet. Once employers
        publish roles, the skills they ask for appear here beside the skills this cohort holds.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {gaps.map((row) => (
        <div key={row.skillId}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium text-slate-800">{row.name}</span>

            {/* The gap is the headline, so it is the bold number. A positive gap
                means employers want it more than this cohort has it. */}
            <span
              className={`shrink-0 text-xs font-semibold tabular-nums ${
                row.gap >= 40 ? 'text-error-600' : row.gap >= 15 ? 'text-warning-600' : 'text-slate-500'
              }`}
            >
              {row.gap > 0 ? `+${row.gap}` : row.gap} pt gap
            </span>
          </div>

          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[11px] text-slate-500">Employers</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-700" style={{ width: width(row.demandShare) }} />
              </div>
              <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                {row.postings} of {livePostings} roles
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[11px] text-slate-500">Students</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-primary-500" style={{ width: width(row.supplyShare) }} />
              </div>
              <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                {row.students} of {students} students
              </span>
            </div>
          </div>

          {/* Levels, only where both sides have one. "Employers want 75, students
              average 48" is the sentence a curriculum decision is made from. */}
          {typeof row.averageStudentLevel === 'number' ? (
            <p className="mt-1 text-[11px] text-slate-400">
              Employers ask for {row.averageRequiredLevel} on average; students who have it average{' '}
              {row.averageStudentLevel}
              {row.verifiedStudents > 0
                ? `, and ${row.verifiedStudents} have it assessment-verified`
                : ', none assessment-verified yet'}
              .
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-400">
              Nobody in this cohort lists this skill. Employers ask for{' '}
              {row.averageRequiredLevel} on average.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default { BarRow, ReadinessChart, BranchChart, SkillGapChart };
