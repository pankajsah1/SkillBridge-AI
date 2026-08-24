/**
 * EmptyState — what a section shows before it has any content.
 *
 * DESIGN.md section 3.4 asks every important surface to point at the next useful
 * action, and section 25 asks for constructive wording. An empty skills list is
 * an invitation, not a warning, so this renders a prompt and a button rather
 * than "No data found".
 */

export default function EmptyState({ title, description, action, icon = null }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-slate-300">{icon}</div> : null}

      <p className="text-sm font-medium text-slate-900">{title}</p>

      {description ? (
        // max-w keeps the line length readable rather than stretching across a
        // wide card.
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      ) : null}

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
