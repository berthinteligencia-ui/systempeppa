"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown } from "lucide-react"

const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
]

const CURRENT_YEAR = new Date().getFullYear()
const ANOS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - i)

interface PeriodSelectorProps {
  month: number
  year: number
}

export function PeriodSelector({ month, year }: PeriodSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigate(newMonth: number, newYear: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("month", String(newMonth))
    params.set("year", String(newYear))
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Mês */}
      <div className="relative inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
        <select
          value={month}
          onChange={e => navigate(Number(e.target.value), year)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          aria-label="Selecionar mês"
        >
          {MESES.map((label, i) => (
            <option key={i + 1} value={i + 1}>{label}</option>
          ))}
        </select>
        COMPETÊNCIA: {MESES[month - 1]} / {year}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </div>

      {/* Ano */}
      <div className="relative inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
        <select
          value={year}
          onChange={e => navigate(month, Number(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          aria-label="Selecionar ano"
        >
          {ANOS.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {year}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </div>
    </div>
  )
}
