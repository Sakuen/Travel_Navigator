export type ApiFailure = { code?: string; message: string; retry_after_seconds?: number | null; quota_url?: string | null };

export class ApiError extends Error {
  constructor(public failure: ApiFailure, public status: number) {
    super(failure.message);
    this.name = "ApiError";
  }
}

export async function readApiError(response: Response): Promise<ApiError> {
  let fallback = response.status === 429
    ? "Gemini's request or token limit was reached. Check Google AI Studio before retrying."
    : `The server could not complete this request (HTTP ${response.status}). Please retry.`;
  if (response.status === 502 || response.status === 504) fallback = "The backend or Gemini did not respond in time. Check the backend is running, then retry.";
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return new ApiError({ message: body.detail }, response.status);
    if (body.detail && typeof body.detail.message === "string") {
      return new ApiError(body.detail, response.status);
    }
    if (Array.isArray(body.detail)) return new ApiError({ message: "Some request fields are invalid. Review your travel brief and try again." }, response.status);
  } catch { /* Proxies can return HTML instead of JSON. */ }
  return new ApiError({ message: fallback }, response.status);
}

export function refreshAiUsage() {
  window.dispatchEvent(new Event("ai-usage-changed"));
}
