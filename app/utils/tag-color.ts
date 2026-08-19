/**
 * 标签配色：色系由标签名哈希得出，同一个标签在全站永远是同一个颜色，
 * 不需要在任何地方登记，新标签也自动有色。
 *
 * 为什么用 Tailwind 现成色板，而不是像评论头像那样算 oklch 色相：
 * sRGB 在很浅的明度上几乎没有彩度余量 —— L=0.96 时蓝色最大彩度只有 0.019，
 * 而黄绿能到 0.13。也就是说「固定明度彩度、只变色相」这套办法在浅色块上做不到：
 * 想留在色域内就得几乎变成灰，想有颜色就会被浏览器裁剪，裁剪量还每个色相不一样，
 * 结果反而不统一。Tailwind 的 50/100/700 三档已经按视觉一致调过，直接用更稳。
 *
 * 这 10 个色系是筛出来的：hover 态（700 字压在 100 底上）也全部过 WCAG AA 4.5:1，
 * 且相邻色相至少差 21°，不会出现「两个标签颜色像但又不一样」的别扭感。
 * 标签多于 10 个时会重复用色 —— 完全同色比「差 5°」清楚，这是故意的。
 *
 * 注意：这些类名必须以完整字符串出现在源码里，Tailwind 才会生成对应的 CSS，
 * 所以不要改成 `bg-${tone}-50` 这种拼接写法。
 */
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
