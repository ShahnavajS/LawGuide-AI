/**
 * Controlled Legal Information Source Registry for LexiGuide AI (Phase 7).
 *
 * Implements a curated, verified registry of authoritative legal-information sources.
 * Sources are strictly categorized by trust level (PRIMARY, SECONDARY, GENERAL)
 * and jurisdiction without allowing arbitrary web scraping or hallucinated URLs.
 */

import { SOURCE_TRUST_LEVELS, SourceTrustLevel } from '@/lib/ai/safety';

export interface AuthoritativeSource {
  id: string;
  title: string;
  shortName: string;
  canonicalUrl: string;
  authorityLevel: SourceTrustLevel;
  jurisdictionCountry: string; // 'India', 'United States', 'United Kingdom', 'International'
  jurisdictionRegion?: string;
  relevantTopics: string[]; // references taxonomy LegalTopicId or '*'
  description: string;
  governingBody: string;
  updatedAt: string;
  accessedAt: string;
  isVerified: boolean;
}

export const AUTHORITATIVE_SOURCES: AuthoritativeSource[] = [
  // --- INDIA PRIMARY SOURCES ---
  {
    id: 'INDIA_CODE',
    title: 'India Code — Digital Repository of Central and State Acts',
    shortName: 'India Code',
    canonicalUrl: 'https://www.indiacode.nic.in',
    authorityLevel: SOURCE_TRUST_LEVELS.PRIMARY,
    jurisdictionCountry: 'India',
    relevantTopics: [
      'TERMINATION',
      'NOTICE_PERIOD',
      'PAYMENT',
      'INTEREST',
      'PENALTIES',
      'INDEMNIFICATION',
      'LIABILITY',
      'NON_COMPETE',
      'GOVERNING_LAW',
      'JURISDICTION',
      'ARBITRATION',
      'FORCE_MAJEURE',
      'SEVERABILITY',
    ],
    description:
      'Official legislative repository maintained by the Legislative Department, Ministry of Law and Justice, Government of India.',
    governingBody: 'Ministry of Law and Justice, Government of India',
    updatedAt: '2026-01-15',
    accessedAt: '2026-09-01',
    isVerified: true,
  },
  {
    id: 'SCI_JUDGMENTS',
    title: 'Supreme Court of India — Judgments and Case Law Portal',
    shortName: 'Supreme Court of India',
    canonicalUrl: 'https://main.sci.gov.in',
    authorityLevel: SOURCE_TRUST_LEVELS.PRIMARY,
    jurisdictionCountry: 'India',
    relevantTopics: [
      'ARBITRATION',
      'DISPUTE_RESOLUTION',
      'INDEMNIFICATION',
      'NON_COMPETE',
      'LIMITATION_OF_LIABILITY',
      'FORCE_MAJEURE',
      'PENALTIES',
    ],
    description:
      'Official court records and reported precedents of the Supreme Court of India.',
    governingBody: 'Supreme Court of India',
    updatedAt: '2026-02-10',
    accessedAt: '2026-09-01',
    isVerified: true,
  },
  {
    id: 'NALSA_PORTAL',
    title: 'National Legal Services Authority (NALSA)',
    shortName: 'NALSA',
    canonicalUrl: 'https://nalsa.gov.in',
    authorityLevel: SOURCE_TRUST_LEVELS.PRIMARY,
    jurisdictionCountry: 'India',
    relevantTopics: [
      'DISPUTE_RESOLUTION',
      'MEDIATION',
      'TERMINATION',
      'PAYMENT',
    ],
    description:
      'Statutory apex body constituted under the Legal Services Authorities Act, 1987, providing free legal services and organizing Lok Adalats.',
    governingBody: 'National Legal Services Authority',
    updatedAt: '2026-03-01',
    accessedAt: '2026-09-01',
    isVerified: true,
  },
  {
    id: 'MCA_PORTAL',
    title: 'Ministry of Corporate Affairs (MCA)',
    shortName: 'MCA',
    canonicalUrl: 'https://www.mca.gov.in',
    authorityLevel: SOURCE_TRUST_LEVELS.PRIMARY,
    jurisdictionCountry: 'India',
    relevantTopics: [
      'REPRESENTATIONS',
      'WARRANTIES',
      'ASSIGNMENT',
      'CONFIDENTIALITY',
      'ENTIRE_AGREEMENT',
    ],
    description:
      'Official repository for Indian corporate administration, Companies Act 2013 filings, and commercial regulations.',
    governingBody: 'Ministry of Corporate Affairs, Government of India',
    updatedAt: '2026-01-20',
    accessedAt: '2026-09-01',
    isVerified: true,
  },
  {
    id: 'TELE_LAW',
    title: 'Department of Justice — Tele-Law Portal',
    shortName: 'Tele-Law India',
    canonicalUrl: 'https://tele-law.in',
    authorityLevel: SOURCE_TRUST_LEVELS.PRIMARY,
    jurisdictionCountry: 'India',
    relevantTopics: [
      'DISPUTE_RESOLUTION',
      'MEDIATION',
      'TERMINATION',
    ],
    description:
      'Mainstream legal aid and pre-litigation advice delivery service operated by the Department of Justice.',
    governingBody: 'Department of Justice, Government of India',
    updatedAt: '2026-02-15',
    accessedAt: '2026-09-01',
    isVerified: true,
  },

  // --- INTERNATIONAL & GENERAL AUTHORITATIVE SOURCES ---
  {
    id: 'CORNELL_LII',
    title: 'Legal Information Institute (LII) — Cornell Law School',
    shortName: 'Cornell LII',
    canonicalUrl: 'https://www.law.cornell.edu',
    authorityLevel: SOURCE_TRUST_LEVELS.SECONDARY,
    jurisdictionCountry: 'United States',
    relevantTopics: [
      'TERMINATION',
      'NOTICE_PERIOD',
      'RENEWAL',
      'PAYMENT',
      'INTEREST',
      'PENALTIES',
      'INDEMNIFICATION',
      'LIABILITY',
      'LIMITATION_OF_LIABILITY',
      'CONFIDENTIALITY',
      'NON_DISCLOSURE',
      'INTELLECTUAL_PROPERTY',
      'GOVERNING_LAW',
      'JURISDICTION',
      'ARBITRATION',
      'FORCE_MAJEURE',
      'REPRESENTATIONS',
      'WARRANTIES',
      'ASSIGNMENT',
      'SEVERABILITY',
      'ENTIRE_AGREEMENT',
      'AMENDMENT',
      'WAIVER',
      'DEFINITIONS',
    ],
    description:
      'Renowned non-profit, open-access public legal research and education facility hosted by Cornell Law School.',
    governingBody: 'Cornell Law School',
    updatedAt: '2026-04-01',
    accessedAt: '2026-09-01',
    isVerified: true,
  },
  {
    id: 'UK_LEGISLATION',
    title: 'The National Archives — UK Legislation',
    shortName: 'UK Legislation',
    canonicalUrl: 'https://www.legislation.gov.uk',
    authorityLevel: SOURCE_TRUST_LEVELS.PRIMARY,
    jurisdictionCountry: 'United Kingdom',
    relevantTopics: [
      'TERMINATION',
      'PAYMENT',
      'LIABILITY',
      'LIMITATION_OF_LIABILITY',
      'ARBITRATION',
      'GOVERNING_LAW',
    ],
    description:
      'Official statutory portal containing UK Public General Acts, Statutory Instruments, and devolved legislation.',
    governingBody: 'The National Archives, UK Government',
    updatedAt: '2026-03-12',
    accessedAt: '2026-09-01',
    isVerified: true,
  },
  {
    id: 'WIPO_LEX',
    title: 'World Intellectual Property Organization (WIPO)',
    shortName: 'WIPO Lex',
    canonicalUrl: 'https://www.wipo.int',
    authorityLevel: SOURCE_TRUST_LEVELS.PRIMARY,
    jurisdictionCountry: 'International',
    relevantTopics: [
      'INTELLECTUAL_PROPERTY',
      'CONFIDENTIALITY',
      'NON_DISCLOSURE',
      'WARRANTIES',
    ],
    description:
      'Global forum for intellectual property services, policy, treaties, and educational standards.',
    governingBody: 'World Intellectual Property Organization (United Nations)',
    updatedAt: '2026-01-30',
    accessedAt: '2026-09-01',
    isVerified: true,
  },
  {
    id: 'UNCITRAL',
    title: 'United Nations Commission on International Trade Law (UNCITRAL)',
    shortName: 'UNCITRAL',
    canonicalUrl: 'https://uncitral.un.org',
    authorityLevel: SOURCE_TRUST_LEVELS.PRIMARY,
    jurisdictionCountry: 'International',
    relevantTopics: [
      'ARBITRATION',
      'MEDIATION',
      'DISPUTE_RESOLUTION',
      'GOVERNING_LAW',
      'FORCE_MAJEURE',
    ],
    description:
      'Core legal body of the United Nations system in the field of international commercial law and dispute arbitration standards.',
    governingBody: 'United Nations',
    updatedAt: '2026-02-28',
    accessedAt: '2026-09-01',
    isVerified: true,
  },
];

/**
 * Retrieves matching authoritative sources for a topic and jurisdiction.
 */
export function getAuthoritativeSources(
  topicId: string,
  country?: string | null
): AuthoritativeSource[] {
  const normTopic = topicId.toUpperCase().replace(/[-\s]+/g, '_');
  const targetCountry = (country || '').trim().toLowerCase();

  return AUTHORITATIVE_SOURCES.filter((source) => {
    // 1. Topic match
    const topicMatch =
      source.relevantTopics.includes('*') ||
      source.relevantTopics.includes(normTopic);
    if (!topicMatch) return false;

    // 2. Jurisdiction preference
    if (targetCountry) {
      if (
        source.jurisdictionCountry.toLowerCase() === targetCountry ||
        source.jurisdictionCountry.toLowerCase() === 'international'
      ) {
        return true;
      }
      return false;
    }

    // Default: return international or general primary sources
    return true;
  });
}
