"use client"

import { useRouter, useSearchParams } from "next/navigation"

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export function MonthSelector({ currentMonth, currentYear }: { currentMonth: number; currentYear: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const options: { month: number; year: number; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({ month: d.getMonth() + 1, year: d.getFullYear(), label: `${MESES[d.getMonth()]} / ${d.getFullYear()}` })
  }

  const value = `${currentMonth}-${currentYear}`

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [m, y] = e.target.value.split("-")
    const params = new URLSearchParams(searchParams.toString())
    params.set("month", m)
    params.set("year", y)
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      className="ml-3 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      {options.map((o) => (
        <option key={`${o.month}-${o.year}`} value={`${o.month}-${o.year}`}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
