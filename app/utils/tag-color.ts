// 标签配色：色系由标签名哈希得出，同一个标签全站永远同色。类名必须完整出现在源码里，
// 拼接成 `bg-${tone}-50` Tailwind 就不生成 CSS；也别改成算 oklch 色相，这么浅的明度下 sRGB 没有彩度余量
const TAG_TONES = [
  'bg-pink-50 text-pink-700 hover:bg-pink-100',
  'bg-red-50 text-red-700 hover:bg-red-100',
  'bg-amber-50 text-amber-700 hover:bg-amber-100',
  'bg-lime-50 text-lime-700 hover:bg-lime-100',
  'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  'bg-teal-50 text-teal-700 hover:bg-teal-100',
  'bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
  'bg-blue-50 text-blue-700 hover:bg-blue-100',
  'bg-violet-50 text-violet-700 hover:bg-violet-100',
  'bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100',
]

/** 和评论头像取色（server/utils/comments.ts 的 hueOf）同一个多项式哈希 */
export function tagTone(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) % 100003
  }
  return TAG_TONES[hash % TAG_TONES.length]!
}
