import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'warning'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

let addToastFn: ((message: string, type: ToastType) => void) | null = null

export function showToast(message: string, type: ToastType = 'error') {
  addToastFn?.(message, type)
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-600/90 border-green-400/30 text-green-100',
  error: 'bg-red-600/90 border-red-400/30 text-red-100',
  warning: 'bg-yellow-600/90 border-yellow-400/30 text-yellow-100',
}

const typeIcons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
}

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    addToastFn = (message: string, type: ToastType) => {
      const id = Date.now()
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3000)
    }
    return () => {
      addToastFn = null
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm text-sm animate-[slideIn_0.3s_ease-out] ${typeStyles[toast.type]}`}
        >
          <span className="font-bold">{typeIcons[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
