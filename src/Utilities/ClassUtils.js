const botlistCache = require('../resources/botlists.json')

// Cached Object keys for Comparing with User DisBotlist Data
const CacheObjectkeys = Object.keys(botlistCache.Botlists)

/**
 * @class ClassUtils -> Class Util's methods are for Class's Support and helping basic or extract support neccassity tools
 */
class ClassUtils {
  /**
   * @method PostBodyParse() -> Class Utils General Private Method
   * @param {Object} defaultApiBodyParams Default API body Params for API Request
   * @param {Object} clientSideBotlistData Botlist Data to be Parsed inf avour of acceptable order
   * @returns {Object} Basic API acceptable ordered Value
   */

  static PostBodyParse(defaultApiBodyParams, clientSideBotlistData) {
    const CachedStructure = {}

    for (let count = 0, len = CacheObjectkeys.length; count < len; ++count) {
      if (clientSideBotlistData[CacheObjectkeys[count]])
        CachedStructure[
          botlistCache.Botlists[CacheObjectkeys[count]]?.universalPostUrl
        ] = clientSideBotlistData[CacheObjectkeys[count]]?.authorizationToken
    }
    return { ...defaultApiBodyParams, ...CachedStructure }
  }

  /**
   * @method PostResponseParse() -> parsing Post Request Reponse of Axios into Structured
   * @param {JSON} SuccessArray Success Botlist Posting Data in Array for several Botlists
   * @param {JSON} FailureArray Failure Botlist Posting Data in Array for several Botlists
   * @returns {Object} Returns Object of Actual Ordered with parsed Data
   */

  static PostResponseParse(SuccessArray, FailureArray) {
    const CachedStructure = {}
    for (let count = 0, len = CacheObjectkeys.length; count < len; ++count) {
      if (
        SuccessArray?.[
          botlistCache.Botlists[CacheObjectkeys[count]]?.universalPostUrl
        ] ||
        FailureArray?.[
          botlistCache.Botlists[CacheObjectkeys[count]]?.universalPostUrl
        ]
      )
        CachedStructure[CacheObjectkeys[count]] = {
          status_code:
            FailureArray?.[
              botlistCache.Botlists[CacheObjectkeys[count]]?.universalPostUrl
            ]?.[0] ??
            SuccessArray?.[
              botlistCache.Botlists[CacheObjectkeys[count]]?.universalPostUrl
            ]?.[0] ??
            200,
          message:
            FailureArray?.[
              botlistCache.Botlists[CacheObjectkeys[count]]?.universalPostUrl
            ]?.[1] ?? 'Successfully Posted Stats',
        }
    }
    return { ...CachedStructure }
  }

  /**
   * @static
   * @param {Object} requestOptions Axios Config HTTP Data Request Options
   * @returns {Object} Parsed Basic HTTP Request Structured Value for Axios
   */

  static parseHTTPRequestOption(requestOptions = {}) {
    if (
      !(
        requestOptions &&
        typeof requestOptions === 'object' &&
        !Array.isArray(requestOptions)
      )
    )
      return {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    requestOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
      ...requestOptions,
    }
    if (requestOptions?.cookie || requestOptions?.cookies) {
      requestOptions.headers.cookie ??=
        requestOptions?.cookies ?? requestOptions?.cookie
      requestOptions?.cookies ? delete requestOptions?.cookies : undefined
      requestOptions?.cookie ? delete requestOptions?.cookie : undefined
    }

    if (requestOptions?.proxy && typeof requestOptions.proxy === 'string') {
      const rawProxyData = new URL(requestOptions?.proxy)
      if (!rawProxyData?.host || !rawProxyData?.port)
        throw new TypeError(
          'Invalid Proxy url with Invalid Host-Name or Post-Number',
        )
      requestOptions.proxy = {
        host: rawProxyData?.host,
        port: parseInt(rawProxyData?.port),
      }
      return requestOptions
    } else if (
      requestOptions?.proxy?.host &&
      typeof requestOptions?.proxy?.host === 'string' &&
      requestOptions?.proxy?.port &&
      !Number.isNaN(requestOptions?.proxy?.port)
    ) {
      requestOptions.proxy = {
        host: requestOptions?.proxy?.host,
        port: parseInt(requestOptions?.proxy?.port),
      }
      return requestOptions
    } else return requestOptions
  }
}
module.exports = ClassUtils
