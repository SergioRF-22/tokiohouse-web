import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import * as api from './api'
import type { Categoria, GastoFijoCasa, MovimientoCasa, Tipo } from './api'
import { CatPicker, Confirm, diaLabel, eur, errMsg, parseImporte } from './Finanzas'
import { mesCorto, mesLabel, shiftMes, today } from './fechas'
import { BarChart, Donut, LineChart, fmtEur, type BarGroup } from './charts'
import { Empty, Fold, Kpi, catColor } from './FinPanel'

type CreateCat = (tipo: Tipo, nombre: string) => Promise<Categoria>

function MovSheet({ tipo, categorias, onClose, onCreateCat, onSave }: {
  tipo: Tipo
  categorias: Categoria[]
  onClose: () => void
  onCreateCat: CreateCat
  onSave: (m: Omit<api.NuevoMovimiento, 'trabajo'>) => Promise<void>
}) {
  const [importe, setImporte] = useState('')
  const [cat, setCat] = useState<number | null>(null)
  const [fecha, setFecha] = useState(today)
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const c = parseImporte(importe)
    if (c === null) return setError('Importe no válido (ej. 12,50)')
    if (cat === null) return setError('Elige una categoría')
    setBusy(true)
    try {
      await onSave({ tipo, importe_centimos: c, categoria_id: cat, fecha, nota: nota.trim() || undefined })
    } catch (e) {
      setError(errMsg(e))
      setBusy(false)
    }
  }

  const titulo = tipo === 'gasto' ? 'Nuevo gasto de la casa' : 'Nuevo ingreso de la casa'
  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()} aria-label={titulo}>
        <h3>{titulo}</h3>
        <input className="amount" value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" placeholder="0,00 €" aria-label="Importe" autoFocus />
        <CatPicker tipo={tipo} categorias={categorias} value={cat} onPick={setCat} onCreate={onCreateCat} />
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" required />
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" maxLength={200} aria-label="Nota" />
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>Guardar</button>
      </form>
    </div>
  )
}

function FijoSheet({ categorias, onClose, onCreateCat, onSave }: {
  categorias: Categoria[]
  onClose: () => void
  onCreateCat: CreateCat
  onSave: (g: Omit<api.NuevoGastoFijo, 'trabajo'>) => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [importe, setImporte] = useState('')
  const [cat, setCat] = useState<number | null>(null)
  const [dia, setDia] = useState('1')
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
      await onSave({ nombre: nombre.trim(), importe_centimos: c, categoria_id: cat, dia: d, mes_inicio: today().slice(0, 7) })
    } catch (e) {
      setError(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()} aria-label="Nuevo gasto fijo de la casa">
        <h3>Nuevo gasto fijo</h3>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Alquiler)" maxLength={60} aria-label="Nombre" autoFocus />
        <input className="amount" value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" placeholder="0,00 €" aria-label="Importe" />
        <CatPicker tipo="gasto" categorias={categorias} value={cat} onPick={setCat} onCreate={onCreateCat} />
        <label className="field">
          Día del mes (1-28)
          <input type="number" min={1} max={28} value={dia} onChange={(e) => setDia(e.target.value)} inputMode="numeric" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>Añadir gasto fijo</button>
      </form>
    </div>
  )
}

// El saldo inicial puede ser negativo, así que admite signo.
function parseSaldo(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null
  const c = Math.round(Number(t) * 100)
  return Number.isSafeInteger(c) ? c : null
}

function SaldoSheet({ actual, onClose, onSave }: { actual: number; onClose: () => void; onSave: (c: number) => Promise<void> }) {
  const [valor, setValor] = useState(() => String(actual / 100).replace('.', ','))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const c = parseSaldo(valor)
    if (c === null) return setError('Importe no válido (ej. 1500,00)')
    setBusy(true)
    try {
      await onSave(c)
    } catch (e) {
      setError(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()} aria-label="Saldo inicial">
        <h3>Saldo inicial</h3>
        <p className="muted">Lo que había en la cuenta de la casa antes de apuntar nada.</p>
        <input className="amount" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00 €" aria-label="Saldo inicial" autoFocus />
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>Guardar</button>
      </form>
    </div>
  )
}

const C_ING_BAR = '#9ED6B9'
const C_GAS_BAR = '#F29B90'
const C_PERSONAS = ['#9EC5E8', '#E8B4D6', '#C9B8E8', '#E8D49E']

function CasaCharts({ refresh }: { refresh: unknown }) {
  const [anio, setAnio] = useState(() => today().slice(0, 4))
  const [r, setR] = useState<api.ResumenCasa | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    // `refresh` cambia cada vez que Casa recarga (alta/baja de movimientos).
    const s = ++seq.current
    api.getCasaResumen(anio).then((x) => s === seq.current && setR(x)).catch(() => {})
  }, [anio, refresh])

  const cambiar = (d: number) => {
    setR(null)
    setAnio(String(Number(anio) + d))
  }

  const personas = (r?.aportaciones_anio ?? []).map((p, i) => ({
    id: String(p.usuario_id ?? 'x'),
    label: p.usuario ?? 'Sin usuario',
    color: C_PERSONAS[i % C_PERSONAS.length],
    total: p.total,
  }))
  const totalAport = personas.reduce((a, p) => a + p.total, 0)
  const aportGroups: BarGroup[] = (r?.por_mes ?? []).map((m) => ({
    label: mesCorto(m.mes).slice(0, 3),
    title: mesLabel(m.mes),
    bars: personas.map((p) => ({
      id: p.id,
      value: r!.aportaciones.find((a) => String(a.usuario_id ?? 'x') === p.id && a.mes === m.mes)?.total ?? 0,
    })),
  }))
  const hayMov = !!r && r.por_mes.some((m) => m.ingresos + m.gastos > 0)

  return (
    <section className="section">
      <h2>Gráficas</h2>
      <div className="month-nav">
        <button className="icon-btn" aria-label="Año anterior" onClick={() => cambiar(-1)}>‹</button>
        <strong className="month-label" aria-live="polite">{anio}</strong>
        <button className="icon-btn" aria-label="Año siguiente" onClick={() => cambiar(1)}>›</button>
      </div>
      {!r ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="fin-panel">
          <div className="kpis" role="list">
            <Kpi label={`Gasto ${anio}`} value={fmtEur(r.gasto_anio)} />
            <Kpi label="Fijos al mes" value={fmtEur(r.fijos_mensual_total)} />
            <Kpi label="Colchón" value={r.meses_colchon === null ? '—' : `${String(r.meses_colchon).replace('.', ',')} meses`} tone={r.meses_colchon !== null && r.meses_colchon < 0 ? 'bad' : undefined} />
            <Kpi label="Aportación sugerida" value={fmtEur(r.aportacion_sugerida_persona)} sub="por persona al mes" />
          </div>

          <Fold title="Ingresos y gastos por mes">
            {hayMov ? (
              <BarChart
                label={`Ingresos y gastos por mes de ${anio}`}
                groups={r.por_mes.map((m) => ({ label: mesCorto(m.mes).slice(0, 3), title: mesLabel(m.mes), bars: [{ id: 'ing', value: m.ingresos }, { id: 'gas', value: m.gastos }] }))}
                bars={[{ id: 'ing', label: 'Ingresos', color: C_ING_BAR }, { id: 'gas', label: 'Gastos', color: C_GAS_BAR }]}
              />
            ) : (
              <Empty>Sin movimientos en {anio}.</Empty>
            )}
          </Fold>

          <Fold title="Saldo al cierre de cada mes">
            <LineChart
              label={`Saldo al cierre de cada mes de ${anio}`}
              n={r.por_mes.length}
              xEvery={2}
              xLabel={(i) => mesCorto(r.por_mes[i].mes).slice(0, 3)}
              xTitle={(i) => mesLabel(r.por_mes[i].mes)}
              series={[{ id: 'saldo', label: 'Saldo', color: 'var(--fg)', values: r.por_mes.map((m) => m.saldo_cierre), area: true }]}
            />
          </Fold>

          <Fold title="Gastos por categoría">
            {r.por_categoria.length ? (
              <Donut
                key={anio}
                slices={r.por_categoria.map((c, i) => ({ id: String(c.categoria_id), label: c.categoria, value: c.total, color: catColor(i) }))}
                label={`Gastos de la casa de ${anio} por categoría`}
              />
            ) : (
              <Empty>Sin gastos en {anio}.</Empty>
            )}
          </Fold>

          <Fold title="Aportaciones por persona">
            {totalAport > 0 ? (
              <>
                <BarChart label={`Aportaciones por mes y persona de ${anio}`} groups={aportGroups} bars={personas} />
                <p className="ch-note">
                  Total {anio}: <strong>{fmtEur(totalAport)}</strong>
                  {personas.map((p) => ` · ${p.label} ${fmtEur(p.total)} (${Math.round((p.total / totalAport) * 100)} %)`)}
                </p>
              </>
            ) : (
              <Empty>Sin aportaciones en {anio}.</Empty>
            )}
          </Fold>
        </div>
      )}
    </section>
  )
}

type Pending = { kind: 'mov'; m: MovimientoCasa } | { kind: 'fijo'; g: GastoFijoCasa }

export default function Casa() {
  const [mes, setMes] = useState(() => today().slice(0, 7))
  const [movs, setMovs] = useState<MovimientoCasa[] | null>(null)
  const [resumen, setResumen] = useState<api.ResumenCasa | null>(null)
  const [fijos, setFijos] = useState<GastoFijoCasa[]>([])
  const [cats, setCats] = useState<Categoria[]>([])
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState<Tipo | null>(null)
  const [fijoSheet, setFijoSheet] = useState(false)
  const [saldoSheet, setSaldoSheet] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)

  // Descarta respuestas de un mes que ya no es el visible.
  const seq = useRef(0)

  const load = useCallback(async () => {
    const s = ++seq.current
    try {
      // Movimientos primero: el servidor materializa los gastos fijos al pedirlos.
      const m = await api.getCasaMovimientos(mes)
      const [r, f, c] = await Promise.all([api.getCasaResumen(), api.getCasaGastosFijos(), api.getCasaCategorias()])
      if (s !== seq.current) return
      setMovs(m.movimientos)
      setResumen(r)
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
    const c = await api.crearCasaCategoria(tipo, nombre)
    setCats((prev) => [...prev, c])
    return c
  }

  async function saveMov(m: Omit<api.NuevoMovimiento, 'trabajo'>) {
    await api.crearCasaMovimiento(m)
    setSheet(null)
    // Si la fecha cae en otro mes, se salta a él para ver el movimiento recién creado.
    const destino = m.fecha.slice(0, 7)
    if (destino === mes) await load()
    else setMes(destino)
  }

  async function saveFijo(g: Omit<api.NuevoGastoFijo, 'trabajo'>) {
    await api.crearCasaGastoFijo(g)
    setFijoSheet(false)
    await load()
  }

  async function saveSaldo(c: number) {
    await api.setCasaSaldoInicial(c)
    setSaldoSheet(false)
    await load()
  }

  async function confirmPending() {
    const p = pending
    setPending(null)
    if (!p) return
    try {
      if (p.kind === 'mov') await api.borrarCasaMovimiento(p.m.id)
      else await api.quitarCasaGastoFijo(p.g.id)
    } catch (e) {
      setError(errMsg(e))
    }
    await load()
  }

  const dias: { fecha: string; items: MovimientoCasa[] }[] = []
  for (const m of movs ?? []) {
    const last = dias[dias.length - 1]
    if (last?.fecha === m.fecha) last.items.push(m)
    else dias.push({ fecha: m.fecha, items: [m] })
  }

  return (
    <>
      <section className="section">
        <h2>Finanzas de la casa</h2>
        <div className="work-kpis">
          <div className="work-kpi card">
            <small>Saldo actual</small>
            <strong className={resumen && resumen.saldo_actual < 0 ? 'gasto' : undefined}>{resumen ? eur(resumen.saldo_actual) : '—'}</strong>
            {resumen && <span className="saldo-note">Incluye saldo inicial de {eur(resumen.saldo_inicial_centimos)}</span>}
          </div>
          <div className="work-kpi card">
            <small>Gasto medio mensual</small>
            <strong>{resumen ? eur(resumen.gasto_medio_mensual) : '—'}</strong>
            <span className="kpi-sub">últimos 12 meses</span>
          </div>
        </div>
        {resumen && <button className="link-btn" onClick={() => setSaldoSheet(true)}>Ajustar saldo inicial</button>}
        <div className="big-actions">
          <button className="big gasto-btn" onClick={() => setSheet('gasto')}>+ Gasto</button>
          <button className="big ingreso-btn" onClick={() => setSheet('ingreso')}>+ Ingreso</button>
        </div>
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="section">
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
                  <span className="item-name">{g.nombre}</span>
                  <small className="item-by">{eur(g.importe_centimos)} · día {g.dia} · {g.categoria}</small>
                </span>
                <button className="secondary quitar" onClick={() => setPending({ kind: 'fijo', g })}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>Movimientos</h2>
        <div className="month-nav">
          <button className="icon-btn" aria-label="Mes anterior" onClick={() => setMes(shiftMes(mes, -1))}>‹</button>
          <strong className="month-label" aria-live="polite">{mesLabel(mes)}</strong>
          <button className="icon-btn" aria-label="Mes siguiente" onClick={() => setMes(shiftMes(mes, 1))}>›</button>
        </div>
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
                      </span>
                      <small className="item-by">{[m.usuario, m.nota].filter(Boolean).join(' · ')}</small>
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

      <CasaCharts refresh={resumen} />

      {sheet && <MovSheet tipo={sheet} categorias={cats.filter((c) => c.tipo === sheet)} onClose={() => setSheet(null)} onCreateCat={createCat} onSave={saveMov} />}
      {fijoSheet && <FijoSheet categorias={cats.filter((c) => c.tipo === 'gasto')} onClose={() => setFijoSheet(false)} onCreateCat={createCat} onSave={saveFijo} />}
      {saldoSheet && resumen && <SaldoSheet actual={resumen.saldo_inicial_centimos} onClose={() => setSaldoSheet(false)} onSave={saveSaldo} />}
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
