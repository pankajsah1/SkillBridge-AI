/**
 * Card — the white panel every dashboard section sits in.
 *
 * The classes here already appear verbatim in DashboardPlaceholder.jsx and
 * SystemStatus.jsx. Step 3 adds five more sections, and eight hand-typed copies
 * of the same class string is how a UI starts drifting one padding value at a
 * time. This is that string, named once.
 *
 * `title`/`description`/`action` are optional so the component is still useful
 * as a plain container. `id` is forwarded so a section can be linked to
 * directly — the dashboard's "Manage skills" action relies on it.
 */

export default function Card({
  id,
  title,
  description,
  action,
  children,
  className = '',
  bodyClassName = '',
}) {
  const hasHeader = Boolean(title || description || action);

  return (
    <section id={id} className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}>
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>

          {/* shrink-0 so a long title wraps instead of squashing the button. */}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}

      <div className={`px-6 py-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
