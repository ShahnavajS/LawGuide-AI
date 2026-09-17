/**
 * Controlled Legal Topic Taxonomy for LexiGuide AI (Phase 7).
 *
 * Defines canonical topics, search aliases, educational definitions,
 * standard counsel discussion points, and limitations for 29 core contractual concepts.
 */

export const LEGAL_TOPIC_CATEGORIES = {
  CONTRACT_LIFECYCLE: 'Contract Lifecycle',
  FINANCIAL: 'Financial & Payment Terms',
  RISK_AND_LIABILITY: 'Risk & Liability',
  IP_AND_DATA: 'Intellectual Property & Data',
  DISPUTE_RESOLUTION: 'Dispute Resolution & Governance',
  GENERAL_BOILERPLATE: 'General Provisions & Boilerplate',
} as const;

export type TopicCategory =
  (typeof LEGAL_TOPIC_CATEGORIES)[keyof typeof LEGAL_TOPIC_CATEGORIES];

export interface LegalTopicDefinition {
  id: string;
  label: string;
  category: TopicCategory;
  searchAliases: string[];
  shortExplanation: string;
  generalMeaning: string;
  whatItGenerallyDoes: string[];
  standardQuestionsForCounsel: string[];
  importantLimitations: string[];
}

export const LEGAL_TOPICS: Record<string, LegalTopicDefinition> = {
  TERMINATION: {
    id: 'TERMINATION',
    label: 'Termination',
    category: LEGAL_TOPIC_CATEGORIES.CONTRACT_LIFECYCLE,
    searchAliases: ['terminate', 'end contract', 'cancellation', 'exit clause', 'early termination'],
    shortExplanation: 'Defines how, when, and under what circumstances the agreement can be brought to an end.',
    generalMeaning:
      'A termination clause outlines the procedures and conditions under which either party can end their contractual relationship, including termination for convenience, termination for material breach, or termination upon insolvency.',
    whatItGenerallyDoes: [
      'Specifies whether advance written notice is required to end the agreement.',
      'Distinguishes between termination for cause (e.g. non-payment or breach) vs for convenience.',
      'Identifies cure periods during which a party may remedy a breach before termination takes effect.',
      'Governs post-termination obligations such as returning property, handling confidential information, and survival of liabilities.',
    ],
    standardQuestionsForCounsel: [
      'Under what circumstances can either party terminate this agreement without penalty?',
      'Is there a required cure period before termination for breach can occur?',
      'What specific obligations survive termination of the agreement?',
      'Are there potential financial damages or transition fees associated with early termination?',
    ],
    importantLimitations: [
      'LexiGuide cannot determine whether adequate grounds exist in your specific situation to terminate for cause.',
      'The enforceability of termination penalties or immediate forfeiture depends on local statutory and common law.',
    ],
  },

  NOTICE_PERIOD: {
    id: 'NOTICE_PERIOD',
    label: 'Notice Period',
    category: LEGAL_TOPIC_CATEGORIES.CONTRACT_LIFECYCLE,
    searchAliases: ['notice', 'advance notice', 'written notice', 'notice requirement', 'notice window'],
    shortExplanation: 'Specifies the amount of advance warning and delivery formal methods required before an action takes effect.',
    generalMeaning:
      'Notice provisions establish contractual timetables and delivery protocols (e.g., registered mail, courier, or certified email) that a party must satisfy when terminating, renewing, claiming breach, or invoking force majeure.',
    whatItGenerallyDoes: [
      'Sets mandatory time horizons (e.g., 30, 60, or 90 days) before termination or non-renewal takes effect.',
      'Defines acceptable delivery addresses and communication media.',
      'Establishes when notice is legally deemed received (e.g., upon dispatch vs upon delivery).',
    ],
    standardQuestionsForCounsel: [
      'What are the exact procedural requirements for delivering valid notice under this agreement?',
      'What consequences occur if notice is given late or via an unapproved communication channel?',
      'Does the notice window calculate calendar days or business/working days?',
    ],
    importantLimitations: [
      'LexiGuide cannot calculate whether your past communications legally satisfy formal contractual notice criteria.',
    ],
  },

  RENEWAL: {
    id: 'RENEWAL',
    label: 'Renewal & Extension',
    category: LEGAL_TOPIC_CATEGORIES.CONTRACT_LIFECYCLE,
    searchAliases: ['evergreen', 'auto-renewal', 'extension', 'contract term', 'automatic renewal'],
    shortExplanation: 'Determines whether and how an agreement continues after its initial duration expires.',
    generalMeaning:
      'Renewal provisions govern whether an agreement automatically rolls over for subsequent terms (evergreen clauses) or expires unless actively renegotiated and renewed in writing.',
    whatItGenerallyDoes: [
      'Establishes automatic renewal triggers and deadlines to opt out or cancel.',
      'Specifies the duration of successive renewal terms (e.g., month-to-month or multi-year).',
      'Defines whether pricing, fees, or service levels adjust upon renewal.',
    ],
    standardQuestionsForCounsel: [
      'Does this contract renew automatically, and what is the cutoff date to prevent renewal?',
      'Do commercial terms, such as fees or scope, change automatically upon extension?',
    ],
    importantLimitations: [
      'Consumer protection laws in certain jurisdictions restrict auto-renewal clauses; consult an attorney for enforceability.',
    ],
  },

  PAYMENT: {
    id: 'PAYMENT',
    label: 'Payment Terms',
    category: LEGAL_TOPIC_CATEGORIES.FINANCIAL,
    searchAliases: ['invoice', 'fee', 'compensation', 'billing', 'remittance', 'net 30', 'net 60'],
    shortExplanation: 'Sets out invoicing procedures, due dates, currency, and accepted methods of payment.',
    generalMeaning:
      'Payment clauses specify the financial consideration agreed between parties, establishing invoice issuance schedules, payment milestones, reimbursement protocols, and banking mechanics.',
    whatItGenerallyDoes: [
      'Determines payment credit terms (e.g., Net 15, Net 30, or upon receipt).',
      'Outlines invoice dispute protocols and withholding rights.',
      'Defines tax liabilities, withholdings, and statutory deductions.',
    ],
    standardQuestionsForCounsel: [
      'What happens if an invoice is disputed in good faith—can the undisputed portion be paid?',
      'Are taxes (such as GST or VAT) included in the stated fee or billed additionally?',
    ],
    importantLimitations: [
      'LexiGuide cannot provide tax advice or audit billing accuracy.',
    ],
  },

  INTEREST: {
    id: 'INTEREST',
    label: 'Late Payment Interest',
    category: LEGAL_TOPIC_CATEGORIES.FINANCIAL,
    searchAliases: ['late fee', 'finance charge', 'interest rate', 'overdue interest'],
    shortExplanation: 'Defines the financial penalty or interest rate assessed on overdue payments.',
    generalMeaning:
      'Late payment interest clauses compensate a creditor for the time value of money when payments are delayed past the contractual due date.',
    whatItGenerallyDoes: [
      'Specifies an annual or monthly percentage rate applied to outstanding balances.',
      'Caps interest charges at statutory maximums (usury limits).',
    ],
    standardQuestionsForCounsel: [
      'Is the late payment interest rate within statutory limits in the governing jurisdiction?',
      'When does interest begin to accrue on disputed invoices?',
    ],
    importantLimitations: [
      'Certain jurisdictions cap commercial interest rates or render excessive rates unenforceable penalties.',
    ],
  },

  PENALTIES: {
    id: 'PENALTIES',
    label: 'Penalties & Liquidated Damages',
    category: LEGAL_TOPIC_CATEGORIES.FINANCIAL,
    searchAliases: ['penalty', 'liquidated damages', 'predetermined damages', 'punitive damages'],
    shortExplanation: 'Specifies pre-agreed financial sums payable upon a specific breach or performance failure.',
    generalMeaning:
      'Liquidated damages provisions pre-estimate the financial compensation payable if a party breaches an obligation (e.g., delayed delivery or unauthorized disclosure).',
    whatItGenerallyDoes: [
      'Establishes predetermined compensation to avoid litigating actual financial loss.',
      'Provides exclusive or alternative remedies for specific operational defaults.',
    ],
    standardQuestionsForCounsel: [
      'Does the governing law treat this clause as enforceable liquidated damages or an unenforceable penalty?',
      'Is this amount the sole and exclusive financial remedy for the specified breach?',
    ],
    importantLimitations: [
      'Common law jurisdictions (including India, UK, and US) generally refuse to enforce punitive penalty clauses that do not reflect genuine pre-estimates of loss.',
    ],
  },

  INDEMNIFICATION: {
    id: 'INDEMNIFICATION',
    label: 'Indemnification',
    category: LEGAL_TOPIC_CATEGORIES.RISK_AND_LIABILITY,
    searchAliases: ['indemnity', 'hold harmless', 'defend and indemnify', 'third party claims'],
    shortExplanation: 'Allocates financial responsibility for third-party claims, lawsuits, or losses.',
    generalMeaning:
      'An indemnification clause obligates one party to protect, defend, or reimburse the other party against specified financial liabilities, damages, and legal defense costs resulting from breaches, negligence, or IP infringement.',
    whatItGenerallyDoes: [
      'Requires one party to defend the other against third-party lawsuits.',
      'Reimburses legal costs, settlement sums, and court judgments.',
      'Specifies whether indemnity is mutual or one-sided.',
      'Governs the control and conduct of legal defense and settlement negotiations.',
    ],
    standardQuestionsForCounsel: [
      'Is the indemnification obligation capped by the agreement’s limitation of liability?',
      'Does the clause require defense costs to be paid upfront or reimbursed after final judgment?',
      'Is the indemnity triggered by simple negligence, gross negligence, or strict breach of contract?',
    ],
    importantLimitations: [
      'Indemnification scope is highly fact-specific and subject to statutory public policy limitations.',
    ],
  },

  LIABILITY: {
    id: 'LIABILITY',
    label: 'Liability & Fault Allocation',
    category: LEGAL_TOPIC_CATEGORIES.RISK_AND_LIABILITY,
    searchAliases: ['damages', 'responsibility', 'fault', 'direct damages', 'consequential damages'],
    shortExplanation: 'Defines the scope of legal and financial responsibility for contract breaches or torts.',
    generalMeaning:
      'Liability provisions determine what categories of losses (e.g., direct, indirect, special, punitive, or loss of profits) a party can recover if a dispute arises.',
    whatItGenerallyDoes: [
      'Excludes speculative or consequential damages.',
      'Identifies whether liability is strict, fault-based, or capped.',
    ],
    standardQuestionsForCounsel: [
      'What categories of losses are excluded from recovery?',
      'Are there carve-outs where liability is unlimited (e.g., confidentiality, gross negligence, or IP)?',
    ],
    importantLimitations: [
      'Liability rules vary significantly across jurisdictions, especially regarding gross negligence and bodily harm.',
    ],
  },

  LIMITATION_OF_LIABILITY: {
    id: 'LIMITATION_OF_LIABILITY',
    label: 'Limitation of Liability',
    category: LEGAL_TOPIC_CATEGORIES.RISK_AND_LIABILITY,
    searchAliases: ['liability cap', 'aggregate liability', 'consequential damages exclusion', 'max damages'],
    shortExplanation: 'Sets a maximum ceiling on total financial damages payable under the contract.',
    generalMeaning:
      'A limitation of liability clause places an absolute monetary ceiling (e.g., fees paid in the past 12 months or a fixed dollar figure) on the damages one or both parties can recover.',
    whatItGenerallyDoes: [
      'Caps overall financial exposure at a defined multiple of fees or a fixed sum.',
      'Disclaims indirect, consequential, punitive, and lost revenue damages.',
      'Identifies specific exceptions (carve-outs) where the cap does not apply.',
    ],
    standardQuestionsForCounsel: [
      'Does the cap apply mutually to both parties or only to one side?',
      'Are indemnification claims subject to this liability cap, or are they uncapped?',
      'Is the cap reasonable in relation to the commercial risk and transaction value?',
    ],
    importantLimitations: [
      'Some jurisdictions invalidate limitations of liability that attempt to excuse willful misconduct or statutory obligations.',
    ],
  },

  CONFIDENTIALITY: {
    id: 'CONFIDENTIALITY',
    label: 'Confidentiality',
    category: LEGAL_TOPIC_CATEGORIES.IP_AND_DATA,
    searchAliases: ['confidential information', 'trade secrets', 'proprietary information', 'secrecy'],
    shortExplanation: 'Restricts the disclosure and unauthorized use of sensitive business information.',
    generalMeaning:
      'Confidentiality clauses define what business information is protected, impose non-disclosure duties, and specify standard exceptions (e.g., publicly known information or court orders).',
    whatItGenerallyDoes: [
      'Defines protected proprietary information, trade secrets, and technical data.',
      'Specifies permissible disclosure to employees, advisors, and affiliates on a need-to-know basis.',
      'Sets survival duration for confidentiality obligations (e.g., 2 years, 5 years, or indefinitely).',
    ],
    standardQuestionsForCounsel: [
      'How long do confidentiality obligations continue after the agreement ends?',
      'What procedure must be followed if compelled by court order or subpoena to disclose information?',
    ],
    importantLimitations: [
      'Trade secret protection laws may supersede contractual confidentiality terms in certain jurisdictions.',
    ],
  },

  NON_DISCLOSURE: {
    id: 'NON_DISCLOSURE',
    label: 'Non-Disclosure Undertakings',
    category: LEGAL_TOPIC_CATEGORIES.IP_AND_DATA,
    searchAliases: ['nda', 'non disclosure', 'gag clause', 'secrecy agreement'],
    shortExplanation: 'Prohibits sharing designated information with third parties without written authorization.',
    generalMeaning:
      'Non-disclosure covenants legally bind recipients of proprietary materials to maintain secrecy and prevent commercial exploitation by competitors or unauthorized third parties.',
    whatItGenerallyDoes: [
      'Establishes standards of care (e.g., reasonable care or the same care as own information).',
      'Restricts copying, reverse engineering, or redistributing materials.',
    ],
    standardQuestionsForCounsel: [
      'Does the agreement require written confirmation of destruction of confidential materials upon termination?',
    ],
    importantLimitations: [
      'Whistleblower protection and statutory reporting rights cannot be lawfully waived by non-disclosure clauses.',
    ],
  },

  INTELLECTUAL_PROPERTY: {
    id: 'INTELLECTUAL_PROPERTY',
    label: 'Intellectual Property Rights',
    category: LEGAL_TOPIC_CATEGORIES.IP_AND_DATA,
    searchAliases: ['ip', 'copyright', 'patent', 'trademark', 'ownership', 'work made for hire', 'ip assignment'],
    shortExplanation: 'Allocates ownership, licensing, and usage rights for inventions, software, and creative works.',
    generalMeaning:
      'Intellectual property provisions distinguish between pre-existing background IP, newly created foreground IP, work-for-hire creations, and licensing grants.',
    whatItGenerallyDoes: [
      'Specifies whether deliverables are transferred permanently (assigned) or licensed non-exclusively.',
      'Protects pre-existing proprietary technology and tools.',
      'Governs trademark usage, moral rights, and open-source software compliance.',
    ],
    standardQuestionsForCounsel: [
      'Does the client own the intellectual property upon creation or only upon full payment?',
      'Is the license perpetual, revocable, transferable, or sublicensable?',
      'Does the agreement include a formal written assignment of copyright and patent rights?',
    ],
    importantLimitations: [
      'Copyright assignment in many jurisdictions (such as Section 19 of the Indian Copyright Act) requires explicit written terms and statutory royalty compliance.',
    ],
  },

  DATA_PRIVACY: {
    id: 'DATA_PRIVACY',
    label: 'Data Privacy & Security',
    category: LEGAL_TOPIC_CATEGORIES.IP_AND_DATA,
    searchAliases: ['privacy', 'gdpr', 'personal data', 'dpdp', 'security breach', 'data protection'],
    shortExplanation: 'Governs the collection, processing, security, and transfer of personal data.',
    generalMeaning:
      'Data privacy clauses ensure compliance with data protection laws (e.g., DPDP Act in India, GDPR in EU, or CCPA in California), setting standards for data breaches, transfers, and user rights.',
    whatItGenerallyDoes: [
      'Specifies technical and organizational data security safeguards.',
      'Mandates prompt breach notification timeframes (e.g., 24 to 72 hours).',
      'Governs cross-border data transfers and processor vs controller roles.',
    ],
    standardQuestionsForCounsel: [
      'Does this contract comply with the applicable data protection statute (e.g., DPDP Act 2023)?',
      'Who bears the cost of investigating and notifying individuals in the event of a security breach?',
    ],
    importantLimitations: [
      'Statutory privacy laws apply regardless of contractual language and cannot be disclaimed.',
    ],
  },

  GOVERNING_LAW: {
    id: 'GOVERNING_LAW',
    label: 'Governing Law',
    category: LEGAL_TOPIC_CATEGORIES.DISPUTE_RESOLUTION,
    searchAliases: ['applicable law', 'choice of law', 'legal system', 'laws of'],
    shortExplanation: 'Identifies which country, state, or province’s laws will be used to interpret the contract.',
    generalMeaning:
      'A choice of law provision selects the substantive legal framework that governs contract interpretation, rights, obligations, and disputes.',
    whatItGenerallyDoes: [
      'Selects a specific state or national legal code to resolve ambiguities.',
      'Excludes conflict of laws principles that might point to another jurisdiction.',
    ],
    standardQuestionsForCounsel: [
      'Why was this specific jurisdiction’s law chosen, and does it provide adequate commercial predictability?',
      'Are there mandatory local consumer or employment laws that override this choice of law?',
    ],
    importantLimitations: [
      'Courts will not enforce a choice of law that violates fundamental domestic public policy.',
    ],
  },

  JURISDICTION: {
    id: 'JURISDICTION',
    label: 'Jurisdiction & Venue',
    category: LEGAL_TOPIC_CATEGORIES.DISPUTE_RESOLUTION,
    searchAliases: ['court', 'venue', 'forum', 'exclusive jurisdiction', 'submission to jurisdiction'],
    shortExplanation: 'Specifies which courts have the legal authority to hear lawsuits arising from the contract.',
    generalMeaning:
      'Jurisdiction and forum selection clauses dictate where lawsuits must be filed, distinguishing between exclusive jurisdiction (only that court) and non-exclusive jurisdiction.',
    whatItGenerallyDoes: [
      'Identifies the physical city or district courts that hear disputes.',
      'Prevents parties from initiating lawsuits in foreign or inconvenient forums.',
    ],
    standardQuestionsForCounsel: [
      'Is the jurisdiction clause exclusive or non-exclusive?',
      'Would litigating in the specified forum impose prohibitive travel or representation expenses?',
    ],
    importantLimitations: [
      'Parties cannot confer jurisdiction on a court that has no statutory subject-matter jurisdiction.',
    ],
  },

  DISPUTE_RESOLUTION: {
    id: 'DISPUTE_RESOLUTION',
    label: 'Dispute Resolution Procedure',
    category: LEGAL_TOPIC_CATEGORIES.DISPUTE_RESOLUTION,
    searchAliases: ['dispute', 'escalation', 'good faith negotiation', 'controversy'],
    shortExplanation: 'Establishes structured multi-step procedures (negotiation, mediation, arbitration) before court litigation.',
    generalMeaning:
      'Dispute resolution clauses define step-by-step escalation protocols to resolve disagreements amicably before formally filing a claim in arbitration or court.',
    whatItGenerallyDoes: [
      'Mandates good-faith executive escalation meetings within a specified period (e.g., 30 days).',
      'Requires pre-litigation mediation before formal adversarial proceedings.',
    ],
    standardQuestionsForCounsel: [
      'Is completing the dispute escalation process a mandatory prerequisite before filing for interim emergency relief?',
    ],
    importantLimitations: [
      'Urgent injunctive relief from courts is typically permitted even during multi-tier escalation.',
    ],
  },

  ARBITRATION: {
    id: 'ARBITRATION',
    label: 'Arbitration',
    category: LEGAL_TOPIC_CATEGORIES.DISPUTE_RESOLUTION,
    searchAliases: ['arbitrator', 'arbitral tribunal', 'arbitration agreement', 'institutional arbitration', 'seat of arbitration'],
    shortExplanation: 'Agrees to resolve disputes before a private arbitrator instead of a public courtroom judge.',
    generalMeaning:
      'An arbitration agreement waives the right to a public court trial, submitting disputes to binding determination by one or more private arbitrators under designated procedural rules.',
    whatItGenerallyDoes: [
      'Designates an arbitral institution (e.g., SIAC, ICC, MCIA, AAA) or ad-hoc rules.',
      'Specifies the legal seat (which governs procedural law) and physical venue.',
      'Determines the number of arbitrators (typically 1 or 3) and language of proceedings.',
      'States that arbitral awards are final, binding, and enforceable across borders.',
    ],
    standardQuestionsForCounsel: [
      'What is the designated seat of arbitration, and does that country’s law favor arbitration enforcement?',
      'Who pays for the arbitrator fees and institutional administrative charges upfront?',
      'Does the arbitration clause prevent class action lawsuits or public court hearings?',
    ],
    importantLimitations: [
      'Arbitration awards have very limited avenues of appeal compared to traditional court judgments.',
    ],
  },

  MEDIATION: {
    id: 'MEDIATION',
    label: 'Mediation & Conciliation',
    category: LEGAL_TOPIC_CATEGORIES.DISPUTE_RESOLUTION,
    searchAliases: ['conciliator', 'mediator', 'amicable settlement', 'non-binding mediation'],
    shortExplanation: 'Involves an independent neutral third party to facilitate voluntary settlement discussions.',
    generalMeaning:
      'Mediation is a confidential, non-adversarial dispute resolution process where an impartial mediator assists parties in reaching a consensual settlement without imposing a binding ruling.',
    whatItGenerallyDoes: [
      'Preserves business relationships through structured confidential dialogue.',
      'Requires parties to share mediator costs equally.',
    ],
    standardQuestionsForCounsel: [
      'If a settlement is reached in mediation, how is it formalized into an enforceable decree?',
    ],
    importantLimitations: [
      'Mediation cannot force an outcome; if either party refuses to settle, formal proceedings are required.',
    ],
  },

  FORCE_MAJEURE: {
    id: 'FORCE_MAJEURE',
    label: 'Force Majeure',
    category: LEGAL_TOPIC_CATEGORIES.RISK_AND_LIABILITY,
    searchAliases: ['act of god', 'unforeseeable circumstances', 'pandemic', 'war', 'natural disaster'],
    shortExplanation: 'Excuses performance delays or failures caused by extraordinary unforeseeable events beyond human control.',
    generalMeaning:
      'Force majeure provisions relieve a party from liability for failing to perform contractual obligations when prevented by catastrophic events such as floods, wars, epidemics, or government shutdowns.',
    whatItGenerallyDoes: [
      'Lists qualified qualifying events (natural disasters, war, strikes, government orders).',
      'Requires prompt written notice and mitigation efforts by the affected party.',
      'Allows termination if the force majeure event persists beyond a specified timeframe (e.g., 60 or 90 days).',
    ],
    standardQuestionsForCounsel: [
      'Does the clause excuse payment obligations or only operational service deliverables?',
      'What notice must be provided, and what mitigation efforts are legally required?',
    ],
    importantLimitations: [
      'Economic downturns, increased raw material costs, or financial hardship are rarely recognized as force majeure events.',
    ],
  },

  REPRESENTATIONS: {
    id: 'REPRESENTATIONS',
    label: 'Representations',
    category: LEGAL_TOPIC_CATEGORIES.GENERAL_BOILERPLATE,
    searchAliases: ['reps', 'statements of fact', 'corporate authority', 'good standing'],
    shortExplanation: 'Formal statements of current or past facts made to induce the other party to enter the contract.',
    generalMeaning:
      'Representations are formal assurances of fact (e.g., that a company is legally incorporated, solvent, and authorized to sign) upon which the other party relies.',
    whatItGenerallyDoes: [
      'Confirms corporate capacity, authority, and absence of conflicting agreements.',
      'Assures compliance with applicable laws and licensing requirements.',
    ],
    standardQuestionsForCounsel: [
      'What remedies exist if a representation turns out to have been inaccurate when made?',
    ],
    importantLimitations: [
      'Misrepresentations can trigger tort claims for fraud or negligent misrepresentation beyond standard contract remedies.',
    ],
  },

  WARRANTIES: {
    id: 'WARRANTIES',
    label: 'Warranties & Guarantees',
    category: LEGAL_TOPIC_CATEGORIES.GENERAL_BOILERPLATE,
    searchAliases: ['warranty', 'as is', 'fitness for purpose', 'merchantability', 'warranty disclaimer'],
    shortExplanation: 'Promises that goods, software, or services will meet designated standards of quality or performance.',
    generalMeaning:
      'Warranties are contractual promises regarding performance, quality, title, or non-infringement over a specified duration, often paired with explicit statutory disclaimers.',
    whatItGenerallyDoes: [
      'Provides repair, replacement, or re-performance remedies for defects.',
      'Disclaims implied statutory warranties (e.g., merchantability or fitness for a particular purpose).',
    ],
    standardQuestionsForCounsel: [
      'What is the warranty period, and what are the exclusive remedies if services fail to perform?',
      'Are statutory consumer warranties disclaimed lawfully under the governing jurisdiction?',
    ],
    importantLimitations: [
      'Implied warranties cannot be disclaimed against consumers in many jurisdictions.',
    ],
  },

  ASSIGNMENT: {
    id: 'ASSIGNMENT',
    label: 'Assignment & Transfer',
    category: LEGAL_TOPIC_CATEGORIES.GENERAL_BOILERPLATE,
    searchAliases: ['transfer', 'novation', 'subcontracting', 'change of control', 'delegation'],
    shortExplanation: 'Governs whether a party can transfer its contract rights or delegate obligations to a third party.',
    generalMeaning:
      'Assignment provisions control whether either party can assign its rights or delegate its performance duties to a third party, subsidiary, or acquirer.',
    whatItGenerallyDoes: [
      'Prohibits assignment without prior written consent, with or without reasonableness qualifiers.',
      'Permits assignment in connection with mergers, corporate reorganizations, or sale of assets.',
      'Governs subcontracting and affiliate performance.',
    ],
    standardQuestionsForCounsel: [
      'Can the other party assign this contract to a competitor or third party upon an acquisition?',
      'Does an assignment relieve the original signing party from ongoing liabilities?',
    ],
    importantLimitations: [
      'Contracts involving personal skill or confidential trust cannot typically be assigned without mutual consent.',
    ],
  },

  NON_COMPETE: {
    id: 'NON_COMPETE',
    label: 'Non-Compete Restrictions',
    category: LEGAL_TOPIC_CATEGORIES.RISK_AND_LIABILITY,
    searchAliases: ['restrictive covenant', 'restraint of trade', 'competition clause', 'post-employment'],
    shortExplanation: 'Restricts an individual or business from engaging in competing commercial activities.',
    generalMeaning:
      'Non-compete clauses restrict a party from working for, launching, or investing in competing businesses during or after the contractual term within a geographic area and duration.',
    whatItGenerallyDoes: [
      'Defines prohibited competing activities, products, or industry verticals.',
      'Specifies geographic reach and post-contract duration.',
    ],
    standardQuestionsForCounsel: [
      'Is this post-contractual non-compete restraint enforceable under the governing law?',
      'What geographical and temporal limits are legally recognized as reasonable in this jurisdiction?',
    ],
    importantLimitations: [
      'In India, Section 27 of the Indian Contract Act, 1872 renders post-employment non-compete covenants completely void as restraints of trade. In the US, FTC regulations and state laws (e.g. California) strictly limit non-competes.',
    ],
  },

  NON_SOLICITATION: {
    id: 'NON_SOLICITATION',
    label: 'Non-Solicitation',
    category: LEGAL_TOPIC_CATEGORIES.RISK_AND_LIABILITY,
    searchAliases: ['non solicitation', 'poaching', 'solicit employees', 'solicit clients'],
    shortExplanation: 'Prohibits poaching employees, contractors, clients, or suppliers from the other party.',
    generalMeaning:
      'Non-solicitation covenants prevent a party from entreating, hiring away, or diverting staff, vendors, or customers of the other contracting party for a designated duration.',
    whatItGenerallyDoes: [
      'Bars actively soliciting or hiring away skilled employees or consultants.',
      'Prohibits soliciting current customers or prospective clients.',
    ],
    standardQuestionsForCounsel: [
      'Does the non-solicitation restrict general job advertisements or only direct targeting?',
      'What duration and scope are considered reasonable under governing employment jurisprudence?',
    ],
    importantLimitations: [
      'Unreasonably broad non-solicitation clauses may be pruned or struck down as anti-competitive.',
    ],
  },

  SEVERABILITY: {
    id: 'SEVERABILITY',
    label: 'Severability',
    category: LEGAL_TOPIC_CATEGORIES.GENERAL_BOILERPLATE,
    searchAliases: ['saving clause', 'blue pencil', 'partial invalidity', 'invalid provision'],
    shortExplanation: 'Ensures that if one clause is found invalid or illegal, the remainder of the contract stays alive.',
    generalMeaning:
      'A severability clause protects the agreement from collapsing entirely if a single sentence or clause is held unlawful, authorizing courts to strike or modify the offending language.',
    whatItGenerallyDoes: [
      'Keeps the rest of the contract in full force and effect.',
      'Encourages courts to modify (blue-pencil) rather than void the provision.',
    ],
    standardQuestionsForCounsel: [
      'If a critical clause (such as payment or IP ownership) is invalidated, does the contract still survive?',
    ],
    importantLimitations: [
      'If the severed clause goes to the root or core consideration of the bargain, severability may not salvage the contract.',
    ],
  },

  ENTIRE_AGREEMENT: {
    id: 'ENTIRE_AGREEMENT',
    label: 'Entire Agreement & Integration',
    category: LEGAL_TOPIC_CATEGORIES.GENERAL_BOILERPLATE,
    searchAliases: ['merger clause', 'integration clause', 'prior discussions', 'parol evidence'],
    shortExplanation: 'Confirms that the written document supersedes all prior oral conversations, emails, and drafts.',
    generalMeaning:
      'An entire agreement (or integration) clause establishes that the written contract contains the final, complete understanding between the parties, extinguishing prior oral representations or sales pitches.',
    whatItGenerallyDoes: [
      'Excludes prior negotiations, emails, term sheets, or verbal assurances from being part of the binding agreement.',
      'Requires any future change to be in a signed written amendment.',
    ],
    standardQuestionsForCounsel: [
      'Are there verbal assurances, email agreements, or proposal promises that need to be explicitly attached as exhibits?',
    ],
    importantLimitations: [
      'Entire agreement clauses do not preclude claims based on fraudulent misrepresentation or statutory warranties in many jurisdictions.',
    ],
  },

  AMENDMENT: {
    id: 'AMENDMENT',
    label: 'Amendment & Modification',
    category: LEGAL_TOPIC_CATEGORIES.GENERAL_BOILERPLATE,
    searchAliases: ['variation', 'modification', 'change order', 'written amendment'],
    shortExplanation: 'Requires any changes or additions to the agreement to be made in a formal written document signed by both sides.',
    generalMeaning:
      'Amendment provisions prevent informal contract alterations, mandating that modifications must be documented in writing and executed by authorized corporate signatories.',
    whatItGenerallyDoes: [
      'Bars informal modifications through email threads, course of performance, or oral agreements.',
    ],
    standardQuestionsForCounsel: [
      'Do electronic signatures or email exchanges constitute valid written amendments under this clause?',
    ],
    importantLimitations: [
      'Courts occasionally recognize oral modifications or waiver through long-standing conduct despite written amendment clauses.',
    ],
  },

  WAIVER: {
    id: 'WAIVER',
    label: 'Waiver & Non-Waiver',
    category: LEGAL_TOPIC_CATEGORIES.GENERAL_BOILERPLATE,
    searchAliases: ['non waiver', 'forbearance', 'failure to enforce', 'delay in enforcement'],
    shortExplanation: 'Provides that failing or delaying to enforce a right does not mean that right has been surrendered.',
    generalMeaning:
      'A non-waiver clause ensures that if a party tolerates a late payment or minor breach once, it does not lose the right to strictly enforce the contract terms in the future.',
    whatItGenerallyDoes: [
      'Specifies that any waiver must be explicit and in writing to be binding.',
      'Prevents course of dealing or indulgence from altering legal rights.',
    ],
    standardQuestionsForCounsel: [
      'Does past tolerance of delayed deadlines forfeit the right to terminate for subsequent delays?',
    ],
    importantLimitations: [
      'Prolonged acquiescence or intentional surrender of rights can still trigger estoppel or statutory waiver doctrines.',
    ],
  },

  DEFINITIONS: {
    id: 'DEFINITIONS',
    label: 'Definitions & Interpretation',
    category: LEGAL_TOPIC_CATEGORIES.GENERAL_BOILERPLATE,
    searchAliases: ['defined terms', 'interpretation', 'capitalized terms', 'construction'],
    shortExplanation: 'Establishes precise contractual meanings for capitalized words and interpretive conventions.',
    generalMeaning:
      'A definitions section assigns tailored legal meanings to specialized commercial terms, avoiding ambiguity across complex agreements.',
    whatItGenerallyDoes: [
      'Standardizes key terms (e.g., "Affiliate", "Confidential Information", "Gross Negligence").',
      'Defines grammatical conventions (e.g., singular includes plural, references to statutes include amendments).',
    ],
    standardQuestionsForCounsel: [
      'Do any defined terms have counter-intuitive or unexpectedly broad meanings compared to standard commercial practice?',
    ],
    importantLimitations: [
      'A definition applies only as used within that specific agreement unless defined by statutory mandate.',
    ],
  },
};

/**
 * Searches or normalizes an input string into a known taxonomy topic.
 */
export function resolveTaxonomyTopic(query: string): LegalTopicDefinition | null {
  if (!query || !query.trim()) return null;
  const clean = query.trim().toUpperCase().replace(/[-\s]+/g, '_');

  // Direct ID match
  if (LEGAL_TOPICS[clean]) {
    return LEGAL_TOPICS[clean];
  }

  // Search by alias or label
  const lower = query.trim().toLowerCase();
  for (const topic of Object.values(LEGAL_TOPICS)) {
    if (topic.label.toLowerCase() === lower) return topic;
    if (topic.searchAliases.some((alias) => alias.toLowerCase() === lower || lower.includes(alias.toLowerCase()))) {
      return topic;
    }
  }

  // Substring matching on label or ID
  for (const topic of Object.values(LEGAL_TOPICS)) {
    if (topic.label.toLowerCase().includes(lower) || topic.id.toLowerCase().includes(lower)) {
      return topic;
    }
  }

  return null;
}

/**
 * Searches topics for autocomplete or topic browsing.
 */
export function searchTaxonomyTopics(searchTerm: string): LegalTopicDefinition[] {
  if (!searchTerm || !searchTerm.trim()) {
    return Object.values(LEGAL_TOPICS);
  }

  const query = searchTerm.trim().toLowerCase();
  return Object.values(LEGAL_TOPICS).filter((topic) => {
    return (
      topic.label.toLowerCase().includes(query) ||
      topic.id.toLowerCase().includes(query) ||
      topic.category.toLowerCase().includes(query) ||
      topic.searchAliases.some((alias) => alias.toLowerCase().includes(query)) ||
      topic.shortExplanation.toLowerCase().includes(query)
    );
  });
}
