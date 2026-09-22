const arabicMap = {
  "ا":"a","أ":"a","إ":"i","آ":"a","ب":"b","ت":"t","ث":"th","ج":"j","ح":"h","خ":"kh",
  "د":"d","ذ":"th","ر":"r","ز":"z","س":"s","ش":"sh","ص":"s","ض":"d","ط":"t","ظ":"z",
  "ع":"a","غ":"gh","ف":"f","ق":"q","ك":"k","ل":"l","م":"m","ن":"n","ه":"h","ة":"a",
  "و":"w","ؤ":"w","ي":"y","ى":"a","ئ":"y","ء":"","َ":"","ً":"","ُ":"","ٌ":"","ِ":"","ٍ":"","ْ":"","ّ":""
};

const preferredNames = {
  "صفوان":"safwan","محمد":"mohammad","محمود":"mahmoud","أحمد":"ahmad","احمد":"ahmad",
  "علي":"ali","عمر":"omar","يوسف":"yousef","خالد":"khaled","حسن":"hassan","حسين":"hussein",
  "مصطفى":"mustafa","عبدالله":"abdullah","عبد":"abd","رامي":"rami","سامر":"samer"
};

function transliterateFirstName(fullName) {
  const firstName = String(fullName || "").trim().split(/\s+/)[0] || "user";
  if (preferredNames[firstName]) return preferredNames[firstName];

  const value = [...firstName].map((char) => arabicMap[char] ?? char).join("");
  const cleaned = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return cleaned || "user";
}

async function nextAvailableUsername(connection, fullName) {
  const base = transliterateFirstName(fullName).slice(0, 20);
  let candidate = base;

  for (let suffix = 1; suffix < 10000; suffix += 1) {
    const [rows] = await connection.execute(
      "SELECT 1 FROM customers WHERE username = ? LIMIT 1",
      [candidate]
    );
    if (rows.length === 0) return candidate;

    const number = String(suffix + 1);
    candidate = base.slice(0, Math.max(1, 20 - number.length)) + number;
  }

  throw new Error("USERNAME_GENERATION_FAILED");
}

module.exports = { transliterateFirstName, nextAvailableUsername };
