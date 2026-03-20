const text = `LISTA DE REGISTROS ENCONTRADOS
====================================

1. NOME: ADRIANO MOREIRA DO PRADO
   CPF: 062.193.526-37 | VALOR: R$ 2.496,16
------------------------------------
2. NOME: ALEX GUILHERME DE OLIVEIRA
   CPF: 144.417.326-00 | VALOR: R$ 2.777,67
------------------------------------
3. NOME: ALLAN SANTOS SILVA
   CPF: 976.974.356-91 | VALOR: R$ 4.789,08`;

const recordRegex = /(\d+)\.\s+NOME:\s+([^\n]+)\s+CPF:\s+([\d.-]+)\s+\|\s+VALOR:\s+R\$\s+([\d.,]+)/g;
let match;
let list = [];

while ((match = recordRegex.exec(text)) !== null) {
  list.push({
    nome: match[2].trim(),
    cpf: match[3].replace(/\D/g, ""),
    situacao: "PROCESSADO",
    valor: match[4]
  });
}

console.log("Found records:", list.length);
console.log(JSON.stringify(list, null, 2));

if (list.length === 0) {
    console.log("Regex failed. Trying fallback...");
    const lines = text.split("\n");
    let currentRecord = {};
    for (const line of lines) {
        if (line.includes("NOME:")) {
            if (currentRecord.nome) {
                list.push(currentRecord);
                currentRecord = {};
            }
            currentRecord.nome = line.split("NOME:")[1]?.trim();
        } else if (line.includes("CPF:")) {
            const parts = line.split("|");
            currentRecord.cpf = parts[0]?.split("CPF:")[1]?.trim().replace(/\D/g, "");
            if (parts[1] && parts[1].includes("VALOR:")) {
                currentRecord.valor = parts[1].split("VALOR:")[1]?.trim().replace("R$", "").trim();
            }
        }
    }
    if (currentRecord.nome) list.push(currentRecord);
    console.log("Fallback items:", list.length);
    console.log(JSON.stringify(list, null, 2));
}
