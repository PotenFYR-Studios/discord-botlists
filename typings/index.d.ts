import { AxiosPromise } from 'axios'
import { WebhooksEvents, Awaitable } from './Instances'

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
  ): Promise<any>
  public poststats(
    botId: string | number,
    apiBody: {
      serverCount: number | string
      shards: Array | void
      shardcount: number | string | void
      shardId: number | string | void
    },
  ): Promise<AxiosPromise<any>>

  public on<K extends keyof WebhooksEvents>(
    event: K,
    listener: (...args: WebhooksEvents[K]) => Awaitable<void>,
  ): this
  public on<S extends string | symbol>(
    event: Exclude<S, keyof WebhooksEvents>,
    listener: (...args: any[]) => Awaitable<void>,
  ): this
}
