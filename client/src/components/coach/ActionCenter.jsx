/**
 * ActionCenter — the per-role "next best actions" panel (Step 10 §8).
 *
 * ONE COMPONENT, EVERY ROLE. The server decides the heading and the rows from the
 * signed-in role, so a student sees "Your Next Best Actions", an institution
 * "Priority Actions", and so on, all through this. It renders the four async states
 * the rest of the app uses — loading, error+retry, empty, list — and links each row
 * to the screen that resolves it.
 *
 * IT RANKS AND COMPUTES NOTHING. Priority order and every sentence come from the
 * service; this only paints them, so the panel can never disagree with the dashboard.
 */

import { Link } from 'react-router-dom';

import useNextActions from '../../hooks/useNextActions.js';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { Spinner } from '../ui/Spinner.jsx';

/** Priority → badge variant. Meaning never rides on colour alone — the label shows too. */
const PRIORITY_VARIANT = {
  CRITICAL: 'error',
  HIGH: 'warning',
  MEDIUM: 'primary',
  LOW: 'neutral',
};

const PRIORITY_LABEL = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

function ActionRow({ action }) {
  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{action.title}</p>
        {action.detail ? <p className="mt-0.5 text-sm text-slate-500">{action.detail}</p> : null}
      </div>
      <Badge variant={PRIORITY_VARIANT[action.priority] ?? 'neutral'} size="sm" className="shrink-0">
        {PRIORITY_LABEL[action.priority] ?? action.priority}
      </Badge>
    </div>
  );

  const base = 'block rounded-lg border border-slate-200 px-4 py-3 transition';

  if (action.link) {
    return (
      <Link to={action.link} className={`${base} hover:border-primary-300 hover:bg-primary-50/40`}>
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}

export default function ActionCenter({ className = '' }) {
  const { title, actions, isLoading, loadError, reload } = useNextActions();

  return (
    <Card
      title={title}
      description="Grounded in your current data — the most useful next steps first."
      className={className}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
          <Spinner size="sm" /> Loading your actions…
        </div>
      ) : loadError ? (
        <div className="py-2">
          <p className="text-sm text-error-600">Could not load your actions right now.</p>
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={reload}>
              Try again
            </Button>
          </div>
        </div>
      ) : actions.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          description="There are no priority actions for you right now. New ones appear as your data changes."
        />
      ) : (
        <ul className="space-y-2.5">
          {actions.map((action) => (
            <li key={action.key}>
              <ActionRow action={action} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
