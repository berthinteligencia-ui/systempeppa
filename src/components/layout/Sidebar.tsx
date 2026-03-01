"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Building2,
  AlertTriangle,
  BarChart3,
  Settings,
  Users,
  LogOut,
  Landmark,
  FileSpreadsheet,
  MessageSquare,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/funcionarios", label: "Funcionários", icon: Users },
  { href: "/unidades", label: "Unidades", icon: Building2 },
  { href: "/comprovante", label: "Comprovante", icon: FileText },
  { href: "/folha-pagamento", label: "Folha de Pagamento", icon: FileSpreadsheet },
  { href: "/alertas", label: "Alertas Financeiros", icon: AlertTriangle },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/whatsapp-business", label: "WhatsApp Business", icon: MessageSquare },
]

const adminNav = [
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/usuarios", label: "Usuários", icon: Users },
]

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user

  const NavItem = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string
    label: string
    icon: React.ElementType
  }) => (
    <Link href={href}>
      <span
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
          pathname === href
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </span>
    </Link>
  )

  return (
    <aside className="flex h-screen w-64 flex-col" style={{ backgroundColor: "#152138" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
          <Landmark className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white uppercase tracking-wider">PEPACORP</p>
          <p className="text-[10px] text-slate-400 font-medium">Controle Financeiro</p>
        </div>
      </div>

      <div className="mx-4 border-t border-white/10" />

      {/* Main nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        <p className="mt-4 px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Administração
        </p>
        {adminNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* User profile */}
      <div className="mx-4 border-t border-white/10" />
      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-blue-600 text-xs text-white">
            {user?.name ? initials(user.name) : "??"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium text-white">{user?.name ?? "Usuário"}</p>
          <p className="truncate text-xs text-slate-400">{user?.role ?? "RH"}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-slate-400 transition-colors hover:text-white"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
