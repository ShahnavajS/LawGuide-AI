import styles from './login.module.css';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className={`container ${styles.shell}`}>
      <div className={styles.intro}><p className={styles.eyebrow}>PRIVATE WORKSPACE</p><h1>Your documents, ready when you are.</h1><p>Sign in to review your saved documents and matters.</p><span className={styles.rule} /></div>
      <div className={styles.panel}>
        <span className={styles.panelIndex}>ACCESS / 01</span>
        <h2>Sign in</h2>
        {error && <p className={styles.error} role="alert">Incorrect password. Please try again.</p>}
        <form method="post" action="/api/auth/login" className={styles.form}>
          <label htmlFor="workspace-password">Workspace password</label>
          <input id="workspace-password" name="password" type="password" autoComplete="current-password" required />
          <button type="submit">Open workspace <span aria-hidden="true">↗</span></button>
        </form>
        <p>LexiGuide provides legal information and preparation support, not legal advice.</p>
      </div>
    </div>
  );
}
