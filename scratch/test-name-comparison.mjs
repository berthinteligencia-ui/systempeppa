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
  
  // Simplify double consonants
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

  // M/N spelling variation
  w = w.replace(/m(?=[bpfv])/g, "n");
  w = w.replace(/m$/g, "n");

  return w;
}

function getLevenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function getStringSimilarity(s1, s2) {
  const distance = getLevenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;
  return (maxLength - distance) / maxLength;
}

function testIsNameMatch(name1, name2) {
  if (!name1 || !name2) return false;

  const norm1 = cleanAndNormalizeString(name1);
  const norm2 = cleanAndNormalizeString(name2);

  if (norm1 === norm2) return true;

  const prepositions = new Set(["de", "da", "do", "das", "dos", "e"]);
  const words1 = norm1.split(" ").filter(w => w && !prepositions.has(w)).map(simplifySpelling);
  const words2 = norm2.split(" ").filter(w => w && !prepositions.has(w)).map(simplifySpelling);

  if (words1.length === 0 || words2.length === 0) return false;

  // 1. Equal sorted words (different word order)
  const sorted1 = [...words1].sort().join(" ");
  const sorted2 = [...words2].sort().join(" ");
  if (sorted1 === sorted2) return true;

  // 2. Prefix / Abbreviation matching
  const matchesAll = (listA, listB) => {
    return listA.every(wA => 
      listB.some(wB => 
        wA === wB || 
        (wA.length >= 3 && wB.startsWith(wA)) || 
        (wB.length >= 3 && wA.startsWith(wB)) ||
        (wA.length === 1 && wB.startsWith(wA)) ||
        (wB.length === 1 && wA.startsWith(wB))
      )
    );
  };

  if (matchesAll(words1, words2) || matchesAll(words2, words1)) {
    return true;
  }

  // 3. String similarity based on Levenshtein (typos, like Ferreira vs Pereira)
  const simplified1 = words1.join(" ");
  const simplified2 = words2.join(" ");
  const similarity = getStringSimilarity(simplified1, simplified2);
  if (similarity >= 0.82) {
    return true;
  }

  return false;
}

const testCases = [
  // User's specific cases from screenshots
  { n1: "ELOI JOSE FERREIRA NETO", n2: "Eloi Jose Pereira Neto", expected: true },
  { n1: "REGIANE DE JESUS VASCONCELOS SILVA", n2: "Regiane De Jesus Vasconcelos Silva", expected: true },
  { n1: "CLEIDIANE DE JESUS SILVA", n2: "Cleidiane Silva De Jesus", expected: true },
  { n1: "SUSY CLAY SILVA NASC. ROCHA", n2: "Susy Clay Silva Nascimento Rocha", expected: true },
  
  // Basic cases
  { n1: "LUIZ CARLOS OLIVEIRA DA SILVA", n2: "Luís Carlos Oliveira Da Silva", expected: true },
  { n1: "JURACY XAVIER ROCHA RAMOS", n2: "Juraci Xavier Rocha Ramos", expected: true },
  { n1: "JACKSON SANTOS BOMFIM", n2: "Jacson Santos Bomfim", expected: true },
  { n1: "JOSIVANDA PACHECO DE O. SOUSA", n2: "Josivanda Pacheco De Oliveira Sousa", expected: true },
  { n1: "DANIEL BONFIM", n2: "Daniel Bomfim", expected: true },
  { n1: "LUIZ CARLOS", n2: "LUIZ CARLOS OLIVEIRA DA SILVA", expected: true },

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

