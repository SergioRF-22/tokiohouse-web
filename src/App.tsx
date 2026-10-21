import { useEffect, useState } from 'react'
import * as api from './api'
import type { User } from './api'
import Login from './Login'
import Home from './Home'

export default function App() {
  // undefined = comprobando sesión, null = sin sesión
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    api.me().then(setUser, () => setUser(null))
  }, [])

  if (user === undefined) return <main className="screen" aria-busy="true" />
  if (!user) return <Login onLogin={setUser} />
  return <Home user={user} onLogout={() => setUser(null)} />
}
