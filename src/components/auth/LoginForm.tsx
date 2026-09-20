'use client';

import { apiFetch } from '@/lib/api/client';

import { useState } from 'react';
import styles from '@/app/login/login.module.css';
import { Spinner } from '@/components/ui/Spinner/Spinner';

interface LoginFormProps {
  nextPath: string;
  demo?: { email: string; password: string };
  initialError?: string;
}

export function LoginForm({ nextPath, demo, initialError }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError === 'credentials' ? 'The email or password is incorrect.' : (initialError ? 'Sign in failed. Please try again.' : null)
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
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
      } else if (response.status === 401) {
        setErrorMessage('The email or password is incorrect.');
      } else if (response.status === 429) {
        setErrorMessage('Too many attempts. Please try again shortly.');
      } else {
        setErrorMessage('Failed to sign in. Please check your connection and try again.');
      }
    } catch {
      setErrorMessage('Network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form method="post" action="/api/auth/login" onSubmit={handleSubmit} className={styles.form}>
      <input type="hidden" name="next" value={nextPath} />

      {errorMessage && (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      )}

      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (errorMessage) setErrorMessage(null);
        }}
        required
        disabled={loading}
      />

      <label htmlFor="login-password">Password</label>
      <div className={styles.passwordWrapper}>
        <input
          id="login-password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
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

      {demo && (
        <button
          type="button"
          className={styles.demoButton}
          onClick={() => {
            setEmail(demo.email);
            setPassword(demo.password);
            if (errorMessage) setErrorMessage(null);
          }}
          disabled={loading}
        >
          Fill evaluator account
          <span aria-hidden="true">01</span>
        </button>
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
              <Spinner size="sm" /> Signing in...
            </span>
            <span aria-hidden="true">⏳</span>
          </>
        ) : (
          <>
            Sign in <span aria-hidden="true">↗</span>
          </>
        )}
      </button>
    </form>
  );
}
