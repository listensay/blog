export default defineEventHandler(async (event) => {
  const name = requirePageName(event)
  await assertPageComments(event, name)

  const input = validateComment(await readBody(event) ?? {})
  const visitor = await visitorId(event)
  await assertNotFlooding(visitor)

  return createComment(pageTargetId(name), input, visitor)
})
