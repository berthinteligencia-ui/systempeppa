"use server"

import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import bcrypt from "bcryptjs"

export async function changePassword(data: {
    name: string
    email: string
    password: string
}): Promise<void> {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Não autorizado")

    if (!data.name.trim()) throw new Error("Nome é obrigatório")
    if (!data.email.trim()) throw new Error("E-mail é obrigatório")
    if (data.password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres")

    const supabase = getSupabaseAdmin()
    const hashed = await bcrypt.hash(data.password, 10)
    const now = new Date().toISOString()

    const { error } = await supabase.from("User").update({
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        password: hashed,
        mustChangePassword: false,
        updatedAt: now,
    }).eq("id", session.user.id)

    if (error) throw new Error(error.message)
}
