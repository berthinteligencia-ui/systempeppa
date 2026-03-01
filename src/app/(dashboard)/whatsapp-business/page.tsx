import { WhatsAppContainer } from "@/components/chat/WhatsAppContainer"

export default function WhatsAppPage() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-slate-900">WhatsApp Business</h1>
                <p className="text-sm text-slate-500">Comunicação direta com seus funcionários</p>
            </div>

            <WhatsAppContainer />
        </div>
    )
}
