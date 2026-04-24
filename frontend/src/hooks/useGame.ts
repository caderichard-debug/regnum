import { useCallback, useEffect, useRef, useState } from "react";
import type { Color, GameState, PlayerInfo, Square } from "@/lib/chess/types";
import { legalMoves, makeMove, opp } from "@/lib/chess/engine";
import { newGameState } from "@/lib/chess/engine";
import { applyItem } from "@/lib/chess/items";
import { connectGame, type GameSocket } from "@/lib/socket";
import { pickAIMove } from "@/lib/ai";

export type GameMode = "online" | "ai" | "friend";

interface UseGameOpts {
  mode: GameMode;
  localColor: Color;
  white: PlayerInfo;
  black: PlayerInfo;
  gameId?: string;
  playerId?: string;
  turnSeconds?: number;
}

export interface ActiveItem {
  key: string;
  hint: string;
}

export function useGame(opts: UseGameOpts) {
  const [state, setState] = useState<GameState>(() =>
    newGameState(opts.white, opts.black, opts.turnSeconds ?? 60)
  );
  const [selected, setSelected] = useState<Square | null>(null);
  const [legal, setLegal] = useState<Square[]>([]);
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [goldFlash, setGoldFlash] = useState<{ color: Color; amount: number; key: number } | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [rematchIncoming, setRematchIncoming] = useState(false);
  const [rematchOutgoing, setRematchOutgoing] = useState(false);

  const socketRef = useRef<GameSocket | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const normalizeServerState = useCallback((incoming: GameState): GameState => {
    const remainingFromDeadline =
      typeof incoming.turnDeadline === "number"
        ? Math.max(0, Math.ceil((incoming.turnDeadline - Date.now()) / 1000))
        : incoming.turnTimeRemaining;
    return {
      ...incoming,
      turnTimeRemaining: Number.isFinite(remainingFromDeadline)
        ? (remainingFromDeadline as number)
        : opts.turnSeconds ?? 60,
      moveCount: incoming.moveCount ?? 0,
      ledger: incoming.ledger ?? [],
      winner: incoming.winner ?? null,
    };
  }, [opts.turnSeconds]);

  // ---- Online connection (best-effort; local engine remains source of truth if no server) ----
  useEffect(() => {
    if (opts.mode !== "online" || !opts.gameId || !opts.playerId) return;
    const sock = connectGame(opts.gameId, opts.playerId, (ev) => {
      if (ev.type === "state_update") setState(normalizeServerState(ev.state));
      else if (ev.type === "opponent_disconnected") setOpponentDisconnected(true);
      else if (ev.type === "opponent_reconnected") setOpponentDisconnected(false);
      else if (ev.type === "rematch_requested") setRematchIncoming(true);
      else if (ev.type === "rematch_declined") setRematchOutgoing(false);
    });
    socketRef.current = sock;
    return () => sock.close();
  }, [opts.mode, opts.gameId, opts.playerId, normalizeServerState]);

  // ---- Turn timer ----
  useEffect(() => {
    if (state.gameOver || opts.mode === "online") return;
    const id = setInterval(() => {
      setState((s) => {
        if (s.gameOver) return s;
        const remaining = Math.max(0, s.turnTimeRemaining - 1);
        if (remaining === 0) {
          return { ...s, turnTimeRemaining: 0, gameOver: true, winner: opp(s.turn), checkStatus: s.checkStatus };
        }
        return { ...s, turnTimeRemaining: remaining };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state.gameOver, opts.mode]);

  // Reset timer on turn change
  const lastTurn = useRef(state.turn);
  useEffect(() => {
    if (opts.mode === "online") return;
    if (lastTurn.current !== state.turn) {
      lastTurn.current = state.turn;
      setState((s) => ({ ...s, turnTimeRemaining: opts.turnSeconds ?? 60 }));
    }
  }, [state.turn, opts.turnSeconds, opts.mode]);

  // In online mode, derive timer from server deadline.
  useEffect(() => {
    if (opts.mode !== "online") return;
    const id = setInterval(() => {
      setState((s) => {
        if (typeof s.turnDeadline !== "number") return s;
        const rem = Math.max(0, Math.ceil((s.turnDeadline - Date.now()) / 1000));
        if (rem === s.turnTimeRemaining) return s;
        return { ...s, turnTimeRemaining: rem };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [opts.mode]);

  // ---- AI opponent ----
  useEffect(() => {
    if (opts.mode !== "ai") return;
    if (state.gameOver) return;
    if (state.turn === opts.localColor) return;
    const t = setTimeout(() => {
      const move = pickAIMove(stateRef.current, opp(opts.localColor));
      if (move) doMove(move.from, move.to, true);
    }, 600 + Math.random() * 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.turn, state.gameOver, opts.mode, opts.localColor]);

  const isMyTurn = state.turn === opts.localColor;

  const doMove = useCallback((from: Square, to: Square, _byAI = false) => {
    if (opts.mode === "online") {
      socketRef.current?.send({ type: "move", from, to });
      setSelected(null);
      setLegal([]);
      setStatusMsg("");
      return;
    }
    setState((prev) => {
      const result = makeMove(prev, from, to);
      if (!result) return prev;
      // Gold flash for the mover
      if (result.goldEarned > 0) {
        setGoldFlash({ color: prev.turn, amount: result.goldEarned, key: Date.now() });
        setTimeout(() => setGoldFlash(null), 1500);
      }
      return result.state;
    });
    setSelected(null);
    setLegal([]);
    setStatusMsg("");
  }, [opts.mode]);

  const onSquareClick = useCallback((sq: Square) => {
    if (state.gameOver) return;

    // Item targeting
    if (activeItem) {
      if (opts.mode === "online") {
        socketRef.current?.send({ type: "item", itemKey: activeItem.key, targetSquare: sq });
        setActiveItem(null);
        setSelected(null);
        setLegal([]);
        setStatusMsg("");
        return;
      }
      const result = applyItem(state, activeItem.key, sq);
      if (!result) {
        setStatusMsg("Invalid target for " + activeItem.key + ".");
        return;
      }
      setState(result.state);
      setActiveItem(null);
      setSelected(null);
      setLegal([]);
      setStatusMsg("");
      return;
    }

    if (!isMyTurn) return;

    if (selected && legal.includes(sq)) {
      doMove(selected, sq);
      return;
    }

    // pick own piece
    const [r, c] = [8 - parseInt(sq[1]), sq.charCodeAt(0) - 97];
    const piece = state.board[r][c];
    if (piece && piece[0] === opts.localColor) {
      setSelected(sq);
      setLegal(legalMoves(state, sq));
    } else {
      setSelected(null);
      setLegal([]);
    }
  }, [state, selected, legal, activeItem, isMyTurn, doMove, opts.localColor]);

  const activateItem = useCallback((key: string, hint: string, needsTarget: boolean) => {
    if (!isMyTurn || state.gameOver) return;
    if (opts.mode === "online" && !needsTarget) {
      socketRef.current?.send({ type: "item", itemKey: key });
      setActiveItem(null);
      return;
    }
    if (!needsTarget) {
      // Apply immediately (e.g. recall)
      const result = applyItem(state, key);
      if (!result) {
        setStatusMsg("Cannot use that right now.");
        return;
      }
      setState(result.state);
      setActiveItem(null);
      return;
    }
    setActiveItem({ key, hint });
    setStatusMsg(hint);
    setSelected(null);
    setLegal([]);
  }, [isMyTurn, state, opts.mode]);

  const cancelItem = useCallback(() => {
    setActiveItem(null);
    setStatusMsg("");
  }, []);

  const requestRematch = useCallback(() => {
    setRematchOutgoing(true);
    socketRef.current?.send({ type: "rematch_request" });
  }, []);

  return {
    state,
    selected,
    legal,
    activeItem,
    statusMsg,
    goldFlash,
    isMyTurn,
    localColor: opts.localColor,
    opponentDisconnected,
    rematchIncoming,
    rematchOutgoing,
    onSquareClick,
    activateItem,
    cancelItem,
    requestRematch,
    setStatusMsg,
  };
}
