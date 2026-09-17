import { describe, it, expect } from 'vitest';
import { getServerConfig } from '@/lib/config/env';

describe('Server Environment Configuration', () => {
  it('loads default configuration safely when environment variables are set', () => {
    const config = getServerConfig();
    expect(config).toBeDefined();
    expect(config.gemini).toBeDefined();
    expect(config.gemini.model).toBeTypeOf('string');
    expect(config.db.url).toBeTypeOf('string');
    expect(config.storage.dir).toBeTypeOf('string');
  });

  it('prevents execution on client side to avoid leaking secrets', () => {
    // Temporarily mock window object to simulate client execution
    const originalWindow = global.window;
    // @ts-expect-error Mocking window for security test
    global.window = {};

    expect(() => getServerConfig()).toThrowError(/FATAL: Attempted to access server environment variables/);

    // Restore
    global.window = originalWindow;
  });
});
