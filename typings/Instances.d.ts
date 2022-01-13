import { AxiosResponse } from "axios"

export type Awaitable<T> = T | PromiseLike<T>

export interface WebhooksEvents {
  error: [
    message: string
  ],
  vote: [
    websiteName: string,
    requestBody: Object | void,
    request: any | void,
    response: any | void
  ],
  posted: [
    websiteName: string,
    websiteUrl: string,
    response: AxiosResponse
  ]
}