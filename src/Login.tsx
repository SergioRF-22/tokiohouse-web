import { useState, type FormEvent } from 'react'
import * as api from './api'
import type { User } from './api'

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      onLogin(await api.login(String(f.get('username')), String(f.get('password'))))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setBusy(false)
    }
  }

  return (
    <main className="screen center">
      <form onSubmit={submit} className="card">
        <h1>TokioHouse</h1>
        <input name="username" placeholder="Usuario" autoComplete="username" autoCapitalize="none" required />
        <input name="password" type="password" placeholder="Contraseña" autoComplete="current-password" required />
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  )
}
