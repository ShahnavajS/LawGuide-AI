import Link from 'next/link';
import { safeNextPath } from '@/lib/auth/http';
import styles from '@/app/login/login.module.css';

const ERRORS: Record<string, string> = {
  exists: 'An account with this email already exists. Sign in instead.',
  invalid: 'Check your name, email, and password requirements.',
  'password-match': 'The two passwords do not match.',
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next || null);

  return (
    <div className={`container ${styles.shell}`}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>A WORKSPACE OF YOUR OWN</p>
        <h1>Keep every matter with the person it belongs to.</h1>
        <p>Your documents, analyses, comparisons, notes, and preparation briefs are separated from every other account.</p>
        <span className={styles.rule} />
      </div>
      <section className={styles.panel} aria-labelledby="create-account-title">
        <span className={styles.panelIndex}>ACCOUNT / 02</span>
        <h2 id="create-account-title">Create account</h2>
        {params.error && (
          <p className={styles.error} role="alert">{ERRORS[params.error] || ERRORS.invalid}</p>
        )}
        <form method="post" action="/api/auth/signup" className={styles.form}>
          <input type="hidden" name="next" value={nextPath} />
          <label htmlFor="signup-name">Name</label>
          <input id="signup-name" name="name" type="text" autoComplete="name" minLength={2} maxLength={80} required />
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" name="email" type="email" autoComplete="email" maxLength={254} required />
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="password-help" required />
          <p id="password-help" className={styles.fieldHelp}>Use 12 or more characters with uppercase, lowercase, a number, and a symbol.</p>
          <label htmlFor="signup-confirm">Confirm password</label>
          <input id="signup-confirm" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          <button type="submit" className={styles.submitButton}>Create account <span aria-hidden="true">↗</span></button>
        </form>
        <p className={styles.switchText}>Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
    </div>
  );
}
