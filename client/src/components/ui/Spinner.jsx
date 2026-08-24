/**
 * Loading indicators.
 *
 * `Spinner` is the bare glyph; `FullPageLoader` is the centred version used
 * while the stored token is being validated on app boot.
 */

const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
};

export function Spinner({ size = 'md', className = '' }) {
  return (
    <span
      // role=status + the visually hidden label means screen readers announce
      // "Loading" instead of silence.
      role="status"
      className={`inline-block animate-spin rounded-full border-slate-200 border-t-primary-600 ${
        SIZES[size] ?? SIZES.md
      } ${className}`}
    >
      <span className="sr-only">Loading</span>
    </span>
  );
}

export function FullPageLoader({ message = 'Loading…' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export default Spinner;
