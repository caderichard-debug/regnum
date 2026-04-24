import type { PlayerInfo } from "./chess/types";
import { createGuestPlayer, getMe } from "./api";

const KEY = "regnum.player";

export function getOrCreatePlayer(): PlayerInfo {
  if (typeof window === "undefined") {
    return { id: "guest", name: "Guest", elo: 1200, connected: true };
  }
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* ignore */ }
  }
  const player: PlayerInfo = {
    id: crypto.randomUUID(),
    name: "Guest",
    elo: 1200,
    connected: true,
  };
  localStorage.setItem(KEY, JSON.stringify(player));
  return player;
}

export async function ensureServerPlayer(): Promise<PlayerInfo> {
  if (typeof window === "undefined") return getOrCreatePlayer();
  const local = getOrCreatePlayer();
  if (local.id && !local.id.startsWith("guest-") && !local.id.startsWith("p-") && !local.id.startsWith("ai-")) {
    try {
      const me = await getMe(local.id);
      if (me) {
        localStorage.setItem(KEY, JSON.stringify(me));
        return me;
      }
    } catch {
      // fall through to create guest
    }
  }
  const guest = await createGuestPlayer();
  localStorage.setItem(KEY, JSON.stringify(guest));
  return guest;
}

export function updatePlayer(patch: Partial<PlayerInfo>): PlayerInfo {
  const p = { ...getOrCreatePlayer(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(p));
  return p;
}

export function aiOpponent(): PlayerInfo {
  const names = ["Vasilios", "Lady Mira", "Ser Aldwin", "The Magister", "Eleanora", "Conrad the Bold", "Isolde"];
  return {
    id: "ai-" + crypto.randomUUID(),
    name: names[Math.floor(Math.random() * names.length)],
    elo: 1100 + Math.floor(Math.random() * 400),
    connected: true,
  };
}

export function randomOpponent(): PlayerInfo {
  const names = ["Marcellus", "Theodora", "Octavian", "Helena", "Cassius", "Aurelia", "Dmitri", "Seraphina"];
  return {
    id: "p-" + crypto.randomUUID(),
    name: names[Math.floor(Math.random() * names.length)],
    elo: 1050 + Math.floor(Math.random() * 500),
    connected: true,
  };
}
