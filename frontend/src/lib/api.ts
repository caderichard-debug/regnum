import { API_BASE_URL } from "./config";
import type { Color, GameState, PlayerInfo, Square } from "./chess/types";

interface GuestResponse {
  playerId: string;
  name: string;
  elo: number;
}

interface MatchJoinResponseWaiting {
  status: "waiting";
}

interface MatchJoinResponseMatched {
  status: "matched";
  gameId: string;
  color: Color;
}

export type MatchJoinResponse = MatchJoinResponseWaiting | MatchJoinResponseMatched;

function jsonHeaders(playerId?: string): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (playerId) h["x-player-id"] = playerId;
  return h;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function createGuestPlayer(): Promise<PlayerInfo> {
  const res = await fetch(`${API_BASE_URL}/api/player/guest`, {
    method: "POST",
    headers: jsonHeaders(),
  });
  const data = await readJson<GuestResponse>(res);
  return { id: data.playerId, name: data.name, elo: data.elo, connected: true };
}

export async function getMe(playerId: string): Promise<PlayerInfo | null> {
  const res = await fetch(`${API_BASE_URL}/api/player/me`, {
    headers: jsonHeaders(playerId),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { id: string; name: string; elo: number };
  return { ...data, connected: true };
}

export async function matchmakingJoin(playerId: string, wsClientId: string): Promise<MatchJoinResponse> {
  const res = await fetch(`${API_BASE_URL}/api/matchmaking/join`, {
    method: "POST",
    headers: jsonHeaders(playerId),
    body: JSON.stringify({ wsClientId }),
  });
  return readJson<MatchJoinResponse>(res);
}

export async function matchmakingCancel(playerId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/matchmaking/cancel`, {
    method: "DELETE",
    headers: jsonHeaders(playerId),
  });
}

export async function fetchGame(gameId: string): Promise<GameState> {
  const res = await fetch(`${API_BASE_URL}/api/game/${gameId}`);
  return readJson<GameState>(res);
}

export async function postMove(playerId: string, gameId: string, from: Square, to: Square): Promise<GameState> {
  const res = await fetch(`${API_BASE_URL}/api/game/${gameId}/move`, {
    method: "POST",
    headers: jsonHeaders(playerId),
    body: JSON.stringify({ from, to }),
  });
  return readJson<GameState>(res);
}

export async function postItem(
  playerId: string,
  gameId: string,
  itemKey: string,
  targetSquare?: Square,
): Promise<GameState> {
  const res = await fetch(`${API_BASE_URL}/api/game/${gameId}/item`, {
    method: "POST",
    headers: jsonHeaders(playerId),
    body: JSON.stringify({ itemKey, targetSquare }),
  });
  return readJson<GameState>(res);
}

