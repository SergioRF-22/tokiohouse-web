import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import * as api from './api'
import type { Categoria, Movimiento } from './api'
import { BarChart, Donut, LineChart, StackBar, fmtEur, type BarGroup, type Slice } from './charts'
import { daysIn, lastDay, mesCorto, mesLabel, shiftMes, today } from './fechas'

// Paleta pastel de la app (--cat-* de styles.css); a partir de la 9.ª categoría se generan tonos.
const PALETA = ['proteina', 'verduras', 'frutas', 'limpieza', 'higiene', 'hidratos', 'despensa', 'otro']
const catColor = (idx: number) => (idx < PALETA.length ? `var(--cat-${PALETA[idx]})` : `hsl(${(idx * 47) % 360} 55% 82%)`)

const C_GASTO = 'var(--gasto)'
const C_PREV = '#BDBDC4'
const C_ING_BAR = '#9ED6B9'
const C_GAS_BAR = '#F29B90'

type Agg = { ing: number; gas: number }

function Fold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="card fold" data-open={open}>
      <button type="button" className="fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <h3>{title}</h3>
        <span className="fold-chev" aria-hidden="true">⌄</span>
      </button>
      <div className="fold-collapse" aria-hidden={!open}>
        <div className="fold-inner">{children}</div>
      </div>
    </section>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <p className="ch-empty">{children}</p>

type Opt = { id: number | null; nombre: string; color?: string }

function CatChips({ options, value, onChange, label }: { options: Opt[]; value: number | null; onChange: (id: number | null) => void; label: string }) {
  return (
    <div className="chips scroll" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={o.id ?? 'todas'}
          role="radio"
          aria-checked={o.id === value}
          className={`chip pick${o.id === value ? ' on' : ''}`}
          style={{ '--cat': o.color ?? 'var(--accent-soft)' } as CSSProperties}
          onClick={() => onChange(o.id)}
        >
          {o.nombre}
        </button>
      ))}
    </div>
  )
}

function Seg<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([v, l]) => (
        <button type="button" key={v} role="radio" aria-checked={v === value} className={v === value ? 'on' : undefined} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)} %`

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="kpi card">
      <small>{label}</small>
      <strong className={tone === 'bad' ? 'gasto' : tone === 'good' ? 'ingreso' : undefined}>{value}</strong>
      {sub && <span className={`kpi-sub${tone ? ` ${tone}` : ''}`}>{sub}</span>}
    </div>
  )
}

export default function FinPanel({ mes, cats, refresh }: { mes: string; cats: Categoria[]; refresh: unknown }) {
  const [movs, setMovs] = useState<Movimiento[] | null>(null)
  const seq = useRef(0)

  const year = mes.slice(0, 4)
  const inicioVentana = shiftMes(mes, -11)
  const desde = `${inicioVentana < `${year}-01` ? inicioVentana : `${year}-01`}-01`

  useEffect(() => {
    // `refresh` cambia cada vez que Finanzas recarga (alta/baja de movimientos).
    const s = ++seq.current
    api
      .getMovimientos(desde, lastDay(mes))
      .then((r) => s === seq.current && setMovs(r.movimientos))
      .catch(() => {})
  }, [mes, desde, refresh])

  const [catDia, setCatDia] = useState<number | null>(null)
  const [catBar, setCatBar] = useState<number | null>(null)
  const [alcance, setAlcance] = useState<'mes' | 'anio'>('mes')

  const d = useMemo(() => {
    const all = movs ?? []
    const orden = [...cats].sort((a, b) => a.id - b.id)
    const color = (id: number) => {
      const i = orden.findIndex((c) => c.id === id)
      return catColor(i < 0 ? id : i)
    }
    const porMes = new Map<string, Agg>()
    for (const m of all) {
      const k = m.fecha.slice(0, 7)
      const a = porMes.get(k) ?? { ing: 0, gas: 0 }
      if (m.tipo === 'ingreso') a.ing += m.importe_centimos
      else a.gas += m.importe_centimos
      porMes.set(k, a)
    }
    const get = (k: string): Agg => porMes.get(k) ?? { ing: 0, gas: 0 }

    // KPIs
    const ventana = Array.from({ length: 12 }, (_, i) => shiftMes(mes, i - 11))
    const conDatos = ventana.filter((k) => get(k).ing + get(k).gas > 0)
    const ahorroMedio = conDatos.length ? conDatos.reduce((a, k) => a + get(k).ing - get(k).gas, 0) / conDatos.length : null
    let ingAnio = 0
    let gasAnio = 0
    for (const [k, a] of porMes) if (k.startsWith(year)) (ingAnio += a.ing), (gasAnio += a.gas)
    const previos = ventana.slice(0, 11).filter((k) => get(k).gas > 0)
    const mediaPrev = previos.length ? previos.reduce((a, k) => a + get(k).gas, 0) / previos.length : null
    const gasMes = get(mes).gas

    // Gastos por día (acumulado), mes y mes anterior
    const prev = shiftMes(mes, -1)
    const acumulado = (k: string, tope: number) => {
      const dias = new Array<number>(daysIn(k)).fill(0)
      for (const m of all) {
        if (m.tipo !== 'gasto' || !m.fecha.startsWith(k)) continue
        if (catDia !== null && m.categoria_id !== catDia) continue
        dias[Number(m.fecha.slice(8, 10)) - 1] += m.importe_centimos
      }
      let t = 0
      return dias.map((v, i) => (i < tope ? (t += v) : null))
    }
    const hoy = today()
    const tope = hoy.startsWith(mes) ? Number(hoy.slice(8, 10)) : mes > hoy.slice(0, 7) ? 0 : daysIn(mes)
    const cur = acumulado(mes, tope)
    const ant = acumulado(prev, daysIn(prev))

    // Categorías con datos
    const catsConDatos = (tipo?: 'ingreso' | 'gasto', f?: (m: Movimiento) => boolean) => {
      const seen = new Map<number, { id: number; nombre: string; tipo: string }>()
      for (const m of all) if ((!tipo || m.tipo === tipo) && (!f || f(m))) seen.set(m.categoria_id, { id: m.categoria_id, nombre: m.categoria, tipo: m.tipo })
      return [...seen.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }
    const gastosDiaCats = catsConDatos('gasto', (m) => m.fecha.startsWith(mes) || m.fecha.startsWith(prev))
    const barCats = catsConDatos(undefined, (m) => m.fecha.slice(0, 7) >= inicioVentana)

    // Barras 12 meses
    const filtroBar = catBar === null ? null : barCats.find((c) => c.id === catBar)
    const barGroups: BarGroup[] = ventana.map((k) => {
      let ing = 0
      let gas = 0
      if (filtroBar) {
        for (const m of all) if (m.fecha.startsWith(k) && m.categoria_id === filtroBar.id) (m.tipo === 'ingreso' ? (ing += m.importe_centimos) : (gas += m.importe_centimos))
      } else (ing = get(k).ing), (gas = get(k).gas)
      const bars = [] as BarGroup['bars']
      if (!filtroBar || filtroBar.tipo === 'ingreso') bars.push({ id: 'ing', value: ing })
      if (!filtroBar || filtroBar.tipo === 'gasto') bars.push({ id: 'gas', value: gas })
      return { label: mesCorto(k).slice(0, 3), title: mesLabel(k), bars, line: filtroBar ? undefined : ing - gas }
    })
    const hayBar = barGroups.some((g) => g.bars.some((b) => b.value > 0))

    // Donuts
    const sumar = (tipo: 'ingreso' | 'gasto', f: (m: Movimiento) => boolean) => {
      const t = new Map<number, Slice>()
      for (const m of all) {
        if (m.tipo !== tipo || !f(m)) continue
        const s = t.get(m.categoria_id) ?? { id: String(m.categoria_id), label: m.categoria, value: 0, color: color(m.categoria_id) }
        s.value += m.importe_centimos
        t.set(m.categoria_id, s)
      }
      return [...t.values()].sort((a, b) => b.value - a.value)
    }
    const ingCat = sumar('ingreso', (m) => m.fecha.startsWith(mes))
    const gasCat = sumar('gasto', (m) => m.fecha.startsWith(alcance === 'mes' ? mes : year))

    // Fijos vs variables
    let fijo = 0
    let variable = 0
    for (const m of all) if (m.tipo === 'gasto' && m.fecha.startsWith(mes)) m.gasto_fijo_id !== null ? (fijo += m.importe_centimos) : (variable += m.importe_centimos)

    // Top 3 del mes frente a su media de meses anteriores con gasto
    const top = sumar('gasto', (m) => m.fecha.startsWith(mes))
      .slice(0, 3)
      .map((s) => {
        let tot = 0
        for (const m of all) if (m.tipo === 'gasto' && String(m.categoria_id) === s.id && previos.includes(m.fecha.slice(0, 7))) tot += m.importe_centimos
        return { ...s, media: previos.length ? tot / previos.length : null }
      })

    return { ahorroMedio, ahorroAnio: ingAnio - gasAnio, ingAnio, mediaPrev, gasMes, cur, ant, gastosDiaCats, barCats, barGroups, hayBar, filtroBar, ingCat, gasCat, fijo, variable, top, color, nPrev: previos.length }
  }, [movs, cats, mes, year, inicioVentana, catDia, catBar, alcance])

  // Los errores de carga ya los muestra Finanzas; sin datos no hay panel.
  if (!movs) return null
  const diaOpts: Opt[] = [{ id: null, nombre: 'Todas' }, ...d.gastosDiaCats.map((c) => ({ id: c.id, nombre: c.nombre, color: d.color(c.id) }))]
  const barOpts: Opt[] = [{ id: null, nombre: 'Todas' }, ...d.barCats.map((c) => ({ id: c.id, nombre: c.nombre, color: d.color(c.id) }))]
  const diaSel = catDia !== null && d.gastosDiaCats.some((c) => c.id === catDia) ? catDia : null
  const hayDia = d.cur.some((v) => v) || d.ant.some((v) => v)
  const delta = d.mediaPrev ? ((d.gasMes - d.mediaPrev) / d.mediaPrev) * 100 : null
  const tasa = d.ingAnio > 0 ? (d.ahorroAnio / d.ingAnio) * 100 : null
  const prevLabel = mesLabel(shiftMes(mes, -1))
  const totalFijoVar = d.fijo + d.variable

  return (
    <div className="fin-panel">
      <div className="kpis" role="list">
        <Kpi label="Ahorro medio mensual" value={d.ahorroMedio === null ? '—' : fmtEur(d.ahorroMedio)} sub="últimos 12 meses" tone={d.ahorroMedio === null ? undefined : d.ahorroMedio < 0 ? 'bad' : 'good'} />
        <Kpi label={`Ahorro ${year}`} value={fmtEur(d.ahorroAnio)} sub="ingresos − gastos" tone={d.ahorroAnio < 0 ? 'bad' : d.ahorroAnio > 0 ? 'good' : undefined} />
        <Kpi label={`Tasa de ahorro ${year}`} value={tasa === null ? '—' : `${tasa.toFixed(1).replace('.', ',')} %`} sub={tasa === null ? 'sin ingresos' : 'del total ingresado'} tone={tasa === null ? undefined : tasa < 0 ? 'bad' : 'good'} />
        <Kpi
          label="Gasto del mes"
          value={fmtEur(d.gasMes)}
          sub={delta === null ? 'sin meses anteriores' : `${pct(delta)} vs media`}
          tone={delta === null ? undefined : delta > 0 ? 'bad' : 'good'}
        />
      </div>

      <Fold title="Gastos del mes">
        <CatChips options={diaOpts} value={diaSel} onChange={setCatDia} label="Categoría" />
        {hayDia ? (
          <LineChart
            label={`Gasto acumulado por día de ${mesLabel(mes)} frente a ${prevLabel}`}
            n={Math.max(d.cur.length, d.ant.length)}
            xEvery={5}
            xLabel={(i) => String(i + 1)}
            xTitle={(i) => `Día ${i + 1}`}
            series={[
              { id: 'prev', label: prevLabel, color: C_PREV, values: d.ant },
              { id: 'cur', label: mesLabel(mes), color: C_GASTO, values: d.cur, area: true },
            ]}
          />
        ) : (
          <Empty>Sin gastos en {mesLabel(mes)} ni en {prevLabel}{diaSel !== null ? ' para esta categoría' : ''}. ¡Qué calma! 🍃</Empty>
        )}
      </Fold>

      <Fold title="Ingresos y gastos por mes">
        <CatChips options={barOpts} value={d.filtroBar?.id ?? null} onChange={setCatBar} label="Categoría" />
        {d.hayBar ? (
          <BarChart
            label="Ingresos, gastos y ahorro de los últimos 12 meses"
            groups={d.barGroups}
            bars={[
              ...(!d.filtroBar || d.filtroBar.tipo === 'ingreso' ? [{ id: 'ing', label: 'Ingresos', color: C_ING_BAR }] : []),
              ...(!d.filtroBar || d.filtroBar.tipo === 'gasto' ? [{ id: 'gas', label: 'Gastos', color: C_GAS_BAR }] : []),
            ]}
            line={d.filtroBar ? undefined : { id: 'ahorro', label: 'Ahorro', color: 'var(--fg)' }}
          />
        ) : (
          <Empty>Aún no hay movimientos en los últimos 12 meses. Apunta uno y aparecerá aquí.</Empty>
        )}
      </Fold>

      <Fold title="Ingresos por categoría">
        {d.ingCat.length ? <Donut slices={d.ingCat} label={`Ingresos de ${mesLabel(mes)} por categoría`} /> : <Empty>Sin ingresos en {mesLabel(mes)}.</Empty>}
      </Fold>

      <Fold title="Gastos por categoría">
        <Seg options={[['mes', 'Mes'], ['anio', 'Año']]} value={alcance} onChange={setAlcance} />
        {d.gasCat.length ? (
          <Donut key={alcance} slices={d.gasCat} label={`Gastos por categoría de ${alcance === 'mes' ? mesLabel(mes) : year}`} />
        ) : (
          <Empty>Sin gastos {alcance === 'mes' ? `en ${mesLabel(mes)}` : `en ${year}`}.</Empty>
        )}
      </Fold>

      <Fold title="Gastos fijos frente a variables">
        {totalFijoVar > 0 ? (
          <>
            <StackBar
              label={`Gastos fijos y variables de ${mesLabel(mes)}`}
              parts={[
                { id: 'fijo', label: 'Fijos', value: d.fijo, color: 'var(--cat-higiene)' },
                { id: 'var', label: 'Variables', value: d.variable, color: 'var(--cat-frutas)' },
              ]}
            />
            <p className="ch-note">El {Math.round((d.fijo / totalFijoVar) * 100)} % de lo que gastas en {mesLabel(mes)} ya viene comprometido.</p>
          </>
        ) : (
          <Empty>Sin gastos en {mesLabel(mes)}.</Empty>
        )}
      </Fold>

      <Fold title="Top 3 categorías de gasto">
        {d.top.length ? (
          <ul className="top3">
            {d.top.map((t, i) => {
              const max = Math.max(t.value, t.media ?? 0)
              const dl = t.media ? ((t.value - t.media) / t.media) * 100 : null
              return (
                <li key={t.id}>
                  <div className="top-head">
                    <span className="top-rank">{i + 1}</span>
                    <span className="nm">{t.label}</span>
                    <strong>{fmtEur(t.value)}</strong>
                    {dl !== null && <span className={`delta ${dl > 0 ? 'bad' : 'good'}`}>{pct(dl)}</span>}
                  </div>
                  <div className="top-track" aria-hidden="true">
                    <span className="top-fill" style={{ width: `${(t.value / max) * 100}%`, background: t.color }} />
                    {t.media !== null && <span className="top-avg" style={{ left: `${(t.media / max) * 100}%` }} />}
                  </div>
                  <small className="muted">{t.media === null ? 'Sin meses anteriores con los que comparar' : `Media: ${fmtEur(t.media)} al mes`}</small>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>Sin gastos en {mesLabel(mes)}.</Empty>
        )}
      </Fold>
    </div>
  )
}
