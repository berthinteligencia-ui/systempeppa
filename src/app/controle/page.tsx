import { redirect } from "next/navigation"
import { checkControleAuth, getControleStats } from "@/lib/actions/controle"
import { ControleClient } from "./client"

export default async function ControlePage() {
    const isAuthed = await checkControleAuth()
    if (!isAuthed) redirect("/controle/login")

    const stats = await getControleStats()

    return <ControleClient stats={stats} />
}
