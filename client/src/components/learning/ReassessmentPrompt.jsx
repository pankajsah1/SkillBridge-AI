/**
 * The completion → reassessment prompt. The step that closes the loop.
 *
 * WHY THIS COMPONENT EXISTS AT ALL. Completing a program does not raise a single skill
 * score anywhere in this system, by design — the assessment engine owns skill levels and
 * only a measured attempt changes them. That leaves a gap between "I learned AWS" and "my
 * profile shows AWS", and this is the only thing that bridges it: an invitation to be
 * measured again. Without it the loop stops at completion and the improvement never
 * reaches the readiness score, the gap analysis or matching.
 *
 * IT PROMISES NOTHING ABOUT THE OUTCOME. It does not say the score will go up. A student
 * who finished a course and still answers the questions poorly has not improved, and the
 * portal would be lying if it implied otherwise. The wording is "show it" and "update
 * your profile", never "increase your score".
 *
 * THE LINK GOES TO THE EXISTING ASSESSMENT FLOW, /student/assessment, and carries no
 * skill filter — because a paper is built from a career role, not from a skill list
 * (POST /assessments takes `careerRoleId`). Naming the covered skills tells the student
 * what to expect without claiming a targeted paper that does not exist.
 *
 * `justCompleted` CHANGES THE TONE, NOT THE OFFER: an event gets congratulated once, a
 * state gets a standing reminder. Both link to the same place.
 */

import { Link } from 'react-router-dom';

import Alert from '../ui/Alert.jsx';
import Badge from '../ui/Badge.jsx';

export default function ReassessmentPrompt({
  /** `[{skillId, name, slug}]` — the programme's target skills. */
  skills = [],
  programTitle,
  /** True only on the response that crossed 100%. */
  justCompleted = false,
}) {
  const named = skills.filter((skill) => skill?.name);

  return (
    <Alert
      variant={justCompleted ? 'success' : 'info'}
      title={
        justCompleted
          ? `You completed ${programTitle ?? 'this program'}`
          : 'Reassess to put this on your profile'
      }
      message={
        justCompleted
          ? 'That is recorded as learning evidence. Your skill levels have not changed yet — they come from assessments, so take one to show what you picked up.'
          : 'Your skill levels come from assessments, not from completions, so a retake is what turns this program into a measured improvement.'
      }
    >
      {named.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600">Skills this program covered</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {named.map((skill) => (
              <Badge key={skill.skillId} variant="outline" size="sm">
                {skill.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          to="/student/assessment"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
        >
          Take the assessment
        </Link>

        <Link
          to="/student/readiness"
          className="text-sm font-medium text-slate-600 transition hover:text-slate-800"
        >
          See your readiness first →
        </Link>
      </div>
    </Alert>
  );
}
