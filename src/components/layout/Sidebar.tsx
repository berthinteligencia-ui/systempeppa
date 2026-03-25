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
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const mainNav = [
  { href: "/dashboard",        label: "Dashboard",          icon: LayoutDashboard, feature: null },
  { href: "/funcionarios",     label: "Funcionários",       icon: Users,           feature: "funcionarios" },
  { href: "/unidades",         label: "Unidades",           icon: Building2,       feature: "unidades" },
  { href: "/nfs",              label: "NFs",                icon: Receipt,         feature: "nfs" },
  { href: "/folha-pagamento",  label: "Folha de Pagamento", icon: FileSpreadsheet, feature: "folha_pagamento" },
  { href: "/comprovante",      label: "Comprovante",        icon: FileText,        feature: "comprovante" },
  { href: "/whatsapp-business",label: "WhatsApp Business",  icon: MessageSquare,   feature: "whatsapp" },
  { href: "/relatorios",       label: "Relatórios",         icon: BarChart3,       feature: "relatorios" },
]

const configNav = [
  { href: "/alertas",          label: "Alertas Financeiros",icon: AlertTriangle,   feature: null },
  { href: "/bancos",           label: "Bancos",             icon: Landmark,        feature: "bancos" },
  { href: "/usuarios",         label: "Usuários",           icon: Users,           feature: "admin" },
  { href: "/configuracoes",    label: "Configurações Gerais",icon: Settings,        feature: "admin" },
]

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user
  const [collapsed, setCollapsed] = useState(false)
  const [configExpanded, setConfigExpanded] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const [allowedFeatures, setAllowedFeatures] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    if (!session?.user) return
    if (session.user.role === "ADMIN") { setAllowedFeatures(null); return }
    fetch("/api/permissions")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.isAdmin) { setAllowedFeatures(null); return }
        setAllowedFeatures(data?.permissions ?? {})
      })
      .catch(() => setAllowedFeatures(null))
  }, [session?.user?.role, session?.user?.companyId])

  function isAllowed(feature: string | null): boolean {
    if (user?.role === "ADMIN") return true
    if (feature === "admin") return false
    if (!feature || !allowedFeatures) return true
    return allowedFeatures[feature] !== false
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!collapsed && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setCollapsed(true)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [collapsed])

  // Auto-expand group if a sub-item is active
  useEffect(() => {
    if (configNav.some(item => pathname === item.href)) {
      setConfigExpanded(true)
    }
  }, [pathname])

  const NavItem = ({
    href,
    label,
    icon: Icon,
    isSubItem = false,
  }: {
    href: string
    label: string
    icon: React.ElementType
    isSubItem?: boolean
  }) => (
    <Link href={href} title={collapsed ? label : undefined}>
      <span
        className={cn(
          "flex items-center rounded-lg transition-all",
          collapsed ? "justify-center gap-0 px-3 py-2.5" : isSubItem ? "gap-3 pl-10 pr-3 py-2" : "gap-3 px-3 py-2.5",
          pathname === href
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-300 hover:bg-white/10 hover:text-white",
          !collapsed && isSubItem && "text-xs py-1.5"
        )}
      >
        <Icon className={cn("shrink-0", isSubItem ? "h-3.5 w-3.5" : "h-4 w-4")} />
        {!collapsed && <span>{label}</span>}
      </span>
    </Link>
  )

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "flex h-screen flex-col transition-all duration-300 z-40",
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
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4 overflow-y-auto custom-scrollbar">
        {mainNav.filter(item => isAllowed(item.feature)).map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        {/* Configurações Group */}
        <div className="mt-2 text-slate-300">
          <button
            onClick={() => {
              if (collapsed) setCollapsed(false)
              setConfigExpanded(!configExpanded)
            }}
            className={cn(
              "flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all group",
              collapsed ? "justify-center gap-0" : "gap-3 justify-between",
              (configExpanded || configNav.some(i => pathname === i.href)) && !collapsed
                ? "text-white"
                : "hover:bg-white/10 hover:text-white"
            )}
          >
            <div className="flex items-center gap-3">
              <Settings className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Configurações</span>}
            </div>
            {!collapsed && (
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", configExpanded && "rotate-180")} />
            )}
          </button>
          
          {configExpanded && !collapsed && (
            <div className="mt-1 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-200">
              {configNav.filter(item => isAllowed(item.feature)).map((item) => (
                <NavItem key={item.href} {...item} isSubItem />
              ))}
            </div>
          )}
        </div>
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
