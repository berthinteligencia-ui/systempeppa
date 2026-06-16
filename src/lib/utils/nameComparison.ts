export function cleanAndNormalizeString(str: string): string {
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

export function simplifySpelling(word: string): string {
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

export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
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

export function getStringSimilarity(s1: string, s2: string): number {
  const distance = getLevenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;
  return (maxLength - distance) / maxLength;
}

export function isNameMatch(name1: string, name2: string): boolean {
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
  const matchesAll = (listA: string[], listB: string[]) => {
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
