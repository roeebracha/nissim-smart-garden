import { resolveCorsOrigin } from './cors';

describe('resolveCorsOrigin', () => {
  it('returns the configured frontend origin', () => {
    expect(
      resolveCorsOrigin({ FRONTEND_ORIGIN: 'http://localhost:5173' }),
    ).toBe('http://localhost:5173');
  });

  it('returns undefined when FRONTEND_ORIGIN is missing or blank', () => {
    expect(resolveCorsOrigin({})).toBeUndefined();
    expect(resolveCorsOrigin({ FRONTEND_ORIGIN: '   ' })).toBeUndefined();
  });
});
