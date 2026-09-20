import { describe, expect, it, vi } from 'vitest';
import { runSingleFlight } from '@/lib/utils/single-flight';

describe('single-flight operations', () => {
  it('shares concurrent work and permits a later fresh operation', async () => {
    const operation = vi.fn(async () => 'result');
    const [first, second] = await Promise.all([
      runSingleFlight('same-operation', operation),
      runSingleFlight('same-operation', operation),
    ]);
    expect([first, second]).toEqual(['result', 'result']);
    expect(operation).toHaveBeenCalledTimes(1);

    await runSingleFlight('same-operation', operation);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
