const { resolve, dirname } = require('path')
const { FFmpeg } = require('prism-media')
const {
  DefaultUserDrivenAudioFilters,
  DefaultAudioFilters,
} = require('../types/interfaces')

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

  /**
   * ScanDeps() -> Scanning Dependencies in package.json or node_modules for package or versions list
   * @param {String|void} packageName Package name for publishing it versions in project
   * @returns {String|void} Publish Data which was requested for like checks and versions
   */

  static ScanDeps(packageName) {
    if (!packageName) {
      const report = []
      const addVersion = (name) => report.push(
        `- ${name}: ${ClassUtils.__versioning(name) ?? 'not found'}`,
      )
      // general
      report.push('Core Dependencies')
      addVersion('@discordjs/voice')
      addVersion('prism-media')
      report.push('')

      // opus
      report.push('Opus Libraries')
      addVersion('@discordjs/opus')
      addVersion('opusscript')
      report.push('')

      // encryption
      report.push('Encryption Libraries')
      addVersion('sodium')
      addVersion('libsodium-wrappers')
      addVersion('tweetnacl')
      report.push('')

      // ffmpeg
      report.push('FFmpeg')
      try {
        const info = FFmpeg.getInfo()
        report.push(`- version: ${info.version}`)
        report.push(
          `- libopus: ${
            info.output.includes('--enable-libopus') ? 'yes' : 'no'
          }`,
        )
      } catch (err) {
        report.push('- not found')
      }
      addVersion('ffmpeg-static')
      report.push('')

      // Extractors
      report.push('Extractors')
      addVersion('playdl-music-extractor')
      addVersion('video-extractor')

      return ['-'.repeat(50), ...report, '-'.repeat(50)].join('\n')
    }
    return (
      ClassUtils.__versioning(packageName) ??
      ClassUtils.__versioning(packageName.toLowerCase().trim())
    )
  }

  /**
   * @private __versioning() -> Searching Versions of Packages
   * @param {String} name NPM Package Name
   * @returns {String|void} Returns Package Version
   */

  static __versioning(name) {
    try {
      const pkg =
        name === '@discordjs/voice'
          ? require('../../package.json')
          : ClassUtils.__SearchPackageJson(
            dirname(require.resolve(name)),
            name,
            8,
          )
      return pkg?.version ?? undefined
    } catch (err) {
      return undefined
    }
  }
  /**
   * @private __SearchPackageJson() -> Searching Every package.json with deps
   * @param {String} dir Directory name | value
   * @param {String} packageName NPM Package Name
   * @param {Number} depth Depth to go in Directories or outward
   * @returns {Object} pacakge.json file with accurate versions
   */

  static __SearchPackageJson(dir, packageName, depth) {
    if (depth === 0) return undefined
    const attemptedPath = resolve(dir, './package.json')
    try {
      const pkg = require(attemptedPath)
      if (pkg.name !== packageName)
        throw new Error('package.json does not match')
      return pkg
    } catch (err) {
      return ClassUtils.__SearchPackageJson(
        resolve(dir, '..'),
        packageName,
        depth - 1,
      )
    }
  }

  static PostRequestBodyParser() {}
}
module.exports = ClassUtils
