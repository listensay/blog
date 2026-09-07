export default defineEventHandler(async (event) => {
  const name = requirePageName(event)
  await assertPageExists(event, name)

  return toggleLike(pageTargetId(name), await visitorId(event))
})
