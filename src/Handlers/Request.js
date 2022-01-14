const Axios = require('axios').default
const Express = require('express')
const { urlencoded } = require('body-parser')
const EventEmitter = require('events')
const RawBody = require('raw-body')
const botlistCache = require('../resources/botlists.json')
const Utils = require('../Utilities/ClassUtils.js')

// Cached Object keys for Comparing with User DisBotlist Data
const CacheObjectkeys = Object.keys(botlistCache.Botlists)

// Default PostApiBodyParams Structure for typings
const postApiBody = {
  bot_id: undefined,
  server_count: undefined,
  shards: undefined,
  shard_id: undefined,
  shard_count: undefined,
}

/**
 * @class BotLists -> Botlists Class
 * @extends EventEmitter -> Extended for event handling of vote and posted and error event listeners
 */

class BotLists extends EventEmitter {
  /**
   * @constructor
   * @param {string | void} webhookEndpoint -> Webhook Endpoint for "https://ipaddress:port/webhookEndpoint" to make selective path for Webhook's HTTP Post Request
   * @param {Object} botlistData -> Botlists Data as ' { "topgg" : { "authorizationToken": "xxxx" } } ' for comparing fetching token and Json data from resourcess
   * @param {string | number | void} listenerPortNumber -> Port Number for Express's App to listen , By Default it listens in 8080 as default HTTP port
   * @param {string | number | void} ipAddress -> Ip Adddress as "127.0.0.1" or "www.google.com" | No need to add http or https Protocol , just the domain or IP value for it
   * @param {string | void} redirectUrl -> Redirect Url for get Request on Webhook Post Url for making it more cooler , By Default -> Github Repo
   */
  constructor(
    webhookEndpoint = undefined,
    botlistData = undefined,
    listenerPortNumber = 8080,
    ipAddress = 'localhost',
    redirectUrl = 'https://github.com/SidisLiveYT/discord-botlists',
  ) {
    super()

    this.webhookEndpoint = webhookEndpoint
    this.redirectUrl = redirectUrl
    this.ipAddress = ipAddress
    this.botlistData = botlistData ?? botlistCache.Botlists
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
    /**
     * Express App listening on a Particular Port for Ignoring other Invalid Requests | For example containers of Pterodactyl Server
     */
    this.expressApp.listen(Number(this.listenerPortNumber), () => console.log(
      `"discord-botlists" expressApp is Listening at Port: ${this.listenerPortNumber}`,
    ))
  }

  /**
   * @method start() -> Starting Webhook for Vote Event Trigger
   * @param {string | void} webhookEndpoint Webhook Endpoint for "https://ipaddress:port/webhookEndpoint" to make selective path for Webhook's HTTP Post Request
   * @param {string | void} redirectUrl -> Redirect Url for get Request on Webhook Post Url for making it more cooler , By Default -> Github Repo
   * @returns {any} Depends on Incomplete Body or Request , it can return false or complete request.body in Json Format
   */

  async start(
    webhookEndpoint = undefined,
    redirectUrl = 'https://github.com/SidisLiveYT/discord-botlists',
  ) {
    /**
     * @var {apiUrl} -> Apiurl for WebhookEndPoint as for this.expressApp.post() request
     */
    const apiUrl = `/${
      webhookEndpoint ?? this.webhookEndpoint ?? 'discord-botlists'
    }`
    console.log(
      `Webhook-Server is accepting votes Webhooks at - http://${this.ipAddress}:${this.listenerPortNumber}${apiUrl}`,
    )

    /**
     * Redirect Any Request to redirectUrl for skipping Error Message
     */
    this.expressApp.get(apiUrl, (request, response) => {
      this.emit('request', request, response, new Date())
      response.redirect(redirectUrl ?? this.redirectUrl)
      return undefined
    })

    /**
     * Post Request for any Upcoming Webhook Request from /webhook-endpoint
     */
    this.expressApp.post(
      apiUrl,
      (request, response) => new Promise((resolve) => {
        try {
          this.emit('request', request, response, new Date())
          let bodyJson

          /**
             * parsing Auth Secret Token present in Orignal Webhook page for comparing actual request if its okay
             */
          const AuthParsingResults = this.#parseAuthorization(request)

          // Invalid or Un-Authorized UnHandShake Request from Server to Client Side
          if (!AuthParsingResults && AuthParsingResults === undefined) {
            this.emit(
              'error',
              'UnAuthoization/Invalid-AuOth Code is Detected',
              AuthParsingResults,
              new Date(),
            )
            return response.status(400).send({
              ok: false,
              status: 400,
              message: 'Invalid/Un-Authorized Authorization token',
            })
          }

          /**
             * if Body went brr.. then Body should be fetched from Stream.<Readable> from request
             * Check if any error and send 422 for Incomplete Body
             */

          if (!(request.body && Object.entries(request?.body)?.length > 0)) {
            return RawBody(request, {}, (error, actualBody) => {
              if (error)
                return response.status(422).send({
                  ok: false,
                  status: 422,
                  message: 'Malformed Request Received',
                })
              try {
                // Body Json Parsing from Actual Body as in String
                bodyJson = JSON.parse(actualBody?.toString('utf8'))
                this.emit(
                  'vote',
                  AuthParsingResults.name,
                  { ...bodyJson },
                  new Date(),
                )

                response.status(200).send({
                  ok: true,
                  status: 200,
                  message: 'Webhook has been Received',
                })

                return resolve({ ...bodyJson })
              } catch (err) {
                response.status(400).send({
                  ok: false,
                  status: 400,
                  message: 'Invalid Body Received',
                })
                resolve(false)
              }
              return false
            })
          } else bodyJson = JSON.parse(request?.body?.toString('utf8'))

          /**
             * "vote" event trigger for Event Emitter Category
             */
          this.emit(
            'vote',
            AuthParsingResults?.name,
            { ...bodyJson },
            new Date(),
          )

          response.status(200).send({
            ok: true,
            status: 200,
            message: 'Webhook has been Received',
          })

          return resolve({ ...bodyJson })
        } catch (error) {
          response.status(500).send({
            ok: false,
            status: 500,
            message: 'Internal error',
          })
          resolve(false)
        }
        return false
      }),
    )
    return this.expressApp
  }

  /**
   * @method post() -> Posting Stats of the Current Bot to Multiple Botlists mentioned by
   * @param {postApiBody} apiBody Api-Body for Posting Data as per params for API requirements and strictly for if required
   * @param {boolean | void} eventOnPost What if event to be triggered on Post or should be closed
   * @returns {Promise<any>} Array of Axios Response if any
   */

  async poststats(apiBody = postApiBody, eventOnPost = false) {
    if (
      !apiBody?.bot_id ||
      !apiBody?.server_count ||
      Object.entries(apiBody)?.length <= 1
    )
      return void this.emit(
        'error',
        'Failure: Invalid bot_id or server_count is Detected',
        apiBody,
        new Date(),
      )
    const Cached = await this.#poststats(
      Utils.PostBodyParse(apiBody, botlistCache?.Botlists, this.botlistData),
    )
    if (!Cached) {
      return void this.emit(
        'error',
        'Failure: Stats Posting faced issues',
        Cached,
        new Date(),
      )
    } else if (eventOnPost) this.emit('posted', Cached, new Date())
    this.emit('request', undefined, Cached, new Date())
    return Cached
  }

  async #poststats(postData) {
    if (!postData) return undefined
    return await Axios.post(botlistCache?.apiPostUrl, postData, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  #parseAuthorization(request) {
    let count = 0
    while (count < CacheObjectkeys.length) {
      if (
        this.botlistData[CacheObjectkeys[count]] &&
        this.botlistData[CacheObjectkeys[count]]?.authorizationToken &&
        ((this.botlistData[CacheObjectkeys[count]]?.tokenHeadername &&
          request.get(
            `${this.botlistData[CacheObjectkeys[count]]?.tokenHeadername}`,
          )) ??
          (botlistCache.Botlists[CacheObjectkeys[count]]?.tokenHeadername &&
            request.get(
              `${
                botlistCache.Botlists[CacheObjectkeys[count]]?.tokenHeadername
              }`,
            )) ??
          request.get('Authorization')) ===
          this.botlistData[CacheObjectkeys[count]]?.authorizationToken
      )
        return botlistCache.Botlists[CacheObjectkeys[count]]
      else ++count
    }
    return false
  }
}

module.exports = BotLists
