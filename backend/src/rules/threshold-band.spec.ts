import { hysteresisError } from './threshold-band';

describe('hysteresisError', () => {
  it('accepts a less_than band with on below off', () => {
    expect(hysteresisError('less_than', 31.5, 58.25)).toBeNull();
  });

  it('accepts a greater_than band with on above off', () => {
    expect(hysteresisError('greater_than', 58.25, 31.5)).toBeNull();
  });

  it('rejects an inverted or equal band', () => {
    expect(hysteresisError('less_than', 58.25, 31.5)).toBe(
      'for less_than, on_threshold must be below off_threshold',
    );
    expect(hysteresisError('greater_than', 31.5, 58.25)).toBe(
      'for greater_than, on_threshold must be above off_threshold',
    );
    expect(hysteresisError('less_than', 40, 40)).toBe(
      'for less_than, on_threshold must be below off_threshold',
    );
  });
});
