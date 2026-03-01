# FolhaPro — Project Foundation

## Goal
Criar a fundação técnica do FolhaPro: sistema de folha de pagamento multi-tenant com autenticação, schema de banco e layout base navegável.

## Stack
- **Next.js 16** — App Router, TypeScript, Tailwind CSS v4
- **shadcn/ui** — Componentes de UI
- **Prisma 7 + PostgreSQL** — ORM com PrismaPg adapter
- **NextAuth.js v5 (beta)** — Autenticação email+senha com roles

## Core Entities
```
Company → multi-tenant (cada empresa é um tenant)
User    → auth, roles: ADMIN | RH | GESTOR | FUNCIONARIO
Employee → funcionários da empresa
Department → departamentos da empresa
```

## File Structure (target)
```
folhapro/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── employees/page.tsx
│   │   │   └── layout.tsx          ← sidebar + header
│   │   ├── api/
│   │   │   └── auth/[...nextauth]/route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx                ← redirect para /dashboard
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   └── ui/                     ← shadcn/ui components
│   ├── lib/
│   │   ├── auth.ts                 ← NextAuth config
│   │   ├── prisma.ts               ← Prisma client singleton
│   │   └── utils.ts
│   └── types/
│       └── next-auth.d.ts          ← session type augmentation
├── prisma/
│   └── schema.prisma
├── middleware.ts                   ← proteção de rotas
├── .env.example
└── .env.local
```

## Tasks

- [x] T1: Inicializar projeto Next.js com TypeScript, Tailwind, App Router
- [x] T2: Instalar Prisma 7, NextAuth v5, shadcn/ui, bcryptjs, @prisma/adapter-pg
- [x] T3: Criar schema Prisma (Company, User, Employee, Department) → `npx prisma validate` ✅
- [x] T4: Configurar NextAuth v5 com CredentialsProvider + JWT + auth.config.ts (Edge-safe)
- [x] T5: Criar layout base (Sidebar + Header) com route groups (auth) e (dashboard)
- [x] T6: Criar .env.example + middleware Edge-safe com authConfig

## Done When
- [x] `npm run build` passa sem erros ✅
- [x] Schema validado pelo Prisma ✅
- [ ] Login com email/senha funciona ← requer DB rodando + `prisma migrate dev`
- [ ] Usuário autenticado vê sidebar e dashboard ← requer DB
- [ ] Usuário não-autenticado é redirecionado para /login ← requer DB

## Next Steps (próxima task)
1. Configurar PostgreSQL local (Docker ou instalação nativa)
2. Atualizar `DATABASE_URL` no `.env`
3. Rodar `npx prisma migrate dev --name init`
4. Criar seed com empresa + usuário admin inicial
5. Testar login end-to-end

---
## ✅ PHASE X COMPLETE (Build)
- TypeScript: ✅ Pass
- Build: ✅ `npm run build` success (7 routes)
- Schema: ✅ Validated
- Date: 2026-02-24
