import { redirect } from "next/navigation"
import { checkAdminAuth, listAllCompanies } from "@/lib/actions/admin"
import { AdminClient } from "./client"

export default async function AdminPage() {
    const isAuthed = await checkAdminAuth()
    if (!isAuthed) redirect("/admin/login")

    const companies = await listAllCompanies()

    return (
        <AdminClient
            initialCompanies={companies}
        />
    )
}
