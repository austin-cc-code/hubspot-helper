/**
 * String matching utilities for duplicate detection
 *
 * Provides functions for:
 * - Levenshtein distance calculation
 * - String normalization (names, phones, emails)
 * - Similarity scoring
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * needed to change one string into the other.
 *
 * @param str1 First string
 * @param str2 Second string
 * @returns Levenshtein distance (0 = identical)
 *
 * @example
 * levenshteinDistance('kitten', 'sitting') // 3
 * levenshteinDistance('hello', 'hello') // 0
 */
export function levenshteinDistance(str1: string, str2: string): number {
  // Handle empty strings
  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;

  // Create matrix
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate normalized Levenshtein distance (0.0 - 1.0)
 * 0.0 = identical strings, 1.0 = completely different
 *
 * @param str1 First string
 * @param str2 Second string
 * @returns Normalized distance (0.0 - 1.0)
 *
 * @example
 * normalizedLevenshtein('hello', 'hello') // 0.0
 * normalizedLevenshtein('hello', 'hallo') // 0.2
 */
export function normalizedLevenshtein(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) return 0.0;

  return distance / maxLength;
}

/**
 * Calculate similarity score (0.0 - 1.0)
 * 1.0 = identical strings, 0.0 = completely different
 *
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score (0.0 - 1.0)
 *
 * @example
 * similarityScore('hello', 'hello') // 1.0
 * similarityScore('hello', 'hallo') // 0.8
 */
export function similarityScore(str1: string, str2: string): number {
  return 1.0 - normalizedLevenshtein(str1, str2);
}

/**
 * Normalize a name for comparison
 * - Convert to lowercase
 * - Trim whitespace
 * - Collapse multiple spaces into single space
 * - Remove special characters (except hyphens and apostrophes in names)
 *
 * @param name Name to normalize
 * @returns Normalized name
 *
 * @example
 * normalizeName('  John  Smith  ') // 'john smith'
 * normalizeName('Mary-Jane O\'Connor') // 'mary-jane o\'connor'
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Collapse multiple spaces
    .replace(/[^a-z0-9\s'-]/gi, '');  // Keep letters, numbers, spaces, hyphens, apostrophes
}

/**
 * Normalize phone number for comparison
 * - Remove all formatting characters (spaces, dashes, parentheses, dots)
 * - Remove leading + or country code prefixes
 * - Keep only digits
 *
 * @param phone Phone number to normalize
 * @param countryCode Country code (default: 'US')
 * @returns Normalized phone number (digits only)
 *
 * @example
 * normalizePhone('(555) 123-4567') // '5551234567'
 * normalizePhone('+1-555-123-4567', 'US') // '5551234567'
 * normalizePhone('555.123.4567') // '5551234567'
 */
export function normalizePhone(
  phone: string | null | undefined,
  countryCode: string = 'US'
): string {
  if (!phone) return '';

  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, '');

  // Remove common country code prefixes
  if (countryCode === 'US' && normalized.length === 11 && normalized.startsWith('1')) {
    normalized = normalized.substring(1);
  }

  return normalized;
}

/**
 * Extract email domain from an email address
 *
 * @param email Email address
 * @returns Domain (lowercase) or empty string if invalid
 *
 * @example
 * extractEmailDomain('john@example.com') // 'example.com'
 * extractEmailDomain('MARY@COMPANY.COM') // 'company.com'
 */
export function extractEmailDomain(email: string | null | undefined): string {
  if (!email) return '';

  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return '';

  return parts[1];
}

/**
 * Check if two names are likely nickname variations
 * Returns true if one name is a common nickname of the other
 *
 * @param name1 First name
 * @param name2 Second name
 * @returns True if likely nickname variation
 *
 * @example
 * isLikelyNickname('Bob', 'Robert') // true
 * isLikelyNickname('Mike', 'Michael') // true
 * isLikelyNickname('John', 'Jane') // false
 */
export function isLikelyNickname(
  name1: string | null | undefined,
  name2: string | null | undefined
): boolean {
  if (!name1 || !name2) return false;

  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);

  if (normalized1 === normalized2) return false;  // Same name, not nickname

  // Common nickname mappings
  const nicknames: Record<string, string[]> = {
    'robert': ['bob', 'rob', 'bobby', 'robbie'],
    'michael': ['mike', 'mickey', 'mick'],
    'william': ['bill', 'will', 'billy', 'willie'],
    'richard': ['rick', 'dick', 'rich', 'ricky'],
    'james': ['jim', 'jimmy', 'jamie'],
    'john': ['jack', 'johnny'],
    'joseph': ['joe', 'joey'],
    'thomas': ['tom', 'tommy'],
    'charles': ['charlie', 'chuck', 'chas'],
    'christopher': ['chris'],
    'daniel': ['dan', 'danny'],
    'matthew': ['matt'],
    'anthony': ['tony'],
    'elizabeth': ['liz', 'beth', 'betty', 'lizzy', 'betsy'],
    'margaret': ['maggie', 'meg', 'peggy', 'marge'],
    'catherine': ['cathy', 'kate', 'katie', 'cat'],
    'jennifer': ['jen', 'jenny'],
    'kimberly': ['kim'],
    'susan': ['sue', 'susie'],
    'patricia': ['pat', 'patty', 'tricia'],
    'barbara': ['barb', 'barbie'],
  };

  // Check if one is a nickname of the other (bidirectional)
  for (const [formal, nicks] of Object.entries(nicknames)) {
    if (
      (normalized1 === formal && nicks.includes(normalized2)) ||
      (normalized2 === formal && nicks.includes(normalized1))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if two company names are likely the same
 * Handles common variations like Inc., LLC, Ltd., Corp., etc.
 *
 * @param company1 First company name
 * @param company2 Second company name
 * @returns True if likely the same company
 *
 * @example
 * isSameCompany('Acme Inc.', 'Acme Corporation') // true
 * isSameCompany('Tech Co LLC', 'Tech Co') // true
 */
export function isSameCompany(
  company1: string | null | undefined,
  company2: string | null | undefined
): boolean {
  if (!company1 || !company2) return false;

  // Normalize: lowercase, trim, remove common suffixes
  const normalize = (company: string): string => {
    return company
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b(inc|llc|ltd|corp|corporation|company|co|incorporated|limited)\b\.?/gi, '')
      .trim();
  };

  const normalized1 = normalize(company1);
  const normalized2 = normalize(company2);

  if (normalized1 === normalized2) return true;

  // Check similarity (allow for minor typos)
  const similarity = similarityScore(normalized1, normalized2);
  return similarity >= 0.85;  // 85% similar (allows for minor typos)
}
