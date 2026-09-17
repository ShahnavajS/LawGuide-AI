/**
 * Unit Tests for Source Registry and URL Security Validator (LexiGuide AI Phase 7).
 */

import { describe, it, expect } from 'vitest';
import { validateExternalSourceUrl } from '@/lib/legal-info/validator';
import { getAuthoritativeSources, AUTHORITATIVE_SOURCES } from '@/lib/legal-info/sources';
import { SOURCE_TRUST_LEVELS } from '@/lib/ai/safety';

describe('Phase 7: Source Registry and URL Security Validator', () => {
  describe('validateExternalSourceUrl', () => {
    it('approves trusted HTTPS domains on allowlist', () => {
      const validUrls = [
        'https://www.indiacode.nic.in/handle/123456789/2187',
        'https://main.sci.gov.in/judgments',
        'https://nalsa.gov.in/acts-rules',
        'https://www.law.cornell.edu/ucc/2/2-106',
        'https://www.legislation.gov.uk/ukpga/1996/23/contents',
        'https://www.wipo.int/wipolex/en/',
        'https://uncitral.un.org/en/texts/arbitration',
      ];

      for (const url of validUrls) {
        const res = validateExternalSourceUrl(url);
        expect(res.isValid).toBe(true);
        expect(res.sanitizedUrl).toBeDefined();
        expect(res.sanitizedUrl).toMatch(/^https:\/\//);
      }
    });

    it('rejects insecure HTTP URLs', () => {
      const res = validateExternalSourceUrl('http://www.indiacode.nic.in/handle/123');
      expect(res.isValid).toBe(false);
      expect(res.rejectionReason).toContain('HTTPS');
    });

    it('rejects executable or pseudo-protocol URIs (javascript, data, file)', () => {
      expect(validateExternalSourceUrl('javascript:alert(1)').isValid).toBe(false);
      expect(validateExternalSourceUrl('data:text/html,<script>alert(1)</script>').isValid).toBe(false);
      expect(validateExternalSourceUrl('file:///etc/passwd').isValid).toBe(false);
      expect(validateExternalSourceUrl('blob:https://example.com/uuid').isValid).toBe(false);
    });

    it('rejects localhost and private IP addresses', () => {
      expect(validateExternalSourceUrl('https://localhost:3000').isValid).toBe(false);
      expect(validateExternalSourceUrl('https://127.0.0.1/admin').isValid).toBe(false);
      expect(validateExternalSourceUrl('https://192.168.1.1/router').isValid).toBe(false);
      expect(validateExternalSourceUrl('https://10.0.0.1/secret').isValid).toBe(false);
    });

    it('rejects domains not in the trusted legal allowlist', () => {
      const untrusted = [
        'https://random-law-blog.com/tips',
        'https://evil-phishing-site.xyz/login',
        'https://unverified-source.org/statutes',
      ];

      for (const url of untrusted) {
        const res = validateExternalSourceUrl(url);
        expect(res.isValid).toBe(false);
        expect(res.rejectionReason).toContain('allowlist');
      }
    });

    it('handles malformed URL inputs gracefully without throwing', () => {
      expect(validateExternalSourceUrl('').isValid).toBe(false);
      expect(validateExternalSourceUrl('not a url at all').isValid).toBe(false);
      expect(validateExternalSourceUrl('https://').isValid).toBe(false);
    });
  });

  describe('getAuthoritativeSources Registry', () => {
    it('returns primary sources for India for relevant topics', () => {
      const sources = getAuthoritativeSources('INDEMNIFICATION', 'India');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some((s) => s.id === 'INDIA_CODE')).toBe(true);
      expect(sources.some((s) => s.authorityLevel === SOURCE_TRUST_LEVELS.PRIMARY)).toBe(true);
    });

    it('returns Cornell LII as secondary source for general contract topics', () => {
      const sources = getAuthoritativeSources('TERMINATION', 'United States');
      expect(sources.some((s) => s.id === 'CORNELL_LII')).toBe(true);
      const cornell = sources.find((s) => s.id === 'CORNELL_LII');
      expect(cornell?.authorityLevel).toBe(SOURCE_TRUST_LEVELS.SECONDARY);
    });

    it('all registered sources have valid URLs on trusted domains', () => {
      for (const src of AUTHORITATIVE_SOURCES) {
        const val = validateExternalSourceUrl(src.canonicalUrl);
        expect(val.isValid, `Source ${src.id} has invalid URL ${src.canonicalUrl}`).toBe(true);
      }
    });
  });
});
