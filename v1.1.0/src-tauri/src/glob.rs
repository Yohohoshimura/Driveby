pub fn parse_patterns(input: &str) -> Vec<String> {
    input
        .split(|c: char| c == ',' || c == '\n')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn glob_to_regex(glob: &str) -> String {
    let mut re = String::from("^");
    let mut chars = glob.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '*' => {
                if chars.peek() == Some(&'*') {
                    chars.next();
                    re.push_str(".*");
                } else {
                    re.push_str("[^/]*");
                }
            }
            '?' => re.push_str("[^/]"),
            '.' | '+' | '^' | '$' | '{' | '}' | '(' | ')' | '|' | '[' | ']' | '\\' => {
                re.push('\\');
                re.push(c);
            }
            other => re.push(other),
        }
    }
    re.push('$');
    re
}

pub fn matches(rel_path: &str, patterns: &[String]) -> bool {
    if patterns.is_empty() {
        return false;
    }
    let normalized = rel_path.replace('\\', "/");
    let basename = normalized.rsplit('/').next().unwrap_or("");
    let mut excluded = false;
    for pattern in patterns {
        let (body, negated) = if let Some(body) = pattern.strip_prefix('!') {
            (body, true)
        } else {
            (pattern.as_str(), false)
        };
        let re = regex::Regex::new(&glob_to_regex(body));
        let Ok(re) = re else { continue };
        if re.is_match(&normalized) || re.is_match(basename) {
            excluded = !negated;
        }
    }
    excluded
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_separators() {
        assert_eq!(
            parse_patterns("*.tmp, node_modules\n.git"),
            vec!["*.tmp", "node_modules", ".git"]
        );
    }

    #[test]
    fn basename_match() {
        assert!(matches("foo/bar.tmp", &vec!["*.tmp".into()]));
        assert!(!matches("foo/bar.txt", &vec!["*.tmp".into()]));
    }

    #[test]
    fn negation_reincludes() {
        let p = vec!["*.tmp".into(), "!keep.tmp".into()];
        assert!(matches("skip.tmp", &p));
        assert!(!matches("keep.tmp", &p));
    }
}
