/**
 * Create or edit one learning programme.
 *
 * ONE PAGE, TWO ROUTES — `/industry/learning-programs/new` and
 * `/industry/learning-programs/:programId/edit`. The presence of the id is the only
 * difference and useLearningProgramEditor already switches on it, exactly as
 * OpportunityFormPage does for postings.
 *
 * OWNERSHIP IS NOT DECIDED HERE. This page never sends a publisher id — the server takes
 * it from the authenticated token — and the 404 that comes back for another company's
 * programme is rendered as-is. The route guard keeps students out of the URL; it is the
 * API that makes editing a rival's programme impossible.
 *
 * AN EMPTY DIFF IS NOT AN ERROR. Saving an unchanged form sends nothing and says so,
 * because the API would answer an empty patch with a 400 reading "No editable fields were
 * provided", which looks like a bug to the person who just pressed Save.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import LearningProgramForm from '../../components/learning/LearningProgramForm.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Card from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import useLearningProgramEditor from '../../hooks/useLearningProgramEditor.js';
import useSkillCatalogue from '../../hooks/useSkillCatalogue.js';
import { formFromLearningProgram } from '../../utils/learningValidation.js';

const LIST_PATH = '/industry/learning-programs';

export default function LearningProgramFormPage() {
  const { programId } = useParams();
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
  } = useLearningProgramEditor({ programId });

  const catalogue = useSkillCatalogue();

  const [successMessage, setSuccessMessage] = useState(null);

  /**
   * Memoised on `original`'s identity. The form re-seeds whenever `initialValues`
   * changes identity, so a fresh object each render would wipe out whatever is being
   * typed; `original` changes only when the server sends a new version.
   */
  const initialValues = useMemo(
    () => (original ? formFromLearningProgram(original) : null),
    [original],
  );

  const handleSubmit = async (form) => {
    setSuccessMessage(null);

    try {
      const result = await save(form);

      if (!result) {
        setSuccessMessage('Nothing to save yet — none of the details have changed.');
        return;
      }

      if (!isEditing) {
        // replace: Back from the list should not return to a form that has already
        // been submitted.
        navigate(LIST_PATH, { replace: true });
        return;
      }

      setSuccessMessage('Changes saved.');
    } catch {
      // saveError and fieldErrors already hold it: the banner below and the messages
      // beside each input are the report.
    }
  };

  // --- the programme could not be loaded ------------------------------------
  if (isEditing && loadError) {
    return (
      <DashboardLayout title="Edit program">
        <div className="space-y-5">
          <BackLink to={LIST_PATH}>Back to your programs</BackLink>

          <Alert
            variant="error"
            title="This program could not be opened"
            message={
              loadError.status === 404
                ? 'It may have been deleted, or it may belong to another organisation.'
                : loadError.message
            }
          />
        </div>
      </DashboardLayout>
    );
  }

  // --- loading ---------------------------------------------------------------
  if (isEditing && isLoading) {
    return (
      <DashboardLayout title="Edit program" subtitle="Loading the program…">
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
      title={isEditing ? 'Edit program' : 'List a learning program'}
      subtitle={
        isEditing
          ? 'Changes are visible to learners as soon as they are saved.'
          : 'Describe the program and the skills it teaches. Those skills are what put it in front of the students whose gaps it closes.'
      }
    >
      <div className="space-y-5">
        <BackLink to={LIST_PATH}>Back to your programs</BackLink>

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
            title={isEditing ? 'Changes were not saved' : 'The program was not created'}
            message={saveError.message}
            // Passed raw: Alert shows only the messages that have no field, and every
            // fielded one is already beside its input.
            errors={saveError.errors}
          />
        ) : null}

        {successMessage ? <Alert variant="success" message={successMessage} /> : null}

        <Card>
          <LearningProgramForm
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
