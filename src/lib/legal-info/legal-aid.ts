/**
 * Legal-Aid Navigator Registry for LexiGuide AI (Phase 7).
 *
 * Provides authoritative public legal aid resources, statutory bodies,
 * and contact points without inventing eligibility rules, phone numbers, or offices.
 */

export interface LegalAidResource {
  id: string;
  name: string;
  shortName: string;
  jurisdictionCountry: string;
  jurisdictionRegion?: string;
  description: string;
  statutoryBasis: string;
  officialWebsite: string;
  helpline?: string;
  keyServices: string[];
  eligibilityNotes: string;
  disclaimer: string;
}

export const LEGAL_AID_RESOURCES: LegalAidResource[] = [
  // --- INDIA ---
  {
    id: 'NALSA_INDIA',
    name: 'National Legal Services Authority (NALSA)',
    shortName: 'NALSA India',
    jurisdictionCountry: 'India',
    description:
      'Apex statutory body established under the Legal Services Authorities Act, 1987, to provide free and competent legal services to eligible citizens and organize Lok Adalats.',
    statutoryBasis: 'Legal Services Authorities Act, 1987 (Act No. 39 of 1987)',
    officialWebsite: 'https://nalsa.gov.in',
    helpline: '15100',
    keyServices: [
      'Free legal aid and representation by panel advocates in civil, criminal, and revenue matters',
      'Pre-litigation conciliation and Lok Adalats',
      'Legal literacy and awareness camps',
      'Victim compensation assistance',
    ],
    eligibilityNotes:
      'Section 12 of the Act covers women, children, members of SC/ST, industrial workmen, persons with disabilities, persons in custody, and individuals with annual incomes below statutory state limits.',
    disclaimer:
      'LawGuide helps you organize document facts and formulate questions. Only the competent Legal Services Authority can determine formal eligibility for free legal representation.',
  },
  {
    id: 'TELE_LAW_INDIA',
    name: 'Department of Justice — Tele-Law Scheme',
    shortName: 'Tele-Law',
    jurisdictionCountry: 'India',
    description:
      'An initiative by the Department of Justice and Ministry of Law and Justice, connecting citizens with panel lawyers via video conferencing at Common Service Centres (CSCs).',
    statutoryBasis: 'Ministry of Law and Justice Government Scheme',
    officialWebsite: 'https://tele-law.in',
    helpline: '14488',
    keyServices: [
      'Pre-litigation legal advice from panel lawyers',
      'Accessible across Gram Panchayats and rural centers',
      'Free advice for citizens entitled under Section 12 of the Legal Services Authorities Act',
    ],
    eligibilityNotes:
      'Available across India; consultations are free for Section 12 beneficiaries and available at nominal fee for others.',
    disclaimer:
      'Consultations via Tele-Law are provided directly by Department of Justice panel advocates.',
  },

  // --- UNITED STATES ---
  {
    id: 'LSC_US',
    name: 'Legal Services Corporation (LSC)',
    shortName: 'LSC United States',
    jurisdictionCountry: 'United States',
    description:
      'An independent non-profit established by Congress to provide financial support for civil legal aid to low-income Americans.',
    statutoryBasis: 'Legal Services Corporation Act of 1974 (42 U.S.C. 2996 et seq.)',
    officialWebsite: 'https://www.lsc.gov',
    keyServices: [
      'Grants to 130+ independent civil legal aid organizations nationwide',
      'Assistance with housing, family law, domestic violence, consumer disputes, and employment matters',
    ],
    eligibilityNotes:
      'Primarily available to households with incomes at or below 125% of the federal poverty guidelines.',
    disclaimer:
      'Eligibility determinations are handled directly by regional LSC-funded legal aid offices.',
  },
  {
    id: 'LAWHELP_ORG',
    name: 'LawHelp.org — National Legal Aid Network',
    shortName: 'LawHelp',
    jurisdictionCountry: 'United States',
    description:
      'A non-profit legal information portal helping individuals find free legal aid programs, self-help forms, and court resources by state.',
    statutoryBasis: 'Pro Bono Net Public Interest Initiative',
    officialWebsite: 'https://www.lawhelp.org',
    keyServices: [
      'State-by-state directory of free legal services programs',
      'Plain-language self-help legal education',
    ],
    eligibilityNotes:
      'Directory connects users to local legal aid organizations with varying income and categorical criteria.',
    disclaimer:
      'LawHelp.org is an informational directory, not an attorney-client matching service.',
  },

  // --- UNITED KINGDOM ---
  {
    id: 'UK_LEGAL_AID',
    name: 'UK Civil Legal Advice (CLA)',
    shortName: 'Civil Legal Advice UK',
    jurisdictionCountry: 'United Kingdom',
    description:
      'Government service offering free and confidential legal advice in England and Wales for eligible individuals.',
    statutoryBasis: 'Legal Aid, Sentencing and Punishment of Offenders Act 2012 (LASPO)',
    officialWebsite: 'https://www.gov.uk/check-legal-aid',
    keyServices: [
      'Advice for debt, housing, domestic abuse, special education needs, and discrimination',
    ],
    eligibilityNotes:
      'Subject to statutory means-testing (income/capital) and merits-testing under LASPO.',
    disclaimer:
      'Check official gov.uk eligibility criteria before applying for legal aid.',
  },
];

/**
 * Returns legal aid bodies relevant to a country or state.
 */
export function getLegalAidResources(country?: string | null): LegalAidResource[] {
  const norm = (country || '').trim().toLowerCase();
  if (!norm) {
    return LEGAL_AID_RESOURCES;
  }

  const filtered = LEGAL_AID_RESOURCES.filter(
    (r) => r.jurisdictionCountry.toLowerCase() === norm
  );

  return filtered.length > 0 ? filtered : LEGAL_AID_RESOURCES;
}
