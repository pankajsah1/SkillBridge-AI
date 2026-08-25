/**
 * Create or edit one opportunity.
 *
 * ONE PAGE, TWO ROUTES. `/industry/opportunities/new` and
 * `/industry/opportunities/:id/edit` render this; the presence of `:id` is the only
 * difference, and useOpportunityEditor already switches on it. A second page would
 * be this one with the word "Edit" changed.
 *
 * OWNERSHIP IS NOT DECIDED HERE. This page never sends an owner id — the server
 * takes it from the authenticated token — and the 404 that comes back for someone
 * else's posting is rendered as-is. The route guard keeps students out of the URL,
 * but it is the API that makes editing a rival's posting impossible.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import OpportunityForm from '../../components/opportunities/OpportunityForm.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Card from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import useOpportunityEditor from '../../hooks/useOpportunityEditor.js';
import useSkillCatalogue from '../../hooks/useSkillCatalogue.js';
import { formFromOpportunity } from '../../utils/opportunityValidation.js';

const LIST_PATH = '/industry/opportunities';

export default function OpportunityFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    isEditing,
    original,
    isLoading,
    loadError,
    isSaving,
    saveError,
    fieldErrors,
    clearFieldError,
    save,
  } = useOpportunityEditor({ opportunityId: id });

  const catalogue = useSkillCatalogue();

  const [successMessage, setSuccessMessage] = useState(null);

  /**
   * Memoised on `original`'s identity, and that is not a micro-optimisation.
   *
   * The form re-seeds itself whenever `initialValues` changes identity. Building a
   * fresh object on every render would re-seed on every render, wiping out whatever
   * was being typed. `original` changes only when the server sends a new version.
   */
  const initialValues = useMemo(
    () => (original ? formFromOpportunity(original) : null),
    [original],
  );

  const handleSubmit = async (form) => {
    setSuccessMessage(null);

    try {
      const result = await save(form);

      // `null` means the diff was empty. Not an error — the API would answer it
      // with a 400 that reads like a bug, so it is caught before being sent.
      if (!result) {
        setSuccessMessage('Nothing to save yet — none of the details have changed.');
        return;
      }

      if (!isEditing) {
        // replace: Back from the list should not return to a form that has
        // already been submitted.
        navigate(LIST_PATH, { replace: true });
        return;
      }

      setSuccessMessage('Changes saved.');
    } catch {
      // saveError and fieldErrors already hold it: the banner below and the
      // messages beside each input are the report. Swallowing here keeps an
      // unhandled rejection out of the console for a failure that is on screen.
    }
  };

  // --- the posting could not be loaded --------------------------------------
  if (isEditing && loadError) {
    return (
      <DashboardLayout title="Edit opportunity">
        <div className="space-y-5">
          <BackLink to={LIST_PATH}>Back to your opportunities</BackLink>

          <Alert
            variant="error"
            title="This opportunity could not be opened"
            message={
              loadError.status === 404
                ? 'It may have been deleted, or it may belong to another company.'
                : loadError.message
            }
          />
        </div>
      </DashboardLayout>
    );
  }

  // --- loading --------------------------------------------------------------
  if (isEditing && isLoading) {
    return (
      <DashboardLayout title="Edit opportunity" subtitle="Loading the posting…">
        <Card>
          <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
            <Spinner />
            Loading…
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={isEditing ? 'Edit opportunity' : 'Post an opportunity'}
      subtitle={
        isEditing
          ? 'Changes are visible to students as soon as they are saved.'
          : 'Describe the role and the skills it needs. Students can filter on all of it.'
      }
    >
      <div className="space-y-5">
        <BackLink to={LIST_PATH}>Back to your opportunities</BackLink>

        {catalogue.error ? (
          <Alert
            variant="warning"
            title="The skill catalogue could not be loaded"
            message={`${catalogue.error.message} Skills cannot be chosen until it loads, so try again in a moment.`}
          />
        ) : null}

        {saveError ? (
          <Alert
            variant="error"
            title={isEditing ? 'Changes were not saved' : 'The opportunity was not posted'}
            message={saveError.message}
            // Passed raw on purpose: Alert shows only the messages that have no
            // field, and every fielded one is already beside its input. Stripping
            // the fields here (as the list page does) would print each message
            // twice.
            errors={saveError.errors}
          />
        ) : null}

        {successMessage ? <Alert variant="success" message={successMessage} /> : null}

        <Card>
          <OpportunityForm
            mode={isEditing ? 'edit' : 'create'}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            onCancel={() => navigate(LIST_PATH)}
            isSaving={isSaving}
            serverErrors={fieldErrors}
            onClearFieldError={clearFieldError}
            catalogue={catalogue.catalogue}
            isLoadingCatalogue={catalogue.isLoading}
            catalogueError={catalogue.error}
          />
        </Card>
      </div>
    </DashboardLayout>
  );
}
