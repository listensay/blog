<script setup lang="ts">
import { taxonomySlug } from '../utils/taxonomy'

const { data: allPosts, status, error } = await useAsyncData(
  'home-posts',
  () =>
    queryCollection('blog')
      .where('draft', '=', false)
      .order('date', 'DESC')
      .all(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)
const visiblePosts = computed(() => (allPosts.value ?? []).filter((post) => {
  const slug = taxonomySlug(post.category || '未分类', 'category')
  return !siteConfig.home.hiddenCategories.includes(slug)
}))
const posts = computed(() => visiblePosts.value
  .slice(0, siteConfig.home.postLimit))

const avatar = ref<HTMLImageElement>()
const animateAvatar = ref(false)
let avatarAnimationStarted = false

function startAvatarAnimation() {
  if (avatarAnimationStarted) return
  avatarAnimationStarted = true
  animateAvatar.value = true
}

function finishAvatarAnimation() {
  animateAvatar.value = false
}

onMounted(() => {
  if (avatar.value?.complete) startAvatarAnimation()
})

const socialLinks = computed(() => siteConfig.socials.filter(s => s.url))
const authorColors = ['#4285f4', '#ea4335', '#f9ab00', '#34a853', '#a855f7']

useSeo({
  description: siteConfig.description,
})

useJsonLd({
  '@type': 'WebSite',
  'name': siteConfig.title,
  'description': siteConfig.description,
  'url': `${siteConfig.url}/`,
  'inLanguage': 'zh-CN',
  'author': {
    '@type': 'Person',
    'name': siteConfig.author,
    'url': siteConfig.url,
    'image': `${siteConfig.url}${siteConfig.profile.avatar}`,
    'sameAs': siteConfig.socials
      .filter(s => s.url.startsWith('http'))
      .map(s => s.url),
  },
})
</script>

<template>
  <div>
    <section v-reveal class="mt-2 flex items-center gap-4 py-8 sm:mt-4 sm:gap-6 sm:px-6 sm:py-20">
      <img
        ref="avatar"
        :src="siteConfig.profile.avatar"
        class="home-avatar soft-shadow size-20 shrink-0 rounded-full object-cover sm:size-42"
        :class="{ 'home-avatar-jelly': animateAvatar }"
        :alt="`${siteConfig.profile.name} 的头像`"
        @load="startAvatarAnimation"
        @animationend="finishAvatarAnimation"
      >
      <div class="min-w-0">
        <h1
          class="text-2xl font-bold sm:text-5xl"
          :aria-label="siteConfig.author"
        >
          <span
            v-for="(char, index) in [...siteConfig.author]"
            :key="`${char}-${index}`"
            aria-hidden="true"
            :style="{ color: authorColors[index % authorColors.length] }"
          >{{ char }}</span>
        </h1>
        <p class="max-w-2xl leading-relaxed text-slate-600 sm:text-lg">
          {{ siteConfig.profile.bio }}
        </p>
        <div v-if="socialLinks.length" class="mt-3 flex flex-wrap items-center gap-2 sm:mt-5 sm:gap-2.5">
          <AppActionIcon
            v-for="(link, index) in socialLinks"
            :key="`${link.icon}-${index}`"
            :label="link.label"
            :href="link.url"
            :color="link.color"
          >
            <SocialIcon :icon="link.icon" />
          </AppActionIcon>
        </div>
      </div>
    </section>

    <section class="py-4">
      <PostListSkeleton v-if="loading" :count="5" />
      <div v-else-if="posts?.length" class="overflow-hidden rounded-2xl bg-white shadow">
        <PostCard
          v-for="(post, i) in posts"
          :key="post.path"
          v-reveal="i"
          :post="post"
        />
      </div>
      <p v-else class="py-10 text-slate-500 sm:py-12">
        还没有文章。在 <code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">content/blog/</code> 里新建一个 Markdown 文件就会出现在这里。
      </p>
    </section>
  </div>
</template>

<style scoped>
.home-avatar {
  transform-origin: center;
}

.home-avatar-jelly {
  animation: avatar-jelly 680ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

@media (hover: hover) {
  .home-avatar:hover {
    animation: avatar-jelly 680ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }
}

@keyframes avatar-jelly {
  0% {
    opacity: 0.85;
    transform: scale(0.78, 1.16);
  }
  28% {
    opacity: 1;
    transform: scale(1.14, 0.88);
  }
  50% {
    transform: scale(0.93, 1.08);
  }
  70% {
    transform: scale(1.05, 0.96);
  }
  86% {
    transform: scale(0.98, 1.02);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
