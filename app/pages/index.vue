<script setup lang="ts">
// lazy 的取舍见 useQueryState：客户端换路由不阻塞导航，先出骨架屏；SSR 照旧阻塞
const { data: posts, status, error } = await useAsyncData(
  'home-posts',
  () =>
    queryCollection('blog')
      .where('draft', '=', false)
      .order('date', 'DESC')
      .limit(5)
      .all(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

// url 留空的社交项不渲染，方便在 site.ts 里占位
const socialLinks = computed(() => siteConfig.socials.filter(s => s.url))

useSeoMeta({
  title: siteConfig.title,
  description: siteConfig.description,
})
</script>

<template>
  <div>
    <section v-reveal class="mt-4 px-6 py-16 sm:py-20 flex items-center">
      <div class="mr-4">
        <img src="/images/avatar.jpg" class="w-32 rounded-full border border-amber-50" alt="user avatar">
      </div>
      <div>
        <h1 class="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          {{ siteConfig.author }}
        </h1>
        <p class="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
          {{ siteConfig.description }}
        </p>
        <div v-if="socialLinks.length" class="mt-5 flex items-center gap-2.5">
          <AppActionIcon
            v-for="link in socialLinks"
            :key="link.icon"
            :label="link.label"
            :href="link.url"
            :color="link.icon"
          >
            <SocialIcon :icon="link.icon" />
          </AppActionIcon>
        </div>
      </div>
    </section>

    <section class="py-4">
      <PostListSkeleton v-if="loading" :count="5" />
      <div v-else-if="posts?.length">
        <PostCard
          v-for="(post, i) in posts"
          :key="post.path"
          v-reveal="i"
          :post="post"
        />
      </div>
      <p v-else class="py-12 text-slate-500">
        还没有文章。在 <code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">content/blog/</code> 里新建一个 Markdown 文件就会出现在这里。
      </p>
    </section>
  </div>
</template>
