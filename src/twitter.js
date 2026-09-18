const crypto = require("crypto");
const got = require("got");
const OAuth = require("oauth-1.0a");

const TWEET_ENDPOINT = "https://api.twitter.com/2/tweets";

/**
 * Posts tweets through the v2 API, signed with OAuth 1.0a user context.
 *
 * @param {object} args
 * @param {string} args.consumerKey
 * @param {string} args.consumerSecret
 * @param {string} args.accessToken
 * @param {string} args.accessTokenSecret
 * @param {(url: string, options: object) => Promise<unknown>} [args.post]
 */
function createTwitterClient({
  consumerKey,
  consumerSecret,
  accessToken,
  accessTokenSecret,
  post = defaultPost,
}) {
  const oauth = OAuth({
    consumer: { key: consumerKey, secret: consumerSecret },
    signature_method: "HMAC-SHA1",
    hash_function: (baseString, key) =>
      crypto.createHmac("sha1", key).update(baseString).digest("base64"),
  });

  /** @param {string} text */
  async function sendTweet(text) {
    const authHeader = oauth.toHeader(
      oauth.authorize(
        { url: TWEET_ENDPOINT, method: "POST" },
        { key: accessToken, secret: accessTokenSecret }
      )
    );

    return post(TWEET_ENDPOINT, {
      json: { text },
      responseType: "json",
      headers: {
        Authorization: authHeader["Authorization"],
        "user-agent": "v2CreateTweetJS",
        "content-type": "application/json",
        accept: "application/json",
      },
    });
  }

  return { sendTweet };
}

async function defaultPost(url, options) {
  const { body } = await got.post(url, options);
  return body;
}

module.exports = { createTwitterClient, TWEET_ENDPOINT };
