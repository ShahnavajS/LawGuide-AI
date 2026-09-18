import Link from 'next/link';
import styles from './page.module.css';

const tasks = [
  { number: '01', title: 'Read with clarity', text: 'Turn dense clauses into plain language, then return to the original wording and page.', href: '/dashboard', action: 'Explore documents' },
  { number: '02', title: 'See what changed', text: 'Compare two versions and focus on changes to obligations, dates, and terms.', href: '/compare', action: 'Compare versions' },
  { number: '03', title: 'Bring better questions', text: 'Collect the points you want a legal professional to review in a structured brief.', href: '/prepare', action: 'Prepare questions' },
];

export default function HomePage() {
  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.eyebrowRule} />A clearer way through legal documents</p>
            <h1>Know what you&apos;re <em>reading.</em><br />Know what to <em>ask.</em></h1>
            <p className={styles.lead}>Understand agreements in plain language, inspect the source behind a finding, and prepare for a more useful conversation with a legal professional.</p>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href="/dashboard">Upload a document <span aria-hidden="true">↗</span></Link>
              <Link className={styles.secondaryAction} href="/demo">See how it works <span aria-hidden="true">→</span></Link>
            </div>
            <p className={styles.heroNote}>Information and preparation support. Legal decisions deserve qualified advice.</p>
          </div>
          <div className={styles.specimen} aria-label="Illustrative example of a document explanation">
            <div className={styles.specimenTop}><span>ILLUSTRATIVE EXAMPLE</span><span>01 / 02</span></div>
            <div className={styles.document}>
              <div className={styles.docHeader}><span>AGREEMENT EXCERPT</span><span>PAGE 04 · SECTION 8</span></div>
              <h2>Renewal term</h2>
              <p className={styles.docText}>“This Agreement shall automatically renew for successive one-year periods unless either party gives written notice at least sixty (60) days before the end of the then-current term.”</p>
              <div className={styles.annotation}>
                <span className={styles.annotationLabel}>IN PLAIN LANGUAGE</span>
                <p>The agreement may renew for another year unless one party sends written notice at least 60 days before the current term ends.</p>
              </div>
              <div className={styles.docFooter}><span>What to check</span><p>Find the current end date and how notice must be sent.</p></div>
            </div>
            <p className={styles.specimenCaption}>An explanation is a starting point. Check the full clause and surrounding terms.</p>
          </div>
        </div>
      </section>

      <div className={styles.marquee} aria-label="Product workflow"><div className="container"><span>UNDERSTAND</span><i aria-hidden="true">/</i><span>COMPARE</span><i aria-hidden="true">/</i><span>ASK</span><i aria-hidden="true">/</i><span>PREPARE</span></div></div>

      <section className={styles.section} id="what-you-can-do">
        <div className="container">
          <div className={styles.sectionIntro}><p className={styles.eyebrow}>THE WORKSPACE</p><h2>From a page of fine print to a clear next step.</h2><p>Each tool is built around a real task, with the document close at hand.</p></div>
          <div className={styles.taskGrid}>{tasks.map((task) => <article className={styles.task} key={task.number}><span className={styles.taskNumber}>{task.number}</span><div><h3>{task.title}</h3><p>{task.text}</p><Link href={task.href}>{task.action} <span aria-hidden="true">↗</span></Link></div></article>)}</div>
        </div>
      </section>

      <section className={styles.trustSection}>
        <div className={`container ${styles.trustGrid}`}>
          <div><p className={styles.eyebrow}>EVIDENCE, IN CONTEXT</p><h2>See the words behind the answer.</h2><p>Document findings can point you to a page and quote. The interface separates source text from AI interpretation and flags points that need professional review.</p><Link href="/demo" className={styles.textLink}>Explore the approach <span aria-hidden="true">↗</span></Link></div>
          <div className={styles.trustList}><div><span>01</span><strong>Source passage</strong><p>Read the language in the original document.</p></div><div><span>02</span><strong>Plain-language explanation</strong><p>Understand a possible meaning, with uncertainty made visible.</p></div><div><span>03</span><strong>Questions to bring forward</strong><p>Make a note of anything that calls for legal judgment.</p></div></div>
        </div>
      </section>

      <section className={styles.closeSection}><div className="container"><p className={styles.eyebrow}>START WITH THE DOCUMENT</p><h2>Clarity starts with a closer read.</h2><div className={styles.actions}><Link className={styles.primaryAction} href="/dashboard">Open document workspace <span aria-hidden="true">↗</span></Link><Link className={styles.secondaryAction} href="/legal-info">Browse legal information <span aria-hidden="true">→</span></Link></div><p>LexiGuide provides legal information, not legal advice. Consult a qualified professional for advice about your situation.</p></div></section>
    </>
  );
}
