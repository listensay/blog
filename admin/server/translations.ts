import { readFile } from 'node:fs/promises'
import type { EnglishTranslation, EnglishTranslationInput } from '../src/types.ts'
import { POST_KEY_ORDER, serializeFile, withLeadingBlankLine } from './frontmatter.ts'
import { badRequest, conflict } from './http.ts'
import { resolvePostFile, type Workspace } from './paths.ts'
import { readPost } from './posts.ts'
import { normalizeTranslationAssets, validateTranslationBody } from './translation-integrity.ts'
import {
  readTranslationFile,
  revisionOf,
  translationFile,
  withContentWrite,
  writeTranslationFile,
} from './translation-files.ts'

export async function readEnglishTranslation(
  ws: Workspace,
  file: string,
): Promise<EnglishTranslation> {
  const source = await readPost(ws, file)
  const sourceRevision = revisionOf(await readFile(resolvePostFile(ws, file), 'utf8'))
  const translated = await readTranslationFile(ws, source)
  return {
    source,
    sourceRevision,
    revision: translated ? revisionOf(translated.raw) : null,
    file: translated?.file ?? translationFile(source),
    path: `/en${source.realPath}`,
    content: translated
      ? {
          title: String(translated.data.title ?? ''),
          description: String(translated.data.description ?? ''),
          body: translated.body,
          draft: translated.data.draft === true,
        }
      : null,
    outdated: !!translated && translated.data.translationSourceHash !== sourceRevision,
  }
}

export function assertTranslationRevision(
  state: EnglishTranslation,
  sourceRevision: unknown,
): void {
  if (sourceRevision !== state.sourceRevision)
    throw conflict('中文原文已更新，请重新打开英文版后再操作')
}

export async function saveEnglishTranslation(
  ws: Workspace,
  file: string,
  input: EnglishTranslationInput,
): Promise<EnglishTranslation> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw badRequest('英文版参数必须是对象')
  return withContentWrite(async () => {
    const state = await readEnglishTranslation(ws, file)
    assertTranslationRevision(state, input.sourceRevision)
    if (input.revision !== state.revision)
      throw conflict('英文版已在其他窗口修改，请重新打开后再保存')
    const title = typeof input.title === 'string' ? input.title.trim() : ''
    const description = typeof input.description === 'string' ? input.description.trim() : ''
    const body = typeof input.body === 'string' ? input.body : ''
    if (!title || title.length > 200) throw badRequest('英文标题不能为空，且最多 200 个字符')
    if (!description || description.length > 1000)
      throw badRequest('英文摘要不能为空，且最多 1000 个字符')
    if (!body.trim() || body.length > 180_000)
      throw badRequest('英文正文不能为空，且最多 180000 个字符')
    if (typeof input.draft !== 'boolean') throw badRequest('请指定英文版的草稿状态')
    if (state.source.draft && !input.draft) throw badRequest('中文原文仍是草稿，请先发布中文原文')
    const sourceBody = normalizeTranslationAssets(state.source.body, state.source.file)
    const normalizedBody = normalizeTranslationAssets(body, state.source.file)
    validateTranslationBody(sourceBody, normalizedBody)
    const existing = await readTranslationFile(ws, state.source)
    const data = {
      ...existing?.data,
      title,
      description,
      slug: state.source.slug,
      path: state.path,
      date: state.source.date,
      category: state.source.category,
      tags: state.source.tags,
      cover: normalizeTranslationAssets(state.source.cover, state.source.file),
      draft: input.draft,
      translationSourceHash: state.sourceRevision,
    }
    await writeTranslationFile(
      ws,
      state.file,
      serializeFile(data, withLeadingBlankLine(normalizedBody), POST_KEY_ORDER),
    )
    return readEnglishTranslation(ws, file)
  })
}
