import { parsePatterns, matches } from './glob';

describe('glob', () => {
  test('parses comma and newline separated patterns', () => {
    expect(parsePatterns('*.tmp, node_modules\n.git')).toEqual(['*.tmp', 'node_modules', '.git']);
  });

  test('matches basename glob', () => {
    expect(matches('foo/bar.tmp', ['*.tmp'])).toBe(true);
    expect(matches('foo/bar.txt', ['*.tmp'])).toBe(false);
  });

  test('matches directory name', () => {
    expect(matches('node_modules', ['node_modules'])).toBe(true);
    expect(matches('src/node_modules/lodash', ['node_modules'])).toBe(false);
  });

  test('double-star matches nested paths', () => {
    expect(matches('a/b/c/file.log', ['**/file.log'])).toBe(false);
    expect(matches('a/b/c/file.log', ['**'])).toBe(true);
  });

  test('negation re-includes', () => {
    expect(matches('keep.tmp', ['*.tmp', '!keep.tmp'])).toBe(false);
    expect(matches('skip.tmp', ['*.tmp', '!keep.tmp'])).toBe(true);
  });

  test('handles empty input', () => {
    expect(matches('foo', [])).toBe(false);
    expect(parsePatterns('')).toEqual([]);
  });
});
