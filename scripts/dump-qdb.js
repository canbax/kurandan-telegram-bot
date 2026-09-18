#!/usr/bin/env node
// Usage: node scripts/dump-qdb.js <file.qdb> [surah] [verse]
//   no surah  -> one line per surah: "<n>: <verse count>"
//   surah     -> that surah's verses, numbered
//   + verse   -> just that verse
const fs = require("fs");
const { parseHeader, unpackBlock } = require("../src/qdb");

const [file, surahArg, verseArg] = process.argv.slice(2);
if (!file) {
  console.error("usage: node scripts/dump-qdb.js <file.qdb> [surah] [verse]");
  process.exit(1);
}

const buf = fs.readFileSync(file);
const index = parseHeader(buf);
const read = (i) => unpackBlock(buf.subarray(index[i].offset, index[i].offset + index[i].length));

if (!surahArg) {
  index.forEach((_, i) => console.log(`${i + 1}: ${read(i).length} verses`));
  process.exit(0);
}

const surah = Number(surahArg);
if (!Number.isInteger(surah) || surah < 1 || surah > index.length) {
  console.error(`surah must be 1..${index.length}`);
  process.exit(1);
}

const verses = read(surah - 1);
if (!verseArg) {
  verses.forEach((v, i) => console.log(`${surah}:${i + 1}  ${v}`));
  process.exit(0);
}

const verse = Number(verseArg);
if (!Number.isInteger(verse) || verse < 1 || verse > verses.length) {
  console.error(`verse must be 1..${verses.length}`);
  process.exit(1);
}
console.log(verses[verse - 1]);
