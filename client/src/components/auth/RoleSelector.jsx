/**
 * Role picker for the registration form.
 *
 * Radio cards rather than a dropdown: the choice determines which dashboard and
 * which features the person gets, so it deserves to be visible and explained
 * rather than hidden behind a closed <select>. Four options is few enough that
 * showing them all costs nothing.
 *
 * Built on real radio inputs so keyboard and screen-reader behaviour comes free.
 * ADMIN is not in REGISTRATION_ROLES, so it cannot appear here — and the server
 * rejects it independently, which is what actually enforces the rule.
 */

import { REGISTRATION_ROLES } from '../../constants/roles.js';

export default function RoleSelector({ value, onChange, error, disabled = false }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">
        I am registering as
        <span className="ml-0.5 text-error-600" aria-hidden="true">
          *
        </span>
      </legend>

      <div
        className="grid gap-2 sm:grid-cols-2"
        aria-describedby={error ? 'role-error' : undefined}
      >
        {REGISTRATION_ROLES.map((role) => {
          const isSelected = value === role.value;

          return (
            <label
              key={role.value}
              className={[
                'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-100',
                isSelected
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-300 bg-white hover:border-slate-400',
                disabled ? 'cursor-not-allowed opacity-60' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="radio"
                name="role"
                value={role.value}
                checked={isSelected}
                onChange={() => onChange(role.value)}
                className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900">{role.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{role.hint}</span>
              </span>
            </label>
          );
        })}
      </div>

      {error ? (
        <p id="role-error" className="mt-1.5 text-xs text-error-600">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
