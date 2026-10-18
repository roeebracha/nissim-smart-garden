import { parseAskBody } from './ask-body';

describe('parseAskBody', () => {
  it('accepts a question without a planter', () => {
    expect(parseAskBody({ question: '  Why is it dry?  ' })).toEqual({
      ok: true,
      value: { question: 'Why is it dry?' },
    });
  });

  it('accepts a positive planterId', () => {
    expect(parseAskBody({ question: 'Status', planterId: 2 })).toEqual({
      ok: true,
      value: { question: 'Status', planterId: 2 },
    });
  });

  it.each([undefined, '', '   ', 1])(
    'rejects a missing question (%s)',
    (question) => {
      expect(parseAskBody({ question }).ok).toBe(false);
    },
  );

  it.each([0, -1, 1.5, '1', null])('rejects planterId %s', (planterId) => {
    expect(parseAskBody({ question: 'Status', planterId }).ok).toBe(false);
  });
});
