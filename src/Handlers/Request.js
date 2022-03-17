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
  bot_id: '',
  server_count: 0,
  shards: [],
  shard_id: '',
  shard_count: 0,
}

/**
 * @class BotLists -> Botlists Class
 * @extends EventEmitter -> Extended for event handling of vote and posted and error event listeners
 */

class BotLists extends EventEmitter {
  #postRetryAfterTimer = undefined

  #autoPostedTimerId = undefined

  #autoPostCaches = undefined

  /**
   * @constructor
   * @param {string | void} webhookEndpoint -> Webhook Endpoint for "https://ipaddress:port/webhookEndpoint" to make selective path for Webhook's HTTP Post Request
   * @param {Object} botlistData -> Botlists Data as ' { "topgg" : { authorizationToken: "xxx-secrettokenhere-xxx",authorizationValue: "xxx-selfmade-AuthorizationValue-xxx", } } ' for comparing fetching token and Json data from resourcess
   * @param {string | number | void | "8080"} listenerPortNumber -> Port Number for Express's App to listen , By Default it listens in 8080 as default HTTP port
   * @param {string | number | void | "localhost"} ipAddress -> Ip Adddress as "127.0.0.1" or "www.google.com" | No need to add http or https Protocol , just the domain or IP value for it
   * @param {string | void | "https://github.com/SidisLiveYT/discord-botlists"} redirectUrl -> Redirect Url for get Request on Webhook Post Url for making it more cooler , By Default -> Github Repo
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
  }

  /**
   * start() -> Starting Webhook for Vote Event Trigger
   * @param {string | void} webhookEndpoint Webhook Endpoint for "https://ipaddress:port/webhookEndpoint" to make selective path for Webhook's HTTP Post Request
   * @param {string | void | 'https://github.com/SidisLiveYT/discord-botlists'} redirectUrl -> Redirect Url for get Request on Webhook Post Url for making it more cooler , By Default -> Github Repo
   * @param {boolean | void | true} eventTrigger ->  Event Trigger for console.log() function | By Default = true
   * @returns {any} Depends on Incomplete Body or Request , it can return false or complete request.body in Json Format
   */

  async start(
    webhookEndpoint = undefined,
    redirectUrl = 'https://github.com/SidisLiveYT/discord-botlists',
    eventTrigger = true,
  ) {
    /**
     * Express App listening on a Particular Port for Ignoring other Invalid Requests | For example containers of Pterodactyl Server
     */
    this.expressApp.listen(Number(this.listenerPortNumber), () => (eventTrigger
      ? console.log(
        `🎬 "discord-botlists" expressApp is Listening at Port: ${this.listenerPortNumber}`,
      )
      : undefined))
    /**
     * @var {apiUrl} -> Apiurl for WebhookEndPoint as for this.expressApp.post() request
     */
    const apiUrl = `/${
      webhookEndpoint ?? this.webhookEndpoint ?? 'discord-botlists'
    }`
    eventTrigger
      ? console.log(
        `🎬 Webhook-Server is accepting votes Webhooks at - http://${this.ipAddress}:${this.listenerPortNumber}${apiUrl}`,
      )
      : undefined

    /**
     * Redirect Any Request to redirectUrl for skipping Error Message
     */
    this.expressApp.get(apiUrl, (request, response) => {
      this.emit('request', 'Get-Redirect', request, response, new Date())
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
          this.emit('request', 'Post-Votes', request, response, new Date())
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
   * post() -> Posting Stats of the Current Bot to Multiple Botlists mentioned by
   * @param {postApiBody} apiBody Api-Body for Posting Data as per params for API requirements and strictly for if required
   * @param {boolean | void | true} eventOnPost What if event to be triggered on Post or should be closed
   * @param {Object | void } AxioshttpConfigs To Add Proxies to avoid Ratelimit
   * @param {boolean | void | false} forcePosting Force Posting and ignoring in-built Ratelimit function | Users can face un-expected ratelimit from API
   * @param {Boolean | void | true} IgnoreErrors Boolean Value for Ignoring Request Handling Errors
   * @returns {Promise<Boolean>} Booelan Response on success or failure
   */

  async poststats(
    apiBody = postApiBody,
    eventOnPost = true,
    AxioshttpConfigs = undefined,
    forcePosting = false,
    IgnoreErrors = true,
  ) {
    if (
      !(
        apiBody?.bot_id &&
        typeof apiBody?.bot_id === 'string' &&
        apiBody?.bot_id?.length > 0
      ) ||
      !(apiBody?.server_count && parseInt(apiBody?.server_count ?? 0) > 0) ||
      Object.entries(apiBody)?.length <= 1
    )
      return void !IgnoreErrors
        ? this.emit(
          'error',
          'Failure: Invalid bot_id or server_count is Detected',
          apiBody,
          new Date(),
        )
        : undefined
    else if (this.#autoPostedTimerId) {
      return void !IgnoreErrors
        ? this.emit(
          'error',
          'Failure: Auto-Poster is Already in Progress',
          this.#autoPostedTimerId,
          new Date(),
        )
        : undefined
    } else if (
      !forcePosting &&
      this.#postRetryAfterTimer &&
      (this.#postRetryAfterTimer - new Date().getTime()) / 1000 > 0
    ) {
      return void !IgnoreErrors
        ? this.emit(
          'error',
          `Failure: There is a Cooldown on Bot Stats Post Method | Retry After -> "${
            (this.#postRetryAfterTimer - new Date().getTime()) / 1000
          } Seconds"`,
          apiBody,
          new Date(),
        )
        : undefined
    }

    apiBody = { ...postApiBody, ...apiBody }
    apiBody.server_count = parseInt(apiBody?.server_count ?? 0)
    apiBody.shard_count =
      apiBody?.shard_count &&
      typeof apiBody?.shard_count === 'number' &&
      parseInt(apiBody?.shard_count) > 0
        ? parseInt(apiBody?.shard_count)
        : undefined
    apiBody.shard_id =
      apiBody?.shard_id &&
      typeof apiBody?.shard_id === 'string' &&
      apiBody?.shard_id?.length > 0
        ? apiBody?.shard_id
        : undefined
    apiBody.shards =
      apiBody?.shards &&
      Array.isArray(apiBody?.shards) &&
      apiBody?.shards?.length > 0
        ? apiBody?.shards
        : undefined
    const Cached = await this.#poststats(
      Utils.PostBodyParse(apiBody, this.botlistData),
      AxioshttpConfigs ?? undefined,
      IgnoreErrors,
    )
    if (!Cached) return false
    else if (eventOnPost) this.emit('posted', Cached, new Date())
    return true
  }

  /**
   * autoPoster() -> Auto-osting Stats of the Current Bot to Multiple Botlists mentioned
   * @param {postApiBody} apiBody Api-Body for Posting Data as per params for API requirements and strictly for if required
   * @param {Object | void} AxioshttpConfigs To Add Proxies to avoid Ratelimit
   * @param {number | void} Timer Time in Milli-Seconds to Post at every Interval Gap
   * @param {boolean | void} eventOnPost What if event to be triggered on Post or should be closed
   * @param {Boolean | void} IgnoreErrors Boolean Value for Ignoring Request Handling Errors
   * @returns {NodeJS.Timer} Node Timer Id to Cancel for further purposes
   */

  autoPoster(
    apiBody = postApiBody,
    AxioshttpConfigs = undefined,
    Timer = 2 * 60 * 1000,
    eventOnPost = true,
    IgnoreErrors = true,
  ) {
    if (
      !(
        apiBody?.bot_id &&
        typeof apiBody?.bot_id === 'string' &&
        apiBody?.bot_id?.length > 0
      ) ||
      !(apiBody?.server_count && parseInt(apiBody?.server_count ?? 0) > 0) ||
      Object.entries(apiBody)?.length <= 1
    )
      return void this.emit(
        'error',
        'Failure: Invalid bot_id or server_count is Detected',
        apiBody,
        new Date(),
      )
    else if (
      !(
        Timer &&
        !Number.isNaN(Timer) &&
        parseInt(Timer) >= 2 * 60 * 1000 &&
        parseInt(Timer) <= 24 * 60 * 60 * 1000
      )
    ) {
      return void this.emit(
        'error',
        'Failure: Invalid Timer Value is Detected | Timer should be less than a Day and greater than 2 * 60 * 1000 milliseconds and Value should be in Milli-Seconds or leave undefined for defualt Timer Value',
        apiBody,
        new Date(),
      )
    }
    if (this.#autoPostedTimerId) {
      return void !IgnoreErrors
        ? this.emit(
          'error',
          'Failure: Auto-Poster is Already in Progress',
          this.#autoPostedTimerId,
          new Date(),
        )
        : undefined
    } else if (
      this.#postRetryAfterTimer &&
      (this.#postRetryAfterTimer - new Date().getTime()) / 1000 > 0
    ) {
      return void !IgnoreErrors
        ? this.emit(
          'error',
          `Failure: There is a Cooldown on Bot Stats Post Method | Retry After -> "${
            (this.#postRetryAfterTimer - new Date().getTime()) / 1000
          } Seconds"`,
          apiBody,
          new Date(),
        )
        : undefined
    }

    apiBody = { ...postApiBody, ...apiBody }
    apiBody.server_count = parseInt(apiBody?.server_count ?? 0)
    apiBody.shard_count =
      apiBody?.shard_count &&
      typeof apiBody?.shard_count === 'number' &&
      parseInt(apiBody?.shard_count) > 0
        ? parseInt(apiBody?.shard_count)
        : undefined
    apiBody.shard_id =
      apiBody?.shard_id &&
      typeof apiBody?.shard_id === 'string' &&
      apiBody?.shard_id?.length > 0
        ? apiBody?.shard_id
        : undefined
    apiBody.shards =
      apiBody?.shards &&
      Array.isArray(apiBody?.shards) &&
      apiBody?.shards?.length > 0
        ? apiBody?.shards
        : undefined

    return this.#customTimeout(
      apiBody,
      eventOnPost ?? false,
      AxioshttpConfigs,
      Timer,
      IgnoreErrors,
    )
  }

  /**
   * @private
   * @param {postApiBody} postData Api-Body for Posting Data as per params for API requirements and strictly for if required
   * @param {Object} AxioshttpConfigs Axios HTTP Post Request Config
   * @param {Boolean | void | false} IgnoreErrors Boolean Value for Ignoring Request Handling Errors
   * @returns {Object | void} Returns success and failure data formated or undefined on failure
   */
  async #poststats(
    postData,
    AxioshttpConfigs = undefined,
    IgnoreErrors = false,
  ) {
    if (!postData) return undefined
    const AxiosResponse = await Axios.post(
      botlistCache?.apiPostUrl,
      postData,
      AxioshttpConfigs
        ? Utils.parseHTTPRequestOption(AxioshttpConfigs)
        : undefined,
    ).catch((error) => {
      this.emit(
        'request',
        'Post-Bot-Stats',
        undefined,
        error?.message,
        new Date(),
      )
      if (error.response?.status > 200 && error.response?.status < 429) {
        !IgnoreErrors
          ? this.emit(
            'error',
            `Received Response Status Error | Status Code -> ${
              error?.response?.status
            } Message from API Server : ${
              error?.message ?? '<Hidden Message>'
            }`,
            error?.response?.data ?? error?.message,
            new Date(),
          )
          : undefined
        this.#autoPostedTimerId
          ? this.#customTimeout(
            undefined,
            undefined,
            undefined,
            undefined,
            IgnoreErrors,
            true,
          )
          : undefined
      } else if (error?.response?.status === 429) {
        !IgnoreErrors
          ? this.emit(
            'error',
            `Received Response Status Error | Status Code -> 429 | Message from API Server : "Ratelimited IP [${
              error?.response?.data?.ratelimit_ip ?? '127.0.0.1'
            }] and Retry Post Stats After -> ${
              parseInt(error?.response?.data?.retry_after) ?? 80
            } Seconds"`,
            error?.response?.data ?? error?.message,
            new Date(),
          )
          : undefined
        this.#postRetryAfterTimer = error?.response?.data?.retry_after
          ? parseInt(error?.response?.data?.retry_after) * 1000 +
            new Date().getTime()
          : undefined
        this.#autoPostedTimerId
          ? this.#customTimeout(
            undefined,
            undefined,
            undefined,
            undefined,
            IgnoreErrors,
            true,
            parseInt(error?.response?.data?.retry_after ?? 0) * 1000,
          )
          : undefined
      }
      return undefined
    })
    this.emit('request', 'Post-Bot-Stats', undefined, AxiosResponse, new Date())
    if (!AxiosResponse) return undefined
    else if (AxiosResponse?.status > 200 && AxiosResponse?.status < 429) {
      !IgnoreErrors
        ? this.emit(
          'error',
          `Received Response Status Error | Status Code -> ${
            AxiosResponse?.status
          } Message from API Server : ${
            AxiosResponse?.data?.message ?? '<Hidden Message>'
          }`,
          AxiosResponse?.data,
          new Date(),
        )
        : undefined
      this.#autoPostedTimerId
        ? this.#customTimeout(
          undefined,
          undefined,
          undefined,
          undefined,
          IgnoreErrors,
          true,
        )
        : undefined
    } else if (AxiosResponse?.status === 429) {
      !IgnoreErrors
        ? this.emit(
          'error',
          `Received Response Status Error | Status Code -> 429 | Message from API Server : "Ratelimited IP [${
            AxiosResponse?.data?.ratelimit_ip ?? '127.0.0.1'
          }] and Retry Post Stats After -> ${
            parseInt(AxiosResponse?.data?.retry_after) ?? 80
          } Seconds"`,
          AxiosResponse?.data,
          new Date(),
        )
        : undefined
      this.#postRetryAfterTimer = AxiosResponse?.data?.retry_after
        ? parseInt(AxiosResponse?.data?.retry_after) * 1000 +
          new Date().getTime()
        : undefined
      this.#autoPostedTimerId
        ? this.#customTimeout(
          undefined,
          undefined,
          undefined,
          undefined,
          IgnoreErrors,
          true,
          parseInt(AxiosResponse?.data?.retry_after) * 1000,
        )
        : undefined
    } else if (
      (AxiosResponse?.status === 200 && AxiosResponse?.data) ||
      AxiosResponse?.data?.success ||
      AxiosResponse?.data?.failure
    ) {
      this.#postRetryAfterTimer = undefined
      return Utils.PostResponseParse(
        AxiosResponse?.data?.success ?? [],
        AxiosResponse?.data?.failure ?? [],
      )
    }
    return undefined
  }

  /**
   *
   * @param {postApiBody} apiBody Api-Body for Posting Data as per params for API requirements and strictly for if required
   * @param {boolean | void} eventOnPost What if event to be triggered on Post or should be closed
   * @param {Object | void} AxioshttpConfigs To Add Proxies to avoid Ratelimit
   * @param {number | void} Timer Time in Milli-Seconds to Post at every Interval Gap
   * @param {boolean} clearTimeoutBoolean Clear Timedout Boolean for renewing the Auto-Posting Interval
   * @param {number | void} extraTime Extra Time in Milli-Seconds for 429 Error Data
   * @returns {string | void}
   */

  #customTimeout(
    apiBody,
    eventOnPost,
    AxioshttpConfigs,
    Timer = 2 * 60 * 1000,
    IgnoreErrors = true,
    clearTimeoutBoolean = false,
    extraTime = 0,
  ) {
    if (apiBody && Timer)
      this.#autoPostCaches = {
        apiBody,
        eventOnPost,
        AxioshttpConfigs,
        Timer,
        IgnoreErrors,
      }
    if (clearTimeoutBoolean && this.#autoPostedTimerId)
      clearTimeout(this.#autoPostedTimerId)
    this.#autoPostedTimerId = setInterval(async () => {
      const Cached = await this.#poststats(
        Utils.PostBodyParse(this.#autoPostCaches?.apiBody, this.botlistData),
        this.#autoPostCaches?.AxioshttpConfigs,
        this.#autoPostCaches?.IgnoreErrors,
      )
      if (!Cached) return false
      else if (this.#autoPostCaches?.eventOnPost)
        this.emit('posted', Cached, new Date())
      return undefined
    }, this.#autoPostCaches.Timer + extraTime)
    return this.#autoPostedTimerId
  }

  /**
   * @private
   * @param {JSON} request Axios Request Data from GET-Votes location Function
   * @returns {Object | boolean | void} Returns Auth Success Rate or false on failure
   */

  #parseAuthorization(request) {
    let count = 0
    while (count < CacheObjectkeys.length) {
      if (
        this.botlistData[CacheObjectkeys[count]] &&
        (this.botlistData[CacheObjectkeys[count]]?.authorizationValue ||
          this.botlistData[CacheObjectkeys[count]]?.authorizationToken) &&
        (((this.botlistData[CacheObjectkeys[count]]?.tokenHeadername &&
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
          this.botlistData[CacheObjectkeys[count]]?.authorizationValue ||
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
            this.botlistData[CacheObjectkeys[count]]?.authorizationToken)
      )
        return botlistCache.Botlists[CacheObjectkeys[count]]
      else ++count
    }
    return false
  }
}

module.exports = BotLists
