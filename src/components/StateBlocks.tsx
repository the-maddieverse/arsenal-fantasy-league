import type { ReactNode } from 'react'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="state-card">{label}</div>
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state-card state-card-error">{message}</div>
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="state-card">
      <p>{title}</p>
      {action}
    </div>
  )
}
