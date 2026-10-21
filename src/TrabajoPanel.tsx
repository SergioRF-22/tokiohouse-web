import { useEffect, useMemo, useRef, useState } from 'react'
import * as api from './api'
import type { Categoria, Movimiento } from './api'
import { BarChart, Donut, fmtEur, type BarGroup, type Slice } from './charts'
import { Empty, Fold, catColor } from './FinPanel'
import { mesCorto, mesLabel, today } from './fechas'

const C_POS = 'var(--ingreso)'
const C_NEG = 'var(--accent)'

// Panel de trabajo: neto del año (selector de año), histograma mensual y donuts del mes visible.
// `movsMes` son los movimientos del mes (de cualquier tipo); aquí solo se usan los de trabajo.
export default function TrabajoPanel({ mes, cats, movsMes, refresh }: { mes: string; cats: Categoria[]; movsMes: Movimiento[] | null; refresh: unknown }) {
  const [year, setYear] = useState(() => today().slice(0, 4))
  const [anio, setAnio] = useState<Movimiento[] | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    // `refresh` cambia cada vez que Finanzas recarga (alta/baja de movimientos).
    const s = ++seq.current
    api
      .getMovimientos(`${year}-01-01`, `${year}-12-31`, true)
      .then((r) => s === seq.current && setAnio(r.movimientos))
      .catch(() => {})
  }, [year, refresh])

  const d = useMemo(() => {
    const porMes = Array.from({ length: 12 }, () => ({ ing: 0, gas: 0 }))
    for (const m of anio ?? []) porMes[Number(m.fecha.slice(5, 7)) - 1][m.tipo === 'ingreso' ? 'ing' : 'gas'] += m.importe_centimos
    const hoy = today()
    // Meses transcurridos con datos (un año en curso no cuenta los futuros).
    const conDatos = porMes.filter((a, i) => a.ing + a.gas > 0 && `${year}-${String(i + 1).padStart(2, '0')}` <= hoy.slice(0, 7))
    const bruto = porMes.reduce((t, a) => t + a.ing, 0)
    const gastos = porMes.reduce((t, a) => t + a.gas, 0)
    const neto = bruto - gastos
    const barGroups: BarGroup[] = porMes.map((a, i) => {
      const k = `${year}-${String(i + 1).padStart(2, '0')}`
      const v = a.ing - a.gas
      return { label: mesCorto(k).slice(0, 3), title: mesLabel(k), bars: [{ id: 'neto', value: v, color: v < 0 ? C_NEG : C_POS }] }
    })

    const orden = [...cats].sort((a, b) => a.id - b.id)
    const slices = (tipo: 'ingreso' | 'gasto') => {
      const t = new Map<number, Slice>()
      for (const m of movsMes ?? []) {
        if (m.trabajo !== 1 || m.tipo !== tipo) continue
        const i = orden.findIndex((c) => c.id === m.categoria_id)
        const s = t.get(m.categoria_id) ?? { id: String(m.categoria_id), label: m.categoria, value: 0, color: catColor(i < 0 ? m.categoria_id : i) }
        s.value += m.importe_centimos
        t.set(m.categoria_id, s)
      }
      return [...t.values()].sort((a, b) => b.value - a.value)
    }
    return { media: conDatos.length ? neto / conDatos.length : null, nMeses: conDatos.length, neto, bruto, gastos, barGroups, ingCat: slices('ingreso'), gasCat: slices('gasto') }
  }, [anio, cats, movsMes, year])

  const tono = (v: number) => (v < 0 ? 'gasto' : 'ingreso')
  const yearNum = Number(year)

  return (
    <div className="fin-panel">
      <div className="month-nav">
        <button className="icon-btn" aria-label="Año anterior" onClick={() => setYear(String(yearNum - 1))}>‹</button>
        <strong className="month-label" aria-live="polite">{year}</strong>
        <button className="icon-btn" aria-label="Año siguiente" onClick={() => setYear(String(yearNum + 1))}>›</button>
      </div>

      <div className="work-kpis">
        <div className="work-kpi main card">
          <small>Salario neto medio mensual</small>
          <strong className={d.media === null ? undefined : tono(d.media)}>{d.media === null ? '—' : fmtEur(d.media)}</strong>
          <span className="kpi-sub">{d.nMeses ? `media de ${d.nMeses} ${d.nMeses === 1 ? 'mes' : 'meses'} con datos` : 'sin datos este año'}</span>
        </div>
        <div className="work-kpi card">
          <small>Neto total {year}</small>
          <strong className={tono(d.neto)}>{fmtEur(d.neto)}</strong>
        </div>
        <div className="work-kpi card">
          <small>Bruto total</small>
          <strong className="ingreso">{fmtEur(d.bruto)}</strong>
        </div>
        <div className="work-kpi main card">
          <small>Gastos de trabajo</small>
          <strong className="gasto">{fmtEur(d.gastos)}</strong>
        </div>
      </div>

      <Fold title={`Neto por mes ${year}`}>
        {d.bruto + d.gastos > 0 ? (
          <BarChart label={`Neto mensual de trabajo en ${year}`} groups={d.barGroups} bars={[{ id: 'neto', label: 'Neto', color: C_POS }]} />
        ) : (
          <Empty>Sin movimientos de trabajo en {year}.</Empty>
        )}
      </Fold>

      <Fold title="Ingresos por categoría">
        {d.ingCat.length ? <Donut slices={d.ingCat} label={`Ingresos de trabajo de ${mesLabel(mes)} por categoría`} /> : <Empty>Sin ingresos de trabajo en {mesLabel(mes)}.</Empty>}
      </Fold>

      <Fold title="Gastos por categoría">
        {d.gasCat.length ? <Donut slices={d.gasCat} label={`Gastos de trabajo de ${mesLabel(mes)} por categoría`} /> : <Empty>Sin gastos de trabajo en {mesLabel(mes)}.</Empty>}
      </Fold>
    </div>
  )
}
