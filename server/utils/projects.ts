import type { Project, PublishedProject } from '../../app/types/project'

export function publishedProjects(projects: Project[]): PublishedProject[] {
  return projects
    .filter(project => project.draft === false)
    .map(({ id, title, description, cover, tags, demoUrl, repoUrl }) => ({
      id, title, description, cover, tags, demoUrl, repoUrl,
    }))
}
