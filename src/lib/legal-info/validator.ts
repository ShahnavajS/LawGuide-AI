/**
 * URL and Source Security Validator for LexiGuide AI (Phase 7).
 *
 * Enforces strict validation on external legal-information sources:
 * - Requires HTTPS protocol
 * - Enforces trusted domain allowlist
 * - Blocks javascript:, data:, file:, internal IP ranges, and localhost
 * - Rejects malformed or suspicious URL parameters
 */

export const TRUSTED_LEGAL_DOMAINS = [
  'indiacode.nic.in',
  'main.sci.gov.in',
  'sci.gov.in',
  'nalsa.gov.in',
  'mca.gov.in',
  'tele-law.in',
  'ecourts.gov.in',
  'law.cornell.edu',
  'legislation.gov.uk',
  'wipo.int',
  'uncitral.un.org',
  'lsc.gov',
  'lawhelp.org',
  'gov.uk',
];

export interface UrlValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  rejectionReason?: string;
}

/**
 * Validates whether an external URL is safe, authoritative, and conforms to security standards.
 */
export function validateExternalSourceUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, rejectionReason: 'URL is empty or non-string' };
  }

  const trimmed = rawUrl.trim();

  // 1. Block dangerous pseudo-protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('ftp:')
  ) {
    return {
      isValid: false,
      rejectionReason: 'Blocked insecure or executable URI scheme.',
    };
  }

  // 2. Parse URL
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, rejectionReason: 'Malformed URL syntax.' };
  }

  // 3. Must use HTTPS
  if (parsed.protocol !== 'https:') {
    return {
      isValid: false,
      rejectionReason: 'Source URL must use the secure HTTPS protocol.',
    };
  }

  // 4. Block local and private network addresses
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  ) {
    return {
      isValid: false,
      rejectionReason: 'Localhost and private IP addresses are prohibited.',
    };
  }

  // 5. Hostname allowlist matching
  const isAllowedDomain = TRUSTED_LEGAL_DOMAINS.some(
    (allowed) => host === allowed || host.endsWith('.' + allowed)
  );

  if (!isAllowedDomain) {
    return {
      isValid: false,
      rejectionReason: `Hostname '${host}' is not in the trusted legal information registry allowlist.`,
    };
  }

  return {
    isValid: true,
    sanitizedUrl: parsed.origin + parsed.pathname + parsed.search,
  };
}
