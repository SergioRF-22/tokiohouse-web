import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import * as api from './api'
import type { Tarea } from './api'

const POLL_MS = 5000

const isTemp = (t: Tarea) => t.id < 0

function Card({ t, onRemove }: { t: Tarea; onRemove: (t: Tarea) => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: t.id })
  return (
    <li
      ref={setNodeRef}
      className={`item${isDragging ? ' dragging' : ''}`}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      <span className="item-text">
        <span className="item-name">{t.texto}</span>
        <small className="item-by">{t.creado_por}</small>
      </span>
      <button className="icon-btn" aria-label={`Borrar ${t.texto}`} onClick={() => onRemove(t)}>
        ✕
      </button>
    </li>
  )
}

export default function Tasks({ username }: { username: string }) {
  const [tareas, setTareas] = useState<Tarea[] | null>(null)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState('')

  // Evita que un refresco pise cambios optimistas en vuelo o un arrastre en curso.
  const seq = useRef(0)
  const pending = useRef(0)
  const dragging = useRef(false)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long-press corto: un toque con movimiento sigue siendo scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const load = useCallback(async () => {
    if (pending.current > 0 || dragging.current) return
    const s = seq.current
    try {
      const d = await api.getTareas()
      if (s !== seq.current || pending.current > 0 || dragging.current) return
      setTareas((prev) => (JSON.stringify(prev) === JSON.stringify(d.tareas) ? prev : d.tareas))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }, [])

  useEffect(() => {
    load()
    const tick = () => document.visibilityState === 'visible' && load()
    const id = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  async function mutate(optimistic: (d: Tarea[]) => Tarea[], call: () => Promise<unknown>) {
    seq.current++
    pending.current++
    setTareas((d) => d && optimistic(d))
    try {
      await call()
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      pending.current--
      if (pending.current === 0) load()
    }
  }

  function create(e: FormEvent) {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return
    const temp: Tarea = { id: -Date.now(), texto: t, posicion: tareas?.length ?? 0, creado_por: username }
    mutate((d) => [...d, temp], () => api.crearTarea(t))
    setTexto('')
  }

  const remove = (t: Tarea) => {
    if (isTemp(t)) return
    mutate((d) => d.filter((x) => x.id !== t.id), () => api.borrarTarea(t.id))
  }

  function onDragStart() {
    dragging.current = true
  }

  function onDragEnd(e: DragEndEvent) {
    dragging.current = false
    if (!tareas || !e.over || e.active.id === e.over.id) return
    const from = tareas.findIndex((t) => t.id === e.active.id)
    const to = tareas.findIndex((t) => t.id === e.over!.id)
    if (from < 0 || to < 0) return
    const moved = arrayMove(tareas, from, to)
    mutate(
      () => moved,
      () => api.ordenarTareas(moved.filter((t) => !isTemp(t)).map((t) => t.id)),
    )
  }

  const onDragCancel = () => {
    dragging.current = false
  }

  return (
    <section className="section">
      <h2>Tareas</h2>
      <form className="add-row" onSubmit={create}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nueva tarea" maxLength={200} aria-label="Nueva tarea" />
        <button aria-label="Añadir tarea">+</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {!tareas ? (
        !error && <p className="muted">Cargando…</p>
      ) : tareas.length === 0 ? (
        <p className="muted">No hay tareas. Añade la primera arriba.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
          <SortableContext items={tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ul className="items">
              {tareas.map((t) => (
                <Card key={t.id} t={t} onRemove={remove} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}
