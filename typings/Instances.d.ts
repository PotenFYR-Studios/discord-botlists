import { AxiosResponse } from "axios"

export type Awaitable<T> = T | PromiseLike<T>

export interface WebhooksEvents {
  error: [
    message: string,
    extraData: any,
    timestamp: Date,
  ],
  request: [
    request: string,
    response: string,
    timestamp: Date
  ],
  vote: [
    websiteName: string,
    requestBody: Object | void,
    timestamp: Date
  ],
  posted: [
    postResponse: AxiosResponse,
    timestamp: Date
  ]
}