// minimal live check: fetch a wellknown bot from public endpoints
import { Botlists } from '../src/index.js';

const client = new Botlists();
const botId = process.env.DBL_TEST_BOT_ID || '557628352828014614'; // real listed bot (Kirby bot)
// alternates that are known listed: 469207844130381824 (MEE6 clone listing), 557628352828014614

for (const list of ['top.gg', 'discord.bots.gg', 'discordbotlist.com', 'botlist.me']) {
  try {
    const bot = await client.fetchBot(list, botId);
    console.log(`OK   ${list}: ${bot.name} servers=${bot.serverCount} votes=${bot.votes}`);
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    console.log(`WARN ${list}: ${message.slice(0, 100)}`);
  }
}
