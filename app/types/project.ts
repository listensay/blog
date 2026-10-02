export interface Project {
  id: string
  title: string
  titleEn: string
  description: string
  descriptionEn: string
  cover: string
  tags: string[]
  demoUrl: string
  repoUrl: string
  draft: boolean
}

export type PublishedProject = Omit<Project, 'draft'>

export interface ProjectsResponse {
  items: Project[]
  revision: string
}
