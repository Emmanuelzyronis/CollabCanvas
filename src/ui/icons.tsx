import type { SVGProps } from 'react'

type IconName =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'text'
  | 'sticky'
  | 'frame'
  | 'connector'
  | 'comment'
  | 'undo'
  | 'redo'
  | 'zoomIn'
  | 'zoomOut'
  | 'fit'
  | 'trash'
  | 'duplicate'
  | 'group'
  | 'ungroup'
  | 'front'
  | 'back'
  | 'alignLeft'
  | 'alignCenterX'
  | 'alignRight'
  | 'alignTop'
  | 'alignCenterY'
  | 'alignBottom'
  | 'grid'
  | 'sparkles'
  | 'download'
  | 'send'
  | 'bot'
  | 'check'
  | 'close'
  | 'lock'
  | 'unlock'

const PATHS: Record<IconName, JSX.Element> = {
  select: <path d="M5 3l14 6-6 2-2 6-6-14z" />,
  hand: <path d="M8 11V5.5a1.5 1.5 0 013 0V10m0 0V4.5a1.5 1.5 0 013 0V10m0 0V6.5a1.5 1.5 0 013 0V13a6 6 0 01-6 6h-1.5a5 5 0 01-4-2l-3-4a1.5 1.5 0 012.4-1.8L8 12" />,
  rectangle: <rect x="4" y="6" width="16" height="12" rx="2" />,
  ellipse: <ellipse cx="12" cy="12" rx="8" ry="6" />,
  diamond: <path d="M12 3l9 9-9 9-9-9 9-9z" />,
  text: <path d="M6 5h12M12 5v14M9 19h6" />,
  sticky: <path d="M5 4h14v10l-5 5H5V4zM14 19v-5h5" />,
  frame: <path d="M8 3v18M16 3v18M3 8h18M3 16h18" />,
  connector: <path d="M4 8h9a4 4 0 014 4v0M17 12l3-2m-3 2l3 2M4 8l2-2M4 8l2 2" />,
  comment: <path d="M5 5h14v10H9l-4 4V5z" />,
  undo: <path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-1" />,
  redo: <path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h1" />,
  zoomIn: <><circle cx="11" cy="11" r="7" /><path d="M11 8v6M8 11h6M20 20l-3.5-3.5" /></>,
  zoomOut: <><circle cx="11" cy="11" r="7" /><path d="M8 11h6M20 20l-3.5-3.5" /></>,
  fit: <path d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  duplicate: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></>,
  group: <path d="M4 8V4h4M4 16v4h4M20 8V4h-4M20 16v4h-4M8 8h8v8H8z" />,
  ungroup: <path d="M3 6V3h3M3 14v3h3M11 6V3H8M11 14v3H8M8 8h8v8M16 11h5v10H11v-5" />,
  front: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 14V6a2 2 0 012-2h8" /></>,
  back: <><rect x="4" y="4" width="12" height="12" rx="2" /><path d="M20 10v8a2 2 0 01-2 2h-8" /></>,
  alignLeft: <path d="M4 4v16M8 8h9M8 16h6" />,
  alignCenterX: <path d="M12 4v16M7 8h10M9 16h6" />,
  alignRight: <path d="M20 4v16M7 8h9M11 16h6" />,
  alignTop: <path d="M4 4h16M8 8v9M16 8v6" />,
  alignCenterY: <path d="M4 12h16M8 7v10M16 9v6" />,
  alignBottom: <path d="M4 20h16M8 7v9M16 11v6" />,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  sparkles: <path d="M12 3l1.8 4.7L18 9.5l-4.2 1.8L12 16l-1.8-4.7L6 9.5l4.2-1.8L12 3zM18 15l.9 2.3L21 18l-2.1.7L18 21l-.9-2.3L15 18l2.1-.7L18 15z" />,
  download: <path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" />,
  send: <path d="M4 12l16-8-6 16-3-6-7-2z" />,
  bot: <><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 4v4M8 13h.01M16 13h.01M9 17h6" /></>,
  check: <path d="M5 12l5 5L20 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  unlock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 017-2.6" /></>,
}

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {PATHS[name]}
    </svg>
  )
}

export type { IconName }
