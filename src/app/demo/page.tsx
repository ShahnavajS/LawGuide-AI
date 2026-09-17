import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { Card } from '@/components/ui/Card/Card';
import { LEGAL_DISCLAIMERS } from '@/lib/ai/safety';
import styles from './demo.module.css';

export const metadata: Metadata = {
  title: 'Demo — LexiGuide AI',
  description:
    'See how LexiGuide AI turns complex legal documents into plain-language insights grounded in verifiable evidence.',
};

const DEMO_STEPS = [
  {
    step: '01',
    title: 'Upload Any Legal Document',
    desc: 'Drag-and-drop a PDF contract, lease, NDA, or policy. The document stays in your private workspace — it is never used to train AI models.',
    badge: 'Secure & Private',
    badgeVariant: 'fact' as const,
  },
  {
    step: '02',
    title: 'Run Legal X-Ray Analysis',
    desc: 'One click runs Gemini 2.5 Flash over the full document. Parties, obligations, key dates, governing law, and non-standard risk clauses are extracted and classified.',
    badge: 'AI-Powered',
    badgeVariant: 'interpretation' as const,
  },
  {
    step: '03',
    title: 'Verify Every Claim',
    desc: 'Every insight is grounded in a specific page number and verbatim quote. No hallucinations. Open the inline viewer to inspect the cited text yourself.',
    badge: 'Evidence-Grounded',
    badgeVariant: 'fact' as const,
  },
  {
    step: '04',
    title: 'Ask, Compare & Prepare',
    desc: 'Ask natural-language questions and get cited answers. Compare two versions of a contract. Group documents into a Matter and generate a consultation brief for your attorney.',
    badge: 'Attorney-Ready',
    badgeVariant: 'review' as const,
  },
];

const SCENARIO_FEATURES = [
  {
    title: 'Cross-Document Intelligence',
    desc: 'Upload both the original SaaS agreement and the amended version. LexiGuide AI identifies every changed clause, detects payment term inconsistencies, and maps obligation conflicts.',
  },
  {
    title: 'Evidence Source Map',
    desc: 'Every finding — from an inconsistency to a timeline event — is linked back to the exact document, page, and quoted text. Fully traceable, zero inference.',
  },
  {
    title: 'Questions for Counsel',
    desc: 'The system generates targeted questions grounded in factual discrepancies, so your attorney can focus on strategic issues instead of document orientation.',
  },
  {
    title: 'Consultation Brief',
    desc: 'Export a structured legal brief separating verified document facts from areas needing professional interpretation — maximising billable hour efficiency.',
  },
];

export default function DemoPage() {
  return (
    <div>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroContent}`}>
          <Badge variant="fact" showDot style={{ marginBottom: 'var(--space-4)' }}>
            Evaluator Demo Experience
          </Badge>
          <h1 className={styles.heroTitle}>
            LexiGuide AI in Action
          </h1>
          <p className={styles.heroSubtitle}>
            See how the platform transforms impenetrable legal documents into clear, verifiable, attorney-ready intelligence — in four steps.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/dashboard">
              <Button size="lg" variant="primary">Try It — Upload a Document</Button>
            </Link>
            <Link href="/matters">
              <Button size="lg" variant="outline">View Matters Workspace</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 4-Step Walkthrough */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>How It Works</span>
            <h2 className={styles.sectionTitle}>Four steps from upload to attorney-ready</h2>
          </div>
          <div className={styles.stepsGrid}>
            {DEMO_STEPS.map((s) => (
              <div key={s.step} className={styles.stepCard}>
                <div className={styles.stepNum}>{s.step}</div>
                <Badge variant={s.badgeVariant} style={{ alignSelf: 'flex-start' }}>{s.badge}</Badge>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scenario: SaaS Vendor Dispute */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="container">
          <div className={styles.scenarioBox}>
            <div className={styles.scenarioLeft}>
              <span className={styles.eyebrow}>Sample Scenario</span>
              <h2 className={styles.scenarioTitle}>
                Commercial Lease Renewal Dispute
              </h2>
              <p className={styles.scenarioDesc}>
                A tenant receives a proposed lease renewal with significantly altered terms. Using LexiGuide AI, they upload both the original lease and the renewal proposal, then run cross-document analysis to identify what changed, where the obligations shifted, and what questions to raise with their solicitor.
              </p>
              <p className={styles.scenarioDesc}>
                This scenario is representative of typical use — individuals and small teams navigating complex document changes without immediate access to legal counsel.
              </p>
              <div className={styles.scenarioCta}>
                <Link href="/matters">
                  <Button variant="primary">Create Your Own Matter →</Button>
                </Link>
              </div>
            </div>
            <div className={styles.scenarioFeatures}>
              {SCENARIO_FEATURES.map((f) => (
                <Card key={f.title} variant="default" className={styles.featureCard}>
                  <h4 className={styles.featureTitle}>{f.title}</h4>
                  <p className={styles.featureDesc}>{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Evidence Classification */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Trust & Transparency</span>
            <h2 className={styles.sectionTitle}>Every insight is classified and traceable</h2>
            <p className={styles.sectionDesc}>
              LexiGuide AI uses a four-tier evidence classification system so you always know the source and reliability of every statement.
            </p>
          </div>
          <div className={styles.evidenceGrid}>
            <div className={styles.evidenceItem}>
              <Badge variant="fact">DOCUMENT FACT</Badge>
              <p className={styles.evidenceDesc}>Verbatim quote from the document, verified against the source page. Highest confidence.</p>
            </div>
            <div className={styles.evidenceItem}>
              <Badge variant="interpretation">AI INTERPRETATION</Badge>
              <p className={styles.evidenceDesc}>Contextual explanation grounded in document text. Requires professional verification for legal decisions.</p>
            </div>
            <div className={styles.evidenceItem}>
              <Badge variant="general">GENERAL INFORMATION</Badge>
              <p className={styles.evidenceDesc}>Background legal context not specific to the document. Always verify with a licensed attorney.</p>
            </div>
            <div className={styles.evidenceItem}>
              <Badge variant="review">NEEDS REVIEW</Badge>
              <p className={styles.evidenceDesc}>Ambiguous or complex clause requiring professional legal interpretation before acting.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Legal Disclaimer */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="container" style={{ maxWidth: '720px', textAlign: 'center' }}>
          <Badge variant="general" style={{ marginBottom: 'var(--space-4)' }}>Responsible AI Notice</Badge>
          <h2 className={styles.sectionTitle}>Legal Information, Not Legal Advice</h2>
          <p className={styles.disclaimerText}>{LEGAL_DISCLAIMERS.GLOBAL_FOOTER}</p>
          <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard">
              <Button size="lg" variant="primary">Start Analyzing →</Button>
            </Link>
            <Link href="/matters">
              <Button size="lg" variant="outline">Explore Matters</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
