import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import { zipSync, strToU8 } from 'fflate'
import { splitFrontmatter } from '../frontmatter.ts'
import type { Workspace } from '../paths.ts'
import { contentFiles, hash, safeContentPath } from './sync.ts'

export async function exportForAffine(ws: Workspace): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = Object.create(null)
  for (const file of await contentFiles(ws)) {
    const raw = await readFile(await safeContentPath(ws, file), 'utf8')
    const { data, body } = splitFrontmatter(raw)
    const isPost = /^(?:en\/)?blog\//.test(file)
    const relative = file.replace(/^(?:en\/)?(?:blog|pages)\//, '')
    const metadata = {
      blog: true,
      kind: isPost ? 'post' : 'page',
      locale: file.startsWith('en/') ? 'en' : 'zh-CN',
      title: data.title,
      description: data.description ?? '',
      slug: isPost ? data.slug : relative.replace(/\.md$/, ''),
      ...(isPost
        ? {
            directory: path.posix.dirname(relative) === '.' ? '' : path.posix.dirname(relative),
            date: String(data.date),
            category: data.category ?? '未分类',
            tags: data.tags ?? [],
            draft: data.draft === true,
            ...(data.cover ? { cover: data.cover } : {}),
          }
        : { comments: data.comments === true }),
      file,
      migrationRevision: hash(raw),
    }
    // The ZIP importer takes its document title from the Markdown filename.
    const title = String(data.title || path.posix.basename(file, '.md'))
    const filename =
      title
        .replace(/[\\/\p{Cc}]/gu, ' ')
        .replace(/^\.+/, '')
        .trim() || 'Untitled'
    let zipFile = `content/${path.posix.dirname(file)}/${filename}.md`
    if (entries[zipFile])
      zipFile = `content/${path.posix.dirname(file)}/${filename}-${hash(file).slice(0, 8)}.md`
    const publicDir = path.posix.relative(path.posix.dirname(zipFile), 'public')
    // AFFiNE's ZIP importer resolves images relative to each Markdown document.
    const migratedBody = body.replace(/([("'])\/(images|affine-assets)\//g, `$1${publicDir}/$2/`)
    entries[zipFile] = strToU8(
      `# ${title}\n\n\`\`\`yaml\n${YAML.stringify(metadata, { lineWidth: 0 })}\`\`\`\n\n${migratedBody.trim()}\n`,
    )
  }
  let totalBytes = 0
  const walk = async (directory: string) => {
    const children = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error.code === 'ENOENT') return []
      throw error
    })
    for (const entry of children) {
      if (entry.name.startsWith('.')) continue
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(absolute)
      else if (entry.isFile()) {
        const bytes = await readFile(absolute)
        totalBytes += bytes.length
        if (totalBytes > 256 * 1024 * 1024) throw new Error('迁移图片超过 256 MB，请分批迁移')
        const file = path.relative(ws.blogRoot, absolute).split(path.sep).join('/')
        entries[file] = bytes
      }
    }
  }
  await walk(ws.imagesDir)
  await walk(path.join(ws.publicDir, 'affine-assets'))
  return zipSync(entries, { level: 6 })
}
