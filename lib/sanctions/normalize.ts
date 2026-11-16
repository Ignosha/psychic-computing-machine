// Name normalization shared by indexing and queries.
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y",
  ь: "", э: "e", ю: "yu", я: "ya", і: "i", ї: "yi", є: "ye", ґ: "g", ў: "u",
};
const SPECIAL: Record<string, string> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", ł: "l", đ: "d", ð: "d", þ: "th", ı: "i" };

// Legal forms and filler words that carry no identifying signal.
const STOP = new Set([
  "llc", "ltd", "limited", "inc", "incorporated", "co", "company", "corp", "corporation", "gmbh", "sa", "sas", "sarl", "srl", "spa",
  "ag", "bv", "nv", "plc", "llp", "lp", "jsc", "pjsc", "ojsc", "cjsc", "ooo", "oao", "zao", "pao", "ao", "fzc", "fze", "fzco", "dmcc",
  "liability", "joint", "stock", "public", "closed", "open", "the", "of", "and", "for", "de", "la", "le", "el", "del", "der", "und",
  "mr", "mrs", "ms", "dr", "obshchestvo", "s", "ogranichennoi", "otvetstvennostyu", "aktsionernoe", "publichnoe", "tov", "pt", "sdn", "bhd",
]);

export function transliterate(s: string): string {
  let out = "";
  for (const ch of s.toLowerCase()) out += CYRILLIC[ch] ?? SPECIAL[ch] ?? ch;
  return out;
}

export function normalize(s: string): string {
  return transliterate(
    s.replace(/\([^)]*\)/g, " ") // drop parenthetical notes like "(birth name)"
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
  )
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokens(s: string): string[] {
  const all = normalize(s).split(" ").filter(Boolean);
  const kept = all.filter((t) => !STOP.has(t));
  return kept.length ? kept : all; // a name made only of stop words keeps them
}

// Phonetic skeleton: folds common transliteration variants (kh/h, ph/f, q/k, z/s, y/i, w/v, ou/u, doubled letters).
export function skeleton(t: string): string {
  const s = t
    .replace(/ph/g, "f").replace(/kh/g, "h").replace(/gh/g, "g").replace(/ck/g, "k").replace(/q/g, "k").replace(/c(?=[aou]|$)/g, "k")
    .replace(/c/g, "s").replace(/z/g, "s").replace(/x/g, "ks").replace(/y/g, "i").replace(/w/g, "v").replace(/j/g, "dj")
    .replace(/ou/g, "u").replace(/ee/g, "i").replace(/oo/g, "u").replace(/(.)\1+/g, "$1");
  return s[0] + s.slice(1).replace(/[aeiou]/g, "");
}
