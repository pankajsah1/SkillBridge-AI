/**
 * Registration page.
 *
 * The role selector offers Student, Industry, Academician and Institution.
 * ADMIN is absent — and the server rejects it with its own check, which is what
 * actually prevents self-registration as an administrator. Removing an option
 * from a form is a UI decision; the API is where the rule lives.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { homePathForRole } from '../constants/roles.js';
import {
  PASSWORD_HINT,
  isValid,
  mapServerErrors,
  validateRegisterForm,
} from '../utils/validation.js';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import RoleSelector from '../components/auth/RoleSelector.jsx';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';

const INITIAL_FORM = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: '',
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldError = (field) =>
    setFieldErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    clearFieldError(name);
    setFormError(null);
  };

  const handleRoleChange = (role) => {
    setForm((previous) => ({ ...previous, role }));
    clearFieldError('role');
    setFormError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const errors = validateRegisterForm(form);
    if (!isValid(errors)) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);

    try {
      // confirmPassword is a frontend-only field — the API takes one password,
      // so it is not sent.
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });

      // Registration returns a token, so they are already signed in. Sending
      // them to their dashboard is the success feedback — bouncing back to a
      // login form after a successful signup is a needless extra step.
      navigate(homePathForRole(user.role), { replace: true });
    } catch (error) {
      // Server-side field errors (duplicate email, rejected role) land under the
      // right input via the same mechanism as local validation.
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
      title="Create your account"
      subtitle="One account, whichever side of the bridge you are on."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-primary-700 hover:text-primary-800">
            Log in
          </Link>
        </>
      }
    >
      {formError ? (
        <div className="mb-4">
          <Alert
            variant="error"
            title={formError.isNetworkError ? 'Cannot reach the server' : 'Registration failed'}
            message={formError.message}
            errors={formError.errors}
          />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Full name"
          name="name"
          value={form.name}
          onChange={handleChange}
          error={fieldErrors.name}
          placeholder="Pankaj Sah"
          autoComplete="name"
          disabled={isSubmitting}
          required
        />

        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          error={fieldErrors.email}
          hint="Used to log in. Must be unique."
          placeholder="you@college.edu"
          autoComplete="email"
          disabled={isSubmitting}
          required
        />

        <RoleSelector
          value={form.role}
          onChange={handleRoleChange}
          error={fieldErrors.role}
          disabled={isSubmitting}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
          hint={PASSWORD_HINT}
          placeholder="Create a password"
          autoComplete="new-password"
          disabled={isSubmitting}
          required
          showPasswordToggle
        />

        <Input
          label="Confirm password"
          name="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={handleChange}
          error={fieldErrors.confirmPassword}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          disabled={isSubmitting}
          required
          showPasswordToggle
        />

        <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
