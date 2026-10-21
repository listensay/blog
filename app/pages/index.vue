<script setup lang="ts">
import { taxonomySlug } from '../utils/taxonomy'
import { IconArrowRight, IconArrowUpRight, IconArticle } from '@tabler/icons-vue'

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

const socialLinks = computed(() => siteConfig.socials.filter(s => s.url))

useSeo({
  description: () => siteConfig.description,
})

useJsonLd(() => ({
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
}))
</script>

<template>
  <div class="home-page">
    <section class="profile-poster relative flex items-center min-h-[286px] overflow-hidden isolate bg-[#5144b4] min-[1600px]:min-h-[320px] max-[1200px]:min-h-[270px] max-lg:min-h-[290px] max-md:min-h-[260px]" aria-labelledby="profile-name">
      <div class="
          poster-copy relative z-[2] w-[60%] p-[35px_32px] max-[1200px]:p-[28px_22px] max-lg:p-[32px] max-md:w-[65%]
          max-md:p-[26px_20px] max-[360px]:pl-[16px] [&_h1]:m-[0] [&_h1]:text-[clamp(42px,_4.4vw,_68px)]
          [&_h1]:font-[ui-rounded,_'Arial_Rounded_MT_Bold',_'Trebuchet_MS',_var(--font-sans)] [&_h1]:font-black [&_h1]:tracking-[-3px]
          [&_h1]:leading-[1.12] [&_h1]:text-[#fffef5] [&_h1]:wrap-anywhere min-[1600px]:[&_h1]:text-[76px]
          max-[1200px]:[&_h1]:text-[50px] max-lg:[&_h1]:text-[62px] max-md:[&_h1]:text-[54px] max-[360px]:[&_h1]:text-[44px]
        ">
        <h1 id="profile-name">{{ siteConfig.profile.name }}</h1>
        <p v-if="siteConfig.profile.bio" class="poster-bio m-[17px_0_0] max-w-[260px] leading-[1.9] text-[#e1dcfc] text-pretty text-base max-md:max-w-[185px] max-md:mt-[14px] max-md:text-[15px]">{{ siteConfig.profile.bio }}</p>
        <div v-if="socialLinks.length" class="poster-socials flex [flex-wrap:wrap] gap-[10px] mt-[26px] max-md:gap-[7px] max-md:mt-[22px]">
          <a
            v-for="(link, index) in socialLinks"
            :key="`${link.icon}-${index}`"
            :href="link.url"
            :target="/^https?:\/\//i.test(link.url) ? '_blank' : undefined"
            :rel="/^https?:\/\//i.test(link.url) ? 'noopener noreferrer' : undefined"
            class="
          poster-social grid place-items-center [border:1px_solid_#ffffff2b] text-[#f3eefe]
          [transition:background_150ms,_transform_150ms] w-[40px] h-[40px] max-md:w-[36px] max-md:h-[36px] [&_svg]:w-[18px]
          [&_svg]:h-[18px] hover:text-panel hover:bg-accent hover:[transform:translateY(-2px)]
        "
            :aria-label="link.label"
            :title="link.label"
          ><SocialIcon :icon="link.icon" /></a>
        </div>
      </div>
      <div class="poster-art absolute z-[1] inset-[0_0_0_42%] max-md:left-[50%]" aria-hidden="true">
        <span class="poster-orbit absolute right-[-24px] bottom-[-65px] w-[290px] h-[290px] [border:1px_solid_#ffffff20] rounded-full" />
        <DecorativeFlower class="
          poster-flower flower-lime absolute z-[2] top-[19%] left-[14%] w-[48px] h-[48px] text-[#bdd998] [transform:rotate(15deg)]
          max-[1200px]:left-[8%] max-[1200px]:w-[42px] max-[1200px]:h-[42px] max-md:top-[7%] max-md:left-[20%] max-md:w-[30px]
          max-md:h-[30px]
        " />
        <DecorativeFlower class="poster-flower flower-yellow absolute z-[2] left-[-6%] bottom-[14%] w-[56px] h-[56px] text-accent [transform:rotate(-15deg)] max-[1200px]:left-[-4%] max-[1200px]:bottom-[8%] max-[1200px]:w-[48px] max-[1200px]:h-[48px] max-md:hidden" />
        <DecorativeFlower class="
          poster-flower flower-pink absolute z-[2] right-[4%] top-[16%] w-[54px] h-[54px] text-[#cc91dd] [transform:rotate(20deg)]
          max-[1200px]:top-[8%] max-[1200px]:right-[8%] max-[1200px]:w-[42px] max-[1200px]:h-[42px] max-md:top-[9%] max-md:right-[8%]
          max-md:w-[34px] max-md:h-[34px]
        " />
        <img :src="siteConfig.profile.avatar === '/avatar.jpg' ? '/images/profile-cutout.png' : siteConfig.profile.avatar" alt="" class="
          poster-avatar absolute bottom-[-12px] right-[6%] h-[96%] w-[auto] max-w-[none] object-contain [transform:rotate(3deg)]
          max-[1200px]:right-[-4%] max-[1200px]:h-[86%] max-lg:right-[8%] max-lg:h-[98%] max-md:h-[83%] max-md:right-[-15%]
          max-md:bottom-[-6px] max-[360px]:right-[-28%]
        " fetchpriority="high" width="390" height="390">
      </div>
    </section>

    <section class="home-articles" aria-labelledby="home-articles-title">
      <div class="
          articles-heading flex gap-[12px] items-center justify-between p-[28px_0_19px] max-md:pt-[24px] max-md:pb-[16px] [&_h2]:flex
          [&_h2]:items-center [&_h2]:gap-[9px] [&_h2]:font-semibold [&_h2]:text-lg [&_h2_svg]:text-[#b4accf] [&_h2_span]:grid
          [&_h2_span]:place-items-center [&_h2_span]:ml-[1px] [&_h2_span]:bg-[#242238] [&_h2_span]:text-[#b8b0d6]
          [&_h2_span]:font-normal [&_h2_span]:text-xs [&_h2_span]:h-[24px] [&_h2_span]:min-w-[24px] max-md:[&_h2]:text-base
        ">
        <h2 id="home-articles-title"><IconArticle :size="19" stroke="1.7" aria-hidden="true" />最新文章 <span v-if="!loading && !error">{{ visiblePosts.length }}</span></h2>
        <NuxtLink to="/blog" class="articles-more inline-flex items-center gap-[5px] text-accent whitespace-nowrap text-sm hover:text-[#ffe7a9]">全部文章 <IconArrowUpRight :size="15" aria-hidden="true" /></NuxtLink>
      </div>
      <div class="
          article-columns grid gap-[12px] px-4 py-3 [border-bottom:1px_solid_var(--color-panel-line)] text-[#9590ad]
          grid-cols-[26px_minmax(0,_1fr)_96px_28px] text-xs max-[1200px]:gap-[9px]
          max-[1200px]:grid-cols-[18px_minmax(0,_1fr)_88px_25px] max-lg:gap-[12px]
          max-lg:grid-cols-[24px_minmax(0,_1fr)_88px_28px] max-md:hidden [&>:nth-child(2)]:pl-[92px]
          max-[1200px]:[&>:nth-child(2)]:pl-[73px] max-lg:[&>:nth-child(2)]:pl-[76px]
        " aria-hidden="true"><span>#</span><span>文章</span><span>发布日期</span><span /></div>
      <PostListSkeleton v-if="loading" :count="4" mobile-layout="light" />
      <p v-else-if="error" class="article-empty p-[40px_0] text-panel-muted text-base" role="alert">文章加载失败</p>
      <div v-else-if="posts.length" class="article-list overflow-visible [border-block:1px_solid_var(--color-panel-line)]">
        <PostCard v-for="(post, i) in posts" :key="post.path" :post="post" :index="i + 1" mobile-layout="light" />
      </div>
      <p v-else class="article-empty p-[40px_0] text-panel-muted text-base">暂无文章</p>
      <NuxtLink v-if="visiblePosts.length > posts.length" to="/blog" class="articles-view-all flex gap-[10px] items-center justify-center p-[20px] [border-top:1px_solid_var(--color-panel-line)] text-accent text-sm">查看全部文章 <IconArrowRight :size="16" aria-hidden="true" /></NuxtLink>
    </section>
  </div>
</template>
