'use client';

import { apiFetch } from '@/lib/api/client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '@/app/login/login.module.css';
import { Spinner } from '@/components/ui/Spinner/Spinner';

interface SignupFormProps {
  nextPath: string;
  initialError?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  exists: 'An account with this email already exists. Sign in instead.',
  'password-match': 'The two passwords do not match.',
  'password-requirements': 'Password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.',
  'email-invalid': 'Please enter a valid email address.',
  'name-invalid': 'Name must be between 2 and 80 characters.',
  'server-error': 'Authentication service is currently unavailable. Please try again in a few moments.',
  invalid: 'Please review the requirements for your name, email, and password.',
};

export function SignupForm({ nextPath, initialError }: SignupFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError ? (ERROR_MESSAGES[initialError] || ERROR_MESSAGES.invalid) : null
  );

  // Requirement checks
  const hasMinLength = password.length >= 12;
  const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumberSymbol = /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (name.trim().length < 2) {
      setErrorMessage('Name must be at least 2 characters long.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!hasMinLength || !hasUpperLower || !hasNumberSymbol) {
      setErrorMessage('Password must be at least 12 characters with uppercase, lowercase, a number, and a symbol.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          next: nextPath,
        }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        window.location.href = data.next || nextPath || '/dashboard';
        return;
      }

      const errData = await response.json().catch(() => null);
      if (errData?.error?.message) {
        setErrorMessage(errData.error.message);
      } else if (response.status === 409) {
        setErrorMessage('An account with this email already exists. Sign in instead.');
      } else if (response.status === 429) {
        setErrorMessage('Too many attempts. Please wait a moment and try again.');
      } else if (response.status === 503) {
        setErrorMessage('Authentication service is not properly configured. Please contact the administrator.');
      } else {
        setErrorMessage('Failed to create account. Please check your details and try again.');
      }
    } catch {
      setErrorMessage('Network error occurred. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form method="post" action="/api/auth/signup" onSubmit={handleSubmit} className={styles.form}>
      <input type="hidden" name="next" value={nextPath} />

      {errorMessage && (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      )}

      <label htmlFor="signup-name">Full Name</label>
      <input
        id="signup-name"
        name="name"
        type="text"
        autoComplete="name"
        minLength={2}
        maxLength={80}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (errorMessage) setErrorMessage(null);
        }}
        required
        disabled={loading}
        placeholder="e.g. Jane Doe"
      />

      <label htmlFor="signup-email">Email Address</label>
      <input
        id="signup-email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (errorMessage) setErrorMessage(null);
        }}
        required
        disabled={loading}
        placeholder="e.g. jane@example.com"
      />

      <label htmlFor="signup-password">Password</label>
      <div className={styles.passwordWrapper}>
        <input
          id="signup-password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          aria-describedby="password-help"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          required
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className={styles.passwordToggleBtn}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={0}
        >
          {showPassword ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      <div id="password-help" className={styles.fieldHelp} style={{ display: 'grid', gap: '0.2rem', marginTop: '0.25rem' }}>
        <span style={{ color: hasMinLength ? 'var(--status-risk-low-text, #15803d)' : 'var(--text-muted)' }}>
          {hasMinLength ? '✓' : '○'} At least 12 characters
        </span>
        <span style={{ color: hasUpperLower ? 'var(--status-risk-low-text, #15803d)' : 'var(--text-muted)' }}>
          {hasUpperLower ? '✓' : '○'} Both uppercase & lowercase letters
        </span>
        <span style={{ color: hasNumberSymbol ? 'var(--status-risk-low-text, #15803d)' : 'var(--text-muted)' }}>
          {hasNumberSymbol ? '✓' : '○'} At least one number & one symbol
        </span>
      </div>

      <label htmlFor="signup-confirm">Confirm Password</label>
      <div className={styles.passwordWrapper}>
        <input
          id="signup-confirm"
          name="confirmPassword"
          type={showConfirmPassword ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          required
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className={styles.passwordToggleBtn}
          aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
          title={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
          tabIndex={0}
        >
          {showConfirmPassword ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {confirmPassword.length > 0 && (
        <div
          className={`${styles.matchBadge} ${passwordsMatch ? styles.matchSuccess : styles.matchError}`}
          role={passwordsMatch ? 'status' : 'alert'}
        >
          <span>{passwordsMatch ? '✓' : '✕'}</span>
          {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
        </div>
      )}

      <button
        type="submit"
        className={styles.submitButton}
        disabled={loading}
        style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}
      >
        {loading ? (
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Spinner size="sm" /> Creating account...
            </span>
            <span aria-hidden="true">⏳</span>
          </>
        ) : (
          <>
            Create account <span aria-hidden="true">↗</span>
          </>
        )}
      </button>

      <p className={styles.switchText}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
