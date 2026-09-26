import clsx from 'clsx'
import { useToasts, type ToastVariant } from '../hooks/use-toast'

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
}

const variantIcon: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'i',
}

const iconBg: Record<ToastVariant, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
}

export function ToastContainer() {
  const toasts = useToasts()
  if (toasts.length === 0) return null
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-6 right-4 z-[9999] flex flex-col gap-2 sm:right-6"
      style={{ maxWidth: 'min(22rem, calc(100vw - 2rem))' }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={clsx(
            'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-floating',
            variantStyles[t.variant],
          )}
        >
          <span
            aria-hidden="true"
            className={clsx(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
              iconBg[t.variant],
            )}
          >
            {variantIcon[t.variant]}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  )
}
