/**
 * Badge — a small pill for a category, a proficiency tier, or a status.
 *
 * `removable` turns it into a chip with a dismiss button, which is what the
 * interests editor and the selected-goals list need. When removable, the pill
 * itself stays a plain element and only the × is a button — making the whole
 * chip clickable would mean an accidental click destroys data.
 */

const VARIANTS = {
  neutral: 'bg-slate-100 text-slate-700',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  error: 'bg-error-50 text-error-700',
  outline: 'border border-slate-200 bg-white text-slate-600',
};

const SIZES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  removable = false,
  onRemove,
  removeLabel,
}) {
  return (
    <span
      className={[
        'inline-flex max-w-full items-center gap-1.5 rounded-full font-medium',
        VARIANTS[variant] ?? VARIANTS.neutral,
        SIZES[size] ?? SIZES.md,
        className,
      ].join(' ')}
    >
      <span className="truncate">{children}</span>

      {removable ? (
        <button
          type="button"
          onClick={onRemove}
          // Names the thing being removed, so a screen reader says "Remove
          // React" rather than a row of identical "Remove" buttons.
          aria-label={removeLabel ?? `Remove ${typeof children === 'string' ? children : 'item'}`}
          className="-mr-0.5 shrink-0 rounded-full p-0.5 opacity-60 transition hover:bg-black/10 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}
