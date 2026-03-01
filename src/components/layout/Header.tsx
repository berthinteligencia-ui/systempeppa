"use client"

import { Bell, Calendar } from "lucide-react"
import { useSession } from "next-auth/react"

interface HeaderProps {
  title?: string
}

export function Header({ title = "Dashboard Executivo" }: HeaderProps) {
  const { data: session, status } = useSession()

  // Try to get company name from session, fallback to "FolhaPro" if everything fails
  const companyName = session?.user?.companyName || (status === "loading" ? "..." : title)
  const companyCnpj = session?.user?.companyCnpj || ""

  // Debug: If we have a user name but no company info, might be a stale session
  const userName = session?.user?.name

  const formatCnpj = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, "")
    if (cleaned.length !== 14) return cnpj
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
  }

  return (
    <header className="flex h-20 items-center justify-between border-b bg-white px-6">
      <div className="flex flex-col">
        <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
          {companyName}
        </h1>
        {companyCnpj ? (
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
            <span className="h-1 w-1 rounded-full bg-blue-500" />
            CNPJ: {formatCnpj(companyCnpj)}
          </p>
        ) : session?.user ? (
          <p className="text-[10px] font-medium text-slate-400 mt-0.5 italic">
            Configurações da empresa pendentes
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        {/* Bell */}
        <button className="relative rounded-xl p-2.5 text-slate-500 transition-all hover:bg-slate-100 active:scale-95">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            3
          </span>
        </button>

        {/* Calendar */}
        <button className="rounded-xl p-2.5 text-slate-500 transition-all hover:bg-slate-100 active:scale-95">
          <Calendar className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
