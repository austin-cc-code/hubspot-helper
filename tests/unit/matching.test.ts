/**
 * Tests for string matching utilities
 */

import {
  levenshteinDistance,
  normalizedLevenshtein,
  similarityScore,
  normalizeName,
  normalizePhone,
  extractEmailDomain,
  isLikelyNickname,
  isSameCompany,
} from '../../src/utils/matching.js';

describe('Levenshtein Distance', () => {
  test('identical strings have distance 0', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
    expect(levenshteinDistance('', '')).toBe(0);
    expect(levenshteinDistance('a', 'a')).toBe(0);
  });

  test('completely different strings', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
    expect(levenshteinDistance('hello', 'world')).toBe(4);
  });

  test('single character difference', () => {
    expect(levenshteinDistance('hello', 'hallo')).toBe(1);
    expect(levenshteinDistance('kitten', 'sitten')).toBe(1);
  });

  test('insertion/deletion', () => {
    expect(levenshteinDistance('hello', 'helo')).toBe(1);
    expect(levenshteinDistance('test', 'tests')).toBe(1);
  });

  test('multiple changes', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
  });

  test('empty strings', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
    expect(levenshteinDistance('hello', '')).toBe(5);
  });

  test('case sensitive', () => {
    expect(levenshteinDistance('Hello', 'hello')).toBe(1);
    expect(levenshteinDistance('HELLO', 'hello')).toBe(5);
  });
});

describe('Normalized Levenshtein', () => {
  test('identical strings return 0.0', () => {
    expect(normalizedLevenshtein('hello', 'hello')).toBe(0.0);
    expect(normalizedLevenshtein('', '')).toBe(0.0);
  });

  test('completely different strings', () => {
    expect(normalizedLevenshtein('abc', 'xyz')).toBe(1.0);
  });

  test('partially similar strings', () => {
    expect(normalizedLevenshtein('hello', 'hallo')).toBeCloseTo(0.2, 1);
  });

  test('different lengths', () => {
    const result = normalizedLevenshtein('hi', 'hello');
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});

describe('Similarity Score', () => {
  test('identical strings return 1.0', () => {
    expect(similarityScore('hello', 'hello')).toBe(1.0);
    expect(similarityScore('test', 'test')).toBe(1.0);
  });

  test('completely different strings return 0.0', () => {
    expect(similarityScore('abc', 'xyz')).toBe(0.0);
  });

  test('partially similar strings', () => {
    const score = similarityScore('hello', 'hallo');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
    expect(score).toBeCloseTo(0.8, 1);
  });

  test('very similar strings have high score', () => {
    expect(similarityScore('John Smith', 'Jon Smith')).toBeGreaterThanOrEqual(0.9);
    expect(similarityScore('Michael', 'Michele')).toBeGreaterThan(0.7);
  });
});

describe('Normalize Name', () => {
  test('converts to lowercase', () => {
    expect(normalizeName('JOHN SMITH')).toBe('john smith');
    expect(normalizeName('Mary Jane')).toBe('mary jane');
  });

  test('trims whitespace', () => {
    expect(normalizeName('  John Smith  ')).toBe('john smith');
    expect(normalizeName('\tJohn\n')).toBe('john');
  });

  test('collapses multiple spaces', () => {
    expect(normalizeName('John    Smith')).toBe('john smith');
    expect(normalizeName('John  \t  Smith')).toBe('john smith');
  });

  test('preserves hyphens and apostrophes', () => {
    expect(normalizeName('Mary-Jane')).toBe('mary-jane');
    expect(normalizeName("O'Connor")).toBe("o'connor");
    expect(normalizeName('Jean-Claude')).toBe('jean-claude');
  });

  test('removes special characters', () => {
    expect(normalizeName('John@Smith#123')).toBe('johnsmith123');
    expect(normalizeName('Mary (Jones)')).toBe('mary jones');
  });

  test('handles null and undefined', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });

  test('handles empty string', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName('   ')).toBe('');
  });
});

describe('Normalize Phone', () => {
  test('removes formatting characters', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('5551234567');
    expect(normalizePhone('555.123.4567')).toBe('5551234567');
    expect(normalizePhone('555 123 4567')).toBe('5551234567');
  });

  test('removes US country code prefix', () => {
    expect(normalizePhone('+1-555-123-4567', 'US')).toBe('5551234567');
    expect(normalizePhone('1-555-123-4567', 'US')).toBe('5551234567');
    expect(normalizePhone('15551234567', 'US')).toBe('5551234567');
  });

  test('handles international formats', () => {
    expect(normalizePhone('+44 20 1234 5678', 'UK')).toBe('442012345678');
    expect(normalizePhone('+33 1 23 45 67 89', 'FR')).toBe('33123456789');
  });

  test('handles various separators', () => {
    expect(normalizePhone('555-123-4567')).toBe('5551234567');
    expect(normalizePhone('555/123/4567')).toBe('5551234567');
    expect(normalizePhone('555·123·4567')).toBe('5551234567');
  });

  test('handles null and undefined', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });

  test('handles empty string', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone('   ')).toBe('');
  });

  test('handles already normalized phones', () => {
    expect(normalizePhone('5551234567')).toBe('5551234567');
  });
});

describe('Extract Email Domain', () => {
  test('extracts domain from email', () => {
    expect(extractEmailDomain('john@example.com')).toBe('example.com');
    expect(extractEmailDomain('mary@company.org')).toBe('company.org');
  });

  test('converts to lowercase', () => {
    expect(extractEmailDomain('JOHN@EXAMPLE.COM')).toBe('example.com');
    expect(extractEmailDomain('Mary@Company.COM')).toBe('company.com');
  });

  test('handles subdomains', () => {
    expect(extractEmailDomain('user@mail.example.com')).toBe('mail.example.com');
    expect(extractEmailDomain('test@support.company.co.uk')).toBe('support.company.co.uk');
  });

  test('handles invalid emails', () => {
    expect(extractEmailDomain('notanemail')).toBe('');
    expect(extractEmailDomain('no@at@sign')).toBe('');
    expect(extractEmailDomain('@example.com')).toBe('');
    expect(extractEmailDomain('user@')).toBe('');
  });

  test('handles null and undefined', () => {
    expect(extractEmailDomain(null)).toBe('');
    expect(extractEmailDomain(undefined)).toBe('');
  });

  test('handles empty string', () => {
    expect(extractEmailDomain('')).toBe('');
  });
});

describe('Is Likely Nickname', () => {
  test('detects common nicknames - male names', () => {
    expect(isLikelyNickname('Bob', 'Robert')).toBe(true);
    expect(isLikelyNickname('Robert', 'Bob')).toBe(true);
    expect(isLikelyNickname('Mike', 'Michael')).toBe(true);
    expect(isLikelyNickname('Michael', 'Mike')).toBe(true);
    expect(isLikelyNickname('Bill', 'William')).toBe(true);
    expect(isLikelyNickname('Rick', 'Richard')).toBe(true);
    expect(isLikelyNickname('Jim', 'James')).toBe(true);
    expect(isLikelyNickname('Jack', 'John')).toBe(true);
    expect(isLikelyNickname('Joe', 'Joseph')).toBe(true);
    expect(isLikelyNickname('Tom', 'Thomas')).toBe(true);
    expect(isLikelyNickname('Chuck', 'Charles')).toBe(true);
    expect(isLikelyNickname('Chris', 'Christopher')).toBe(true);
    expect(isLikelyNickname('Dan', 'Daniel')).toBe(true);
    expect(isLikelyNickname('Matt', 'Matthew')).toBe(true);
    expect(isLikelyNickname('Tony', 'Anthony')).toBe(true);
  });

  test('detects common nicknames - female names', () => {
    expect(isLikelyNickname('Liz', 'Elizabeth')).toBe(true);
    expect(isLikelyNickname('Beth', 'Elizabeth')).toBe(true);
    expect(isLikelyNickname('Maggie', 'Margaret')).toBe(true);
    expect(isLikelyNickname('Kate', 'Catherine')).toBe(true);
    expect(isLikelyNickname('Jen', 'Jennifer')).toBe(true);
    expect(isLikelyNickname('Kim', 'Kimberly')).toBe(true);
    expect(isLikelyNickname('Sue', 'Susan')).toBe(true);
    expect(isLikelyNickname('Pat', 'Patricia')).toBe(true);
    expect(isLikelyNickname('Barb', 'Barbara')).toBe(true);
  });

  test('case insensitive', () => {
    expect(isLikelyNickname('BOB', 'robert')).toBe(true);
    expect(isLikelyNickname('bob', 'ROBERT')).toBe(true);
  });

  test('handles whitespace', () => {
    expect(isLikelyNickname('  Bob  ', '  Robert  ')).toBe(true);
  });

  test('returns false for non-nicknames', () => {
    expect(isLikelyNickname('John', 'Jane')).toBe(false);
    expect(isLikelyNickname('Mike', 'Michelle')).toBe(false);
    expect(isLikelyNickname('Bob', 'Bobby')).toBe(false); // Both are nicknames of Robert
  });

  test('returns false for same name', () => {
    expect(isLikelyNickname('John', 'John')).toBe(false);
    expect(isLikelyNickname('Mike', 'Mike')).toBe(false);
  });

  test('handles null and undefined', () => {
    expect(isLikelyNickname(null, 'Robert')).toBe(false);
    expect(isLikelyNickname('Bob', null)).toBe(false);
    expect(isLikelyNickname(undefined, undefined)).toBe(false);
  });
});

describe('Is Same Company', () => {
  test('detects exact matches', () => {
    expect(isSameCompany('Acme Corporation', 'Acme Corporation')).toBe(true);
    expect(isSameCompany('Tech Co', 'Tech Co')).toBe(true);
  });

  test('handles case differences', () => {
    expect(isSameCompany('ACME CORP', 'acme corp')).toBe(true);
    expect(isSameCompany('Tech Company', 'TECH COMPANY')).toBe(true);
  });

  test('ignores common suffixes', () => {
    expect(isSameCompany('Acme Inc.', 'Acme Corporation')).toBe(true);
    expect(isSameCompany('Tech Co LLC', 'Tech Co')).toBe(true);
    expect(isSameCompany('Example Ltd', 'Example Limited')).toBe(true);
    expect(isSameCompany('Company Corp.', 'Company Inc.')).toBe(true);
  });

  test('handles abbreviations', () => {
    expect(isSameCompany('International Business Machines', 'IBM')).toBe(false); // Too different
    expect(isSameCompany('Acme Co', 'Acme Company')).toBe(true);
  });

  test('allows minor typos', () => {
    expect(isSameCompany('Acme Industries', 'Acme Industires')).toBe(true); // 90%+ similar
    expect(isSameCompany('Tech Solutions', 'Tech Solution')).toBe(true);
  });

  test('rejects significantly different companies', () => {
    expect(isSameCompany('Acme Corp', 'Beta Corp')).toBe(false);
    expect(isSameCompany('Tech Company', 'Software Company')).toBe(false);
  });

  test('handles whitespace differences', () => {
    expect(isSameCompany('  Acme  Corp  ', 'Acme Corp')).toBe(true);
    expect(isSameCompany('Tech\t\tCo', 'Tech Co')).toBe(true);
  });

  test('handles null and undefined', () => {
    expect(isSameCompany(null, 'Acme Corp')).toBe(false);
    expect(isSameCompany('Acme Corp', null)).toBe(false);
    expect(isSameCompany(undefined, undefined)).toBe(false);
  });

  test('handles empty strings', () => {
    expect(isSameCompany('', 'Acme Corp')).toBe(false);
    expect(isSameCompany('Acme Corp', '')).toBe(false);
  });
});
