'use client'
import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastData {
  id: string
  type: ToastType
  title: string
  message?: string
  detail?: string   // baris ketiga, misal: "Total: Rp 1.850.000"
  duration?: number // ms, default 4000
}

interface ToastProps {
  toasts: ToastData[]
  onRemove: (id: string) => void
}

const CONFIG: Record<ToastType, { icon: string; accent: string; bg: string; border: string }> = {
  success: {
    icon: '✅',
    accent: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.35)',
  },
  error: {
    icon: '❌',
    accent: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.35)',
  },
  warning: {
    icon: '⚠️',
    accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.35)',
  },
  info: {
    icon: 'ℹ️',
    accent: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.35)',
  },
}

function ToastItem({ toast, onRemove }: { toast: ToastData; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const cfg = CONFIG[toast.type]
  const duration = toast.duration ?? 4000

  useEffect(() => {
    // mount animation
    const t1 = setTimeout(() => setVisible(true), 10)
    // auto dismiss
    const t2 = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(toast.id), 350)
    }, duration)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [toast.id, duration, onRemove])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        background: '#1e293b',
        border: `1px solid ${cfg.border}`,
        borderLeft: `4px solid ${cfg.accent}`,
        borderRadius: 12,
        padding: '14px 16px',
        minWidth: 300,
        maxWidth: 400,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 350) }}
    >
      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 14,
          color: '#f1f5f9',
          marginBottom: toast.message || toast.detail ? 3 : 0,
          lineHeight: 1.3,
        }}>
          {toast.title}
        </div>
        {toast.message && (
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.4 }}>
            {toast.message}
          </div>
        )}
        {toast.detail && (
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: cfg.accent,
            marginTop: 4,
            padding: '3px 8px',
            background: cfg.bg,
            borderRadius: 5,
            display: 'inline-block',
          }}>
            {toast.detail}
          </div>
        )}
      </div>

      {/* Close hint */}
      <div style={{ fontSize: 16, color: '#475569', flexShrink: 0, marginTop: 1 }}>×</div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 3, borderRadius: '0 0 12px 12px',
        background: cfg.bg, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          background: cfg.accent,
          animation: `toast-progress ${duration}ms linear forwards`,
        }} />
      </div>

      <style jsx>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  )
}

export default function ToastContainer({ toasts, onRemove }: ToastProps) {
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}
