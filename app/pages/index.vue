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
    <!-- 手机上仍是「头像在左、文字在右」，只是整体缩一号：头像 80px、
         标题降到 text-2xl、留白收紧，好让文章列表早点进视口 -->
    <section v-reveal class="mt-2 flex items-center gap-4 py-8 sm:mt-4 sm:gap-6 sm:px-6 sm:py-20">
      <img
        src="/images/avatar.jpg"
        class="size-20 shrink-0 rounded-full border border-amber-50 object-cover sm:size-42"
        alt="user avatar"
      >
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          {{ siteConfig.author }}
        </h1>
        <p class="mt-1.5 max-w-2xl leading-relaxed text-slate-600 sm:mt-4 sm:text-lg">
          {{ siteConfig.description }}
        </p>
        <div v-if="socialLinks.length" class="mt-3 flex flex-wrap items-center gap-2 sm:mt-5 sm:gap-2.5">
          <AppActionIcon
            v-for="link in socialLinks"
            :key="link.icon"
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
      <div v-else-if="posts?.length">
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
