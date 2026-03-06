"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState, useRef, useEffect } from "react"
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
  Receipt,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/funcionarios", label: "Funcionários", icon: Users },
  { href: "/unidades", label: "Unidades", icon: Building2 },
  { href: "/nfs", label: "NFs", icon: Receipt },
  { href: "/folha-pagamento", label: "Folha de Pagamento", icon: FileSpreadsheet },
  { href: "/comprovante", label: "Comprovante", icon: FileText },
  { href: "/whatsapp-business", label: "WhatsApp Business", icon: MessageSquare },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/alertas", label: "Alertas Financeiros", icon: AlertTriangle },
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
  const [collapsed, setCollapsed] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!collapsed && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setCollapsed(true)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [collapsed])

  const NavItem = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string
    label: string
    icon: React.ElementType
  }) => (
    <Link href={href} title={collapsed ? label : undefined}>
      <span
        className={cn(
          "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
          collapsed ? "justify-center gap-0" : "gap-3",
          pathname === href
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{label}</span>}
      </span>
    </Link>
  )

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "flex h-screen flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
      style={{ backgroundColor: "#152138" }}
    >
      {/* Logo */}
      <div className={cn("flex items-center py-5", collapsed ? "justify-center px-2" : "gap-3 px-5")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
          <Landmark className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-white uppercase tracking-wider">PEPACORP</p>
            <p className="text-[10px] text-slate-400 font-medium">Controle Financeiro</p>
          </div>
        )}
      </div>

      <div className="mx-4 border-t border-white/10" />

      {/* Main nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        {!collapsed && (
          <p className="mt-4 px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Administração
          </p>
        )}
        {collapsed && <div className="mt-4 mx-1 border-t border-white/10" />}
        {adminNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="mx-4 border-t border-white/10" />
      <div className={cn("flex py-2", collapsed ? "justify-center" : "justify-end px-2")}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* User profile */}
      <div className="mx-4 border-t border-white/10" />
      <div className={cn("flex items-center py-4", collapsed ? "justify-center px-2" : "gap-3 px-4")}>
        <Avatar className="h-9 w-9 shrink-0" title={collapsed ? (user?.name ?? "Usuário") : undefined}>
          <AvatarFallback className="bg-blue-600 text-xs text-white">
            {user?.name ? initials(user.name) : "??"}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
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
          </>
        )}
        {collapsed && (
          <div className="sr-only">
            <button onClick={() => signOut({ callbackUrl: "/login" })}>Sair</button>
          </div>
        )}
      </div>
      {collapsed && (
        <div className="flex justify-center pb-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-slate-400 transition-colors hover:text-white"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  )
}
