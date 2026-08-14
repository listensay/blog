/** 管理页首屏用它判断该显示登录框还是评论列表 */
export default defineEventHandler(async (event) => {
  noStore(event)

  return {
    enabled: adminEnabled(event),
    authed: await isAdmin(event),
  }
})
