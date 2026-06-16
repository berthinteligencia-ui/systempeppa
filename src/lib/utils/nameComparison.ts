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
  
  // Simplify double consonants (e.g. ll -> l, tt -> t)
  w = w.replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, "$1");
  
  // Common phonetic spelling variations in Brazilian names
  w = w.replace(/ph/g, "f");
  w = w.replace(/th/g, "t");
  w = w.replace(/ck/g, "c");
  w = w.replace(/k/g, "c");
  w = w.replace(/y/g, "i");
  w = w.replace(/z/g, "s");
  w = w.replace(/w/g, "v"); // e.g. Walter / Valter, Wesley / Vesley
  
  // Remove silent 'h' except in digraphs ch, lh, nh
  w = w.replace(/([^cln])h/g, "$1");
  w = w.replace(/^h/g, "");

  // M/N spelling variation (e.g. Bomfim vs Bonfim)
  w = w.replace(/m(?=[bpfv])/g, "n");
  w = w.replace(/m$/g, "n");

  return w;
}

export function isNameMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;

  const norm1 = cleanAndNormalizeString(name1);
  const norm2 = cleanAndNormalizeString(name2);

  if (norm1 === norm2) return true;

  // Split into words, ignore common prepositions
  const prepositions = new Set(["de", "da", "do", "das", "dos", "e"]);
  const words1 = norm1.split(" ").filter(w => w && !prepositions.has(w));
  const words2 = norm2.split(" ").filter(w => w && !prepositions.has(w));

  if (words1.length === 0 || words2.length === 0) return false;

  const simplifiedWords1 = words1.map(simplifySpelling);
  const simplifiedWords2 = words2.map(simplifySpelling);

  const simplified1 = simplifiedWords1.join(" ");
  const simplified2 = simplifiedWords2.join(" ");

  // Full simplified check or substring check
  if (simplified1 === simplified2 || simplified1.includes(simplified2) || simplified2.includes(simplified1)) {
    return true;
  }

  // Check abbreviation alignment (e.g. O. -> Oliveira)
  if (simplifiedWords1.length === simplifiedWords2.length) {
    let allMatch = true;
    for (let i = 0; i < simplifiedWords1.length; i++) {
      const w1 = simplifiedWords1[i];
      const w2 = simplifiedWords2[i];
      if (w1 === w2) continue;
      // If one is an initial of the other
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
