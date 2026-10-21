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

export type Producto = {
  id: number
  nombre: string
  categoria: string
  en_bolsa: boolean
  posicion: number | null
  comprado: boolean
}
export type Compra = { categorias: string[]; bolsa: Producto[]; lista: Producto[] }
export type NuevoProducto = { nombre: string; categoria: string; en_lista: boolean; en_bolsa: boolean }

export const getCompra = () => request<Compra>('/shopping')

export const crearProducto = (p: NuevoProducto) =>
  request<Producto>('/shopping', { method: 'POST', body: JSON.stringify(p) })

export const aLista = (id: number) => request<Producto>(`/shopping/${id}/lista`, { method: 'POST' })

export const quitarDeLista = (id: number) => request<unknown>(`/shopping/${id}/lista`, { method: 'DELETE' })

export const ordenarLista = (ids: number[]) =>
  request<unknown>('/shopping/lista/orden', { method: 'PUT', body: JSON.stringify({ ids }) })

export const aBolsa = (id: number) => request<Producto>(`/shopping/${id}/bolsa`, { method: 'POST' })

export const marcarComprado = (id: number, comprado: boolean) =>
  request<Producto>(`/shopping/${id}/comprado`, { method: 'PUT', body: JSON.stringify({ comprado }) })

export const terminarCompra = (accion: 'bolsa' | 'eliminar') =>
  request<{ afectados: number }>('/shopping/lista/terminar', { method: 'POST', body: JSON.stringify({ accion }) })

export const borrarProducto =(id: number) => request<unknown>(`/shopping/${id}`, { method: 'DELETE' })

export type Tarea = { id: number; texto: string; posicion: number; creado_por: string }

export const getTareas = () => request<{ tareas: Tarea[] }>('/tasks')

export const crearTarea = (texto: string) =>
  request<Tarea>('/tasks', { method: 'POST', body: JSON.stringify({ texto }) })

export const ordenarTareas = (ids: number[]) =>
  request<unknown>('/tasks/orden', { method: 'PUT', body: JSON.stringify({ ids }) })

export const borrarTarea = (id: number) => request<unknown>(`/tasks/${id}`, { method: 'DELETE' })
