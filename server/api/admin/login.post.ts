export default defineEventHandler(async (event) => {
  const body = await readBody(event) ?? {}
  const password = String(body.password ?? '')

  if (!password) {
    throw httpError(400, '请输入密码')
  }

  await signIn(event, password)

  return { ok: true }
})
