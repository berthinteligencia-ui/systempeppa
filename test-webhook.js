const fetch = require('node-fetch');

const WEBHOOK_URL = "https://webhook.berthia.com.br/webhook/folha2";

async function testWebhook() {
    console.log("Iniciando teste de comunicação com o webhook...");
    console.log("URL:", WEBHOOK_URL);

    const payload = {
        phone: "557391474388",
        message: "Teste de comunicação Antigravity",
        employeeName: "Sistema Teste",
        conversationId: "test-id-123",
        sentAt: new Date().toISOString()
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        console.log("Status da Resposta:", response.status);
        console.log("Resposta OK:", response.ok);

        const text = await response.text();
        console.log("Corpo da Resposta:", text);

    } catch (error) {
        console.error("Erro crítico ao enviar para o webhook:", error.message);
    }
}

testWebhook();
