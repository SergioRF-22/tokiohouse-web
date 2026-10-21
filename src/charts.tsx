import { useState, type PointerEvent, type ReactNode } from 'react'

// Gráficas SVG a mano, sin dependencias. Los importes llegan en céntimos.

const eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eur2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
export const fmtEur = (c: number) => eur2.format(c / 100)

// Etiqueta corta de eje: 850, 1,2k, -300…
function axisLabel(c: number) {
  const e = c / 100
  if (Math.abs(e) >= 1000) return `${(e / 1000).toFixed(1).replace('.', ',').replace(',0', '')}k`
  return eur0.format(e).replace(/\s?€/, '')
}

// Dominio "bonito" que incluye el 0 y marcas en pasos 1-2-5.
function scale(min: number, max: number, count = 4) {
  const lo = Math.min(0, min)
  const hi = Math.max(0, max, lo + 100)
  const raw = (hi - lo) / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(100, ([1, 2, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow)
  const dmin = Math.floor(lo / step) * step
  const dmax = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = dmin; v <= dmax + 1e-6; v += step) ticks.push(v)
  return { dmin, dmax, ticks }
}

const W = 340
const H = 200
const PAD = { l: 34, r: 10, t: 12, b: 24 }
const IW = W - PAD.l - PAD.r
const IH = H - PAD.t - PAD.b

type Frame = { y: (v: number) => number; ticks: number[] }

function Grid({ f }: { f: Frame }) {
  return (
    <g className="ch-grid">
      {f.ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={f.y(t)} y2={f.y(t)} className={t === 0 ? 'zero' : undefined} />
          <text x={PAD.l - 6} y={f.y(t)} textAnchor="end" dominantBaseline="middle">{axisLabel(t)}</text>
        </g>
      ))}
    </g>
  )
}

function Tip({ x, children }: { x: number; children: ReactNode }) {
  const pct = Math.min(80, Math.max(20, (x / W) * 100))
  return <div className="ch-tip" style={{ left: `${pct}%` }} role="status">{children}</div>
}

// Índice del punto/grupo bajo el puntero, a partir de la posición horizontal.
function useHover(n: number, pos: (i: number) => number) {
  const [sel, setSel] = useState<number | null>(null)
  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    let best = 0
    for (let i = 1; i < n; i++) if (Math.abs(pos(i) - x) < Math.abs(pos(best) - x)) best = i
    setSel(best)
  }
  return { sel: sel !== null && sel < n ? sel : null, onPointer, clear: () => setSel(null) }
}

function xTickIdx(n: number, every: number) {
  const out: number[] = []
  for (let i = 0; i < n; i++) if (i === 0 || (i + 1) % every === 0) out.push(i)
  // evita que la última marca quede pegada a la anterior
  if (out.length > 1 && n - 1 - out[out.length - 1] < every / 2 && out[out.length - 1] !== n - 1) out.pop()
  return out
}

export type Dot = { id: string; label: string; color: string }

// ---------- Línea ----------

export type LineSeries = Dot & { values: (number | null)[]; area?: boolean }

export function LineChart({ series, n, xLabel, xTitle, xEvery, label }: {
  series: LineSeries[]
  n: number
  xLabel: (i: number) => string
  xTitle: (i: number) => string
  xEvery: number
  label: string
}) {
  let max = 0
  for (const s of series) for (const v of s.values) if (v !== null && v > max) max = v
  const sc = scale(0, max)
  const x = (i: number) => PAD.l + (n <= 1 ? IW / 2 : (i * IW) / (n - 1))
  const y = (v: number) => PAD.t + ((sc.dmax - v) / (sc.dmax - sc.dmin)) * IH
  const { sel, onPointer, clear } = useHover(n, x)

  const path = (vals: (number | null)[]) => {
    let d = ''
    let pen = false
    vals.forEach((v, i) => {
      if (v === null) return void (pen = false)
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`
      pen = true
    })
    return d
  }
  const lastIdx = (vals: (number | null)[]) => vals.reduce<number>((a, v, i) => (v === null ? a : i), -1)

  return (
    <div className="ch-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerDown={onPointer} onPointerMove={onPointer} onPointerLeave={clear} onPointerCancel={clear}>
        <Grid f={{ y, ticks: sc.ticks }} />
        <g className="ch-xl">
          {xTickIdx(n, xEvery).map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{xLabel(i)}</text>
          ))}
        </g>
        {series.map((s) => {
          const d = path(s.values)
          const li = lastIdx(s.values)
          const sig = s.values.join(',')
          return (
            <g key={s.id}>
              {s.area && li >= 0 && (
                <path key={`a${sig}`} className="ch-area" d={`${d}L${x(li).toFixed(1)} ${y(0)}L${x(0)} ${y(0)}Z`} style={{ fill: s.color }} />
              )}
              <path key={`l${sig}`} className="ch-line" pathLength={1} d={d} style={{ stroke: s.color }} />
              {li >= 0 && <circle cx={x(li)} cy={y(s.values[li] as number)} r={3} style={{ fill: s.color }} className="ch-end" />}
            </g>
          )
        })}
        {sel !== null && (
          <g>
            <line className="ch-cursor" x1={x(sel)} x2={x(sel)} y1={PAD.t} y2={PAD.t + IH} />
            {series.map((s) => {
              const v = s.values[sel]
              return v === null ? null : <circle key={s.id} cx={x(sel)} cy={y(v)} r={4} className="ch-pt" style={{ stroke: s.color }} />
            })}
          </g>
        )}
      </svg>
      {sel !== null && (
        <Tip x={x(sel)}>
          <strong>{xTitle(sel)}</strong>
          {series.map((s) => (
            <span key={s.id}><i style={{ background: s.color }} />{s.label}: {s.values[sel] === null ? '—' : fmtEur(s.values[sel] as number)}</span>
          ))}
        </Tip>
      )}
      <Legend items={series} />
    </div>
  )
}

// ---------- Barras agrupadas (+ línea opcional) ----------

export type BarGroup = { label: string; title: string; bars: { id: string; value: number }[]; line?: number }

export function BarChart({ groups, bars, line, label }: {
  groups: BarGroup[]
  bars: Dot[]
  line?: Dot
  label: string
}) {
  const n = groups.length
  let max = 0
  let min = 0
  for (const g of groups) {
    for (const b of g.bars) max = Math.max(max, b.value)
    if (g.line !== undefined) {
      max = Math.max(max, g.line)
      min = Math.min(min, g.line)
    }
  }
  const sc = scale(min, max)
  const band = IW / Math.max(n, 1)
  const cx = (i: number) => PAD.l + band * (i + 0.5)
  const y = (v: number) => PAD.t + ((sc.dmax - v) / (sc.dmax - sc.dmin)) * IH
  const { sel, onPointer, clear } = useHover(n, cx)
  const k = Math.max(bars.length, 1)
  const bw = Math.min(14, (band * 0.78) / k)

  const pts = line ? groups.map((g, i) => (g.line === undefined ? null : ([cx(i), y(g.line)] as const))) : []
  const lineD = pts.reduce((d, p, i) => (p ? `${d}${d && pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}` : d), '')
  const sig = groups.map((g) => g.bars.map((b) => b.value).join('/')).join(',')

  return (
    <div className="ch-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerDown={onPointer} onPointerMove={onPointer} onPointerLeave={clear} onPointerCancel={clear}>
        <Grid f={{ y, ticks: sc.ticks }} />
        {sel !== null && <rect className="ch-band" x={PAD.l + band * sel} y={PAD.t} width={band} height={IH} />}
        <g key={sig}>
          {groups.map((g, i) => (
            <g key={i}>
              {g.bars.map((b, j) => {
                const meta = bars.find((d) => d.id === b.id)
                const h = Math.abs(y(b.value) - y(0))
                return (
                  <rect
                    key={b.id}
                    className="ch-bar"
                    x={cx(i) - (bw * k) / 2 + j * bw}
                    y={y(Math.max(b.value, 0))}
                    width={Math.max(bw - 1, 1)}
                    height={Math.max(h, b.value ? 1 : 0)}
                    rx={2}
                    style={{ fill: meta?.color, animationDelay: `${i * 30}ms` }}
                  />
                )
              })}
            </g>
          ))}
        </g>
        <g className="ch-xl">
          {groups.map((g, i) => (
            <text key={i} x={cx(i)} y={H - 6} textAnchor="middle">{g.label}</text>
          ))}
        </g>
        {line && lineD && (
          <g key={`l${sig}`}>
            <path className="ch-line" pathLength={1} d={lineD} style={{ stroke: line.color }} />
            {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={sel === i ? 4 : 2.5} className="ch-pt" style={{ stroke: line.color }} />)}
          </g>
        )}
      </svg>
      {sel !== null && (
        <Tip x={cx(sel)}>
          <strong>{groups[sel].title}</strong>
          {groups[sel].bars.map((b) => {
            const meta = bars.find((d) => d.id === b.id)
            return <span key={b.id}><i style={{ background: meta?.color }} />{meta?.label}: {fmtEur(b.value)}</span>
          })}
          {line && groups[sel].line !== undefined && (
            <span><i style={{ background: line.color }} />{line.label}: {fmtEur(groups[sel].line as number)}</span>
          )}
        </Tip>
      )}
      <Legend items={line ? [...bars, line] : bars} />
    </div>
  )
}

function Legend({ items }: { items: Dot[] }) {
  return (
    <ul className="ch-legend">
      {items.map((d) => (
        <li key={d.id}><i style={{ background: d.color }} />{d.label}</li>
      ))}
    </ul>
  )
}

// ---------- Donut ----------

export type Slice = { id: string; label: string; value: number; color: string }

export function Donut({ slices, label }: { slices: Slice[]; label: string }) {
  const [sel, setSel] = useState<string | null>(null)
  const total = slices.reduce((a, s) => a + s.value, 0)
  const cur = slices.find((s) => s.id === sel) ?? null
  const pctOf = (v: number) => (total ? (v / total) * 100 : 0)
  const fmtPct = (v: number) => `${pctOf(v).toFixed(pctOf(v) < 10 ? 1 : 0).replace('.', ',')}%`
  const R = 15.9155
  let acc = 0

  return (
    <div className="ch-donut">
      <div className="ch-donut-box">
        <svg viewBox="0 0 42 42" role="img" aria-label={label}>
          <circle cx={21} cy={21} r={R} className="ch-track" />
          {slices.map((s, i) => {
            const len = pctOf(s.value)
            const gap = slices.length > 1 ? Math.min(0.8, len / 3) : 0
            const off = 25 - acc
            acc += len
            return (
              <circle
                key={s.id}
                cx={21}
                cy={21}
                r={R}
                className={`ch-slice${sel && sel !== s.id ? ' dim' : ''}`}
                style={{ stroke: s.color, animationDelay: `${i * 70}ms` }}
                strokeDasharray={`${Math.max(len - gap, 0)} ${100 - Math.max(len - gap, 0)}`}
                strokeDashoffset={off}
                onClick={() => setSel(sel === s.id ? null : s.id)}
              />
            )
          })}
        </svg>
        <div className="ch-donut-center">
          <small>{cur ? cur.label : 'Total'}</small>
          <strong>{fmtEur(cur ? cur.value : total)}</strong>
          {cur && <small>{fmtPct(cur.value)}</small>}
        </div>
      </div>
      <ul className="ch-donut-legend">
        {slices.map((s) => (
          <li key={s.id}>
            <button type="button" className={sel === s.id ? 'on' : undefined} aria-pressed={sel === s.id} onClick={() => setSel(sel === s.id ? null : s.id)}>
              <i style={{ background: s.color }} />
              <span className="nm">{s.label}</span>
              <span className="pc">{fmtPct(s.value)}</span>
              <span className="vl">{fmtEur(s.value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- Barra apilada simple ----------

export function StackBar({ parts, label }: { parts: { id: string; label: string; value: number; color: string }[]; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0)
  return (
    <div>
      <div className="ch-stack" role="img" aria-label={label}>
        {parts.map((p) => p.value > 0 && (
          <span key={p.id} style={{ width: `${(p.value / total) * 100}%`, background: p.color }}>
            {(p.value / total) * 100 >= 12 && `${Math.round((p.value / total) * 100)}%`}
          </span>
        ))}
      </div>
      <ul className="ch-stack-legend">
        {parts.map((p) => (
          <li key={p.id}>
            <i style={{ background: p.color }} />
            <span>{p.label}</span>
            <strong>{fmtEur(p.value)}</strong>
            <small>{total ? Math.round((p.value / total) * 100) : 0}%</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
