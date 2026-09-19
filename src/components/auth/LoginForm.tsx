'use client';

import { useState } from 'react';
import styles from '@/app/login/login.module.css';

interface LoginFormProps {
  nextPath: string;
  demo?: { email: string; password: string };
}

export function LoginForm({ nextPath, demo }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form method="post" action="/api/auth/login" className={styles.form}>
      <input type="hidden" name="next" value={nextPath} />
      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <label htmlFor="login-password">Password</label>
      <input
        id="login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {demo && (
        <button
          type="button"
          className={styles.demoButton}
          onClick={() => {
            setEmail(demo.email);
            setPassword(demo.password);
          }}
        >
          Fill evaluator account
          <span aria-hidden="true">01</span>
        </button>
      )}
      <button type="submit" className={styles.submitButton}>
        Sign in <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
