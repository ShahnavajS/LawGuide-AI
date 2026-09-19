import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authenticateSessionToken } from '@/lib/auth/service';
import { SESSION_COOKIE } from '@/lib/security/workspace-auth';
import { SignOutButton } from '@/components/auth/SignOutButton';
import styles from './account.module.css';

export default async function AccountPage() {
  const cookieStore = await cookies();
  const user = authenticateSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect('/login?next=/account');

  return (
    <div className={`container ${styles.shell}`}>
      <header className={styles.heading}>
        <p>ACCOUNT</p>
        <h1>Your LawGuide workspace</h1>
        <span>Documents and generated work in this workspace are visible only to this account.</span>
      </header>
      <section className={styles.card} aria-labelledby="profile-heading">
        <div className={styles.cardHeader}>
          <span>PROFILE / 01</span>
          {user.isDemo && <strong>SHARED DEMO</strong>}
        </div>
        <h2 id="profile-heading">{user.name}</h2>
        <dl>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Workspace</dt><dd>{user.isDemo ? 'Evaluator sample workspace' : 'Private account workspace'}</dd></div>
        </dl>
        {user.isDemo && (
          <p className={styles.notice}>This evaluator account is shared. Upload sample or non-sensitive documents only.</p>
        )}
        <div className={styles.actions}>
          <Link href="/dashboard">Open documents</Link>
          <SignOutButton />
        </div>
      </section>
    </div>
  );
}
