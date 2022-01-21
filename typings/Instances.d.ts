export type Awaitable<T> = T | PromiseLike<T>

export interface WebhooksEvents {
  error: [
    message: string,
    extraData: any,
    timestamp: Date,
  ],
  request: [
    Usage:  string,
    request: JSON,
    response: JSON,
    timestamp: Date
  ],
  vote: [
    websiteName: string,
    requestBody: Object | void,
    timestamp: Date
  ],
  posted: [
    postResponse: { status_code: number , message: string },
    timestamp: Date
  ]
}