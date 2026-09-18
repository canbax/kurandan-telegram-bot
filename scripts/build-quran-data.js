#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const got = require("got");

const { pack, SURAH_COUNT } = require("../src/qdb");
const { surah2verseCount } = require("../src/data");

/**
 * Regenerates `data/quran/*.qdb` and `src/editions.js` from
 * https://github.com/fawazahmed0/quran-api (branch `1`).
 *
 * Run by hand with `npm run build:data`; the output is committed. It is not
 * part of the Vercel build, which has no business downloading 27 files on a
 * cold start and could not write them anywhere if it did.
 *
 * Reads `database/chapterverse/` rather than `database/originals/`: same texts,
 * but each line already carries its own "surah|verse|" prefix, so no line
 * number has to be mapped onto a verse.
 */

const SOURCE_BASE =
  "https://raw.githubusercontent.com/fawazahmed0/quran-api/1/database/chapterverse";

const TOTAL_VERSES = 6236;

const DATA_DIR = path.join(__dirname, "..", "data", "quran");
const EDITIONS_MODULE = path.join(__dirname, "..", "src", "editions.js");
const ATTRIBUTION_FILE = path.join(DATA_DIR, "ATTRIBUTION.md");

/**
 * The translations to bundle, with the display name used in the message footer.
 *
 * Upstream's own metadata spells the names in plain ASCII ("Ali Bulac",
 * "Celal Y Ld R M"), so the names below are maintained here instead. Where a
 * translator was already in the old acikkuran author list, that spelling is
 * kept so the messages read exactly as they did before.
 *
 * Deliberately excluded:
 *   - every `*-la` edition: ASCII-folded, the Turkish letters are gone.
 *   - `tur-diyanetisleri1`: partially folded, has lost ş/ğ/ı/İ.
 *   - `tur-latinalphabet`, `tur-latinalphabet1`, `tur-muhammetabay`:
 *     transliterations of the Arabic, not mealler, so "... meali" would lie.
 *
 * Several translators appear more than once upstream as genuinely different
 * revisions (the three Öztürk texts share only 57-81% of their verses), so they
 * are all kept and given names that tell them apart in the footer.
 */
const EDITIONS = [
  ["tur-abdulbakigolpin", "Abdülbaki Gölpınarlı", null],
  ["tur-ademugur", "Adem Uğur", null],
  ["tur-alibulac", "Ali Bulaç", "Kur'an-ı Kerim ve Türkçe Anlamı"],
  ["tur-alifikriyavuz", "Ali Fikri Yavuz", null],
  ["tur-celalyldrm", "Celal Yıldırım", null],
  ["tur-diyanetisleri", "Diyanet İşleri", "Kur'an-ı Kerim Türkçe Meali"],
  ["tur-diyanetvakfi", "Diyanet Vakfı", null],
  ["tur-edipyuksel", "Edip Yüksel", "Mesaj: Kuran Çevirisi"],
  ["tur-elmalilihamdiya", "Elmalılı Hamdi Yazır", "Kur'an-ı Kerim ve Yüce Meali"],
  ["tur-elmallsadelesti", "Elmalılı (sadeleştirilmiş)", null],
  ["tur-elmallsadelesti1", "Elmalılı (sadeleştirilmiş 2)", null],
  ["tur-fizilalilkuran", "Fizilal-il Kuran", null],
  ["tur-gultekinonan", "Gültekin Onan", null],
  ["tur-hasanbasricanta", "Hasan Basri Çantay", "Kur'an-ı Hakim ve Meal-i Kerim"],
  ["tur-ibnikesir", "İbni Kesir", null],
  ["tur-iskenderalimihr", "İskender Ali Mihr", null],
  ["tur-muhammedesed", "Muhammed Esed", "Kur'an Mesajı"],
  ["tur-muslimshahin", "Muslim Shahin", null],
  ["tur-sabanpiris", "Şaban Piriş", "Kur'an-ı Kerim Türkçe Anlamı"],
  ["tur-shabanbritch", "Shaban Britch", null],
  ["tur-suatyildirim", "Suat Yıldırım", "Kuran-ı Kerim ve Meali"],
  ["tur-suleymanates", "Süleyman Ateş", "Kur'an-ı Kerim ve Yüce Meali"],
  ["tur-tefhimulkuran", "Tefhimu'l Kur'an", null],
  ["tur-wwwislamhouseco", "İslamhouse.com", null],
  ["tur-yasarnuriozturk", "Yaşar Nuri Öztürk", "Kur'an-ı Kerim Meali"],
  ["tur-yasarnuriozturk1", "Yaşar Nuri Öztürk (2)", null],
  ["tur-ynozturk", "Y. N. Öztürk", null],
];

/**
 * Splits the downloaded file into its verse lines and its trailing metadata.
 *
 * Upstream appends a pretty-printed JSON object after the last verse, so the
 * split point is the last newline that starts an object.
 *
 * @param {string} raw
 * @returns {{ lines: string[], meta: object }}
 */
function splitPayload(raw) {
  const at = raw.lastIndexOf("\n{");
  if (at === -1) {
    throw new Error("no trailing metadata object found");
  }
  return {
    lines: raw.slice(0, at).split("\n"),
    meta: JSON.parse(raw.slice(at + 1)),
  };
}

/**
 * Removes the stray footnote markers upstream carries (a bare "*" with no
 * footnote text anywhere to reference) and tidies the whitespace they leave.
 *
 * @param {string} text
 */
function normalize(text) {
  return text.replace(/\*/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Turns "surah|verse|text" lines into 114 arrays of verses, checking as it goes
 * that the file really is a complete Qur'an in the expected order.
 *
 * @param {string[]} lines
 * @returns {string[][]}
 */
function toSurahs(lines) {
  if (lines.length !== TOTAL_VERSES) {
    throw new Error(`expected ${TOTAL_VERSES} verses, got ${lines.length}`);
  }

  const surahs = Array.from({ length: SURAH_COUNT }, () => []);

  lines.forEach((line, i) => {
    const first = line.indexOf("|");
    const second = line.indexOf("|", first + 1);
    if (first === -1 || second === -1) {
      throw new Error(`line ${i + 1} is not "surah|verse|text"`);
    }

    const surahId = Number(line.slice(0, first));
    const verseId = Number(line.slice(first + 1, second));
    // The text itself may contain "|", so everything after the second one is it.
    const text = normalize(line.slice(second + 1));

    if (!(surahId >= 1 && surahId <= SURAH_COUNT)) {
      throw new Error(`line ${i + 1} has surah ${surahId}`);
    }
    if (verseId !== surahs[surahId - 1].length + 1) {
      throw new Error(
        `line ${i + 1}: expected verse ${surahs[surahId - 1].length + 1} of surah ` +
          `${surahId}, got ${verseId} (verses must arrive in order)`
      );
    }
    if (text === "") {
      throw new Error(`verse ${surahId}/${verseId} is empty after normalising`);
    }

    surahs[surahId - 1].push(text);
  });

  surahs.forEach((verses, i) => {
    const expected = surah2verseCount[i + 1];
    if (verses.length !== expected) {
      throw new Error(
        `surah ${i + 1}: expected ${expected} verses, got ${verses.length}`
      );
    }
  });

  return surahs;
}

/**
 * Writes `src/editions.js`, the manifest `passage.js` picks a translator from.
 *
 * @param {{ id: string, name: string, description: string | null }[]} editions
 */
function writeEditionsModule(editions) {
  const entries = editions
    .map(({ id, name, description }) => {
      const desc = description === null ? "null" : JSON.stringify(description);
      return (
        `  {\n` +
        `    id: ${JSON.stringify(id)},\n` +
        `    name: ${JSON.stringify(name)},\n` +
        `    description: ${desc},\n` +
        `  },`
      );
    })
    .join("\n");

  const source =
    `// Generated by scripts/build-quran-data.js - do not edit by hand.\n` +
    `//\n` +
    `// One entry per bundled translation. \`id\` is both the translator key passed\n` +
    `// to the Qur'an client and the basename of its file in data/quran/.\n` +
    `\n` +
    `const editions = [\n${entries}\n];\n` +
    `\n` +
    `module.exports = { editions };\n`;

  fs.writeFileSync(EDITIONS_MODULE, source, "utf8");
}

/**
 * Records where each text came from, so the credit the README used to give the
 * Açık Kuran API does not simply disappear.
 *
 * @param {{ id: string, name: string, meta: object, bytes: number }[]} built
 */
function writeAttribution(built) {
  const rows = built
    .map(
      ({ id, name, meta }) =>
        `| ${name} | \`${id}\` | ${meta.author || "-"} | ${meta.source || "-"} |`
    )
    .join("\n");

  const total = built.reduce((sum, e) => sum + e.bytes, 0);

  const body =
    `# Kaynaklar\n\n` +
    `Bu dizindeki \`.qdb\` dosyaları\n` +
    `[fawazahmed0/quran-api](https://github.com/fawazahmed0/quran-api) deposunun\n` +
    `\`1\` dalındaki \`database/chapterverse/\` dizininden üretilmiştir.\n\n` +
    `Üretim tarihi: ${new Date().toISOString().slice(0, 10)}\n` +
    `Meal sayısı: ${built.length} - toplam ${(total / 1e6).toFixed(1)} MB\n\n` +
    `Yeniden üretmek için: \`npm run build:data\`\n\n` +
    `| Meal | Dosya | Üst kaynaktaki ad | Kaynak |\n` +
    `| --- | --- | --- | --- |\n${rows}\n`;

  fs.writeFileSync(ATTRIBUTION_FILE, body, "utf8");
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const built = [];

  for (const [id, name, description] of EDITIONS) {
    process.stdout.write(`${id} ... `);

    const { body } = await got(`${SOURCE_BASE}/${id}.txt`, {
      retry: 2,
      timeout: 60000,
    });

    let surahs;
    let meta;
    try {
      const payload = splitPayload(body);
      meta = payload.meta;
      surahs = toSurahs(payload.lines);
    } catch (err) {
      throw new Error(`${id}: ${err.message}`);
    }

    const packed = pack(surahs);
    fs.writeFileSync(path.join(DATA_DIR, `${id}.qdb`), packed);

    built.push({ id, name, description, meta, bytes: packed.length });
    console.log(`${(packed.length / 1024).toFixed(0)} KB`);
  }

  writeEditionsModule(built);
  writeAttribution(built);

  const total = built.reduce((sum, e) => sum + e.bytes, 0);
  console.log(
    `\n${built.length} meal, ${(total / 1e6).toFixed(1)} MB -> ${path.relative(
      process.cwd(),
      DATA_DIR
    )}`
  );
}

main().catch((err) => {
  console.error(`\nbuild failed: ${err.message}`);
  process.exit(1);
});
