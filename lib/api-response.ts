export type ApiResult = {
  error?: string;
  [key: string]: unknown;
};

export async function readApiResponse<T extends ApiResult>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body) {
    return {
      error: response.ok
        ? "The server returned an empty response."
        : `The server request failed (${response.status}).`,
    } as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return {
      error: response.ok
        ? "The server returned an invalid response."
        : `The server request failed (${response.status}).`,
    } as T;
  }
}
