// require("./env");
const express = require("express");
const app = express();
const got = require("got");
const staticData = require("./data");
const hp = require("./helper");
const bodyParser = require("body-parser");
const STR_LIMIT = 280;

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
  const verseId = hp.getRandomInt(1, verseCount);
  const randomAuthorIdx = hp.getRandomInt(0, staticData.authorIds.length - 1);
  const authorId = staticData.authorIds[randomAuthorIdx];
  const { body } = await got(
    `https://api.acikkuran.com/surah/${surahId}/verse/${verseId}?author=${authorId}`
  );
  const b = JSON.parse(body);
  const txt = b.data.translation.text;
  const footnotes = b.data.translation.footnotes;
  let f = "";
  if (footnotes) {
    f = "\n" + footnotes.map((x, i) => `[${i}] ${x.text}`).join(" ");
  }
  const author = b.data.translation.author.name;
  let footer = `\n${author},${b.data.surah.name} ${surahId}/${verseId}`;
  let remaningSize = STR_LIMIT - footer.length;
  let str = "";
  while (remaningSize > 0) {
    if (txt.length <= remaningSize) {
      str += txt;
      remaningSize -= txt.length;
    } else {
      str += txt.substring(0, remaningSize - 3) + "...";
      break;
    }
    if (footnotes) {
      str += f;
      remaningSize -= f.length;
    } else {
      str += f.substring(0, remaningSize - 3) + "...";
      break;
    }
  }
  str += footer;
  return str;
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
