import * as dotenv from "dotenv";
import path from "path";

// Carregar .env ANTES de qualquer outro import que use process.env
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { logActivity } from "./src/lib/logActivity";
import { query } from "./src/lib/db";

async function test() {
    console.log("Iniciando teste de logActivity...");
    try {
        console.log("Testando conexão com a DB...");
        const result = await query("SELECT NOW()");
        console.log("Conexão OK! Hora do servidor:", result[0].now);

        await logActivity({
            userId: "test-user-id",
            userName: "Test User",
            userEmail: "test@example.com",
            companyId: "test-company-id",
            action: "TEST_ACTION",
            target: "test-target",
            details: { foo: "bar" },
            ipAddress: "127.0.0.1"
        });
        console.log("Sucesso! Log registrado no banco de dados.");
    } catch (err: any) {
        console.error("Erro no teste:", err.message || err);
    }
}

test();
