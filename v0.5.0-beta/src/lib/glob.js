function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if ('.+^${}()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp(`^${re}$`);
}

export function parsePatterns(input) {
  if (!input || typeof input !== 'string') return [];
  return input
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function matches(relPath, patterns) {
  if (!patterns || patterns.length === 0) return false;
  const normalized = String(relPath).replace(/\\/g, '/');
  const basename = normalized.split('/').pop();
  let excluded = false;
  for (const pattern of patterns) {
    const negated = pattern.startsWith('!');
    const body = negated ? pattern.slice(1) : pattern;
    const regex = globToRegex(body);
    const hit = regex.test(normalized) || regex.test(basename);
    if (!hit) continue;
    excluded = !negated;
  }
  return excluded;
}
