// AFFiNE's Markdown adapter only imports Markdown images, not raw HTML img tags.
// Keep fenced examples intact while normalizing the HTML emitted by old exports.
export function markdownForImport(body: string): string {
  const decode = (value: string) =>
    value.replace(/&(amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity, name: string) => {
      if (name.startsWith('#')) {
        const code =
          name[1]?.toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity
      }
      return (
        ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' } as Record<string, string>)[
          name.toLowerCase()
        ] ?? entity
      )
    })
  const normalize = (text: string) =>
    text.replace(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, (tag) => {
      const attrs = Object.fromEntries(
        [...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((m) => [
          m[1]!.toLowerCase(),
          decode(m[2] ?? m[3] ?? m[4] ?? ''),
        ]),
      )
      if (!attrs.src) return tag
      const src = attrs.src
        .replace(/^(?:\.\.\/)+public\//, '/')
        .replace(/[<>\s]/g, (c) => encodeURIComponent(c))
      const alt = (attrs.alt ?? '').replace(/[\\\[\]]/g, '\\$&').replace(/\r?\n/g, ' ')
      return `![${alt}](<${src}>)`
    })
  let fence = '',
    outside = '',
    result = ''
  for (const line of body.split(/(?<=\n)/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
    if (!fence && marker) {
      result += normalize(outside) + line
      outside = ''
      fence = marker
    } else if (fence) {
      result += line
      if (marker?.[0] === fence[0] && marker.length >= fence.length && line.trim() === marker)
        fence = ''
    } else outside += line
  }
  return result + normalize(outside)
}
