"use client";
import { useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";

interface WhiteboardProps {
  roomId: string;
  socket: Socket | null;
}

interface LineData {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  size: number;
}

// Virtual coordinate space — all strokes are stored in this space
// so they can be replayed correctly at any canvas resolution.
const VIRTUAL_WIDTH = 1920;
const VIRTUAL_HEIGHT = 1080;

export default function Whiteboard({ roomId, socket }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ─── Use refs for all drawing state ───────────────────────────────────────
  // Putting strokeHistory in React state causes the useEffect to re-run on
  // every drawn segment (because saveCanvasState / redrawHistory depend on it),
  // which re-triggers handleResize, clears the canvas, and redraws from a
  // stale snapshot — the "erasing" bug.  A ref is synchronous, never stale,
  // and never causes re-renders.
  const strokeHistoryRef = useRef<LineData[]>([]);
  const isDrawingRef = useRef(false);
  const prevPointRef = useRef<{ x: number; y: number } | null>(null);
  const colorRef = useRef("#000000");
  const sizeRef = useRef(4);

  // ─── Canvas helpers ────────────────────────────────────────────────────────

  /**
   * Draw a single line segment using VIRTUAL coordinates.
   * We scale once here so every call site works in the same space.
   */
  const drawLineOnCanvas = useCallback((line: LineData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // canvas.width / canvas.height are the *actual* pixel dimensions we set in
    // handleResize — use those for scaling, not getBoundingClientRect(), which
    // can differ on high-DPI screens.
    const scaleX = canvas.width / VIRTUAL_WIDTH;
    const scaleY = canvas.height / VIRTUAL_HEIGHT;

    ctx.beginPath();
    ctx.moveTo(line.x0 * scaleX, line.y0 * scaleY);
    ctx.lineTo(line.x1 * scaleX, line.y1 * scaleY);
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }, []); // no external deps → never recreated

  /**
   * Repaint the whole canvas from the ref-based history.
   * Accepts an optional override so callers that already have the latest array
   * can pass it in without waiting for the ref to update.
   */
  const redrawHistory = useCallback((history?: LineData[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    (history ?? strokeHistoryRef.current).forEach(drawLineOnCanvas);
  }, [drawLineOnCanvas]); // stable — drawLineOnCanvas never changes

  /**
   * Persist the current stroke history to the DB.
   * Reads straight from the ref so it never captures a stale closure.
   */
  const saveCanvasState = useCallback(async () => {
    if (!roomId || roomId === "undefined") return;
    if (strokeHistoryRef.current.length === 0) return;
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasState: JSON.stringify(strokeHistoryRef.current),
        }),
      });
    } catch (err) {
      console.warn("Whiteboard auto-save interrupted:", err);
    }
  }, [roomId]); // only roomId matters — no strokeHistory dep

  // ─── Resize handler ────────────────────────────────────────────────────────

  /**
   * Fit the canvas element to its parent, then redraw.
   * Setting canvas.width/height clears the bitmap — redrawHistory restores it.
   * Wrapped in useCallback with no deps so it's stable and can safely be added
   * to / removed from the resize listener without stale-closure risk.
   */
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    redrawHistory();
  }, [redrawHistory]); // redrawHistory is also stable

  // ─── Mount effect — runs ONCE ──────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || roomId === "undefined") return;

    // Load persisted canvas state
    fetch(`/api/rooms/${roomId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Room unreachable");
        return res.json();
      })
      .then((data) => {
        if (data?.canvasState) {
          const history = JSON.parse(data.canvasState) as LineData[];
          strokeHistoryRef.current = history;
          // Size the canvas first so redraw uses the correct dimensions
          handleResize();
        }
      })
      .catch((err) => console.warn("Could not load whiteboard history:", err));

    // Initial resize
    handleResize();
    window.addEventListener("resize", handleResize);

    // Auto-save every 10 s
    const saveInterval = setInterval(saveCanvasState, 10_000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(saveInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]); // intentionally omit handleResize / saveCanvasState —
  //              they're stable callbacks but listing them would still cause
  //              the effect to re-run if React decides to recreate them.
  //              roomId is the only real trigger here.

  // ─── Socket effect — runs when socket changes ──────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onDrawLine = (line: LineData) => {
      strokeHistoryRef.current = [...strokeHistoryRef.current, line];
      drawLineOnCanvas(line);
    };

    const onClearCanvas = () => {
      strokeHistoryRef.current = [];
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    socket.on("draw-line", onDrawLine);
    socket.on("clear-canvas", onClearCanvas);

    return () => {
      socket.off("draw-line", onDrawLine);
      socket.off("clear-canvas", onClearCanvas);
    };
  }, [socket, drawLineOnCanvas]);

  // ─── Coordinate helpers ────────────────────────────────────────────────────

  const getVirtualCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    // Map display pixels → virtual space
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIRTUAL_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * VIRTUAL_HEIGHT,
    };
  };

  // ─── Drawing event handlers ────────────────────────────────────────────────

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getVirtualCoords(e);
    if (!coords) return;
    prevPointRef.current = coords;
    isDrawingRef.current = true;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !prevPointRef.current) return;
    const current = getVirtualCoords(e);
    if (!current) return;

    const line: LineData = {
      x0: prevPointRef.current.x,
      y0: prevPointRef.current.y,
      x1: current.x,
      y1: current.y,
      color: colorRef.current,
      size: sizeRef.current,
    };

    // Append to ref (synchronous, no re-render)
    strokeHistoryRef.current = [...strokeHistoryRef.current, line];
    // Paint immediately
    drawLineOnCanvas(line);
    // Broadcast to peers
    socket?.emit("draw-line", { roomId, ...line });

    prevPointRef.current = current;
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    prevPointRef.current = null;
    // Persist on stroke end
    saveCanvasState();
  };

  // ─── Clear board ───────────────────────────────────────────────────────────

  const handleClear = async () => {
    strokeHistoryRef.current = [];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket?.emit("clear-canvas", roomId);
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasState: "[]" }),
      });
    } catch (err) {
      console.error("Failed to save cleared board state:", err);
    }
  };

  // ─── Toolbar sync helpers (refs → DOM inputs) ──────────────────────────────
  // Because we removed useState for color/size, we use uncontrolled inputs
  // and write changes directly to refs.

  return (
    <div className="flex flex-1 flex-col h-full bg-white relative">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2 rounded-lg bg-white p-2 shadow-md border border-gray-100">
        <input
          type="color"
          defaultValue="#000000"
          onChange={(e) => {
            colorRef.current = e.target.value;
          }}
          className="h-8 w-8 cursor-pointer border-0 rounded"
        />
        <select
          defaultValue={4}
          onChange={(e) => {
            sizeRef.current = Number(e.target.value);
          }}
          className="rounded border border-gray-300 text-sm px-2 text-gray-950 focus:outline-none"
        >
          <option value="2">Thin</option>
          <option value="4">Medium</option>
          <option value="8">Thick</option>
          <option value="16">Extra Thick</option>
        </select>
        <button
          onClick={handleClear}
          className="rounded bg-red-50 text-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 transition"
        >
          Clear Board
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 w-full h-full">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="cursor-crosshair block"
        />
      </div>
    </div>
  );
}