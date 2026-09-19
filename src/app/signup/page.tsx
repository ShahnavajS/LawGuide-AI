import { safeNextPath } from '@/lib/auth/http';
import styles from '@/app/login/login.module.css';
import { SignupForm } from '@/components/auth/SignupForm';

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
        <SignupForm nextPath={nextPath} initialError={params.error} />
      </section>
    </div>
  );
}
