/**
 * Login page.
 *
 * Validates locally for fast feedback, then defers to the server — which is the
 * only place that can actually tell whether a password is right.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { homePathForRole } from '../constants/roles.js';
import { isValid, mapServerErrors, validateLoginForm } from '../utils/validation.js';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';

const INITIAL_FORM = { email: '', password: '' };

export default function Login() {
  const { login, sessionNotice, clearSessionNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));

    // Clear that field's error as soon as they start fixing it — leaving a stale
    // red message under a field being actively edited feels broken.
    setFieldErrors((previous) => (previous[name] ? { ...previous, [name]: undefined } : previous));
    setFormError(null);
    if (sessionNotice) clearSessionNotice();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const errors = validateLoginForm(form);
    if (!isValid(errors)) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);

    try {
      const user = await login({ email: form.email.trim(), password: form.password });

      /**
       * Where to land.
       *
       * If a guard bounced them here from a protected URL, return them to it —
       * but only when it belongs to their own role's area. Otherwise a student
       * blocked from /industry would be sent straight back to /industry and
       * refused again.
       */
      const roleHome = homePathForRole(user.role);
      const attempted = location.state?.from?.pathname;
      const destination = attempted?.startsWith(roleHome) ? attempted : roleHome;

      // replace: the login page should not sit in history behind the dashboard.
      navigate(destination, { replace: true });
    } catch (error) {
      const mapped = mapServerErrors(error.errors);
      if (Object.keys(mapped).length > 0) setFieldErrors(mapped);

      setFormError({
        message: error.message,
        errors: error.errors ?? [],
        isNetworkError: error.isNetworkError,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Log in"
      subtitle="Welcome back. Enter your details to continue."
      footer={
        <>
          New to SkillBridge AI?{' '}
          <Link to="/register" className="font-medium text-primary-700 hover:text-primary-800">
            Create an account
          </Link>
        </>
      }
    >
      {/* Explains the bounce when a session expired mid-use. */}
      {sessionNotice ? (
        <div className="mb-4">
          <Alert variant="warning" title="Session ended" message={sessionNotice} />
        </div>
      ) : null}

      {formError ? (
        <div className="mb-4">
          <Alert
            variant="error"
            title={formError.isNetworkError ? 'Cannot reach the server' : 'Login failed'}
            message={formError.message}
            errors={formError.errors}
          />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          error={fieldErrors.email}
          placeholder="you@college.edu"
          autoComplete="email"
          disabled={isSubmitting}
          required
        />

        <Input
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
          placeholder="Your password"
          autoComplete="current-password"
          disabled={isSubmitting}
          required
          showPasswordToggle
        />

        <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
