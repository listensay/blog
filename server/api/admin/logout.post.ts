export default defineEventHandler((event) => {
  signOut(event)
  return { ok: true }
})
