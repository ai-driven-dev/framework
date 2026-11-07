export interface HttpGetOptions {
  token?: string;
  accept?: string;
}

export interface HttpResponse {
  body: Buffer | unknown;
  statusCode: number;
  contentType: string;
}

export interface HttpGet {
  get(url: string, options?: HttpGetOptions): Promise<HttpResponse>;
}
