const TAXONOMY_ALIASES: Record<string, string> = {
  docs: 'docs',
  文档: 'docs',
  福利: 'benefits',
  嵌入式: 'embedded',
  未分类: 'uncategorized',
  other: 'other',
  其他: 'other',
  ai: 'ai',
  python: 'python',
  agent: 'agent',
  白嫖: 'freebies',
}

function hashSlug(value: string) {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

/** Return a stable, ASCII-only URL segment for a category or tag. */
export function taxonomySlug(value: string, kind: 'category' | 'tag' = 'tag') {
  const name = value.trim()
  if (!name) return kind === 'category' ? 'uncategorized' : 'untagged'

  const alias = TAXONOMY_ALIASES[name.toLowerCase()] ?? TAXONOMY_ALIASES[name]
  if (alias) return alias

  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return ascii || `${kind}-${hashSlug(name)}`
}

export function taxonomyLink(prefix: 'categories' | 'tags', value: string) {
  const kind = prefix === 'categories' ? 'category' : 'tag'
  return `/${prefix}/${taxonomySlug(value, kind)}`
}

export function taxonomyMatches(value: string, routeValue: string, kind: 'category' | 'tag') {
  const decoded = decodeURIComponent(routeValue).trim()
  return value === decoded || taxonomySlug(value, kind) === decoded.toLowerCase()
}

