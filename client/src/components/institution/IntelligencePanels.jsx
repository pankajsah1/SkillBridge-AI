/**
 * The panels on the institution intelligence page.
 *
 * ONE FILE, SEVERAL SMALL COMPONENTS, THE SAME SHAPE AS `AnalyticsCharts.jsx`. These
 * are five views of one response and they share a vocabulary — priority, band, share
 * — so splitting them across five files would spread that vocabulary out without
 * making any of it reusable.
 *
 * NOTHING HERE COMPUTES A STATISTIC. Shares, gaps, bands, priorities, the
 * explanation sentences and the action list all arrive finished from the server.
 * These components choose a colour, a width and a word order. That is the rule the
 * Step 8 charts already follow, and it is what stops a figure on this page from
 * disagreeing with the same figure on the dashboard.
 *
 * NO CHART LIBRARY, FOR THE REASON THE STEP 8 CHARTS GIVE: every bar here is a
 * horizontal proportion, which is a div with a width, and every bar carries its
 * number as text so the meaning survives without colour.
 */

import Badge from '../ui/Badge.jsx';
import { APPLICATION_STATUSES } from '../../constants/applications.js';
import { BarRow } from './AnalyticsCharts.jsx';

/** Priority to badge colour. Warmest is most urgent, and the label carries the word. */
const PRIORITY_VARIANT = {
  CRITICAL: 'error',
  HIGH: 'warning',
  MEDIUM: 'primary',
  LOW: 'neutral',
};

/** Demand and supply bands, coloured on what they mean rather than how big they are. */
const DEMAND_FILL = { HIGH: 'bg-slate-800', MEDIUM: 'bg-slate-600', LOW: 'bg-slate-400' };

/** A share that may legitimately be absent prints as a dash, never as 0%. */
function Figure({ value, suffix = '%', hint }) {
  return (
    <>
      <span className="text-sm font-medium tabular-nums text-slate-800">
        {value === null || value === undefined ? (
          <span className="text-slate-300">—</span>
        ) : (
          `${value}${suffix}`
        )}
      </span>
      {hint ? <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span> : null}
    </>
  );
}

/**
 * A number and what it means.
 *
 * The Step 8 dashboard has its own copy of this, and it stays there: rewiring a
 * working page to import from here would be a refactor this step did not need, and
 * the two are four lines of markup that have never had to agree on anything.
 */
export function StatTile({ label, value, suffix = '', hint }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>

      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
        {value === null || value === undefined ? (
          <span className="text-slate-300">—</span>
        ) : (
          <>
            {value}
            {suffix ? <span className="text-base font-medium text-slate-500">{suffix}</span> : null}
          </>
        )}
      </p>

      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

/** The one word a judge reads first. */
export function PriorityBadge({ priority }) {
  return <Badge variant={PRIORITY_VARIANT[priority] ?? 'neutral'}>{priority}</Badge>;
}

/**
 * The table this page exists for: what industry asks for against what this cohort
 * holds, one row per skill, ordered most urgent first.
 *
 * A REAL TABLE, BECAUSE IT IS REAL TABULAR DATA. Six headed columns compared down
 * their length is exactly what `<table>` is for, and it is what lets a screen reader
 * announce "Docker, industry demand 31%" instead of reading six unlabelled numbers.
 *
 * TWO ROWS PER SKILL. The figures are on the first; the server's explanation sentence
 * is on the second, spanning the width. That sentence is the difference between a
 * dashboard and an argument — "0.78342" tells an institution nothing, "31% of live
 * postings ask for Docker while the students who list it average 53%" tells it what to
 * do — so it is given room rather than squeezed into a tooltip.
 */
export function SkillDemandTable({ rows = [], livePostings = 0, students = 0 }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No live posting lists a skill requirement yet, so there is nothing to compare this cohort
        against. The table fills in as employers publish roles.
      </p>
    );
  }

  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-2 py-2 font-medium">
              Skill
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Industry demand
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Student supply
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Avg proficiency
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Gap
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Priority
            </th>
          </tr>
        </thead>

        {/* One tbody per skill, so the figures and the sentence that explains them
            stay together when the table is read or copied. */}
        {rows.map((row) => (
          <tbody key={row.skillId} className="border-b border-slate-100 align-top">
            <tr>
              <th scope="row" className="px-2 pt-3 text-sm font-medium text-slate-900">
                {row.name}
                {row.category ? (
                  <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                    {row.category}
                  </span>
                ) : null}
              </th>

              <td className="px-2 pt-3">
                <Figure
                  value={row.demandShare}
                  hint={`${row.postings} of ${livePostings} ${livePostings === 1 ? 'role' : 'roles'} · ${row.demandBand}`}
                />
              </td>

              <td className="px-2 pt-3">
                <Figure
                  value={row.supplyShare}
                  hint={`${row.students} of ${students} ${students === 1 ? 'student' : 'students'} · ${row.supplyBand}`}
                />
              </td>

              <td className="px-2 pt-3">
                <Figure
                  value={row.averageStudentLevel}
                  hint={
                    row.averageStudentLevel === null
                      ? 'nobody lists it'
                      : `${row.proficiencyBand} · employers ask ${row.averageRequiredLevel}`
                  }
                />
              </td>

              <td className="px-2 pt-3">
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    row.gap >= 40
                      ? 'text-error-600'
                      : row.gap >= 15
                        ? 'text-warning-600'
                        : 'text-slate-500'
                  }`}
                >
                  {row.gap > 0 ? `+${row.gap}` : row.gap}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  {row.shortfall === null
                    ? 'coverage only'
                    : `${row.shortfall > 0 ? `${row.shortfall} pts` : 'no'} level shortfall`}
                </span>
              </td>

              <td className="px-2 pt-3">
                <PriorityBadge priority={row.priority} />
              </td>
            </tr>

            <tr>
              <td colSpan={6} className="px-2 pb-3 pt-1.5 text-xs text-slate-500">
                {row.explanation}
              </td>
            </tr>
          </tbody>
        ))}
      </table>
    </div>
  );
}

/**
 * What employers ask for most, ranked by demand alone.
 *
 * DELIBERATELY NOT THE GAP TABLE. That one is ordered by priority, so a skill this
 * cohort already covers well drops off it — correctly, because it is not a gap. But
 * the market itself must be reported without holes: a widely-requested skill the
 * students happen to be strong on is still one of the most-requested skills. So this
 * list has no reference to supply in it at all.
 */
export function DemandRanking({ skills = [], livePostings = 0 }) {
  if (skills.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No live posting lists a skill requirement yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <BarRow
          key={skill.skillId}
          label={skill.name}
          sublabel={`asks for ${skill.averageRequiredLevel} on average`}
          share={skill.demandShare}
          figure={`${skill.postings} of ${livePostings} · ${skill.demandShare}%`}
          fill={DEMAND_FILL[skill.demandBand] ?? 'bg-slate-600'}
        />
      ))}
    </div>
  );
}

/**
 * What the learning programmes have measurably changed, per skill.
 *
 * COMPLETION IS PARTICIPATION, NOT PROOF. The left half of each row is what happened
 * — programmes, enrolments, completions — and the right half is the only thing that
 * counts as evidence: a score from one submitted assessment against a score from a
 * later one. A row where nobody has sat the skill twice says so and shows no number,
 * because `+0` there reads as "the training did not work" when it means "nobody has
 * been measured since".
 */
export function LearningImpactList({ rows = [] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        There are no priority skills to track learning against yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => (
        <li key={row.skillId} className="flex flex-wrap gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-slate-900">{row.name}</span>
              <PriorityBadge priority={row.priority} />
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {row.programs} published {row.programs === 1 ? 'programme' : 'programmes'} ·{' '}
              {row.enrolments} {row.enrolments === 1 ? 'enrolment' : 'enrolments'} from{' '}
              {row.learners} {row.learners === 1 ? 'student' : 'students'} · {row.completed}{' '}
              completed
              {row.completionRate === null ? '' : ` (${row.completionRate}%)`}
            </p>

            <p className="mt-1 text-xs text-slate-500">{row.note}</p>
          </div>

          <div className="shrink-0 text-right">
            {row.insufficientData ? (
              <Badge variant="outline">Not measured</Badge>
            ) : (
              <>
                <span
                  className={`text-lg font-semibold tabular-nums ${
                    row.improvement > 0 ? 'text-success-600' : 'text-slate-500'
                  }`}
                >
                  {row.improvement > 0 ? `+${row.improvement}` : row.improvement}
                </span>
                <span className="mt-0.5 block text-[11px] tabular-nums text-slate-400">
                  {row.before} → {row.after} · {row.reassessedStudents}{' '}
                  {row.reassessedStudents === 1 ? 'student' : 'students'}
                </span>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * What became of this cohort's applications.
 *
 * THE APPLICATION IS THE OUTCOME RECORD, AND ITS OWN STATUSES ARE THE VOCABULARY.
 * Applied through selected is the funnel every other screen in the product already
 * shows; this one only groups it by cohort and by the kind of posting, so there is no
 * second placement status to keep in step with the first.
 *
 * ROWS IN PIPELINE ORDER, INCLUDING THE EMPTY ONES. A funnel that hides its empty
 * stages reads as if those stages do not exist, and "nobody has reached interview" is
 * the most actionable row on it.
 */
export function OutcomeFunnel({ outcomes, students = 0 }) {
  if (!outcomes || outcomes.applications === 0) {
    return (
      <p className="text-sm text-slate-600">
        No student in this cohort has applied to an opportunity yet, so there are no outcomes to
        report.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {outcomes.byStatus.map((stage) => (
        <BarRow
          key={stage.status}
          label={stage.label}
          share={outcomes.applications > 0 ? (stage.count / outcomes.applications) * 100 : 0}
          figure={
            stage.count === 0
              ? 'none'
              : `${stage.count} of ${outcomes.applications} ${stage.count === 1 ? 'application' : 'applications'}`
          }
          fill={
            stage.status === APPLICATION_STATUSES.SELECTED
              ? 'bg-success-600'
              : stage.status === APPLICATION_STATUSES.REJECTED
                ? 'bg-slate-300'
                : 'bg-primary-500'
          }
        />
      ))}

      <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
        {outcomes.applicants} of {students} {students === 1 ? 'student' : 'students'} have applied ·{' '}
        {outcomes.internships.applications} internship{' '}
        {outcomes.internships.applications === 1 ? 'application' : 'applications'} (
        {outcomes.internships.selected} selected) · {outcomes.placements.applications} job{' '}
        {outcomes.placements.applications === 1 ? 'application' : 'applications'} (
        {outcomes.placements.selected} selected)
      </p>
    </div>
  );
}

/**
 * The institution's to-do list, derived from the rows above.
 *
 * DETERMINISTIC, AND NOT A CHATBOT. Each item was produced by a fixed rule over the
 * same figures the table shows — a top-priority skill with no programme, a programme
 * nobody joined, learners who finished but never re-sat the paper — so the same
 * database always produces the same list. Every item carries the numbers it came from,
 * because "why am I being told this" has to be answerable from the item itself.
 */
export function ActionList({ actions = [] }) {
  if (actions.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Nothing is outstanding: every priority skill has a programme, students are enrolled on them,
        and the learners who finished have been reassessed.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {actions.map((action) => (
        <li key={action.key} className="rounded-lg border border-slate-200 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={action.priority} />
            <span className="text-sm font-medium text-slate-900">{action.title}</span>
          </div>

          <p className="mt-1.5 text-xs text-slate-500">{action.detail}</p>
        </li>
      ))}
    </ol>
  );
}

export default {
  ActionList,
  DemandRanking,
  LearningImpactList,
  OutcomeFunnel,
  PriorityBadge,
  SkillDemandTable,
  StatTile,
};
