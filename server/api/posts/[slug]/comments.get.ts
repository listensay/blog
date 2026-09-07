export default defineEventHandler(async (event) => {
  noStore(event)

  return listComments(requireSlug(event))
})
