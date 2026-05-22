import { useState, useCallback } from 'react'
import type { ToastData, ToastType } from '@/components/ui/Toast'

let _counter = 0

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const addToast = useCallback((data: Omit<ToastData, 'id'>) => {
    const id = `toast-${++_counter}`
    setToasts(prev => [...prev, { ...data, id }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  /** Shorthand helpers */
  const toast = {
    success: (title: string, message?: string, detail?: string) =>
      addToast({ type: 'success', title, message, detail }),
    error: (title: string, message?: string, detail?: string) =>
      addToast({ type: 'error', title, message, detail }),
    info: (title: string, message?: string, detail?: string) =>
      addToast({ type: 'info', title, message, detail }),
    warning: (title: string, message?: string, detail?: string) =>
      addToast({ type: 'warning', title, message, detail }),
  }

  return { toasts, removeToast, toast }
}
