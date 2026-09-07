export default defineEventHandler(async (event) => {
  noStore(event)

  const name = requirePageName(event)
  await assertPageComments(event, name)

  return listComments(pageTargetId(name))
})
