// Let's write the functions inline for the scratch test to make it run instantly with node.js
function cleanAndNormalizeString(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s]/g, " ") // keep only alphanumeric and spaces
    .replace(/\s+/g, " ")
    .trim();
}

function simplifySpelling(word) {
  if (!word) return "";
  let w = word;
  
  // Simplify double consonants (e.g. ll -> l, tt -> t)
  w = w.replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, "$1");
  
  // Common phonetic spelling variations in Brazilian names
  w = w.replace(/ph/g, "f");
  w = w.replace(/th/g, "t");
  w = w.replace(/ck/g, "c");
  w = w.replace(/k/g, "c");
  w = w.replace(/y/g, "i");
  w = w.replace(/z/g, "s");
  w = w.replace(/w/g, "v");
  
  // Remove silent 'h' except in digraphs ch, lh, nh
  w = w.replace(/([^cln])h/g, "$1");
  w = w.replace(/^h/g, "");

  // M/N spelling variation (e.g. Bomfim vs Bonfim)
  w = w.replace(/m(?=[bpfv])/g, "n");
  w = w.replace(/m$/g, "n");

  return w;
}

function testIsNameMatch(name1, name2) {
  if (!name1 || !name2) return false;

  const norm1 = cleanAndNormalizeString(name1);
  const norm2 = cleanAndNormalizeString(name2);

  if (norm1 === norm2) return true;

  const prepositions = new Set(["de", "da", "do", "das", "dos", "e"]);
  const words1 = norm1.split(" ").filter(w => w && !prepositions.has(w));
  const words2 = norm2.split(" ").filter(w => w && !prepositions.has(w));

  if (words1.length === 0 || words2.length === 0) return false;

  const simplifiedWords1 = words1.map(simplifySpelling);
  const simplifiedWords2 = words2.map(simplifySpelling);

  const simplified1 = simplifiedWords1.join(" ");
  const simplified2 = simplifiedWords2.join(" ");

  if (simplified1 === simplified2 || simplified1.includes(simplified2) || simplified2.includes(simplified1)) {
    return true;
  }

  if (simplifiedWords1.length === simplifiedWords2.length) {
    let allMatch = true;
    for (let i = 0; i < simplifiedWords1.length; i++) {
      const w1 = simplifiedWords1[i];
      const w2 = simplifiedWords2[i];
      if (w1 === w2) continue;
      if ((w1.length === 1 && w2.startsWith(w1)) || (w2.length === 1 && w1.startsWith(w2))) {
        continue;
      }
      allMatch = false;
      break;
    }
    if (allMatch) return true;
  }

  return false;
}

const testCases = [
  // Case / Accents / S vs Z
  { n1: "LUIZ CARLOS OLIVEIRA DA SILVA", n2: "Luís Carlos Oliveira Da Silva", expected: true },
  
  // Y vs I
  { n1: "JURACY XAVIER ROCHA RAMOS", n2: "Juraci Xavier Rocha Ramos", expected: true },
  
  // CK vs C
  { n1: "JACKSON SANTOS BOMFIM", n2: "Jacson Santos Bomfim", expected: true },
  
  // Abbreviations & S vs Z
  { n1: "JOSIVANDA PACHECO DE O. SOUSA", n2: "Josivanda Pacheco De Oliveira Sousa", expected: true },

  // Bomfim vs Bonfim (M vs N spelling)
  { n1: "DANIEL BONFIM", n2: "Daniel Bomfim", expected: true },

  // Substring matching
  { n1: "LUIZ CARLOS", n2: "LUIZ CARLOS OLIVEIRA DA SILVA", expected: true },
  { n1: "Luís Carlos Oliveira Da Silva", n2: "Luis Carlos", expected: true },

  // Completely different names
  { n1: "LUIZ CARLOS OLIVEIRA DA SILVA", n2: "MARIA DA SILVA", expected: false },
  { n1: "JURACY XAVIER ROCHA RAMOS", n2: "JURACI SILVA", expected: false },
]

console.log("--- Executando Testes de Comparação de Nomes ---");
let passCount = 0;
for (const tc of testCases) {
  const result = testIsNameMatch(tc.n1, tc.n2);
  const pass = result === tc.expected;
  if (pass) {
    passCount++;
    console.log(`✅ PASS: "${tc.n1}" vs "${tc.n2}" => ${result}`);
  } else {
    console.log(`❌ FAIL: "${tc.n1}" vs "${tc.n2}" => esperado: ${tc.expected}, obtido: ${result}`);
  }
}

console.log(`\nResultado: ${passCount}/${testCases.length} testes passaram.`);
if (passCount !== testCases.length) {
  process.exit(1);
}
