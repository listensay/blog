import type { Project, PublishedProject } from '../../app/types/project'

export function publishedProjects(projects: Project[]): PublishedProject[] {
  return projects
    .filter(project => project.draft === false)
    .map(({ id, title, titleEn, description, descriptionEn, cover, tags, demoUrl, repoUrl }) => ({
      id, title, titleEn, description, descriptionEn, cover, tags, demoUrl, repoUrl,
    }))
}
