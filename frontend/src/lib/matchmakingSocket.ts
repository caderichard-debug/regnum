import { WS_BASE_URL } from "./config";
import type { Color } from "./chess/types";

export type MatchmakingEvent = { type: "match_found"; gameId: string; color: Color };

export interface MatchmakingSocket {
  close: () => void;
}

export function connectMatchmaking(
  wsClientId: string,
  onEvent: (event: MatchmakingEvent) => void,
  onOpen?: () => void,
): MatchmakingSocket {
  const url = `${WS_BASE_URL.replace(/\/$/, "")}/ws/matchmaking`;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "listen", wsClientId }));
    onOpen?.();
  };
  ws.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(msg.data) as MatchmakingEvent;
      if (parsed.type === "match_found") onEvent(parsed);
    } catch {
      // ignore malformed payloads
    }
  };

  return {
    close: () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    },
  };
}

