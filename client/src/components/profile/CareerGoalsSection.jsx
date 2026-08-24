/**
 * Career goals section — pick up to five target roles.
 *
 * The role list comes from GET /career-roles, never from a hard-coded array in
 * this file. That is his section 2 requirement, and it is what stops the
 * frontend and the seed data from drifting apart: there is one list, it lives in
 * the database, and the picker cannot offer a role the API would then reject.
 *
 * Selection is staged locally and committed with an explicit Save, rather than
 * firing a request per checkbox. PUT replaces the whole selection, so
 * click-by-click saving would mean five round trips to pick five goals, each one
 * briefly persisting an incomplete set.
 */

import { useEffect, useMemo, useState } from 'react';

import { fetchCareerRoles } from '../../api/catalogue.api.js';
import { MAX_CAREER_GOALS } from '../../utils/profileValidation.js';
import Alert from '../ui/Alert.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { Spinner } from '../ui/Spinner.jsx';

export default function CareerGoalsSection({ profile, isSaving = false, onSave }) {
  const [roles, setRoles] = useState([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [rolesError, setRolesError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [limitWarning, setLimitWarning] = useState(null);

  /** The goals already saved, in priority order. */
  const savedGoals = useMemo(
    () => [...(profile?.targetRoles ?? [])].sort((a, b) => a.priority - b.priority),
    [profile?.targetRoles],
  );

  useEffect(() => {
    let isActive = true;

    (async () => {
      setIsLoadingRoles(true);
      setRolesError(null);
      try {
        const loaded = await fetchCareerRoles();
        if (isActive) setRoles(loaded);
      } catch (error) {
        if (isActive) setRolesError(error);
      } finally {
        if (isActive) setIsLoadingRoles(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  /** Grouped by category, which is what `category` on a role is for. */
  const grouped = useMemo(() => {
    const groups = new Map();
    for (const role of roles) {
      if (!groups.has(role.category)) groups.set(role.category, []);
      groups.get(role.category).push(role);
    }
    return [...groups.entries()];
  }, [roles]);

  const startEditing = () => {
    setSelectedIds(savedGoals.map((goal) => goal.roleId));
    setLimitWarning(null);
    setIsEditing(true);
  };

  const toggle = (roleId) => {
    setLimitWarning(null);

    setSelectedIds((previous) => {
      if (previous.includes(roleId)) return previous.filter((id) => id !== roleId);

      if (previous.length >= MAX_CAREER_GOALS) {
        setLimitWarning(
          `You can pick up to ${MAX_CAREER_GOALS} goals. Remove one to choose a different role.`,
        );
        return previous;
      }

      return [...previous, roleId];
    });
  };

  const handleSave = async () => {
    try {
      // Sent as a plain id list: priority follows the click order, which is the
      // student's own ranking and needs no extra UI.
      await onSave(selectedIds);
      setIsEditing(false);
    } catch {
      // The parent renders the error banner; staying in edit mode preserves the
      // selection so it is not retyped.
    }
  };

  const action = isEditing ? null : (
    <Button variant="secondary" size="sm" onClick={startEditing} disabled={isLoadingRoles || Boolean(rolesError)}>
      {savedGoals.length > 0 ? 'Change goals' : 'Select goals'}
    </Button>
  );

  return (
    <Card
      id="career-goals"
      title="Career goals"
      description={`The roles you are working towards. Choose up to ${MAX_CAREER_GOALS}.`}
      action={action}
    >
      {isLoadingRoles ? (
        <div className="flex items-center gap-2.5 py-2 text-sm text-slate-500">
          <Spinner size="sm" />
          Loading career roles…
        </div>
      ) : rolesError ? (
        <Alert
          variant="error"
          title="Could not load career roles"
          message={rolesError.message}
        />
      ) : isEditing ? (
        <div className="space-y-5">
          {grouped.map(([category, categoryRoles]) => (
            <fieldset key={category}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {category}
              </legend>

              <div className="grid gap-2 sm:grid-cols-2">
                {categoryRoles.map((role) => {
                  const isSelected = selectedIds.includes(role.id);
                  const position = selectedIds.indexOf(role.id) + 1;

                  return (
                    <label
                      key={role.id}
                      className={[
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition',
                        isSelected
                          ? 'border-primary-300 bg-primary-50/60'
                          : 'border-slate-200 bg-white hover:border-slate-300',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(role.id)}
                        disabled={isSaving}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />

                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{role.title}</span>
                          {/* The number makes the ranking visible, so the order
                              is a choice rather than a side effect. */}
                          {isSelected ? (
                            <Badge variant="primary" size="sm">
                              #{position}
                            </Badge>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {role.requiredSkillCount} key skills
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {limitWarning ? (
            <p className="text-sm text-warning-700">{limitWarning}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <Button onClick={handleSave} isLoading={isSaving}>
              {isSaving ? 'Saving…' : 'Save goals'}
            </Button>
            <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={isSaving}>
              Cancel
            </Button>
            <span className="text-xs text-slate-500">
              {selectedIds.length} of {MAX_CAREER_GOALS} selected
            </span>
          </div>
        </div>
      ) : savedGoals.length === 0 ? (
        <EmptyState
          title="No career goals selected yet"
          description="Choosing the roles you are aiming for is what lets the portal tell you which skills matter most."
          action={
            <Button size="sm" onClick={startEditing}>
              Select career goals
            </Button>
          }
        />
      ) : (
        <ol className="space-y-2.5">
          {savedGoals.map((goal) => (
            <li
              key={goal.roleId}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3.5 py-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                {goal.priority}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {/* Falls back to the id if the API ever returns an unpopulated
                      reference, so a row is never blank. */}
                  {goal.title ?? 'Career role'}
                </span>
                {goal.category ? (
                  <span className="text-xs text-slate-500">{goal.category}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
