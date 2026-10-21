export const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => isoDate(new Date())
export const lastDay = (mes: string) => isoDate(new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0))
export const daysIn = (mes: string) => Number(lastDay(mes).slice(8, 10))
export const shiftMes = (mes: string, delta: number) => {
  const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
const mesDate = (mes: string) => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1)
export const mesLabel = (mes: string) => `${new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(mesDate(mes))} ${mes.slice(0, 4)}`
export const mesCorto = (mes: string) => new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(mesDate(mes)).replace('.', '')
