"use client";

import {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Engine2d } from "@/lib/engine2d";
import type { RoomShape, ActiveItem, Wall } from "@/lib/types";
import styles from "./Engine2D.module.css";

interface Engine2DProps {
  roomShape: RoomShape;
  onZoomLevelChange?: (zoom: number) => void;
  onSelectedItemChange?: (item: ActiveItem) => void;
  onWallsListChange?: (walls: Wall[]) => void;
  onAnimationComplete?: () => void;
  onRoomDataChanged?: () => void;
}

export interface Engine2DHandle {
  engine: Engine2d | null;
}

const Engine2D = forwardRef<Engine2DHandle, Engine2DProps>(function Engine2D(
  { roomShape, onZoomLevelChange, onSelectedItemChange, onWallsListChange, onAnimationComplete, onRoomDataChanged },
  ref
) {
  const canvasGridRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasToolsRef = useRef<HTMLCanvasElement>(null);
  const canvasTilesRef = useRef<HTMLCanvasElement>(null);
  const canvasInsetsRef = useRef<HTMLCanvasElement>(null);
  const canvasControlsRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine2d | null>(null);

  useImperativeHandle(ref, () => ({
    get engine() {
      return engineRef.current;
    },
  }));

  const handleResize = useCallback(() => {
    engineRef.current?.resize();
  }, []);

  useEffect(() => {
    if (
      !canvasGridRef.current ||
      !canvasRef.current ||
      !canvasInsetsRef.current ||
      !canvasToolsRef.current ||
      !canvasControlsRef.current ||
      !canvasTilesRef.current
    )
      return;

    const engine = new Engine2d();
    engineRef.current = engine;

    engine.setCallbacks(
      (item) => onSelectedItemChange?.(item),
      (walls) => onWallsListChange?.(walls),
      (zoom) => onZoomLevelChange?.(zoom),
      () => onAnimationComplete?.(),
      () => onRoomDataChanged?.()
    );

    const timer = setTimeout(() => {
      engine.startEngine(
        canvasGridRef.current!,
        canvasRef.current!,
        canvasInsetsRef.current!,
        canvasToolsRef.current!,
        canvasControlsRef.current!,
        canvasTilesRef.current!,
        roomShape
      );
    }, 100);

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      engine.dispose();
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (engineRef.current && engineRef.current.roomShape !== roomShape) {
      engineRef.current.setRoom(roomShape);
    }
  }, [roomShape]);

  return (
    <div className={styles.canvasContainer}>
      <canvas ref={canvasGridRef} className={styles.canvasLayer} />
      <canvas ref={canvasTilesRef} className={styles.canvasLayer} />
      <canvas ref={canvasRef} className={styles.canvasLayer} />
      <canvas ref={canvasInsetsRef} className={styles.canvasLayer} />
      <canvas ref={canvasToolsRef} className={styles.canvasLayer} />
      <canvas ref={canvasControlsRef} className={styles.canvasControls} />
    </div>
  );
});

export default Engine2D;
