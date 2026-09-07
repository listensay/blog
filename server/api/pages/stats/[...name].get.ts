export default defineEventHandler(async (event) => {
  noStore(event)

  const name = requirePageName(event)
  const visitor = await visitorId(event)

  return readStats(pageTargetId(name), visitor)
})
