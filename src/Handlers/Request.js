const Axios = require('axios').default
const { Router } = require('express')
const botlistCache = require('../resources/botlists.json')

const CacheObjectkeys = Object.keys(botlistCache)

class Requests {
  constructor(webhookEndpoint = undefined, botlistData = undefined) {
    this.webhookEndpoint = webhookEndpoint
    this.botlistData = botlistData ?? botlistCache
    this.router = Router()
  }

  start() {
    this.router.post(
      this.webhookEndpoint ? `/${this.webhookEndpoint}` : '/',
      (request, response) => {
        try {
          const AuthParsingResults = this.#parseAuthorization(request)
          if (!AuthParsingResults) {
            return response.status(401).send({
              ok: false,
              status: 401,
              message: 'Invalid authorization',
            })
          }
          this.emit('vote', request.body, AuthParsingResults, request, response)
        } catch (error) {
          return response.status(500).send({
            ok: false,
            status: 500,
            message: 'Internal error',
          })
        }
      },
    )
    return this.router
  }

  poststats(
    botId = undefined,
    serverCount = undefined,
    shards = undefined,
    shardcount = undefined,
    shardId = undefined,
  ) {
    if (!botId) return undefined
    let count = 0
    while (count < CacheObjectkeys.length) {
      if (
        this.botlistData[CacheObjectkeys[count]] &&
        this.botlistData[CacheObjectkeys[count]].token &&
        this.botlistData[CacheObjectkeys[count]].tokenHeadername
      )
        return this.#poststats(
          this.botlistData[CacheObjectkeys[count]],
          botId,
          {},
        )
      else ++count
    }
  }

  async #poststats(singleBotlistCache, botId, postData) {
    await Axios.post(
      singleBotlistCache.poststatsurl.replace('{replace}', botId),
      postData,
      {
        headers: {
          Authorization: 'application/json',
          Authorization: singleBotlistCache.token,
        },
      },
    )
  }

  #parseAuthorization(request) {
    const authSecret = request.get('Authorization')
    let count = 0
    while (count < CacheObjectkeys.length) {
      if (
        this.botlistData[CacheObjectkeys[count]] &&
        this.botlistData[CacheObjectkeys[count]].token &&
        ((this.botlistData[CacheObjectkeys[count]].tokenHeadername &&
          request.get(
            `${this.botlistData[CacheObjectkeys[count]].tokenHeadername}`,
          )) ??
          authSecret) === this.botlistData[CacheObjectkeys[count]].token
      )
        return this.botlistData[CacheObjectkeys[count]]
      else ++count
    }
    return false
  }
}
