export default defineEventHandler(async (event) => {
  noStore(event)

  return {
    enabled: adminEnabled(event),
    authed: await isAdmin(event),
  }
})
