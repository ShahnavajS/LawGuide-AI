import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
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
    desc: 'Upload a text-based PDF contract, lease, NDA, or policy. The original PDF stays in your private workspace; extracted text is sent to the configured AI provider when you request AI analysis.',
    badge: 'Document workspace',
    badgeVariant: 'fact' as const,
  },
  {
    step: '02',
    title: 'Run Legal X-Ray Analysis',
    desc: 'Run analysis to identify parties, obligations, key dates, governing law, and clauses that may deserve a closer look.',
    badge: 'AI-Powered',
    badgeVariant: 'interpretation' as const,
  },
  {
    step: '03',
    title: 'Inspect the Evidence',
    desc: 'Inspect page numbers and source quotes for document findings. A matching quote does not prove every interpretation, so review important conclusions with a legal professional.',
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
    desc: 'Compare an original agreement with a proposed revision to inspect changed clauses and possible shifts in obligations.',
  },
  {
    title: 'Evidence Source Map',
    desc: 'Inspect source quotes for supported findings and see which items need review. Some summaries and suggested questions involve interpretation.',
  },
  {
    title: 'Questions for Counsel',
    desc: 'Collect questions linked to the documents so you can discuss uncertain points with counsel.',
  },
  {
    title: 'Consultation Brief',
    desc: 'Create a structured brief that separates supported document facts from areas needing professional interpretation.',
  },
];

export default function DemoPage() {
  return (
    <div>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroContent}`}>
          <Badge variant="fact" showDot style={{ marginBottom: 'var(--space-4)' }}>
            THE WORKFLOW
          </Badge>
          <h1 className={styles.heroTitle}>
            A guided look at LexiGuide
          </h1>
          <p className={styles.heroSubtitle}>
            See how a document moves from upload to plain-language review, source checking, and questions for counsel.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/dashboard" className={styles.primaryLink}>Upload a document <span aria-hidden="true">↗</span></Link>
            <Link href="/matters" className={styles.secondaryLink}>View matters <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      {/* 4-Step Walkthrough */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>How It Works</span>
            <h2 className={styles.sectionTitle}>Four steps toward a clearer conversation</h2>
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
                <Link href="/matters" className={styles.primaryLink}>Create a matter <span aria-hidden="true">↗</span></Link>
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
            <h2 className={styles.sectionTitle}>Inspect the source behind findings</h2>
            <p className={styles.sectionDesc}>
              LexiGuide AI labels the source and evidence status of statements so you can inspect them before relying on a conclusion.
            </p>
          </div>
          <div className={styles.evidenceGrid}>
            <div className={styles.evidenceItem}>
              <Badge variant="fact">DOCUMENT FACT</Badge>
              <p className={styles.evidenceDesc}>A quote found on the cited page. Read the passage to assess whether the explanation follows.</p>
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
            <Link href="/dashboard" className={styles.primaryLink}>Start with a document <span aria-hidden="true">↗</span></Link>
            <Link href="/matters" className={styles.secondaryLink}>Explore matters <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
