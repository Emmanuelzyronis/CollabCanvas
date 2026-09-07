import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import clsx from 'clsx'

type TextRole = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'metadata' | 'code'
type TextElement = 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'label'

const gapClasses: Record<string, string> = { '1': 'gap-1', '2': 'gap-2', '3': 'gap-3', '4': 'gap-4', '5': 'gap-5', '6': 'gap-6', '8': 'gap-8', '10': 'gap-10', '12': 'gap-12' }
const itemClasses: Record<string, string> = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' }
const justifyClasses: Record<string, string> = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between' }
const columnClasses: Record<string, string> = { '1': 'grid-cols-1', '2': 'grid-cols-2', '3': 'grid-cols-3', '4': 'grid-cols-4', '5': 'grid-cols-5', '6': 'grid-cols-6', '12': 'grid-cols-12' }

const textRoleClasses: Record<TextRole, string> = {
  display: 'text-3xl font-semibold leading-tight tracking-tight',
  title: 'text-xl font-semibold leading-tight tracking-tight',
  heading: 'text-sm font-semibold leading-5',
  body: 'text-sm leading-6',
  label: 'text-xs font-medium leading-5',
  caption: 'text-xs leading-5',
  metadata: 'text-[11px] leading-4',
  code: 'font-mono text-xs leading-5',
}

export function Text({ role = 'body', as = 'p', muted = false, emphasis = false, className, children, ...props }: { role?: TextRole; as?: TextElement; muted?: boolean; emphasis?: boolean; className?: string; children?: ReactNode } & Omit<HTMLAttributes<HTMLElement>, 'className'> & { className?: string }) {
  const Element = as
  return <Element className={clsx(textRoleClasses[role], muted ? 'text-text-muted' : 'text-text-primary', emphasis && 'font-semibold', className)} {...props}>{children}</Element>
}

export function Stack({ gap = '4', direction = 'column', align, justify, className, children, ...props }: { gap?: string; direction?: 'column' | 'row'; align?: 'start' | 'center' | 'end' | 'stretch'; justify?: 'start' | 'center' | 'end' | 'between'; className?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('flex', direction === 'column' ? 'flex-col' : 'flex-row', gapClasses[gap] ?? gapClasses['4'], align && itemClasses[align], justify && justifyClasses[justify], className)} {...props}>{children}</div>
}

export function Inline({ gap = '2', align = 'center', justify, wrap = false, className, children, ...props }: { gap?: string; align?: 'start' | 'center' | 'end' | 'stretch'; justify?: 'start' | 'center' | 'end' | 'between'; wrap?: boolean; className?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('flex flex-row', gapClasses[gap] ?? gapClasses['2'], itemClasses[align], justify && justifyClasses[justify], wrap && 'flex-wrap', className)} {...props}>{children}</div>
}

export function Grid({ gap = '4', columns = '1', className, children, ...props }: { gap?: string; columns?: string; className?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('grid', columnClasses[columns] ?? columnClasses['1'], gapClasses[gap] ?? gapClasses['4'], className)} {...props}>{children}</div>
}

export function Divider({ orientation = 'horizontal', className, ...props }: { orientation?: 'horizontal' | 'vertical'; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" aria-orientation={orientation} className={clsx('shrink-0 bg-border-subtle', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)} {...props} />
}

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
type ControlSize = 'sm' | 'md' | 'lg'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-blue-700 disabled:bg-blue-300',
  secondary: 'border border-border-default bg-panel text-text-primary hover:bg-hover disabled:text-text-muted',
  quiet: 'text-text-secondary hover:bg-hover disabled:text-text-muted',
  danger: 'bg-error text-white hover:bg-red-600 disabled:bg-red-300',
}
const controlSizes: Record<ControlSize, string> = { sm: 'min-h-8 px-2.5 text-xs', md: 'min-h-9 px-3 text-sm', lg: 'min-h-10 px-4 text-sm' }

export function Button({ variant = 'secondary', size = 'md', loading = false, className, disabled, children, ...props }: { variant?: ButtonVariant; size?: ControlSize; loading?: boolean; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={clsx('inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors duration-[var(--cc-duration-fast)] ease-[var(--cc-ease-standard)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60', buttonVariants[variant], controlSizes[size], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading && <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />}{children}</button>
}

export function IconButton({ label, variant = 'quiet', size = 'md', className, ...props }: { label: string; variant?: ButtonVariant; size?: ControlSize; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button type="button" aria-label={label} title={label} variant={variant} size={size} className={clsx('aspect-square px-0', className)} {...props} />
}

export function Input({ invalid = false, className, ...props }: { invalid?: boolean; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('min-h-9 w-full rounded-control border bg-panel px-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted', invalid ? 'border-error' : 'border-border-default focus:border-focus', className)} aria-invalid={invalid || undefined} {...props} />
}

export function Select({ invalid = false, className, children, ...props }: { invalid?: boolean; className?: string; children?: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx('min-h-9 w-full rounded-control border bg-panel px-3 text-sm text-text-primary transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted', invalid ? 'border-error' : 'border-border-default focus:border-focus', className)} aria-invalid={invalid || undefined} {...props}>{children}</select>
}

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error'
const badgeTones: Record<BadgeTone, string> = { neutral: 'bg-surface text-text-secondary', accent: 'bg-blue-100 text-blue-700', success: 'bg-emerald-100 text-emerald-700', warning: 'bg-amber-100 text-amber-700', error: 'bg-red-100 text-red-700' }

export function Badge({ tone = 'neutral', className, children, ...props }: { tone?: BadgeTone; className?: string; children?: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return <span className={clsx('inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium leading-4', badgeTones[tone], className)} {...props}>{children}</span>
}

export function Status({ tone = 'neutral', label, className }: { tone?: BadgeTone; label: string; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1.5 text-xs text-text-secondary', className)}><span aria-hidden="true" className={clsx('h-1.5 w-1.5 rounded-full', tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : tone === 'error' ? 'bg-error' : tone === 'accent' ? 'bg-accent' : 'bg-text-muted')} />{label}</span>
}

export function Panel({ elevation = 'panel', className, children, ...props }: { elevation?: 'none' | 'subtle' | 'panel' | 'floating' | 'modal'; className?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const shadows = { none: 'shadow-none', subtle: 'shadow-subtle', panel: 'shadow-panel', floating: 'shadow-floating', modal: 'shadow-modal' }
  return <section className={clsx('rounded-panel border border-border-default bg-panel text-text-primary', shadows[elevation], className)} {...props}>{children}</section>
}

export function Card({ className, children, ...props }: { className?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('rounded-card border border-border-subtle bg-panel p-4 text-text-primary shadow-subtle', className)} {...props}>{children}</div>
}
