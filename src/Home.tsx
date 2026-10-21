import * as api from './api'
import type { User } from './api'

export default function Home({ user, onLogout }: { user: User; onLogout: () => void }) {
  async function out() {
    await api.logout().catch(() => {})
    onLogout()
  }

  return (
    <main className="screen">
      <h1>Hola, {user.username}</h1>
      <p>Próximamente…</p>
      <button className="secondary" onClick={out}>Cerrar sesión</button>
    </main>
  )
}
