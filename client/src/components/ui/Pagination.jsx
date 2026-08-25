/**
 * Page navigation for a paginated list.
 *
 * Reads the API's `pagination` object as-is — `{ page, limit, total, totalPages,
 * hasNextPage, hasPrevPage }` from the server's buildPagination() — so there is no
 * page arithmetic on the client to disagree with the server's.
 *
 * Renders nothing for a single page. A "Page 1 of 1" control with both arrows
 * greyed out is noise that makes a short list look truncated.
 *
 * Numbered page buttons are deliberately absent: previous, next and a plain "Page
 * 2 of 4" is the whole interaction, and a window of numbered buttons is a
 * surprising amount of edge-case logic (ellipses, clamping) for a hackathon list.
 */

import Button from './Button.jsx';

export default function Pagination({ pagination, onPageChange, isLoading = false, label = 'items' }) {
  if (!pagination) return null;

  const { page = 1, limit = 0, total = 0, totalPages = 1, hasNextPage, hasPrevPage } = pagination;

  if (totalPages <= 1) return null;

  // The range being shown, so "Page 2 of 4" is grounded in actual numbers.
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"
      aria-label="Pagination"
    >
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium tabular-nums text-slate-700">{first}</span>–
        <span className="font-medium tabular-nums text-slate-700">{last}</span> of{' '}
        <span className="font-medium tabular-nums text-slate-700">{total}</span> {label}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={isLoading || !hasPrevPage}
        >
          Previous
        </Button>

        <span className="px-1 text-xs tabular-nums text-slate-500" aria-current="page">
          Page {page} of {totalPages}
        </span>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={isLoading || !hasNextPage}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
