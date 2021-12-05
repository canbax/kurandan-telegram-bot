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
    console.log(req);
    res.write("Hiii");
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
  try {
    const { body } = await got(URL + "setWebhook?url=https://");
    console.log(body);
    const b = JSON.parse(body);
    return b.result.url.length > 0;
  } catch (err) {
    console.log("Error: ", err);
  }
}

async function executer() {
  const e = await hasWebhook();
  console.log(e);
}

executer();
