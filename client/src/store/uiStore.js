import { create } from 'zustand'

const useUIStore = create((set) => ({
  modals: {},
  toasts: [],
  loadingStates: {},

  openModal: (modalName, payload = null) => set((state) => ({
    modals: { ...state.modals, [modalName]: { isOpen: true, payload } }
  })),

  closeModal: (modalName) => set((state) => ({
    modals: { ...state.modals, [modalName]: { isOpen: false, payload: null } }
  })),

  showToast: (toast) => set((state) => ({
    toasts: [
      ...state.toasts,
      {
        id: toast.id || Date.now(),
        type: toast.type || 'info',
        message: toast.message || '',
        duration: toast.duration || 4000
      }
    ]
  })),

  dismissToast: (id) => set((state) => ({
    toasts: state.toasts.filter((toast) => toast.id !== id)
  })),

  clearToasts: () => set({ toasts: [] }),

  setLoading: (key, value) => set((state) => ({
    loadingStates: { ...state.loadingStates, [key]: value }
  }))
}))

export { useUIStore }
