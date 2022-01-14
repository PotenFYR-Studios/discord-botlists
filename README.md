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

Multi-Discord-Botlist Management Package with 10+ Botlist Supported with Events and Stats Update Methods and More to Add if you want

## Installation

### Install **[discord-botlists](https://npmjs.com/package/discord-botlists)**

```sh
$ npm install --save discord-botlists
```

# Features

- Upvote/Vote Events Support 🚗
- Stats Posting Feature for Discord Bots to Multiple Botlists
- Better Event Handlers and Request Handlers
- Better Body Parsing for Incomplete request ( HTTP Post Request )

## Scheme :

```js
// Discord Bot Lists Data from the Client Side to the Official package
var discordBotlistData = {
  bladebotlist: {
    authorizationToken: "xxx-secrettokenhere-xxx",
  },
  topgg: {
    authorizationToken: "xxx-secrettokenhere-xxx",
  },
  boatspace: {
    authorizationToken: "xxx-secrettokenhere-xxx",
  },
  botlistme: {
    authorizationToken: "xxx-secrettokenhere-xxx",
  },
  botrix: {
    authorizationToken: "xxx-secrettokenhere-xxx",
  },
  discordlabs: {
    authorizationToken: "xxx-secrettokenhere-xxx",
  },
  //... many other botlist data just like above and where "authorizationToken"'s value should be secret token or value for "Authorization"
};

// Webhook Scheme
var webhookEndpoint = "discord-botlists";
// It will start accepting get and post request to -> "http://localhost:8080/discord-botlists" , where you can change listener port and ip address for pterodactyl users
```

## Point to be Noted :

**Above Object Keys Example from : [Bot-List Json File](https://github.com/SidisLiveYT/discord-botlists/blob/main/src/resources/botlists.json)**

## Example Code :

```js
const { BotLists } = require("discord-botlists");

// webhookEndpoint and discordBotlistData is from above scheme
const Botlist = new BotLists("discord-botlists", discordBotlistData);

// Starting Botlists Vote Event webhook listening
await Botlist.start(
  "discord-botlists",
  "https://github.com/SidisLiveYT/discord-botlists"
);

// Start Accepting vote Events , even the test votes from every Botlists where your webhook url has been saved in their Webhook manage page

Botlist.on("vote", (websiteName, jsonBody, timestamp) => {
  console.log("Website Name : " + websiteName);
  console.log("Vote Json Data : " + jsonBody);
  console.log("Date/Time : " + timestamp);

  // ... call back function work here ...
});

// Botlists to send Bot Stats to multiple botlist at the same time
await Botlist.poststats(
  {
    bot_id: undefined,
    server_count: undefined,
    shards: undefined,
    shard_id: undefined,
    shard_count: undefined,
  },
  false
);
// Above Data should replaced with undefined with appropiate data for post request

// Posted Event for acknowledment of the Data Stats has been Posted successfully
Botlist.on("posted", (postResponse, timestamp) => {
  console.log("HTTP-Post Response : " + postResponse);
  console.log("Date/Time : " + timestamp);

  // ... call back function work here ...
});
```
