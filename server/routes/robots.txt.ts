/**
 * /robots.txt
 *
 * 写成服务端路由而不是 public/robots.txt，是为了让域名只有 site.ts 一个来源 ——
 * 换域名时不用记得还有个静态文件里硬编码着旧地址。
 */
import { siteConfig } from '../../app/utils/site'

export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return [
    'User-agent: *',
    'Allow: /',
    // 后台和接口没有可收录内容，爬它们只是浪费抓取预算
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteConfig.url}/sitemap.xml`,
    '',
  ].join('\n')
})
