import projectsData from '../../content/data/projects.json'
import type { Project, PublishedProject } from '../../app/types/project'
import { publishedProjects } from '../utils/projects'

export default defineEventHandler((): PublishedProject[] => {
  // Keep drafts on the server; they must never be included in public payloads.
  return publishedProjects(projectsData as Project[])
})
