import { listNotasFiscais } from "@/lib/actions/nfs"
import { NfsClient } from "./client"

export default async function NfsPage() {
  const nfs = await listNotasFiscais()
  return <NfsClient initialNfs={nfs as any} />
}
