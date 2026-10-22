import { ref } from 'vue'
export const notices = ref<{ id: number; text: string; tone: 'success' | 'error' }[]>([])
let nextId = 0
function addNotice(text: string, tone: 'success' | 'error') {
  const id = ++nextId
  notices.value.push({ id, text, tone })
  setTimeout(() => dismissNotice(id), tone === 'error' ? 8000 : 4000)
}
export function dismissNotice(id: number) {
  notices.value = notices.value.filter((notice) => notice.id !== id)
}
export const notify = {
  success: (text: string) => addNotice(text, 'success'),
  error: (text: string) => addNotice(text, 'error'),
}
interface Confirmation {
  title: string
  content?: string
  confirmText?: string
  danger?: boolean
  resolve: (accepted: boolean) => void
}
export const confirmation = ref<Confirmation | null>(null)
const queue: Confirmation[] = []
export function confirmAction(options: Omit<Confirmation, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push({ ...options, resolve })
    if (!confirmation.value) confirmation.value = queue.shift() ?? null
  })
}
export function settleConfirmation(accepted: boolean) {
  const current = confirmation.value
  confirmation.value = null
  current?.resolve(accepted)
  // Let the native dialog close before displaying the next queued confirmation.
  setTimeout(() => {
    if (!confirmation.value) confirmation.value = queue.shift() ?? null
  }, 0)
}
