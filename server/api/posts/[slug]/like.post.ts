export default defineEventHandler(async (event) => {
  const slug = requireSlug(event)
  await assertPostExists(event, slug)

  return toggleLike(slug, await visitorId(event))
})
