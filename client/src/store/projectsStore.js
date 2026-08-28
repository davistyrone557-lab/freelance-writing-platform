import { create } from 'zustand'
import { projectsAPI } from '../services/api'

const useProjectsStore = create((set) => ({
  projects: [],
  currentProject: null,
  filters: {},
  isLoading: false,
  error: null,

  setFilters: (filters) => set({ filters }),

  fetchProjects: async (params = {}) => {
    set({ isLoading: true, error: null })
    try {
      const response = await projectsAPI.getAll(params)
      set({ projects: response.data.projects || [], isLoading: false })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to load projects', isLoading: false })
      throw error
    }
  },

  fetchProjectById: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const response = await projectsAPI.getById(id)
      set({ currentProject: response.data, isLoading: false })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to load project', isLoading: false })
      throw error
    }
  },

  createProject: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await projectsAPI.create(data)
      set((state) => ({
        projects: [response.data.project, ...state.projects],
        isLoading: false
      }))
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to create project', isLoading: false })
      throw error
    }
  },

  updateProject: async (id, data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await projectsAPI.update(id, data)
      set((state) => ({
        currentProject: response.data.project,
        projects: state.projects.map((project) => project.id === response.data.project.id ? response.data.project : project),
        isLoading: false
      }))
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to update project', isLoading: false })
      throw error
    }
  },

  resetCurrentProject: () => set({ currentProject: null, error: null })
}))

export { useProjectsStore }
