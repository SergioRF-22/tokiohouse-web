import { useEffect, useState, type ReactNode } from 'react'
import * as api from './api'
import type { User } from './api'
import Finanzas from './Finanzas'
import Shopping from './Shopping'
import Tasks from './Tasks'

type Tab = { id: string; label: string; icon: ReactNode; soon: boolean; text: string }

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

const TABS: Tab[] = [
  {
    id: 'compra',
    label: 'Compra',
    soon: false,
    text: 'Aquí irá la lista de la compra.',
    icon: svg(<><path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>),
  },
  {
    id: 'tareas',
    label: 'Tareas',
    soon: false,
    text: 'Aquí irán las tareas de la casa.',
    icon: svg(<><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8.5 12.2 2.4 2.4 4.6-5" /></>),
  },
  {
    id: 'casa',
    label: 'Finanzas casa',
    soon: true,
    text: 'Los gastos compartidos de la casa.',
    icon: svg(<><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></>),
  },
  {
    id: 'mias',
    label: 'Mis finanzas',
    soon: false,
    text: 'Tus finanzas personales.',
    icon: svg(<><rect x="3.5" y="6" width="17" height="13" rx="3" /><path d="M3.5 10h17" /><circle cx="16.5" cy="14.5" r="1" /></>),
  },
]

const current = () => TABS.find((t) => t.id === location.hash.slice(1)) ?? TABS[0]

export default function Home({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab] = useState(current)
  const [confirmOut, setConfirmOut] = useState(false)

  useEffect(() => {
    const onHash = () => setTab(current())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  async function out() {
    await api.logout().catch(() => {})
    onLogout()
  }

  return (
    <>
      <main className="app-main">
        {tab.id === 'compra' ? (
          <Shopping />
        ) : tab.id === 'tareas' ? (
          <Tasks username={user.username} />
        ) : tab.id === 'mias' ? (
          <Finanzas />
        ) : (
          <section className="section">
            <h2>{tab.label}</h2>
            <div className="card">
              {tab.soon ? <span className="badge">Próximamente</span> : null}
              <p>{tab.text}</p>
            </div>
          </section>
        )}
      </main>

      <nav className="tabbar" aria-label="Secciones">
        {TABS.map((t) => (
          <a key={t.id} href={`#${t.id}`} aria-current={t.id === tab.id ? 'page' : undefined}>
            {t.icon}
            {t.label}
          </a>
        ))}
        <button className="tab-logout" aria-label="Salir" title="Salir" onClick={() => setConfirmOut(true)}>
          {svg(<><path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" /><path d="M15 8l4 4-4 4" /><path d="M19 12H9.5" /></>)}
        </button>
      </nav>

      {confirmOut && (
        <div className="overlay" onClick={() => setConfirmOut(false)}>
          <div className="dialog card" role="dialog" aria-modal="true" aria-labelledby="out-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="out-title">Cerrar sesión</h3>
            <p>¿Seguro que quieres salir?</p>
            <button className="danger" onClick={out}>Salir</button>
            <button className="secondary" onClick={() => setConfirmOut(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </>
  )
}
