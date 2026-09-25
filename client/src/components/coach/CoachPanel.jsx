/**
 * CoachPanel — the student AI Coach (Step 10 §5/§9).
 *
 * A grounded explainability surface, NOT a chatbot. It renders the fixed set of
 * employability answers the server assembles from real data — readiness, what to learn
 * first, which gaps matter, why an opportunity was recommended, and the honest "what
 * changed after reassessment". Every sentence traces to stored data, so there is no
 * free-text input and nothing here invents a number.
 *
 * The four async states are the app's usual ones. When the server had an LLM available
 * to reword the answers, a small "AI-assisted" note says so; when it did not, the same
 * deterministic answers render with no loss.
 */

import useCoach from '../../hooks/useCoach.js';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { Spinner } from '../ui/Spinner.jsx';

export default function CoachPanel({ careerRoleId, className = '' }) {
  const { explanations, readinessScore, careerRole, aiEnabled, isLoading, loadError, reload } =
    useCoach({ careerRoleId });

  const heading =
    careerRole?.title != null
      ? `Grounded answers for your ${careerRole.title} goal`
      : 'Grounded answers about your employability';

  return (
    <Card
      title="AI Skill Coach"
      description={heading}
      className={className}
      action={
        aiEnabled ? (
          <Badge variant="primary" size="sm">
            AI-assisted
          </Badge>
        ) : null
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
          <Spinner size="sm" /> Preparing your coach…
        </div>
      ) : loadError ? (
        <div className="py-2">
          <p className="text-sm text-error-600">Could not load your coach right now.</p>
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={reload}>
              Try again
            </Button>
          </div>
        </div>
      ) : explanations.length === 0 ? (
        <EmptyState
          title="Nothing to explain yet"
          description="Add your skills and choose a target career role, and grounded answers will appear here."
        />
      ) : (
        <div className="space-y-4">
          {readinessScore != null ? (
            <p className="text-sm text-slate-500">
              Current readiness:{' '}
              <span className="font-semibold text-slate-900">{readinessScore}%</span>
            </p>
          ) : null}

          <dl className="space-y-4">
            {explanations.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 px-4 py-3">
                <dt className="flex items-start gap-2 text-sm font-semibold text-slate-900">
                  <span>{item.question}</span>
                  {item.grounded ? (
                    <Badge variant="success" size="sm" className="shrink-0">
                      Grounded
                    </Badge>
                  ) : null}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-600">{item.answer}</dd>
              </div>
            ))}
          </dl>

          <p className="text-xs text-slate-400">
            Answers are derived from your stored profile, assessments and matches. Completing a
            course does not raise your score on its own — only a reassessment does.
          </p>
        </div>
      )}
    </Card>
  );
}
