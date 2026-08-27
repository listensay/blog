import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Modal, message } from 'ant-design-vue'

import { api } from '@/api'
import type { CategoryOption, SiteSettings, SocialIconOption } from '@/types'

function emptySettings(): SiteSettings {
  return {
    profile: { name: '', bio: '', avatar: '', socials: [] },
    site: {
      title: '',
      description: '',
      url: '',
      ogImage: '',
      utcOffset: '+08:00',
      home: { postLimit: 5, hiddenCategories: [] },
    },
  }
}

export function useSettings() {
  const loading = ref(true)
  const saving = ref(false)
  const loadError = ref('')
  const fileError = ref('')
  const fileMissing = ref(false)

  const settings = ref<SiteSettings>(emptySettings())
  const icons = ref<SocialIconOption[]>([])
  const categories = ref<CategoryOption[]>([])

  const baseline = ref('')
  const dirty = computed(() => JSON.stringify(settings.value) !== baseline.value)

  const canSave = computed(() => !loading.value && !loadError.value)

  async function load() {
    loading.value = true
    loadError.value = ''
    try {
      const data = await api.getSettings()
      settings.value = data.settings
      icons.value = data.icons
      categories.value = data.categories ?? []
      fileMissing.value = data.missing === true
      fileError.value = data.error ?? ''
      baseline.value = JSON.stringify(settings.value)
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (saving.value || !canSave.value) return
    saving.value = true
    try {
      const data = await api.saveSettings(settings.value)
      settings.value = data.settings
      baseline.value = JSON.stringify(settings.value)
      fileMissing.value = false
      fileError.value = ''
      message.success('已保存')
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err))
    } finally {
      saving.value = false
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void save()
    }
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value) event.preventDefault()
  }

  onMounted(() => {
    void load()
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('beforeunload', onBeforeUnload)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('beforeunload', onBeforeUnload)
  })

  onBeforeRouteLeave(async () => {
    if (!dirty.value) return true
    return new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '有未保存的修改',
        content: '离开后修改会丢失。',
        okText: '不保存并离开',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })
  })

  return {
    loading,
    saving,
    loadError,
    fileError,
    fileMissing,
    settings,
    icons,
    categories,
    dirty,
    canSave,
    load,
    save,
  }
}
