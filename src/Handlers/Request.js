const Axios = require('axios').default
const Express = require('express')
const { urlencoded } = require('body-parser')
const EventEmitter = require('events')
const botlistCache = require('../resources/botlists.json')
const Utils = require('../Utilities/ClassUtils.js')

const CacheObjectkeys = Object.keys(botlistCache)

class BotLists extends EventEmitter {
  constructor(
    webhookEndpoint = undefined,
    botlistData = undefined,
    listenerPortNumber = 8080,
    redirectUrl = 'https://github.com/SidisLiveYT/discord-botlists',
  ) {
    super()

    this.webhookEndpoint = webhookEndpoint
    this.redirectUrl = redirectUrl
    this.botlistData = botlistData ?? botlistCache
    this.listenerPortNumber =
      Number.isNaN(listenerPortNumber) &&
      Number(listenerPortNumber) > 0 &&
      Number(listenerPortNumber) < 65535
        ? 8080
        : Number(listenerPortNumber)
    this.expressApp = Express()

    this.expressApp.use(
      urlencoded({
        extended: true,
      }),
    )

    this.expressApp.listen(Number(this.listenerPortNumber), () => console.log(
      `"discord-botlists" Class-Server is running at Port: ${this.listenerPortNumber}`,
    ))
  }

  start(
    webhookEndpoint = undefined,
    redirectUrl = 'https://github.com/SidisLiveYT/discord-botlists',
  ) {
    const apiUrl = `/${
      webhookEndpoint ?? this.webhookEndpoint ?? 'discord-botlists'
    }`
    console.log(
      `Webhook-Server is accepting votes Webhooks at - http://localhost:${this.listenerPortNumber}${apiUrl}`,
    )
    this.expressApp.get(apiUrl, (request, response) => {
      response.redirect(redirectUrl ?? this.redirectUrl)
      return undefined
    })
    this.expressApp.post(apiUrl, (request, response) => {
      try {
        const AuthParsingResults = this.#parseAuthorization(request)
        if (!AuthParsingResults) {
          return response.status(401).send({
            ok: false,
            status: 401,
            message: 'Invalid authorization',
          })
        }

        this.emit(
          'vote',
          AuthParsingResults.siteName,
          request.body,
          request,
          response,
        )

        response.status(200).send({
          ok: true,
          status: 200,
          message: 'Webhook has been Received',
        })

        return this.expressApp
      } catch (error) {
        return response.status(500).send({
          ok: false,
          status: 500,
          message: 'Internal error',
        })
      }
    })
    return this.expressApp
  }

  async poststats(
    botId = undefined,
    apiBody = {
      serverCount: undefined,
      shards: undefined,
      shardcount: undefined,
      shardId: undefined,
    },
    eventOnPost = false,
  ) {
    if (!botId) return undefined
    let Cached
    return await Promise.all(
      CacheObjectkeys.map(async (Caches) => {
        if (
          this.botlistData[Caches] &&
          this.botlistData[Caches].authorizationToken &&
          this.botlistData[Caches].tokenHeadername
        )
          Cached = await this.#poststats(
            botlistCache[Caches].poststatsurl,
            this.botlistData[Caches].authorizationToken,
            botId,
            Utils.BodyParser(apiBody, botlistCache[Caches]),
          )
        eventOnPost && Cached
          ? this.emit(
            'posted',
            botlistCache[Caches].name,
            botlistCache[Caches].websiteurl,
            Cached,
          )
          : !Cached
            ? this.emit(
              'error',
              `Failure: Stats Post for Website Name = ${botlistCache[Caches].name} and Website = ${botlistCache[Caches].websiteurl}`,
            )
            : undefined
        return Cached
      }),
    )
  }

  async #poststats(url, authorizationToken, botId, postData) {
    if (!postData) return undefined
    return await Axios.post(url.replace('{replace}', botId), postData, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorizationToken,
      },
    })
  }

  #parseAuthorization(request) {
    const authSecret = request.get('Authorization')
    let count = 0
    while (count < CacheObjectkeys.length) {
      if (
        this.botlistData[CacheObjectkeys[count]] &&
        this.botlistData[CacheObjectkeys[count]].authorizationToken &&
        ((this.botlistData[CacheObjectkeys[count]].tokenHeadername &&
          request.get(
            `${this.botlistData[CacheObjectkeys[count]].tokenHeadername}`,
          )) ??
          (botlistCache[CacheObjectkeys[count]].tokenHeadername &&
            request.get(
              `${botlistCache[CacheObjectkeys[count]].tokenHeadername}`,
            )) ??
          authSecret) ===
          this.botlistData[CacheObjectkeys[count]].authorizationToken
      )
        return botlistCache[CacheObjectkeys[count]]
      else ++count
    }
    return false
  }
}

module.exports = BotLists
