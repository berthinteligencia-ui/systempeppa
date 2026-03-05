"use server"

import { getPrisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export type NfStatus = "PENDENTE" | "ANALISADA" | "APROVADA" | "REJEITADA"

export type NotaFiscalInput = {
  numero: string
  emitente: string
  valor: number
  dataEmissao: string
  descricao?: string
}

export async function createNotaFiscal(data: NotaFiscalInput) {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  const prisma = getPrisma()
  const nf = await prisma.notaFiscal.create({
    data: {
      numero: data.numero,
      emitente: data.emitente,
      valor: data.valor,
      dataEmissao: new Date(data.dataEmissao),
      descricao: data.descricao ?? null,
      status: "PENDENTE",
      companyId: session.user.companyId,
    },
  })

  revalidatePath("/nfs")
  return nf
}

export async function listNotasFiscais() {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  const prisma = getPrisma()
  return prisma.notaFiscal.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { createdAt: "desc" },
  })
}

export async function updateNotaFiscalStatus(id: string, status: NfStatus) {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  const prisma = getPrisma()
  await prisma.notaFiscal.update({
    where: { id, companyId: session.user.companyId },
    data: { status },
  })

  revalidatePath("/nfs")
}

export async function deleteNotaFiscal(id: string) {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  const prisma = getPrisma()
  await prisma.notaFiscal.delete({
    where: { id, companyId: session.user.companyId },
  })

  revalidatePath("/nfs")
}
