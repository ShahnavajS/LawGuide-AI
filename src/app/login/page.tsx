import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';
import { evaluatorAccountConfig } from '@/lib/auth/service';
import { safeNextPath } from '@/lib/auth/http';
import styles from './login.module.css';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next || null);
  const demoConfig = evaluatorAccountConfig();
  const demo = demoConfig.enabled
    ? { email: demoConfig.email, password: demoConfig.password }
    : undefined;

  return (
    <div className={`container ${styles.shell}`}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>YOUR PRIVATE WORKSPACE</p>
        <h1>Legal documents deserve a private desk.</h1>
        <p>Sign in to continue with documents, comparisons, matters, and counsel preparation saved to your account.</p>
        <span className={styles.rule} />
      </div>
      <section className={styles.panel} aria-labelledby="sign-in-title">
        <span className={styles.panelIndex}>ACCOUNT / 01</span>
        <h2 id="sign-in-title">Sign in</h2>
        {params.error && (
          <p className={styles.error} role="alert">The email or password is incorrect.</p>
        )}
        <LoginForm nextPath={nextPath} demo={demo} />
        {demo && (
          <p className={styles.demoNote}>
            The evaluator account is shared and contains sample data. Use a personal account for private documents.
          </p>
        )}
        <p className={styles.switchText}>New to LexiGuide? <Link href="/signup">Create an account</Link></p>
      </section>
    </div>
  );
}
