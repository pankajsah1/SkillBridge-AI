/**
 * Student portfolio page — /student/portfolio.
 *
 * The Step 6 surface. STUDENT only, like every page in this route group; the
 * backend re-checks the token and the role on every one of the ~19 endpoints this
 * page can call. The route guard is navigation, the API is the boundary.
 *
 * THE PAGE IS ONE SNAPSHOT, NOT MANY. Everything below the header reads from
 * `{profile, completion}`, a pair the hook stores wholesale from every mutation
 * response. That is what makes the completion panel beside the lists always agree
 * with them: the score and the lists were produced by the same server response and
 * are stored in the same state update. Nothing here recomputes a number — the
 * score is the server's, the "missing" list is the server's, and the counts in the
 * header are array lengths.
 *
 * THREE STATES, IN THE ORDER A STUDENT MEETS THEM.
 *
 *   loading    the token is being used to fetch the portfolio
 *   first run  no profile exists yet — show a prompt, not an empty page
 *   editing    everything renders, in the order a recruiter would read it
 *
 * HEADER, SUMMARY, PANEL, THEN SECTIONS. The sections are deliberately laid out in
 * the same order the completion weights them: resume first (it is the one thing a
 * recruiter opens), then projects, certifications, experience, achievements. A
 * student who adds one thing will usually add it in this order.
 */

import { Link } from 'react-router-dom';

import usePortfolio from '../../hooks/usePortfolio.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { sectionByKey } from '../../constants/portfolioSections.js';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import BackLink from '../../components/ui/BackLink.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import PortfolioCompletionPanel from '../../components/portfolio/PortfolioCompletionPanel.jsx';
import PortfolioHeader from '../../components/portfolio/PortfolioHeader.jsx';
import PortfolioSection from '../../components/portfolio/PortfolioSection.jsx';
import PortfolioSummary from '../../components/portfolio/PortfolioSummary.jsx';
import ResumeCard from '../../components/portfolio/ResumeCard.jsx';

/** The four list sections, in recruiter order. Resume is its own card, above. */
const LIST_SECTIONS = [
  sectionByKey.projects,
  sectionByKey.certifications,
  sectionByKey.experiences,
  sectionByKey.achievements,
];

export default function StudentPortfolio() {
  const { user } = useAuth();
  const portfolio = usePortfolio();

  const { profile, completion, isFirstVisit, isLoading, loadError, reload } = portfolio;

  // --- loading -------------------------------------------------------------
  if (isLoading) {
    return (
      <DashboardLayout title="Your portfolio" subtitle="Loading your portfolio…">
        <Card>
          <div className="flex items-center gap-3 py-6 text-sm text-slate-500">
            <Spinner />
            Loading your portfolio…
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  // --- the portfolio could not be fetched ----------------------------------
  if (loadError) {
    return (
      <DashboardLayout title="Your portfolio" subtitle="We could not load your portfolio.">
        <div className="space-y-4">
          <Alert
            variant="error"
            title="Could not load your portfolio"
            message={loadError.message}
            errors={loadError.errors}
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={reload}>Try again</Button>
            <BackLink to="/student">Back to dashboard</BackLink>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // --- first run: no profile to build a portfolio out of -------------------
  // Separate from the empty sections below, because the fix is not "add a
  // project" — it is "go set up your profile". The portfolio is a presentation of
  // that data, not a replacement for it.
  if (isFirstVisit) {
    return (
      <DashboardLayout
        title="Your portfolio"
        subtitle="A portfolio is built from the details in your profile."
      >
        <div className="space-y-5">
          <BackLink to="/student">Back to dashboard</BackLink>

          <Card title="Create your profile first" description="Your portfolio has nothing to show yet.">
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Your portfolio takes the profile you have already filled in — your headline, your
                institution, your skills — and adds the projects, certifications, experience and
                achievements that prove what you can do. Set up the profile first, and it all
                appears here.
              </p>
              <Link
                to="/student/profile"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Set up my profile
              </Link>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // --- everything renders ---------------------------------------------------
  return (
    <DashboardLayout
      title="Your portfolio"
      subtitle="What you have built and done — the proof behind your profile."
    >
      <div className="space-y-5">
        <BackLink to="/student">Back to dashboard</BackLink>

        {/* Feedback above everything: whichever section produced it, a
            confirmation or an error is seen without scrolling. */}
        {portfolio.successMessage ? (
          <Alert variant="success" title={portfolio.successMessage}>
            <button
              type="button"
              onClick={portfolio.clearFeedback}
              className="mt-2 text-xs font-medium text-success-700 underline"
            >
              Dismiss
            </button>
          </Alert>
        ) : null}

        {portfolio.saveError ? (
          <Alert
            variant="error"
            title="That did not save"
            message={portfolio.saveError.message}
            errors={portfolio.saveError.errors}
          />
        ) : null}

        <PortfolioHeader user={user} profile={profile} completion={completion} />

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <PortfolioSummary profile={profile} />
            <ResumeCard portfolio={portfolio} />

            {LIST_SECTIONS.map((section) => (
              <PortfolioSection
                key={section.key}
                section={section}
                records={profile?.[section.key] ?? []}
                portfolio={portfolio}
              />
            ))}
          </div>

          <div className="space-y-5">
            {/* Sticky above the fold while the sections scroll: the thing the
                panel tells you to do is usually lower down, and staying visible
                while scrolling there keeps the advice in reach. */}
            <div className="lg:sticky lg:top-5">
              <PortfolioCompletionPanel completion={completion} />
            </div>

            {/* Honesty note, once, in place of the section-by-section badge
                messages: everything here is self-reported until a verification
                process exists. */}
            <Card
              title="A note on verification"
              description="What the badges mean, and what nothing means yet."
            >
              <p className="text-sm text-slate-600">
                Every record you add is marked{' '}
                <span className="font-medium text-slate-800">awaiting verification</span> — it is
                your own description, and nothing in the portal has checked it yet. Verified
                records will come from an actual reviewer, never from a checkbox on this page.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
