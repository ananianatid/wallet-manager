export interface CloudHttpAdapter {
  request(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export const fetchHttpAdapter: CloudHttpAdapter = {
  request: (input, init) => fetch(input, init),
};
