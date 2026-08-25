// /robots.txt 写成服务端路由而不是静态文件，域名只有 site.ts 一个来源，换域名不会漏改
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
