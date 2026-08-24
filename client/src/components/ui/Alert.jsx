/**
 * Inline message block for errors, warnings, successes and notices.
 *
 * Every variant pairs its colour with a text label ("Error", "Success"), because
 * DESIGN.md §40 requires that meaning never depend on colour alone.
 */

const VARIANTS = {
  error: {
    container: 'border-error-100 bg-error-50',
    title: 'text-error-700',
    body: 'text-error-600',
    defaultTitle: 'Something went wrong',
  },
  warning: {
    container: 'border-warning-100 bg-warning-50',
    title: 'text-warning-700',
    body: 'text-warning-600',
    defaultTitle: 'Heads up',
  },
  success: {
    container: 'border-success-100 bg-success-50',
    title: 'text-success-700',
    body: 'text-success-600',
    defaultTitle: 'Success',
  },
  info: {
    container: 'border-primary-100 bg-primary-50',
    title: 'text-primary-700',
    body: 'text-primary-600',
    defaultTitle: 'Note',
  },
};

export default function Alert({ variant = 'error', title, message, errors = [], children }) {
  const styles = VARIANTS[variant] ?? VARIANTS.error;

  // Field-level messages are rendered next to their inputs, so only list
  // errors here that have no field to attach to.
  const unfieldedErrors = errors.filter((item) => item?.message && !item?.field);

  return (
    <div
      className={`rounded-lg border p-4 ${styles.container}`}
      // Errors interrupt; softer variants wait for a pause in speech.
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <p className={`text-sm font-medium ${styles.title}`}>{title ?? styles.defaultTitle}</p>

      {message ? <p className={`mt-1 text-sm ${styles.body}`}>{message}</p> : null}

      {unfieldedErrors.length > 0 ? (
        <ul className={`mt-2 list-inside list-disc space-y-0.5 text-sm ${styles.body}`}>
          {unfieldedErrors.map((item, index) => (
            <li key={`${item.message}-${index}`}>{item.message}</li>
          ))}
        </ul>
      ) : null}

      {children}
    </div>
  );
}
