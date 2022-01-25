<div align="center">
  <br />
  <p>
    <a href="https://github.com/SidisLiveYT/discord-botlists"><img src="https://raw.githubusercontent.com/SidisLiveYT/discord-botlists/main/.github/asserts/logo.svg" width="546" alt="discord-botlists" /></a>
  </p>
  <br />
<p>
<a href="https://discord.gg/MfME24sJ2a"><img src="https://img.shields.io/discord/795434308005134406?color=5865F2&logo=discord&logoColor=white" alt="Discord server" /></a>
<a href="https://www.npmjs.com/package/discord-botlists"><img src="https://img.shields.io/npm/v/discord-botlists.svg?maxAge=3600" alt="npm version" /></a>
<a href="https://www.npmjs.com/package/discord-botlists"><img src="https://img.shields.io/npm/dt/discord-botlists.svg?maxAge=3600" alt="npm downloads" /></a>
<a href="https://github.com/SidisLiveYT/discord-botlists/actions"><img src="https://github.com/discordjs/discord.js/workflows/Testing/badge.svg" alt="Tests status" /></a>
</p>
</div>

Multi-Discord-Botlist Management Package with 40+ Botlist Supported with Events and Stats Update Methods and More to Add if you want

## Installation

### Install **[discord-botlists](https://npmjs.com/package/discord-botlists)**

```sh
$ npm install --save discord-botlists
```

## [Documentation]("discord-botlists.js.org")

# Features

- Upvote/Vote Events Support 🚗
- Stats Posting Feature for Discord Bots to Multiple Botlists
- Better Event Handlers and Request Handlers
- Better Body Parsing for Incomplete request ( HTTP Post Request )

## Scheme :

```js
// Discord Bot Lists Data from the Client Side to the Official package

/**
 * "authorizationToken" -> Example Value -> "EyTYRbGciOiJIUasdIFAnR5cCI6IasApXVCJ9.eyJsaLPOsadadw423zMTQzMTM5NTc0NTk4HJKSIsImJvdCI6dad" -> Very Secret Botlist Token and Bot Specific and unique and need to hide for security
 * "authorizationValue" -> Example Value -> "Discord_Bot_1234OP" -> Self Made jsut to check for vote Webhooks
 **/

var discordBotlistData = {
  bladebotlist: {
    authorizationToken: "xxx-secrettokenhere-xxx",
    authorizationValue: "xxx-selfmade-AuthorizationValue-xxx",
  },
  topgg: {
    authorizationToken: "xxx-secrettokenhere-xxx",
    authorizationValue: "xxx-selfmade-AuthorizationValue-xxx",
  },
  boatspace: {
    authorizationToken: "xxx-secrettokenhere-xxx",
    authorizationValue: "xxx-selfmade-AuthorizationValue-xxx",
  },
  botlistme: {
    authorizationToken: "xxx-secrettokenhere-xxx",
    authorizationValue: "xxx-selfmade-AuthorizationValue-xxx",
  },
  botrix: {
    authorizationToken: "xxx-secrettokenhere-xxx",
    authorizationValue: "xxx-selfmade-AuthorizationValue-xxx",
  },
  discordlabs: {
    authorizationToken: "xxx-secrettokenhere-xxx",
    authorizationValue: "xxx-selfmade-AuthorizationValue-xxx",
  },
  //... "authorizationToken" is something secret and important where you had to "regen" in botlist's webhook page . and its quite long like larger than 25 characters at size
  //... many other botlist data just like above and where "authorizationValue"'s value should be value for "Authorization in HTTP POST request"
};

// Webhook Scheme
var webhookEndpoint = "discord-botlists";
// It will start accepting get and post request to -> "http://localhost:8080/discord-botlists" , where you can change listener port and ip address for pterodactyl users
```

## Point to be Noted :

**discordBotlistData Example from : [discordBotlistData Structured Data](https://github.com/SidisLiveYT/discord-botlists/blob/main/src/resources/global.md) | Where Object-Inner Values get changed with "authorizationToken" and "authorizationValue" Values | Only the name of the main key of the botlist is request like First one was "bladebotlist"**

## Example Code :

```js
const { BotLists } = require("discord-botlists");

// webhookEndpoint and discordBotlistData is from above scheme
const Botlist = new BotLists(
  "discord-botlists",
  discordBotlistData,
  8080,
  "127.0.0.1"
);

// Starting Botlists Vote Event webhook listening

new Promise(async (resolve) => {
  resolve(
    await Botlist.start(
      "discord-botlists",
      "https://github.com/SidisLiveYT/discord-botlists"
    )
  );
});
// Start Accepting vote Events , even the test votes from every Botlists where your webhook url has been saved in their Webhook manage page

Botlist.on("vote", (websiteName, jsonBody, timestamp) => {
  console.log("Website Name : " + websiteName);
  console.log("Vote Json Data : " + jsonBody);
  console.log("Date/Time : " + timestamp);

  // ... call back function work here ...
});

// Botlists to send Bot Stats to multiple botlist at the same time

new Promise(async (resolve) => {
  resolve(
    await Botlist.poststats(
      {
        bot_id: undefined,
        server_count: undefined,
        shards: undefined,
        shard_id: undefined,
        shard_count: undefined,
      },
      false,
      undefined,
      true,
      true
    )
  );
});
// Above Data should replaced with undefined with appropiate data for post request

// OR Post using AutoPoster on every 2 * 60 * 1000 Milli-Seconds

var Interval_Id = Botlist.autoPoster(
  {
    bot_id: undefined,
    server_count: undefined,
    shards: undefined,
    shard_id: undefined,
    shard_count: undefined,
  },
  undefined,
  10 * 60 * 1000,
  false,
  true
);

// Posted Event for acknowledment of the Data Stats has been Posted successfully
Botlist.on("posted", (formatedResponse, timestamp) => {
  console.log("SuccessRate or Failure Rate : " + formatedResponse);
  console.log("Date/Time : " + timestamp);
  // ... call back function work here ...
});

// Handle Error Event to Ignore Un-Handled Error on Console and avoid Application Crash
Botlist.on("error", (message, extraData, timestamp) => {
  console.log("Error Message : " + message);
  console.log("Related Data with Error : " + extraData);
  console.log("Date/Time : " + timestamp);
  // ... call back function work here ...
});
```

## Links

- [Source Code](https://github.com/SidisLiveYT/discord-botlists.git)
- [GitHub Repo Link](https://github.com/SidisLiveYT/discord-botlists)
- [NPM Package](https://www.npmjs.com/package/discord-botlists)
- [Yarn Package](https://yarn.pm/discord-botlists)
