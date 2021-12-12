require("./env");
const express = require("express");
const app = express();
const got = require("got");
const bodyParser = require("body-parser");

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
    console.log(req.body);
    res.write("received telegram update: ", req.body);
    res.end();
  } catch (err) {
    errResponseFn(err, res);
  }
});

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
    console.log(body);
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
    console.log(body);
    const b = JSON.parse(body);
    return b.result.url.length > 0;
  } catch (err) {
    console.log("Error: ", err);
  }
}

async function setCommands() {
  try {
    const b = {
      commands: [
        { command: "rasgele", description: "rasgele kısımlar getirir" },
        {
          command: "getir",
          description:
            "x,y,z pozitif tam sayılar olmak üzere '/getir x/y' ya da '/getir x/y-z' komutları ile x. surenin y. ayetini ya da [y,z] aralığındaki ayetleri getirir ",
        },
      ],
    };
    const { body } = await got.post(URL + "setMyCommands", { json: b });
    console.log(body);
  } catch (err) {
    console.log("Error: ", err);
  }
}

async function main() {
  // app.use(express.static('public'));
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log("proxy server on " + PORT));

  await setWebhook();
  await setCommands();
}

main();
