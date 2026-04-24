export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:3000";

export const WS_BASE_URL =
  (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.trim() || "ws://localhost:3000";

