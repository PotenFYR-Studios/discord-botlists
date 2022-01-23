import { AxiosPromise, AxiosResponse } from 'axios'
import { WebhooksEvents, Awaitable } from './Instances'
import botlistJson from '../src/resources/botlists.json'
import EventEmitter from 'events'

export class BotLists extends EventEmitter {
  public constructor(
    webhookEndpoint: string,
    botlistData: Object,
    listenerPortNumber?: number | void | 8080,
    ipAddress?: string | number | 'localhost',
    redirectUrl?:
      | string
      | void
      | 'https://github.com/SidisLiveYT/discord-botlists',
  )
  public readonly webhookEndpoint: string
  public readonly botlistData: Object
  public readonly redirectUrl: string
  public readonly ipAddress: string | number | 'localhost'
  public readonly expressApp: any
  public readonly listenerPortNumber: number
  public start(
    webhookEndpoint: string,
    redirectUrl?:
      | string
      | void
      | 'https://github.com/SidisLiveYT/discord-botlists',
    eventTrigger?: boolean,
  ): Promise<any>
  public poststats(
    apiBody: {
      bot_id: string | number
      server_count: number | string
      shards: Array<string> | void
      shard_id: number | string | void
      shard_count: number | string | void
    },
    eventOnPost?: boolean | void,
    AxioshttpConfigs?: Object,
    forcePosting?: boolean | void,
  ): Promise<boolean>
  public autoPoster(
    apiBody: {
      bot_id: string | number
      server_count: number | string
      shards: Array<string> | void
      shard_id: number | string | void
      shard_count: number | string | void
    },
    AxioshttpConfigs?: Object,
    Timer?: number | void | '82 * 1000',
    eventOnPost?: boolean | void,
  ): NodeJS.Timer

  public on<K extends keyof WebhooksEvents>(
    event: K,
    listener: (...args: WebhooksEvents[K]) => Awaitable<void>,
  ): this
  public on<S extends string | symbol>(
    event: Exclude<S, keyof WebhooksEvents>,
    listener: (...args: any[]) => Awaitable<void>,
  ): this
}
export { botlistJson }
