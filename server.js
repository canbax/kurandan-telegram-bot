// require("./env");
const express = require("express");
const app = express();
const got = require("got");
const staticData = require("./data");
const hp = require("./helper");
const bodyParser = require("body-parser");
const CHAR_LIMIT = 275;

// allow every browser to get response from this server, this MUST BE AT THE TOP
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.use(bodyParser.json());

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("'TELEGRAM_BOT_TOKEN' should be an environment variable");
  return -1;
}
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const URL = "https://api.telegram.org/bot" + TOKEN + "/";

function errResponseFn(err, res) {
  console.log(err);
  res.write("Error: ", JSON.stringify(err));
  res.end();
}

// get echo
app.get("/", async (req, res) => {
  try {
    console.log("Hi!");
    res.write("Hi!");
    res.end();
  } catch (err) {
    errResponseFn(err, res);
  }
});

// get echo
app.post("/tupdate", async (req, res) => {
  try {
    console.log("telegram update come with message: ", req.body.message.text);
    await processInput(req.body.message.text, req.body.message.chat.id);
    res.write("received telegram update: ", req.body);
    res.end();
  } catch (err) {
    console.log("request body: ", typeof req.body, req.body);
    errResponseFn(err, res);
  }
});

async function processInput(txt, chatId) {
  if (txt == "/rasgele") {
    let s = await getRandomFragments();
    console.log("msg: ", s);
    const { body } = await got.post(URL + "sendMessage", {
      json: { chat_id: chatId, text: s },
    });
    console.log("response to send message: ", body);
  }
}

async function getRandomFragments() {
  const surahId = hp.getRandomInt(1, 114);
  const verseCount = staticData.surah2verseCount[surahId];
  let verseId = hp.getRandomInt(1, verseCount);
  const randomAuthorIdx = hp.getRandomInt(0, staticData.authorIds.length - 1);
  const authorId = staticData.authorIds[randomAuthorIdx];
  let { txt, footnotes } = await getVerseAndFootnotes(
    surahId,
    verseId,
    authorId
  );
  const author = b.data.translation.author.name;
  let footer = `\n${author} meali, ${b.data.surah.name} ${surahId}/${verseId}`;
  let remaningSize = CHAR_LIMIT - footer.length;
  let str = "";
  let verseCount = 1;
  while (remaningSize > 0) {
    if (txt.length <= remaningSize) {
      str += txt;
      remaningSize -= txt.length;
    } else {
      str += txt.substring(0, remaningSize - 3) + "...";
      break;
    }
    if (footnotes) {
      if (footnotes.length <= remaningSize) {
        str += footnotes;
        remaningSize -= footnotes.length;
      } else {
        str += footnotes.substring(0, remaningSize - 3) + "...";
        break;
      }
    }
    // it is the last verse
    if (verseId == staticData.surah2verseCount[surahId]) {
      break;
    }
    verseId++;
    const o = await getVerseAndFootnotes(surahId, verseId, authorId);
    verseCount++;
    txt = o.txt;
    footnotes = o.footnotes;
  }
  str += footer;
  if (verseCount > 1) {
    footer += "-" + verseId;
  }
  return str;
}

async function getVerseAndFootnotes(surahId, verseId, authorId) {
  const { body } = await got(
    `https://api.acikkuran.com/surah/${surahId}/verse/${verseId}?author=${authorId}`
  );
  const b = JSON.parse(body);
  let txt = b.data.translation.text;
  let footnotes = "";
  if (b.data.translation.footnotes) {
    footnotes =
      "\n" +
      b.data.translation.footnotes.map((x, i) => `[${i}] ${x.text}`).join(" ");
  }
  return { txt, footnotes };
}

async function getBotInfo() {
  try {
    const { body } = await got(URL + "getMe");
    console.log(body);
    return body;
  } catch (err) {
    console.log("Error: ", err);
  }
}

async function hasWebhook() {
  try {
    const { body } = await got(URL + "getWebhookInfo");
    const b = JSON.parse(body);
    return b.result.url.length > 0;
  } catch (err) {
    console.log("Error: ", err);
  }
}

async function setWebhook() {
  const webhook = "https://kurandan.herokuapp.com/tupdate";
  try {
    if (await hasWebhook()) {
      return;
    }
    const { body } = await got(URL + "setWebhook?url=" + webhook);
    const b = JSON.parse(body);
    return b.result.url.length > 0;
  } catch (err) {
    console.log("Error: ", err);
  }
}

async function setCommands() {
  try {
    const b = {
      commands: [{ command: "rasgele", description: "rasgele getirir" }],
    };
    const { body } = await got.post(URL + "setMyCommands", { json: b });
  } catch (err) {
    console.log("Error: ", err);
  }
}

async function main() {
  // app.use(express.static('public'));
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log("server on " + PORT));

  await setWebhook();
  await setCommands();
}

main();
