export default defineEventHandler(async (event) => {
  const slug = requireSlug(event)
  await assertPostExists(event, slug)

  return countView(slug, await visitorId(event))
})
