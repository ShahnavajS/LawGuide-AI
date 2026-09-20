'use client';

import styles from './global-error.module.css';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className={styles.body}>
        <main className={styles.card}>
          <p className={styles.eyebrow}>LawGuide AI</p>
          <h1>We could not open this workspace.</h1>
          <p>Your saved documents have not been changed. Try loading the page again.</p>
          <button type="button" onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  );
}
