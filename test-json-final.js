const item = {
    "CPF": "062.193.526-37",
    "Status": "LIBERADO"
};

const getVal = (row, keys) => {
    const foundKey = Object.keys(row).find(k => keys.includes(k.toLowerCase()) || keys.includes(k));
    return foundKey ? row[foundKey] : undefined;
};

const nome = getVal(item, ['nome', 'name', 'funcionario', 'employeeName', 'recebedor']) || "Não detectado";
const cpf = getVal(item, ['cpf', 'cpf_cnpj', 'taxid', 'cnpj', 'documento', 'cpfcnpj']) || "";
const situacao = getVal(item, ['situacao', 'status', 'state']) || "PROCESSADO";

console.log("Extracted Data:", {
    nome: String(nome).trim(),
    cpf: String(cpf).replace(/\D/g, ""),
    situacao: String(situacao).trim().toUpperCase()
});
