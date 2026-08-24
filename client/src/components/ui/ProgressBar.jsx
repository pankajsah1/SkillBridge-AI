/**
 * ProgressBar — profile completion and skill proficiency.
 *
 * DESIGN.md sections 15.2 and 15.5 both sketch a bar with its number beside it,
 * so this is that shape rather than two separate components.
 *
 * The value is always rendered as text next to the bar, never conveyed by fill
 * width alone: DESIGN.md section 40 requires meaning to survive without colour,
 * and a bar is unreadable to a screen reader without the number.
 */

const SIZES = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-2.5',
};

export default function ProgressBar({
  value = 0,
  max = 100,
  label,
  valueLabel,
  size = 'md',
  barClassName = 'bg-primary-600',
  className = '',
}) {
  // Clamped so a bad value can never render a bar wider than its track.
  const safeValue = Math.min(Math.max(Number(value) || 0, 0), max);
  const percentage = max === 0 ? 0 : Math.round((safeValue / max) * 100);

  return (
    <div className={className}>
      {label || valueLabel ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label ? <span className="truncate text-sm text-slate-700">{label}</span> : <span />}
          {valueLabel ? (
            // tabular-nums stops the number jittering as it changes width.
            <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
              {valueLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className={`w-full overflow-hidden rounded-full bg-slate-100 ${SIZES[size] ?? SIZES.md}`}
        role="progressbar"
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? 'Progress'}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${barClassName}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
