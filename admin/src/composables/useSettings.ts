import { ref } from 'vue'
import { api } from '@/api'
import { useAutoSave } from './useAutoSave'
import { useDataRefresh } from './useDataRefresh'
import type { CategoryOption, SiteSettings, SocialIconOption } from '@/types'

export function useSettings() {
  const settings = ref<SiteSettings>({
    profile: { name: '', bio: '', avatar: '', socials: [] },
    site: {
      title: '',
      description: '',
      url: '',
      ogImage: '',
      utcOffset: '+08:00',
      home: { postLimit: 5, hiddenCategories: [] },
    },
  })
  const icons = ref<SocialIconOption[]>([])
  const categories = ref<CategoryOption[]>([])
  const fileError = ref('')
  const fileMissing = ref(false)
  const state = useAutoSave({
    value: settings,
    enabled: () => !fileError.value,
    read: async () => {
      const data = await api.getSettings()
      icons.value = data.icons
      categories.value = data.categories ?? []
      fileMissing.value = data.missing === true
      fileError.value = data.error ?? ''
      return data.settings
    },
    write: async (value) => (await api.saveSettings(value)).settings,
  })
  useDataRefresh(state.refresh)
  async function retry() {
    if (state.dirty.value) await state.flush()
    else await state.refresh()
  }
  return { ...state, settings, icons, categories, fileError, fileMissing, retry }
}
