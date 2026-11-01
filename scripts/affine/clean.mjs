import { fileURLToPath } from 'node:url'
import { cleanBuildFiles } from './artifacts.mjs'

const source = fileURLToPath(new URL('../../vendor/affine', import.meta.url))
const removed = await cleanBuildFiles(source)
console.log(removed.length ? `已清理 AFFiNE 构建依赖与中间产物：${removed.join('、')}` : '无需清理 AFFiNE 构建文件')
