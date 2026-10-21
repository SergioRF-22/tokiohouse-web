import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import * as api from './api'
import type { Compra, Producto } from './api'

const POLL_MS = 5000
const LISTA = 'lista'

const sortId = (p: Producto) => `l-${p.id}`
const bagId = (p: Producto) => `b-${p.id}`
const isTemp = (p: Producto) => p.id < 0

// Los chips de la bolsa solo pueden soltarse en la lista; las tarjetas, entre ellas.
const collision: CollisionDetection = (args) => {
  const fromBag = String(args.active.id).startsWith('b-')
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => fromBag || c.id !== LISTA),
  })
}

function groupBy(items: Producto[], categorias: string[]) {
  return categorias
    .map((categoria) => ({ categoria, items: items.filter((p) => p.categoria === categoria) }))
    .filter((g) => g.items.length > 0)
}

function Card({ p, onRemove }: { p: Producto; onRemove: (p: Producto) => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: sortId(p) })
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
      <span className="item-name">{p.nombre}</span>
      <button className="icon-btn" aria-label={`Quitar ${p.nombre}`} onClick={() => onRemove(p)}>
        ✕
      </button>
    </li>
  )
}

function Chip({ p, dim, onAdd }: { p: Producto; dim: boolean; onAdd: (p: Producto) => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: bagId(p), disabled: dim })
  return (
    <button
      ref={setNodeRef}
      className={`chip${dim ? ' dim' : ''}${isDragging ? ' dragging' : ''}`}
      onClick={() => !dim && onAdd(p)}
      {...attributes}
      {...listeners}
    >
      {p.nombre}
    </button>
  )
}

function ListaZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: LISTA })
  return (
    <div ref={setNodeRef} className={`lista-zone${isOver ? ' over' : ''}`}>
      {children}
    </div>
  )
}

function Dialog({ p, onClose, onReturn, onDelete }: { p: Producto; onClose: () => void; onReturn: () => void; onDelete: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog card" role="dialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="dlg-title">{p.nombre}</h3>
        <p>¿Devolver a la bolsa o borrar del todo?</p>
        <button onClick={onReturn}>Devolver a la bolsa</button>
        <button className="danger" onClick={onDelete}>Borrar del todo</button>
        <button className="secondary" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

function Sheet({ categorias, onClose, onCreate }: { categorias: string[]; onClose: () => void; onCreate: (nombre: string, categoria: string, enBolsa: boolean) => void }) {
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('Otro')
  const [enBolsa, setEnBolsa] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    onCreate(nombre.trim(), categoria, enBolsa)
  }

  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()} aria-label="Nuevo producto">
        <h3>Nuevo producto</h3>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" maxLength={60} autoFocus required />
        <div className="chips" role="radiogroup" aria-label="Categoría">
          {categorias.map((c) => (
            <button type="button" key={c} role="radio" aria-checked={c === categoria} className={`chip pick${c === categoria ? ' on' : ''}`} onClick={() => setCategoria(c)}>
              {c}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={enBolsa} onChange={(e) => setEnBolsa(e.target.checked)} />
          Guardar en la bolsa
        </label>
        <button>Añadir a la lista</button>
      </form>
    </div>
  )
}

export default function Shopping() {
  const [data, setData] = useState<Compra | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<Producto | null>(null)
  const [sheet, setSheet] = useState(false)
  const [active, setActive] = useState<Producto | null>(null)

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
      const d = await api.getCompra()
      if (s !== seq.current || pending.current > 0 || dragging.current) return
      setData((prev) => (JSON.stringify(prev) === JSON.stringify(d) ? prev : d))
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

  async function mutate(optimistic: (d: Compra) => Compra, call: () => Promise<unknown>) {
    seq.current++
    pending.current++
    setData((d) => d && optimistic(d))
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

  const addToList = (p: Producto) => {
    if (isTemp(p)) return
    mutate(
      (d) => (d.lista.some((x) => x.id === p.id) ? d : { ...d, lista: [...d.lista, { ...p, posicion: d.lista.length }] }),
      () => api.aLista(p.id),
    )
  }

  const removeFromList = (p: Producto) => {
    if (isTemp(p)) return
    mutate((d) => ({ ...d, lista: d.lista.filter((x) => x.id !== p.id) }), () => api.quitarDeLista(p.id))
  }

  const onRemove = (p: Producto) => (p.en_bolsa ? setConfirm(p) : removeFromList(p))

  const deleteAll = (p: Producto) =>
    mutate(
      (d) => ({ ...d, bolsa: d.bolsa.filter((x) => x.id !== p.id), lista: d.lista.filter((x) => x.id !== p.id) }),
      () => api.borrarProducto(p.id),
    )

  const create = (nombre: string, categoria: string, enBolsa: boolean) => {
    const temp: Producto = { id: -Date.now(), nombre, categoria, en_bolsa: enBolsa, posicion: null }
    mutate(
      (d) => ({ ...d, bolsa: enBolsa ? [...d.bolsa, temp] : d.bolsa, lista: [...d.lista, { ...temp, posicion: d.lista.length }] }),
      () => api.crearProducto({ nombre, categoria, en_lista: true, en_bolsa: enBolsa }),
    )
    setSheet(false)
  }

  function onDragStart(e: DragStartEvent) {
    dragging.current = true
    const id = String(e.active.id)
    if (id.startsWith('b-')) setActive(data?.bolsa.find((p) => bagId(p) === id) ?? null)
  }

  function onDragEnd(e: DragEndEvent) {
    dragging.current = false
    setActive(null)
    if (!data || !e.over) return
    const from = String(e.active.id)
    const over = String(e.over.id)

    if (from.startsWith('b-')) {
      const p = data.bolsa.find((x) => bagId(x) === from)
      if (p) addToList(p)
      return
    }

    if (from === over || !over.startsWith('l-')) return
    const a = data.lista.find((p) => sortId(p) === from)
    const b = data.lista.find((p) => sortId(p) === over)
    if (!a || !b || a.categoria !== b.categoria) return

    const group = data.lista.filter((p) => p.categoria === a.categoria)
    const moved = arrayMove(group, group.indexOf(a), group.indexOf(b))
    // Los huecos de la categoría en la lista global se rellenan con el nuevo orden.
    let i = 0
    const lista = data.lista.map((p) => (p.categoria === a.categoria ? moved[i++] : p))
    mutate(
      (d) => ({ ...d, lista }),
      () => api.ordenarLista(lista.filter((p) => !isTemp(p)).map((p) => p.id)),
    )
  }

  const onDragCancel = () => {
    dragging.current = false
    setActive(null)
  }

  if (!data) {
    return (
      <section className="section">
        <h2>Compra</h2>
        {error ? <p className="error" role="alert">{error}</p> : <p className="muted">Cargando…</p>}
      </section>
    )
  }

  const enLista = new Set(data.lista.map((p) => p.id))
  const listaGroups = groupBy(data.lista, data.categorias)
  const bolsaGroups = groupBy(data.bolsa, data.categorias)

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <section className="section">
          <h2>Lista</h2>
          <ListaZone>
            {listaGroups.length === 0 && <p className="muted">Nada que comprar. Toca un producto de la bolsa o pulsa +.</p>}
            {listaGroups.map((g) => (
              <div key={g.categoria} className="group">
                <h3>{g.categoria}</h3>
                <SortableContext items={g.items.map(sortId)} strategy={verticalListSortingStrategy}>
                  <ul className="items">
                    {g.items.map((p) => (
                      <Card key={p.id} p={p} onRemove={onRemove} />
                    ))}
                  </ul>
                </SortableContext>
              </div>
            ))}
          </ListaZone>
        </section>

        <section className="section bolsa">
          <h2>Bolsa</h2>
          {bolsaGroups.length === 0 && <p className="muted">Aquí van los productos frecuentes. Crea uno con + y marca «Guardar en la bolsa».</p>}
          {bolsaGroups.map((g) => (
            <div key={g.categoria} className="group">
              <h3>{g.categoria}</h3>
              <div className="chips">
                {g.items.map((p) => (
                  <Chip key={p.id} p={p} dim={enLista.has(p.id)} onAdd={addToList} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <DragOverlay>{active ? <span className="chip overlay-chip">{active.nombre}</span> : null}</DragOverlay>
      </DndContext>

      <button className="fab" aria-label="Nuevo producto" onClick={() => setSheet(true)}>+</button>

      {sheet && <Sheet categorias={data.categorias} onClose={() => setSheet(false)} onCreate={create} />}
      {confirm && (
        <Dialog
          p={confirm}
          onClose={() => setConfirm(null)}
          onReturn={() => {
            removeFromList(confirm)
            setConfirm(null)
          }}
          onDelete={() => {
            deleteAll(confirm)
            setConfirm(null)
          }}
        />
      )}
    </>
  )
}
