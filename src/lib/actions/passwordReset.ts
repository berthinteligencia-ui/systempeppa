"use server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import bcrypt from "bcryptjs"
import { Resend } from "resend"

function generateTempPassword(length = 10): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    let result = ""
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    if (!email?.trim()) {
        return { success: false, message: "Informe um e-mail válido." }
    }

    const supabase = getSupabaseAdmin()

    const { data: user, error } = await supabase
        .from("User")
        .select("id, name, email, active")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle()

    if (error) {
        console.error("[passwordReset] DB error:", error.message)
        return { success: false, message: "Erro ao processar solicitação. Tente novamente." }
    }

    // Always return success to avoid email enumeration
    if (!user || !user.active) {
        return { success: true, message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve." }
    }

    const tempPassword = generateTempPassword()
    const hashed = await bcrypt.hash(tempPassword, 10)
    const now = new Date().toISOString()

    const { error: updateError } = await supabase
        .from("User")
        .update({ password: hashed, mustChangePassword: true, updatedAt: now })
        .eq("id", user.id)

    if (updateError) {
        console.error("[passwordReset] update error:", updateError.message)
        return { success: false, message: "Erro ao gerar nova senha. Tente novamente." }
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
        console.error("[passwordReset] RESEND_API_KEY não configurada")
        return { success: false, message: "Serviço de e-mail não configurado. Contate o administrador." }
    }

    const resend = new Resend(apiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@pepacorp.com.br"

    const { error: emailError } = await resend.emails.send({
        from: `PEPACORP <${fromEmail}>`,
        to: [user.email],
        subject: "Recuperação de Acesso — PEPACORP",
        html: buildEmailHtml(user.name, tempPassword),
    })

    if (emailError) {
        console.error("[passwordReset] email error:", emailError)
        return { success: false, message: "Não foi possível enviar o e-mail. Tente novamente ou contate o administrador." }
    }

    return { success: true, message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve." }
}

function buildEmailHtml(name: string, tempPassword: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f6f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1e3b8a;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:0.1em;text-transform:uppercase;">PEPACORP</p>
              <p style="margin:4px 0 0;font-size:11px;color:#93b4f5;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">Enterprise Finance</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Recuperação de acesso</p>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
                Olá, <strong style="color:#1e293b;">${name}</strong>. Recebemos uma solicitação de recuperação de senha para sua conta PEPACORP.
              </p>
              <p style="margin:0 0 12px;font-size:13px;color:#64748b;">Use a senha temporária abaixo para acessar a plataforma:</p>
              <!-- Temp password box -->
              <div style="background:#f0f4ff;border:2px dashed #93b4f5;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6b7fa8;text-transform:uppercase;letter-spacing:0.12em;">Senha temporária</p>
                <p style="margin:0;font-size:28px;font-weight:900;color:#1e3b8a;letter-spacing:0.2em;font-family:monospace;">${tempPassword}</p>
              </div>
              <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 24px;">
                <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">
                  ⚠ Ao entrar com essa senha, você será redirecionado para criar uma nova senha permanente.
                </p>
              </div>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha atual permanece ativa.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;font-size:11px;color:#cbd5e1;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">
                © 2026 PEPACORP • Sistema de Alta Performance
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
