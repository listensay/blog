/**
 * 友情链接。
 * 想加链接就在数组里加一项；页面与内容分离，方便维护。
 */
export interface FriendLink {
  name: string
  url: string
  /** 一句话描述这个站点 */
  description: string
  /** 头像地址：放 public/friends/ 下，或填任意 http(s) URL */
  avatar?: string
}

export const friendLinks: FriendLink[] = [
  {
    name: 'Immki Blog',
    url: '/',
    description: '',
  },
]
