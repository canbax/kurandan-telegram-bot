// require("./env");
const express = require("express");
const app = express();
const got = require("got");
const staticData = require("./data");
const hp = require("./helper");
const bodyParser = require("body-parser");
const session = require("express-session");
const LoginWithTwitter = require("login-with-twitter");
const CHAR_LIMIT = 275;
const sessionConfig = {
  user: null,
  tokenSecret: null,
  secret: "keyboard cat",
};

app.use(session(sessionConfig));

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
const welcomeMsg =
  "Merhaba. Ben Kur'an'dan pasajlar getiren bir botum :) /pasaj komutu ile rastgele pasaj getirebilirsiniz.";

function errResponseFn(err, res) {
  console.log(err);
  res.write("Error: ", JSON.stringify(err));
  res.end();
}

const tw = new LoginWithTwitter({
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackUrl: "https://kurandan.herokuapp.com/twitter_callback",
});

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
app.get("/twitter_success", async (req, res) => {
  res.write("twitter success!");
  res.end();
});

// get echo
app.get("/twitter_login", async (req, res) => {
  console.log("twitter login started");
  try {
    tw.login((err, tokenSecret, url) => {
      if (err) {
        // Handle the error your way
        console.log("err in twitter login: ", err);
      }

      // Save the OAuth token secret for use in your /twitter/callback route
      req.session.tokenSecret = tokenSecret;

      // Redirect to the /twitter/callback route, with the OAuth responses as query params
      res.redirect(url);
    });
  } catch (err) {
    console.log("error in tw login:", err);
    errResponseFn(err, res);
  }
});

// get echo
app.get("/twitter_callback", async (req, res) => {
  tw.callback(
    {
      oauth_token: req.query.oauth_token,
      oauth_verifier: req.query.oauth_verifier,
    },
    req.session.tokenSecret,
    (err, user) => {
      if (err) {
        // Handle the error your way
        console.log("err in twitter callback: ", err);
      }

      console.log("user: ", user);
      // Delete the tokenSecret securely
      delete req.session.tokenSecret;

      // The user object contains 4 key/value pairs, which
      // you should store and use as you need, e.g. with your
      // own calls to Twitter's API, or a Twitter API module
      // like `twitter` or `twit`.
      // user = {
      //   userId,
      //   userName,
      //   userToken,
      //   userTokenSecret
      // }
      // req.session.user = user;
      // Redirect to whatever route that can handle your new Twitter login user details!
      res.redirect("/twitter_success");
    }
  );
});

// get telegram updates using webhook
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

// get telegram updates using webhook
app.get("/tweet_test", async (req, res) => {
  try {
    let txt = await getRandomFragments();
    await sendTweet(txt);
    res.write("received tweet test");
    res.end();
  } catch (err) {
    console.log("request body: ", typeof req.body, req.body);
    errResponseFn(err, res);
  }
});

// respond to gitlab request
app.post("/daily", async (req, res) => {
  try {
    console.log("daily post: ", typeof req.body, req.body);
    if (req.body.pwd != TOKEN) {
      res.write("need password!");
      res.end();
    } else {
      let txt = await getRandomFragments();
      await sendTelegramMsg(txt, "@kurandanmesaj");
      await sendTweet(txt);
      res.write("received daily post from gitlab");
      res.end();
    }
  } catch (err) {
    console.log("request body: ", typeof req.body, req.body);
    errResponseFn(err, res);
  }
});

async function processInput(txt, chatId) {
  if (txt == "/pasaj") {
    let s = await getRandomFragments();
    await sendTelegramMsg(s, chatId);
  } else if (txt == "/start") {
    await sendTelegramMsg(welcomeMsg, chatId);
  }
}

async function sendTelegramMsg(msg, chatId) {
  await got.post(URL + "sendMessage", {
    json: { chat_id: chatId, text: msg },
  });
}

async function getRandomFragments() {
  const surahId = hp.getRandomInt(1, 114);
  const totalVerseCount = staticData.surah2verseCount[surahId];
  let verseId = hp.getRandomInt(1, totalVerseCount);
  const randomAuthorIdx = hp.getRandomInt(0, staticData.authors.length - 1);
  const authorId = staticData.authors[randomAuthorIdx].id;
  let { txt, footnotes } = await getVerseAndFootnotes(
    surahId,
    verseId,
    authorId
  );
  const author = staticData.authors[randomAuthorIdx].name;
  const surahName = staticData.surahs[surahId - 1].name;
  let footer = `\n${author} meali, ${surahName} ${surahId}/${verseId}`;
  let remaningSize = CHAR_LIMIT - footer.length;
  let str = "";
  const firstVerseId = verseId;
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
    txt = " " + o.txt;
    footnotes = o.footnotes;
  }
  if (verseId != firstVerseId) {
    footer += "-" + verseId;
  }
  str += footer;
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
      commands: [{ command: "pasaj", description: "Rastgele pasaj getirir" }],
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

async function sendTweet(txt) {
  const k = process.env.TWITTER_CONSUMER_KEY;
  const o = process.env.TWITTER_OAUTH_TOKEN;
  const authKey = `OAuth oauth_consumer_key="${k}",oauth_token="${o}",oauth_signature_method="HMAC-SHA1",oauth_timestamp="1639941876",oauth_nonce="u6S7dSpsmup",oauth_version="1.0",oauth_signature="lvosV38p1%2FAdwp1g64EuuPQji9U%3D"`;

  await got.post("https://api.twitter.com/2/tweets",
    {
      json: { text: txt },
      headers: { "Authorization": authKey, "Content-Type": "application/json" }
    });
}

main();
