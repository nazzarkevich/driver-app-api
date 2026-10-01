import { isValidUkPostcode, normalizeUkPostcode } from './uk-postcode';

describe('UK postcode utilities', () => {
  it.each([
    ['gu113aa', 'GU11 3AA'],
    ['GU11 3AA', 'GU11 3AA'],
    [' gu11   3aa', 'GU11 3AA'],
    ['sw1a2aa', 'SW1A 2AA'],
    ['SW1A 2AA', 'SW1A 2AA'],
  ])('normalizes %p', (input, expected) => {
    expect(normalizeUkPostcode(input)).toBe(expected);
    expect(isValidUkPostcode(input)).toBe(true);
  });

  it.each(['', '   ', 'invalid', 'SW1A 2A', 'GU11 3AAA']) (
    'rejects %p',
    (input) => expect(isValidUkPostcode(input)).toBe(false),
  );
});
