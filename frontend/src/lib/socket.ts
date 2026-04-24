import type { Color, GameState, Square } from "./chess/types";
import { WS_BASE_URL } from "./config";

export type ServerEvent =
  | { type: "state_update"; state: GameState }
  | { type: "error"; message: string }
  | { type: "opponent_disconnected" }
  | { type: "opponent_reconnected" }
  | { type: "forfeit_win"; reason: "forfeit" | "disconnect" }
  | { type: "rematch_requested" }
  | { type: "rematch_accepted"; newGameId: string }
  | { type: "rematch_declined" }
  | { type: "turn_timeout"; player: Color };

export type ClientEvent =
  | { type: "move"; from: Square; to: Square }
  | { type: "item"; itemKey: string; targetSquare?: Square }
  | { type: "rematch_request" }
  | { type: "rematch_response"; accept: boolean }
  | { type: "ping" };

export interface GameSocket {
  send: (event: ClientEvent) => void;
  close: () => void;
  isOpen: () => boolean;
}

export function connectGame(
  gameId: string,
  playerId: string,
  onEvent: (e: ServerEvent) => void,
): GameSocket {
  let ws: WebSocket | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let authed = false;

  const url = `${WS_BASE_URL.replace(/\/$/, "")}/ws/game/${gameId}`;

  try {
    ws = new WebSocket(url);
    ws.onmessage = (msg) => {
      try { onEvent(JSON.parse(msg.data)); } catch { /* ignore */ }
    };
    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: "auth", playerId, gameId }));
      authed = true;
      pingTimer = setInterval(() => {
        if (authed && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 5000);
    };
    ws.onclose = () => {
      authed = false;
      if (pingTimer) clearInterval(pingTimer);
    };
    ws.onerror = () => { /* fall back silently — local engine remains authoritative */ };
  } catch {
    /* environment without WS — fine, local engine handles play */
  }

  return {
    send: (event) => {
      if (authed && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    },
    close: () => {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      try { ws?.close(); } catch { /* ignore */ }
    },
    isOpen: () => !closed && ws?.readyState === WebSocket.OPEN,
  };
}
