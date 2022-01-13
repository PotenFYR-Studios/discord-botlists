/**
 * @class ClassUtils -> Class Util's methods are for Class's Support and helping basic or extract support neccassity tools
 */
class ClassUtils {
  /**
   * stablizingoptions() -> Stabilizing Local and Parent Options with accuracy 80%
   * @param {Object} Local Local function/method options
   * @param {Object} Parent Parent function/method options
   * @param {Number|void} RecursiveTimes Limit for Infinite Loop of Stabilizing
   * @returns {Object} Finalized Options with Structure or Array Types
   */

  static stablizingoptions(Local, Parent, RecursiveTimes = 0) {
    if (RecursiveTimes > 3 || Array.isArray(Local) || Array.isArray(Parent))
      return Local
    if (!Local || typeof Local !== 'object') return Parent
    if (!Parent || typeof Parent !== 'object') return Local
    const ProcessOptions = {}
    const LocalObjects = Object.keys(Local)
    const ParentObjects = Object.keys(Parent)
    const Options =
      LocalObjects.length > ParentObjects.length ? LocalObjects : ParentObjects
    for (let count = 0, len = Options.length; count < len; ++count) {
      if (
        typeof Local[Options[count]] === 'object' &&
        Local[Options[count]] !== undefined &&
        Parent[Options[count]] !== undefined &&
        Local[Options[count]] &&
        !['metadata'].includes(Options[count].toLowerCase().trim()) &&
        !Array.isArray(Local[Options[count]])
      ) {
        ProcessOptions[Options[count]] = ClassUtils.stablizingoptions(
          Local[Options[count]],
          Parent[Options[count]],
          ++RecursiveTimes,
        )
      } else if (Local[Options[count]] === undefined)
        ProcessOptions[Options[count]] = Parent[Options[count]]
      else ProcessOptions[Options[count]] = Local[Options[count]]
    }
    return ProcessOptions
  }

  static BodyParser(LocalStructure, ParentStructure) {
    const ParentObjects = Object.keys(ParentStructure)
    const CachedStructure = {}
    for (let count = 0, len = ParentObjects.length; count < len; ++count) {
      if (
        ParentStructure[ParentObjects[count]].clientName &&
        ParentStructure[ParentObjects[count]].required &&
        !LocalStructure[ParentStructure[ParentObjects[count]].clientName]
      )
        return undefined
      else if (
        ParentStructure[ParentObjects[count]].clientName &&
        LocalStructure[ParentStructure[ParentObjects[count]].clientName]
      )
        CachedStructure[ParentObjects[count]] =
          LocalStructure[ParentStructure[ParentObjects[count]].clientName]
    }
    return CachedStructure
  }
}
module.exports = ClassUtils
