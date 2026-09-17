import React from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { Card } from '@/components/ui/Card/Card';
import { LEGAL_DISCLAIMERS, EVIDENCE_CLASSIFICATIONS } from '@/lib/ai/safety';

export default function HomePage() {
  return (
    <div>
      {/* 1. HERO SECTION */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroContent}`}>
          <div className={styles.heroBadge}>
            <Badge variant="fact" showDot>
              LexiGuide AI &bull; Grounded in Verifiable Evidence
            </Badge>
          </div>

          <h1 className={styles.heroTitle}>
            Legal language, <br />
            <span className={styles.heroTitleHighlight}>made human.</span>
          </h1>

          <div className={styles.promisePillars}>
            <span className={styles.promiseItem}>UNDERSTAND</span>
            <span className={styles.promiseDivider}>&bull;</span>
            <span className={styles.promiseItem}>COMPARE</span>
            <span className={styles.promiseDivider}>&bull;</span>
            <span className={styles.promiseItem}>PREPARE</span>
          </div>

          <p className={styles.heroSubtitle}>
            Transform dense contracts, leases, and agreements into clear obligations, side-by-side version diffs, and attorney-ready consultation briefs.
          </p>

          <div className={styles.heroCtaGroup}>
            <Link href="/dashboard">
              <Button size="lg" variant="primary">
                Analyze a Document
              </Button>
            </Link>
            <Link href="/matters">
              <Button size="lg" variant="secondary">
                Open Matter Workspace
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline">
                Try Demo Experience
              </Button>
            </Link>
          </div>

          <p className={styles.heroDisclaimer}>
            LexiGuide provides information and preparation support, not legal advice.
          </p>

          {/* Interactive Hero Evidence Preview Card */}
          <div className={styles.previewWrapper}>
            <div className={styles.previewCard}>
              <div className={styles.previewHeader}>
                <div className={styles.previewDots}>
                  <div className={styles.previewDot} />
                  <div className={styles.previewDot} />
                  <div className={styles.previewDot} />
                </div>
                <span className={styles.previewFilename}>Commercial_Lease_Agreement_2025.pdf</span>
                <Badge variant="fact" showDot>
                  Verified Citation (p. 4, §8.2)
                </Badge>
              </div>

              <div className={styles.previewBody}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    SOURCE EXCERPT FROM DOCUMENT:
                  </span>
                  <div className={styles.previewClauseBlock}>
                    &quot;Tenant shall indemnify, defend, and hold Landlord harmless from and against any and all claims, liabilities, or damages arising out of the Premises, regardless of Landlord negligence...&quot;
                  </div>
                </div>

                <div className={styles.previewAnalysisBlock}>
                  <div className={styles.previewAnalysisTitle}>
                    <Badge variant="review">Needs Professional Review</Badge>
                    <span>Unilateral Broad Indemnification</span>
                  </div>
                  <p className={styles.previewAnalysisText}>
                    <strong>Plain English:</strong> This clause requires you to pay for the landlord&apos;s damages and legal fees, even if the issue was caused by the landlord&apos;s own negligence. This is highly unfavorable and typically negotiated to exclude landlord gross negligence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE PROBLEM */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>The Challenge</span>
            <h2 className={styles.sectionTitle}>Why legal documents stay unread</h2>
            <p className={styles.sectionDesc}>
              Standard legal language is designed for courtrooms and risk minimization, creating barriers for individuals and small teams.
            </p>
          </div>

          <div className={styles.problemGrid}>
            <div className={styles.problemCard}>
              <div className={styles.problemIcon}>!</div>
              <h3 className={styles.problemTitle}>Opaque Legalese</h3>
              <p className={styles.problemText}>
                Dense syntax, archaic phrasing, and cross-references hide crucial commitments and ambiguous rights in plain sight.
              </p>
            </div>

            <div className={styles.problemCard}>
              <div className={styles.problemIcon}>§</div>
              <h3 className={styles.problemTitle}>Hidden Obligations</h3>
              <p className={styles.problemText}>
                Automatic renewals, strict notification windows, and unilateral termination clauses often go unnoticed until it is too late.
              </p>
            </div>

            <div className={styles.problemCard}>
              <div className={styles.problemIcon}>$</div>
              <h3 className={styles.problemTitle}>Prohibitive Costs</h3>
              <p className={styles.problemText}>
                Consulting counsel for routine understanding can cost hundreds of dollars per hour, forcing people to sign without clarity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CORE CAPABILITIES */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>Core Experience</span>
            <h2 className={styles.sectionTitle}>UNDERSTAND &rarr; COMPARE &rarr; ASK &rarr; PREPARE</h2>
            <p className={styles.sectionDesc}>
              A comprehensive toolkit engineered to navigate complex documents with certainty.
            </p>
          </div>

          <div className={styles.capabilitiesGrid}>
            <Card variant="interactive" className={styles.capabilityCard}>
              <div className={styles.capabilityBadgeRow}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-600)' }}>01</span>
                <Badge variant="fact">Legal X-Ray</Badge>
              </div>
              <h3 className={styles.capabilityTitle}>Understand the Essentials</h3>
              <p className={styles.capabilityDesc}>
                Instant breakdown of your document: parties, governing law, core obligations, key timelines, and non-standard risk clauses.
              </p>
              <ul className={styles.capabilityBulletList}>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Plain-language clause translation
                </li>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Party obligation mapping
                </li>
              </ul>
            </Card>

            <Card variant="interactive" className={styles.capabilityCard}>
              <div className={styles.capabilityBadgeRow}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-600)' }}>02</span>
                <Badge variant="interpretation">Diff & Nuance</Badge>
              </div>
              <h3 className={styles.capabilityTitle}>Compare Versions</h3>
              <p className={styles.capabilityDesc}>
                Upload two versions of a contract to immediately see substantive changes beyond simple text diffs, highlighting shift in balance.
              </p>
              <ul className={styles.capabilityBulletList}>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Added, removed, and modified clauses
                </li>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Substantive impact assessment
                </li>
              </ul>
            </Card>

            <Card variant="interactive" className={styles.capabilityCard}>
              <div className={styles.capabilityBadgeRow}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-600)' }}>03</span>
                <Badge variant="fact">Evidence Grounded</Badge>
              </div>
              <h3 className={styles.capabilityTitle}>Ask Document Q&amp;A</h3>
              <p className={styles.capabilityDesc}>
                Ask direct questions in natural language. Every answer links to precise page numbers and quoted paragraphs with zero hallucinations.
              </p>
              <ul className={styles.capabilityBulletList}>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Clickable page citations
                </li>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Strict anti-hallucination guardrails
                </li>
              </ul>
            </Card>

            <Card variant="interactive" className={styles.capabilityCard}>
              <div className={styles.capabilityBadgeRow}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-600)' }}>04</span>
                <Badge variant="review">Attorney-Ready</Badge>
              </div>
              <h3 className={styles.capabilityTitle}>Prepare for a Lawyer</h3>
              <p className={styles.capabilityDesc}>
                Maximize consultation efficiency. Generate a structured brief with critical points of ambiguity and tailored questions for counsel.
              </p>
              <ul className={styles.capabilityBulletList}>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Save hundreds on attorney billable hours
                </li>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Targeted negotiation checklists
                </li>
              </ul>
            </Card>

            <Card variant="interactive" className={styles.capabilityCard}>
              <div className={styles.capabilityBadgeRow}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-600)' }}>05</span>
                <Badge variant="fact">Multi-Document</Badge>
              </div>
              <h3 className={styles.capabilityTitle}>Organize Related Matters</h3>
              <p className={styles.capabilityDesc}>
                Group contracts, amendments, notices, and lease schedules under a unified Matter workspace for cross-document intelligence.
              </p>
              <ul className={styles.capabilityBulletList}>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Cross-document consistency detection
                </li>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Document relationship hierarchy
                </li>
              </ul>
            </Card>

            <Card variant="interactive" className={styles.capabilityCard}>
              <div className={styles.capabilityBadgeRow}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-600)' }}>06</span>
                <Badge variant="fact">100% Traceable</Badge>
              </div>
              <h3 className={styles.capabilityTitle}>Trace Findings to Evidence</h3>
              <p className={styles.capabilityDesc}>
                Every finding, consistency alert, and counsel question links directly to exact pages and verbatim quotes in your documents.
              </p>
              <ul className={styles.capabilityBulletList}>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Visual document-to-quote Source Map
                </li>
                <li className={styles.capabilityBullet}>
                  <span className={styles.bulletDot} />
                  Immutable evidence audit ledger
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* 4. EVIDENCE-FIRST ARCHITECTURE */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="container">
          <div className={styles.evidenceBox}>
            <div className={styles.evidenceLeft}>
              <span className={styles.sectionEyebrow}>Trust &amp; Verification</span>
              <h2 className={styles.evidenceTitle}>Every claim anchors directly to the text</h2>
              <p className={styles.evidenceText}>
                Unlike generic chatbots that guess, LexiGuide AI categorizes every insight using a 4-tier evidence classification framework so you always know what is stated vs what is inferred.
              </p>
              <Link href="/dashboard">
                <Button variant="primary">Explore Your Documents</Button>
              </Link>
            </div>

            <div className={styles.evidenceClassifications}>
              {Object.values(EVIDENCE_CLASSIFICATIONS).map((item) => (
                <div key={item.type} className={styles.classificationItem}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '2px' }}>{item.label}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>{item.description}</span>
                  </div>
                  <Badge
                    variant={
                      item.type === 'DOCUMENT_FACT'
                        ? 'fact'
                        : item.type === 'AI_INTERPRETATION'
                        ? 'interpretation'
                        : item.type === 'NEEDS_REVIEW'
                        ? 'review'
                        : 'general'
                    }
                  >
                    {item.type}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section id="how-it-works" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>Workflow</span>
            <h2 className={styles.sectionTitle}>How LexiGuide AI Works</h2>
            <p className={styles.sectionDesc}>
              Four seamless steps from impenetrable legal documents to actionable clarity.
            </p>
          </div>

          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3 className={styles.stepTitle}>Upload</h3>
              <p className={styles.stepText}>
                Upload contracts, leases, NDAs, or employment policies securely to your private workspace.
              </p>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3 className={styles.stepTitle}>Analyze</h3>
              <p className={styles.stepText}>
                Advanced GenAI scans the document structure, extracting clauses, obligations, and unusual clauses.
              </p>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3 className={styles.stepTitle}>Verify</h3>
              <p className={styles.stepText}>
                Inspect exact quotes and citations highlighted on the original document pages to confirm veracity.
              </p>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>4</div>
              <h3 className={styles.stepTitle}>Understand</h3>
              <p className={styles.stepText}>
                Ask questions, compare revisions, and export an attorney-ready brief for targeted professional advice.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. LEGAL SAFETY STATEMENT */}
      <section className={`${styles.section} ${styles.sectionAlt}`} style={{ textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '720px' }}>
          <Badge variant="general" style={{ marginBottom: 'var(--space-4)' }}>
            Responsible AI Notice
          </Badge>
          <h2 className={styles.sectionTitle}>Legal Information, Not Legal Advice</h2>
          <p className={styles.sectionDesc} style={{ marginBottom: 'var(--space-6)' }}>
            {LEGAL_DISCLAIMERS.GLOBAL_FOOTER}
          </p>
          <Link href="/dashboard">
            <Button size="lg" variant="primary">
              Get Started with LexiGuide AI
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
