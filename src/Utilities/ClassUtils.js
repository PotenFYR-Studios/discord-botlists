/**
 * @class ClassUtils -> Class Util's methods are for Class's Support and helping basic or extract support neccassity tools
 */
class ClassUtils {
  /**
   * @method PostBodyParse() -> Class Utils General Private Method
   * @param {Object} defaultApiBodyParams
   * @param {Object} RawBotListsData
   * @param {Object} clientSideBotlistData
   * @returns {{}}
   */

  static PostBodyParse(
    defaultApiBodyParams,
    RawBotListsData,
    clientSideBotlistData,
  ) {
    // Now Adding Botlists Data
    const CachedStructure = {}
    const rawObjects = Object.keys(RawBotListsData)
    for (let count = 0, len = rawObjects.length; count < len; ++count) {
      if (clientSideBotlistData[rawObjects[count]])
        CachedStructure[RawBotListsData[rawObjects[count]]?.universalPostUrl] =
          clientSideBotlistData[rawObjects[count]]?.authorizationToken
    }
    return { ...defaultApiBodyParams, ...CachedStructure }
  }
}
module.exports = ClassUtils
