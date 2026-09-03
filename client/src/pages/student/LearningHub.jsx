/**
 * The Learning Hub — where a student finds something to learn.
 *
 * TWO LISTS, ONE PAGE, AND THE ORDER MATTERS. "Recommended for you" comes first
 * because it is the answer to the question a student actually has ("what should I
 * learn?"), and it is the server's answer, computed from their real gaps against their
 * target role. The catalogue below it answers a different question ("what exists?") and
 * is unranked on purpose — see LearningFilterBar for why there is no relevance sort.
 *
 * ENROLLING FROM EITHER LIST GOES THROUGH THE SAME HANDLER, and after it succeeds the
 * recommendations are reloaded. Without that reload the strip would still offer "Enroll"
 * on a programme the catalogue below had just moved to "In My Learning" — two states for
 * one fact on one screen.
 *
 * THE 409 IS SHOWN, NOT SWALLOWED. "You are already enrolled in this program" is the
 * server's duplicate guard speaking, and a student who clicked twice deserves that
 * sentence rather than a button that quietly does nothing.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import LearningFilterBar from '../../components/learning/LearningFilterBar.jsx';
import ProgramCard from '../../components/learning/ProgramCard.jsx';
import RecommendedPrograms from '../../components/learning/RecommendedPrograms.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { isEnrollable } from '../../constants/learning.js';
import useLearningPrograms from '../../hooks/useLearningPrograms.js';
import useLearningRecommendations from '../../hooks/useLearningRecommendations.js';
import useSkillCatalogue from '../../hooks/useSkillCatalogue.js';

/** How many programmes the recommendation strip shows before it stops being a strip. */
const RECOMMENDATION_LIMIT = 4;

/**
 * What a learner can do about one catalogue row.
 *
 * Three states, and the middle one is the reason this is a component: a programme the
 * reader is already enrolled in must not offer "Enroll" again. The server would refuse
 * it with a 409, and the row already knows the answer.
 */
function CatalogueActions({ program, onEnroll, isEnrolling, disabled }) {
  const detailsLink = (
    <Link
      to={`/student/learning/${program.id}`}
      className="text-sm font-medium text-slate-600 transition hover:text-slate-800"
    >
      Details →
    </Link>
  );

  if (program.enrollment) {
    return (
      <>
        <Link
          to="/student/my-learning"
          className="text-sm font-medium text-primary-700 transition hover:text-primary-800"
        >
          In My Learning →
        </Link>
        {detailsLink}
      </>
    );
  }

  return (
    <>
      {/* Availability is the API's word, not a local clock's. An ended programme keeps
          its row — it is still worth reading — but the button goes. */}
      {isEnrollable(program) ? (
        <Button
          type="button"
          size="sm"
          onClick={() => onEnroll(program.id)}
          isLoading={isEnrolling}
          disabled={disabled}
        >
          Enroll
        </Button>
      ) : (
        <span className="text-xs text-slate-500">Enrollment closed</span>
      )}
      {detailsLink}
    </>
  );
}
export default function LearningHub() {
  const {
    programs,
    total,
    pagination,
    filters,
    applyFilters,
    toggleSkill,
    clearFilters,
    activeFilterCount,
    hasActiveFilters,
    page,
    setPage,
    enroll,
    enrollingId,
    isLoading,
    loadError,
    reload,
  } = useLearningPrograms();

  const recommendations = useLearningRecommendations({ limit: RECOMMENDATION_LIMIT });

  // The one shared catalogue, the same list the skills filter and every publisher form
  // are built from.
  const {
    catalogue,
    isLoading: isLoadingCatalogue,
    error: catalogueError,
  } = useSkillCatalogue();

  const [enrollError, setEnrollError] = useState(null);
  const [enrolledMessage, setEnrolledMessage] = useState(null);

  /**
   * Both lists enrol through here.
   *
   * The recommendations are reloaded afterwards so the strip and the catalogue cannot
   * disagree about one programme: `useLearningPrograms.enroll` patches its own row, and
   * nothing else would tell the strip above it that the answer has changed.
   */
  const handleEnroll = async (programId) => {
    setEnrollError(null);
    setEnrolledMessage(null);

    try {
      await enroll(programId);
      setEnrolledMessage('You are enrolled. Update your progress from My Learning as you go.');
      recommendations.reload();
    } catch (error) {
      setEnrollError(error);
    }
  };

  const isEmpty = !isLoading && programs.length === 0;

  return (
    <DashboardLayout
      title="Learning hub"
      subtitle="Courses, certifications, workshops and mentorships that close the gaps between your skills and the role you are aiming at."
    >
      <div className="space-y-6">
        <BackLink to="/student">Back to dashboard</BackLink>

        <RecommendedPrograms
          recommendations={recommendations.recommendations}
          isLoading={recommendations.isLoading}
          careerRole={recommendations.careerRole}
          readinessScore={recommendations.readinessScore}
          reason={recommendations.reason}
          gapsConsidered={recommendations.gapsConsidered}
          uncoveredGaps={recommendations.uncoveredGaps}
          onEnroll={handleEnroll}
          enrollingId={enrollingId}
        />

        {/* The strip's own failure is reported separately from the catalogue's. One list
            being unavailable is not a reason to imply the other is. */}
        {recommendations.loadError ? (
          <Alert
            variant="warning"
            title="Recommendations could not be loaded"
            message={recommendations.loadError.message}
          >
            <Button type="button" variant="secondary" size="sm" onClick={recommendations.reload}>
              Try again
            </Button>
          </Alert>
        ) : null}

        {enrolledMessage ? <Alert variant="success" message={enrolledMessage} /> : null}

        {/* Including the 409. "You are already enrolled in this program" is the server's
            duplicate guard, and it is the honest answer to a second click. */}
        {enrollError ? (
          <Alert
            variant="error"
            title="That enrollment did not go through"
            message={enrollError.message}
            errors={enrollError.errors}
          />
        ) : null}

        <LearningFilterBar
          filters={filters}
          onChange={applyFilters}
          onToggleSkill={toggleSkill}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          catalogue={catalogue}
          isLoadingCatalogue={isLoadingCatalogue}
          catalogueError={catalogueError}
          disabled={isLoading}
        />

        {loadError ? (
          <Alert
            variant="error"
            title="The catalogue could not be loaded"
            message={loadError.message}
            errors={loadError.errors}
          >
            <Button type="button" variant="secondary" size="sm" onClick={reload}>
              Try again
            </Button>
          </Alert>
        ) : null}

        {isLoading ? (
          <Card>
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          </Card>
        ) : isEmpty ? (
          <Card>
            {/* Two different facts, and telling a student the second when the first is
                true is how they conclude the portal is empty. */}
            {hasActiveFilters ? (
              <EmptyState
                title="Nothing matches your filters"
                description="No open program teaches every one of those things in that format. Widening the level or the delivery mode usually helps."
                action={
                  <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No programs are open yet"
                description="Nothing has been published for enrollment at the moment. Your readiness page still shows which skills to work on in the meantime."
                action={
                  <Link
                    to="/student/readiness"
                    className="text-sm font-medium text-primary-700 transition hover:text-primary-800"
                  >
                    See your skill gaps →
                  </Link>
                }
              />
            )}
          </Card>
        ) : (
          <>
            {/* The order is named out loud, because an unexplained order looks
                arbitrary — and this list is deliberately not ranked by relevance. */}
            <p className="text-sm text-slate-500">
              {total} open {total === 1 ? 'program' : 'programs'}
              {hasActiveFilters ? ' matching your filters' : ''}, newest first.
              Personalised ranking is in the strip above.
            </p>

            <ul className="space-y-3">
              {programs.map((program) => (
                <li key={program.id}>
                  <ProgramCard
                    program={program}
                    titleTo={`/student/learning/${program.id}`}
                    showPublisher
                    actions={
                      <CatalogueActions
                        program={program}
                        onEnroll={handleEnroll}
                        isEnrolling={enrollingId === program.id}
                        disabled={Boolean(enrollingId) && enrollingId !== program.id}
                      />
                    }
                  />
                </li>
              ))}
            </ul>

            <Pagination
              pagination={pagination}
              onPageChange={setPage}
              isLoading={isLoading}
              label="programs"
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

