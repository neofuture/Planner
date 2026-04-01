"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Engine3d } from "@/lib/engine3d";
import type { RoomShape } from "@/lib/types";
import styles from "./Engine3D.module.css";

interface Engine3DProps {
  roomShape: RoomShape;
  floorTexture?: string;
  onClose: () => void;
}

export interface Engine3DHandle {
  refresh: () => void;
  setFloorTexture: (path: string) => void;
}

type Corner = "tl" | "tr" | "bl" | "br";

const MIN_W = 280;
const MIN_H = 220;

const STORAGE_KEY = "planner-3d-preview";

interface SavedState {
  window?: { top: number; left: number; width: number; height: number };
  invertY?: boolean;
  nightMode?: boolean;
}

function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state: SavedState) {
  try {
    const prev = loadState() ?? {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...state }));
  } catch { /* noop */ }
}

const Engine3D = forwardRef<Engine3DHandle, Engine3DProps>(function Engine3D(
  { roomShape, floorTexture, onClose },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine3d | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const [invertY, setInvertY] = useState(() => loadState()?.invertY ?? false);
  const [kneeling, setKneeling] = useState(false);
  const [nightMode, setNightMode] = useState(() => loadState()?.nightMode ?? false);

  const windowDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const resizeCorner = useRef<Corner | null>(null);
  const resizeStart = useRef({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  useImperativeHandle(ref, () => ({
    refresh() {
      engineRef.current?.buildRoom(roomShape);
    },
    setFloorTexture(path: string) {
      engineRef.current?.setFloorTexture(path);
    },
  }));

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new Engine3d();
    engine.invertY = loadState()?.invertY ?? false;
    engine.onKneelChange = (k) => setKneeling(k);
    engineRef.current = engine;

    const timer = setTimeout(() => {
      engine.start(canvasRef.current!, roomShape);
      if (floorTexture) {
        engine.setFloorTexture(floorTexture);
      }
      const savedNightMode = loadState()?.nightMode ?? false;
      if (savedNightMode) {
        engine.setNightMode(true);
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      engine.onKneelChange = null;
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.buildRoom(roomShape);
  }, [roomShape]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !floorTexture) return;
    engine.setFloorTexture(floorTexture);
  }, [floorTexture]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.invertY = invertY;
    saveState({ invertY });
  }, [invertY]);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.kneeling = kneeling;
      engine.requestRender();
    }
  }, [kneeling]);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setNightMode(nightMode);
    }
    saveState({ nightMode });
  }, [nightMode]);

  useEffect(() => {
    const ro = new ResizeObserver(() => engineRef.current?.resize());
    const el = windowRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getParentRect = useCallback(() => {
    const el = windowRef.current;
    if (!el) return null;
    const parent = el.offsetParent as HTMLElement | null;
    if (!parent) return null;
    return parent.getBoundingClientRect();
  }, []);

  /* ---- Title-bar drag (move window) ---- */

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = windowRef.current;
    if (!el) return;
    windowDragging.current = true;
    const rect = el.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!windowDragging.current || !windowRef.current) return;
      const pr = getParentRect();
      if (!pr) return;
      const el = windowRef.current;
      const elW = el.offsetWidth;
      const elH = el.offsetHeight;
      let newLeft = e.clientX - pr.left - dragOffset.current.x;
      let newTop = e.clientY - pr.top - dragOffset.current.y;
      newLeft = Math.max(0, Math.min(newLeft, pr.width - elW));
      newTop = Math.max(0, Math.min(newTop, pr.height - elH));
      el.style.left = newLeft + "px";
      el.style.top = newTop + "px";
      el.style.right = "auto";
      el.style.bottom = "auto";
    },
    [getParentRect]
  );

  const persistWindowRect = useCallback(() => {
    const el = windowRef.current;
    if (!el) return;
    saveState({
      window: {
        top: el.offsetTop,
        left: el.offsetLeft,
        width: el.offsetWidth,
        height: el.offsetHeight,
      },
    });
  }, []);

  const onPointerUp = useCallback(() => {
    windowDragging.current = false;
    persistWindowRect();
  }, [persistWindowRect]);

  /* ---- Corner resize ---- */

  const onResizePointerDown = useCallback(
    (corner: Corner, e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const el = windowRef.current;
      if (!el) return;
      const pr = getParentRect();
      if (!pr) return;
      resizeCorner.current = corner;
      const rect = el.getBoundingClientRect();
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        left: rect.left - pr.left,
        top: rect.top - pr.top,
        width: rect.width,
        height: rect.height,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getParentRect]
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeCorner.current || !windowRef.current) return;
      const pr = getParentRect();
      if (!pr) return;
      const el = windowRef.current;
      const s = resizeStart.current;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const corner = resizeCorner.current;

      let newLeft = s.left;
      let newTop = s.top;
      let newWidth = s.width;
      let newHeight = s.height;

      if (corner === "tl" || corner === "bl") {
        newLeft = Math.max(0, s.left + dx);
        newWidth = s.left + s.width - newLeft;
        if (newWidth < MIN_W) {
          newWidth = MIN_W;
          newLeft = s.left + s.width - MIN_W;
        }
      } else {
        newWidth = s.width + dx;
        newWidth = Math.max(MIN_W, Math.min(newWidth, pr.width - newLeft));
      }

      if (corner === "tl" || corner === "tr") {
        newTop = Math.max(0, s.top + dy);
        newHeight = s.top + s.height - newTop;
        if (newHeight < MIN_H) {
          newHeight = MIN_H;
          newTop = s.top + s.height - MIN_H;
        }
      } else {
        newHeight = s.height + dy;
        newHeight = Math.max(MIN_H, Math.min(newHeight, pr.height - newTop));
      }

      el.style.left = newLeft + "px";
      el.style.top = newTop + "px";
      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.width = newWidth + "px";
      el.style.height = newHeight + "px";
    },
    [getParentRect]
  );

  const onResizePointerUp = useCallback(() => {
    resizeCorner.current = null;
    persistWindowRect();
  }, [persistWindowRect]);

  const handleProps = useCallback(
    (corner: Corner) => ({
      onPointerDown: (e: React.PointerEvent) => onResizePointerDown(corner, e),
      onPointerMove: onResizePointerMove,
      onPointerUp: onResizePointerUp,
    }),
    [onResizePointerDown, onResizePointerMove, onResizePointerUp]
  );

  const savedWin = useRef(loadState()?.window);
  const initialStyle = savedWin.current
    ? { top: savedWin.current.top, left: savedWin.current.left, width: savedWin.current.width, height: savedWin.current.height }
    : { top: 10, right: 10, width: 420, height: 320 };

  return (
    <div
      ref={windowRef}
      className={styles.floatingWindow}
      style={initialStyle}
    >
      <div
        className={`${styles.resizeHandle} ${styles.handleTL}`}
        {...handleProps("tl")}
      />
      <div
        className={`${styles.resizeHandle} ${styles.handleTR}`}
        {...handleProps("tr")}
      />
      <div
        className={`${styles.resizeHandle} ${styles.handleBL}`}
        {...handleProps("bl")}
      />
      <div
        className={`${styles.resizeHandle} ${styles.handleBR}`}
        {...handleProps("br")}
      />
      <div
        className={styles.titleBar}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className={styles.titleText}>3D Preview</span>
        <label
          className={styles.invertLabel}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => canvasRef.current?.focus()}
        >
          <input
            type="checkbox"
            checked={invertY}
            onChange={(e) => setInvertY(e.target.checked)}
          />
          Invert Y
        </label>
        <label
          className={styles.invertLabel}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => canvasRef.current?.focus()}
        >
          <input
            type="checkbox"
            checked={kneeling}
            onChange={(e) => setKneeling(e.target.checked)}
          />
          Kneel (Shift)
        </label>
        <label
          className={styles.invertLabel}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => canvasRef.current?.focus()}
        >
          <input
            type="checkbox"
            checked={nightMode}
            onChange={(e) => setNightMode(e.target.checked)}
          />
          Night
        </label>
        <button className={styles.closeBtn} onClick={onClose}>
          &times;
        </button>
      </div>
      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} tabIndex={0} />
        <div className={styles.hint}>
          Click+drag look &mdash; Click doors &mdash; WASD move &mdash; Shift kneel
        </div>
      </div>
    </div>
  );
});

export default Engine3D;
