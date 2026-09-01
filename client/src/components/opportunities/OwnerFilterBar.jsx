/**
 * The filter bar over the employer's own postings.
 *
 * Filters on status, type and a search term — the three questions an employer
 * actually asks of their own list ("what is still a draft?", "where did the
 * internship go?", "the one about React"). Deliberately not the same bar as the
 * student's: a student cannot filter by status because they only ever see open
 * postings, and an employer has no use for filtering by work mode across a list of
 * their own five.
 *
 * The controls are uncontrolled in one sense and controlled in another: the two
 * selects apply immediately, while the search box debounces inside SearchInput.
 * Both funnel through the same `onChange`, which resets to page 1 in the hook.
 */

import {
  ALL_TYPE_ORDER,
  OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_STATUS_VALUES,
  OPPORTUNITY_TYPE_LABELS,
} from '../../constants/opportunities.js';
import Button from '../ui/Button.jsx';
import Select from '../ui/Select.jsx';
import SearchInput from './SearchInput.jsx';

const statusOptions = OPPORTUNITY_STATUS_VALUES.map((status) => ({
  value: status,
  label: OPPORTUNITY_STATUS_LABELS[status],
}));

/**
 * ALL twelve types, not the four the student bar offers.
 *
 * This is the one list in the app that legitimately spans both audiences: an
 * employer who posted an internship and an FDP owns both, and filtering their own
 * work by an audience they never chose would hide half of it. The server's query
 * validator agrees — it restricts the type filter by audience only for discovery.
 */
const typeOptions = ALL_TYPE_ORDER.map((type) => ({
  value: type,
  label: OPPORTUNITY_TYPE_LABELS[type],
}));

export default function OwnerFilterBar({
  filters,
  /** (partialFilters) => void */
  onChange,
  onClear,
  hasActiveFilters = false,
  disabled = false,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          {/* Title only, which is what GET /industry/opportunities actually greps
              — it sets `filter.title` and nothing else. The student's bar says
              "title, description or location" because that endpoint really does
              search all three. Promising more here than the API delivers is a bug
              an employer finds by typing a word from their own description and
              getting nothing back. */}
          <SearchInput
            value={filters.search}
            onChange={(search) => onChange({ search })}
            label="Search your postings"
            placeholder="Search by title"
            disabled={disabled}
          />
        </div>

        <Select
          label="Status"
          name="ownerStatus"
          value={filters.status}
          onChange={(event) => onChange({ status: event.target.value })}
          options={statusOptions}
          placeholder="Any status"
          disabled={disabled}
        />

        <Select
          label="Type"
          name="ownerType"
          value={filters.type}
          onChange={(event) => onChange({ type: event.target.value })}
          options={typeOptions}
          placeholder="Any type"
          disabled={disabled}
        />
      </div>

      {/* Only offered when there is something to clear — a permanently visible
          "Clear filters" invites the question of what is currently filtered. */}
      {hasActiveFilters ? (
        <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={disabled}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
