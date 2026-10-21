export type User = { id: number; username: string }

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)
  return data as T
}

export const login = (username: string, password: string) =>
  request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })

export const logout = () => request<unknown>('/auth/logout', { method: 'POST' })

export const me = () => request<User>('/auth/me')
