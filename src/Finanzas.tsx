import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import * as api from './api'
import type { Categoria, GastoFijo, Movimiento, Tipo } from './api'
import FinPanel, { Seg } from './FinPanel'
import TrabajoPanel from './TrabajoPanel'
import { lastDay, mesLabel, shiftMes, today } from './fechas'

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
export const eur = (centimos: number) => euros.format(centimos / 100)

export const diaLabel =(fecha: string) =>
  new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10))),
  )

// "12,5" o "12.50" -> 1250 céntimos; null si no es un importe válido (> 0, máx. 2 decimales).
export function parseImporte(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const c = Math.round(Number(t) * 100)
  return c > 0 && Number.isSafeInteger(c) ? c : null
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Error')

export function Confirm({ title, text, action, onClose, onOk }: { title: string; text: string; action: string; onClose: () => void; onOk: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog card" role="dialog" aria-modal="true" aria-labelledby="conf-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="conf-title">{title}</h3>
        <p>{text}</p>
        <button className="danger" onClick={onOk}>{action}</button>
        <button className="secondary" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

function TrabajoSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={value} onChange={(e) => onChange(e.target.checked)} />
      Trabajo
    </label>
  )
}

// Chips de las categorías de un tipo + "+ Nueva" para crearla en línea.
export function CatPicker({ tipo, categorias, value, onPick, onCreate }: {
  tipo: Tipo
  categorias: Categoria[]
  value: number | null
  onPick: (id: number) => void
  onCreate: (tipo: Tipo, nombre: string) => Promise<Categoria>
}) {
  const [adding, setAdding] = useState(false)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')

  async function add() {
    const n = nombre.trim()
    if (!n) return
    try {
      onPick((await onCreate(tipo, n)).id)
      setAdding(false)
      setNombre('')
      setError('')
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <>
      <div className="chips" role="radiogroup" aria-label="Categoría">
        {categorias.map((c) => (
          <button type="button" key={c.id} role="radio" aria-checked={c.id === value} className={`chip pick${c.id === value ? ' on' : ''}`} onClick={() => onPick(c.id)}>
            {c.nombre}
          </button>
        ))}
        {!adding && <button type="button" className="chip new" onClick={() => setAdding(true)}>+ Nueva</button>}
      </div>
      {adding && (
        <div className="add-row">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="Nueva categoría"
            maxLength={40}
            aria-label="Nueva categoría"
            autoFocus
          />
          <button type="button" aria-label="Crear categoría" onClick={add}>✓</button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  )
}

function MovSheet({ tipo, categorias, onClose, onCreateCat, onSave }: {
  tipo: Tipo
  categorias: Categoria[]
  onClose: () => void
  onCreateCat: (tipo: Tipo, nombre: string) => Promise<Categoria>
  onSave: (m: api.NuevoMovimiento) => Promise<void>
}) {
  const [importe, setImporte] = useState('')
  const [cat, setCat] = useState<number | null>(null)
  const [fecha, setFecha] = useState(today)
  const [nota, setNota] = useState('')
  const [trabajo, setTrabajo] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const c = parseImporte(importe)
    if (c === null) return setError('Importe no válido (ej. 12,50)')
    if (cat === null) return setError('Elige una categoría')
    setBusy(true)
    try {
      await onSave({ tipo, importe_centimos: c, categoria_id: cat, fecha, nota: nota.trim() || undefined, trabajo })
    } catch (e) {
      setError(errMsg(e))
      setBusy(false)
    }
  }

  const titulo = tipo === 'gasto' ? 'Nuevo gasto' : 'Nuevo ingreso'
  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()} aria-label={titulo}>
        <h3>{titulo}</h3>
        <input className="amount" value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" placeholder="0,00 €" aria-label="Importe" autoFocus />
        <CatPicker tipo={tipo} categorias={categorias} value={cat} onPick={setCat} onCreate={onCreateCat} />
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" required />
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" maxLength={200} aria-label="Nota" />
        <TrabajoSwitch value={trabajo} onChange={setTrabajo} />
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>Guardar</button>
      </form>
    </div>
  )
}

function AportarSheet({ onClose, onSave }: {
  onClose: () => void
  onSave: (a: { importe_centimos: number; fecha: string; nota?: string }) => Promise<void>
}) {
  const [importe, setImporte] = useState('')
  const [fecha, setFecha] = useState(today)
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const c = parseImporte(importe)
    if (c === null) return setError('Importe no válido (ej. 12,50)')
    setBusy(true)
    try {
      await onSave({ importe_centimos: c, fecha, nota: nota.trim() || undefined })
    } catch (e) {
      setError(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()} aria-label="Aportar a casa">
        <h3>Aportar a casa</h3>
        <input className="amount" value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" placeholder="0,00 €" aria-label="Importe" autoFocus />
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" required />
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" maxLength={200} aria-label="Nota" />
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>Guardar</button>
      </form>
    </div>
  )
}

function FijoSheet({ categorias, mes, onClose, onCreateCat, onSave }: {
  categorias: Categoria[]
  mes: string
  onClose: () => void
  onCreateCat: (tipo: Tipo, nombre: string) => Promise<Categoria>
  onSave: (g: api.NuevoGastoFijo) => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [importe, setImporte] = useState('')
  const [cat, setCat] = useState<number | null>(null)
  const [dia, setDia] = useState('1')
  const [trabajo, setTrabajo] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const c = parseImporte(importe)
    const d = Number(dia)
    if (!nombre.trim()) return setError('Pon un nombre')
    if (c === null) return setError('Importe no válido (ej. 12,50)')
    if (cat === null) return setError('Elige una categoría')
    if (!Number.isInteger(d) || d < 1 || d > 28) return setError('El día debe estar entre 1 y 28')
    setBusy(true)
    try {
      await onSave({ nombre: nombre.trim(), importe_centimos: c, categoria_id: cat, dia: d, mes_inicio: mes, trabajo })
    } catch (e) {
      setError(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()} aria-label="Nuevo gasto fijo">
        <h3>Nuevo gasto fijo</h3>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Alquiler)" maxLength={60} aria-label="Nombre" autoFocus />
        <input className="amount" value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" placeholder="0,00 €" aria-label="Importe" />
        <CatPicker tipo="gasto" categorias={categorias} value={cat} onPick={setCat} onCreate={onCreateCat} />
        <label className="field">
          Día del mes (1-28)
          <input type="number" min={1} max={28} value={dia} onChange={(e) => setDia(e.target.value)} inputMode="numeric" />
        </label>
        <TrabajoSwitch value={trabajo} onChange={setTrabajo} />
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>Añadir gasto fijo</button>
      </form>
    </div>
  )
}

type Pending = { kind: 'mov'; m: Movimiento } | { kind: 'fijo'; g: GastoFijo }

export default function Finanzas() {
  const [mes, setMes] = useState(() => today().slice(0, 7))
  const [movs, setMovs] = useState<Movimiento[] | null>(null)
  const [totales, setTotales] = useState({ ingresos: 0, gastos: 0 })
  const [fijos, setFijos] = useState<GastoFijo[]>([])
  const [cats, setCats] = useState<Categoria[]>([])
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState<Tipo | null>(null)
  const [fijoSheet, setFijoSheet] = useState(false)
  const [aportarSheet, setAportarSheet] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [vista, setVista] = useState<'personal' | 'trabajo'>('personal')

  // Descarta respuestas de un mes que ya no es el visible.
  const seq = useRef(0)

  const load = useCallback(async () => {
    const s = ++seq.current
    const desde = `${mes}-01`
    const hasta = lastDay(mes)
    try {
      // Movimientos primero: el servidor materializa los gastos fijos al pedirlos.
      const m = await api.getMovimientos(desde, hasta)
      const [r, f, c] = await Promise.all([api.getResumen(desde, hasta), api.getGastosFijos(), api.getCategorias()])
      if (s !== seq.current) return
      setMovs(m.movimientos)
      setTotales(r.por_mes.find((x) => x.mes === mes) ?? { ingresos: 0, gastos: 0 })
      setFijos(f.gastos_fijos)
      setCats(c.categorias)
      setError('')
    } catch (e) {
      if (s === seq.current) setError(errMsg(e))
    }
  }, [mes])

  useEffect(() => {
    setMovs(null)
    load()
  }, [load])

  async function createCat(tipo: Tipo, nombre: string) {
    const c = await api.crearCategoria(tipo, nombre)
    setCats((prev) => [...prev, c])
    return c
  }

  async function saveMov(m: api.NuevoMovimiento) {
    await api.crearMovimiento(m)
    setSheet(null)
    // Si la fecha cae en otro mes, se salta a él para ver el movimiento recién creado.
    const destino = m.fecha.slice(0, 7)
    if (destino === mes) await load()
    else setMes(destino)
  }

  async function saveAportar(a: { importe_centimos: number; fecha: string; nota?: string }) {
    await api.aportarCasa(a)
    setAportarSheet(false)
    const destino = a.fecha.slice(0, 7)
    if (destino === mes) await load()
    else setMes(destino)
  }

  async function saveFijo(g: api.NuevoGastoFijo) {
    await api.crearGastoFijo(g)
    setFijoSheet(false)
    await load()
  }

  async function confirmPending() {
    const p = pending
    setPending(null)
    if (!p) return
    try {
      if (p.kind === 'mov') await api.borrarMovimiento(p.m.id)
      else await api.quitarGastoFijo(p.g.id)
    } catch (e) {
      setError(errMsg(e))
    }
    await load()
  }

  const dias: { fecha: string; items: Movimiento[] }[] = []
  for (const m of (vista === 'trabajo' ? movs?.filter((x) => x.trabajo === 1) : movs) ?? []) {
    const last = dias[dias.length - 1]
    if (last?.fecha === m.fecha) last.items.push(m)
    else dias.push({ fecha: m.fecha, items: [m] })
  }
  const balance = totales.ingresos - totales.gastos

  const monthNav = (
    <div className="month-nav">
      <button className="icon-btn" aria-label="Mes anterior" onClick={() => setMes(shiftMes(mes, -1))}>‹</button>
      <strong className="month-label" aria-live="polite">{mesLabel(mes)}</strong>
      <button className="icon-btn" aria-label="Mes siguiente" onClick={() => setMes(shiftMes(mes, 1))}>›</button>
    </div>
  )
  const acciones = (
    <div className="big-actions">
      <button className="big gasto-btn" onClick={() => setSheet('gasto')}>+ Gasto</button>
      <button className="big ingreso-btn" onClick={() => setSheet('ingreso')}>+ Ingreso</button>
      {vista === 'personal' && <button className="big secondary aportar-btn" onClick={() => setAportarSheet(true)}>Aportar a casa</button>}
    </div>
  )
  const lista = (
    <section className="section">
      <h2>Movimientos</h2>
      {!movs ? (
        !error && <p className="muted">Cargando…</p>
      ) : dias.length === 0 ? (
        <p className="muted">Sin movimientos este mes.</p>
      ) : (
        dias.map((d) => (
          <div key={d.fecha} className="day">
            <h3>{diaLabel(d.fecha)}</h3>
            <ul className="items">
              {d.items.map((m) => (
                <li key={m.id} className={`item mov ${m.tipo}`}>
                  <span className="item-text">
                    <span className="item-name">
                      {m.gasto_fijo_id !== null && <span className="fijo-icon" role="img" aria-label="Gasto fijo" title="Gasto fijo">↻ </span>}
                      {m.categoria}
                      {m.trabajo === 1 && <span className="tag-work">work</span>}
                      {m.tipo === 'gasto' && m.categoria === 'Casa' && <span className="tag-work">casa</span>}
                    </span>
                    {m.nota && <small className="item-by">{m.nota}</small>}
                  </span>
                  <strong className={`amt ${m.tipo}`}>{m.tipo === 'gasto' ? '−' : '+'}{eur(m.importe_centimos)}</strong>
                  <button className="icon-btn" aria-label={`Borrar ${m.categoria} ${eur(m.importe_centimos)}`} onClick={() => setPending({ kind: 'mov', m })}>✕</button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )

  return (
    <>
      <section className="section">
        <h2>Mis finanzas</h2>
        <Seg options={[['personal', 'Personal'], ['trabajo', 'Trabajo']]} value={vista} onChange={setVista} />
        {vista === 'trabajo' && acciones}
        {vista === 'personal' && monthNav}
        {vista === 'personal' && <div className="totals card">
          <div><small>Ingresos</small><strong className="ingreso">{eur(totales.ingresos)}</strong></div>
          <div><small>Gastos</small><strong className="gasto">{eur(totales.gastos)}</strong></div>
          <div><small>Balance</small><strong className={balance < 0 ? 'gasto' : 'ingreso'}>{eur(balance)}</strong></div>
        </div>}
        {vista === 'personal' && acciones}
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      {vista === 'trabajo' ? (
        <>
          <TrabajoPanel mes={mes} cats={cats} movsMes={movs} refresh={movs} />
          <section className="section">{monthNav}</section>
          {lista}
        </>
      ) : (
        <FinPanel mes={mes} cats={cats} refresh={movs} />
      )}

      {vista === 'personal' && lista}

      {vista === 'personal' && <section className="section">
        <div className="section-head">
          <h2>Gastos fijos</h2>
          <button className="shop-go" onClick={() => setFijoSheet(true)}>+ Añadir</button>
        </div>
        {fijos.length === 0 ? (
          <p className="muted">Sin gastos fijos. Se apuntan solos cada mes.</p>
        ) : (
          <ul className="items">
            {fijos.map((g) => (
              <li key={g.id} className="item mov gasto">
                <span className="item-text">
                  <span className="item-name">{g.nombre}{g.trabajo === 1 && <span className="tag-work">work</span>}</span>
                  <small className="item-by">{eur(g.importe_centimos)} · día {g.dia} · {g.categoria}</small>
                </span>
                <button className="secondary quitar" onClick={() => setPending({ kind: 'fijo', g })}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </section>}

      {sheet && <MovSheet tipo={sheet} categorias={cats.filter((c) => c.tipo === sheet)} onClose={() => setSheet(null)} onCreateCat={createCat} onSave={saveMov} />}
      {aportarSheet && <AportarSheet onClose={() => setAportarSheet(false)} onSave={saveAportar} />}
      {fijoSheet && <FijoSheet categorias={cats.filter((c) => c.tipo === 'gasto')} mes={today().slice(0, 7)} onClose={() => setFijoSheet(false)} onCreateCat={createCat} onSave={saveFijo} />}
      {pending?.kind === 'mov' && (
        <Confirm
          title="Borrar movimiento"
          text={`¿Borrar ${pending.m.categoria} de ${eur(pending.m.importe_centimos)}?`}
          action="Borrar"
          onClose={() => setPending(null)}
          onOk={confirmPending}
        />
      )}
      {pending?.kind === 'fijo' && (
        <Confirm
          title="Quitar gasto fijo"
          text={`¿Quitar «${pending.g.nombre}»? No se generarán más meses; lo ya apuntado se queda.`}
          action="Quitar"
          onClose={() => setPending(null)}
          onOk={confirmPending}
        />
      )}
    </>
  )
}
