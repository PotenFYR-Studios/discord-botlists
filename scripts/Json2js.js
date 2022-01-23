const { writeJSONSync } = require('write-json-safe')
const botlistCache = require('../src/resources/botlists.json')

writeJSONSync('src/resources/global.md', botlistCache.Botlists)
