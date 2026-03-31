"use client";

import { useState, useRef, useCallback, lazy, Suspense } from "react";
import Engine2D, { type Engine2DHandle } from "@/components/Engine2D";
import type { Engine3DHandle } from "@/components/Engine3D";
import { roomShape1, roomShape2, roomShape3 } from "@/lib/room-data";

const Engine3D = lazy(() => import("@/components/Engine3D"));
import type {
  ActiveItem,
  Wall,
  RoomShape,
  GridSizeOption,
  InteractionMode,
  Inset,
  DoorStyle,
} from "@/lib/types";
import { DOOR_PRESETS } from "@/lib/types";
import styles from "./page.module.css";

const gridSizes: GridSizeOption[] = [
  { label: "100mm", value: 100 },
  { label: "200mm", value: 200 },
  { label: "250mm", value: 250 },
  { label: "500mm", value: 500 },
  { label: "1000mm", value: 1000 },
];

export default function PlannerPage() {
  const engineRef = useRef<Engine2DHandle>(null);
  const engine3dRef = useRef<Engine3DHandle>(null);

  const [roomShape, setRoomShape] = useState<RoomShape>(roomShape1);
  const [zoomLevel, setZoomLevel] = useState(0.5);
  const [selectedItem, setSelectedItem] = useState<ActiveItem>({
    type: "",
    id: -1,
    poly: [],
    wall: -1,
    identity: -1,
  });
  const [walls, setWalls] = useState<Wall[]>([]);
  const [gridSize, setGridSize] = useState(1000);
  const [mode, setMode] = useState<InteractionMode>("all");
  const [freeEdit, setFreeEdit] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [show3D, setShow3D] = useState(false);

  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(false);
  const [showGround, setShowGround] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [showInsetMeasurements, setShowInsetMeasurements] = useState(true);
  const [showCorners, setShowCorners] = useState(true);
  const [showLetters, setShowLetters] = useState(true);
  const [showArea, setShowArea] = useState(true);
  const [showWalls, setShowWalls] = useState(true);
  const [showSlopes, setShowSlopes] = useState(true);
  const [showInsets, setShowInsets] = useState(true);
  const [showInsetOpenings, setShowInsetOpenings] = useState(true);
  const [showColours, setShowColours] = useState(true);
  const [showFlooring, setShowFlooring] = useState(false);
  const [showLocks, setShowLocks] = useState(true);

  const [floorAngle, setFloorAngle] = useState(0);
  const [floorPositionX, setFloorPositionX] = useState(0);
  const [floorPositionY, setFloorPositionY] = useState(0);
  const [floorWidth, setFloorWidth] = useState(1000);
  const [floorHeight, setFloorHeight] = useState(500);
  const [floorGap, setFloorGap] = useState(0);
  const [floorOffset, setFloorOffset] = useState(0);

  const engine = engineRef.current?.engine;

  const itemDetails: string[] = [];
  if (selectedItem.wall > -1) {
    itemDetails.push(
      "Wall " + String.fromCharCode(65 + selectedItem.wall)
    );
  }
  if (selectedItem.wall === -99) {
    itemDetails.push("Ground");
  }
  if (selectedItem.type === "inset") {
    itemDetails.push(String(selectedItem.identity));
  }
  if (selectedItem.type === "slope") {
    itemDetails.push(String(selectedItem.identity));
  }

  const wallsList = walls.map((_, i) => ({
    label: String.fromCharCode(65 + i),
    value: i,
  }));

  const handleRoomShape = useCallback(
    (shape: number) => {
      const shapes = [roomShape1, roomShape2, roomShape3];
      const newShape = shapes[shape - 1];
      setRoomShape(newShape);
    },
    []
  );

  const handleGridChange = useCallback(
    (value: number) => {
      setGridSize(value);
      engine?.setGrid(value);
    },
    [engine]
  );

  const handleModeChange = useCallback(
    (m: InteractionMode) => {
      setMode(m);
      engine?.setMode(m);
    },
    [engine]
  );

  const handleFreeEdit = useCallback(() => {
    const result = engine?.setFreeEdit();
    setFreeEdit(!!result);
  }, [engine]);

  const toggle = useCallback(
    (
      setter: (v: boolean) => void,
      engineMethod: ((v: boolean) => void) | undefined,
      value: boolean
    ) => {
      const next = !value;
      setter(next);
      engineMethod?.(next);
    },
    []
  );

  const handleAnimationComplete = useCallback(() => {
    setSelectedItem((prev) => ({ ...prev }));
    engine3dRef.current?.refresh();
  }, []);

  const lastRefreshTime = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRoomDataChanged = useCallback(() => {
    const now = Date.now();
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (now - lastRefreshTime.current > 120) {
      lastRefreshTime.current = now;
      engine3dRef.current?.refresh();
    } else {
      refreshTimer.current = setTimeout(() => {
        lastRefreshTime.current = Date.now();
        engine3dRef.current?.refresh();
      }, 120);
    }
  }, []);

  const handleToggleInset = useCallback(
    (inset: Inset, id: number) => {
      const opening = inset.openings[id];
      if (!opening) return;
      if (opening.state === "open" || opening.state === "opening") {
        engine?.closeInsets(inset, id);
      } else {
        engine?.openInsets(inset, id);
      }
      setSelectedItem((prev) => ({ ...prev }));
    },
    [engine]
  );

  return (
    <div className={styles.root}>
      <div className={styles.uiContainer}>
        {/* Left Tools Panel */}
        <div className={styles.tools}>
          <button
            className={styles.btn}
            onClick={() => handleRoomShape(1)}
          >
            Room 1
          </button>
          <button
            className={styles.btn}
            onClick={() => handleRoomShape(2)}
          >
            Room 2
          </button>
          <button
            className={styles.btn}
            onClick={() => handleRoomShape(3)}
          >
            Room 3
          </button>
          <hr className={styles.divider} />
          <input
            type="file"
            id="roomJsonUpload"
            accept=".json"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                  try {
                    const json = JSON.parse(evt.target?.result as string);
                    setRoomShape(json);
                  } catch (err) {
                    alert("Invalid JSON file");
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }
            }}
          />
          <button
            className={styles.btn}
            onClick={() => document.getElementById("roomJsonUpload")?.click()}
          >
            Upload JSON
          </button>
          <button
            className={styles.btn}
            onClick={() => {
              const json = JSON.stringify(roomShape, null, 2);
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "room-shape.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download JSON
          </button>
          <hr className={styles.divider} />

          <div>
            <label className={styles.label}>Grid Size</label>
            <select
              className={styles.select}
              value={gridSize}
              onChange={(e) => handleGridChange(Number(e.target.value))}
            >
              {gridSizes.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <hr className={styles.divider} />

          <Checkbox
            label="Grid"
            checked={showGrid}
            onChange={() =>
              toggle(setShowGrid, engine?.setGridVisible.bind(engine), showGrid)
            }
          />
          <Checkbox
            label="Rulers"
            checked={showRulers}
            indent
            onChange={() =>
              toggle(setShowRulers, engine?.setRulers.bind(engine), showRulers)
            }
          />
          <Checkbox
            label="Ground"
            checked={showGround}
            onChange={() =>
              toggle(setShowGround, engine?.setGround.bind(engine), showGround)
            }
          />
          <Checkbox
            label="Measurements"
            checked={showMeasurements}
            onChange={() =>
              toggle(
                setShowMeasurements,
                engine?.setMeasurements.bind(engine),
                showMeasurements
              )
            }
          />
          {showMeasurements && (
            <>
              <Checkbox
                label="Insets"
                checked={showInsetMeasurements}
                indent
                onChange={() =>
                  toggle(
                    setShowInsetMeasurements,
                    engine?.setInsetMeasurements.bind(engine),
                    showInsetMeasurements
                  )
                }
              />
              <Checkbox
                label="Corners"
                checked={showCorners}
                indent
                onChange={() =>
                  toggle(
                    setShowCorners,
                    engine?.setCorners.bind(engine),
                    showCorners
                  )
                }
              />
            </>
          )}
          <Checkbox
            label="Wall Letters"
            checked={showLetters}
            onChange={() =>
              toggle(
                setShowLetters,
                engine?.setLetters.bind(engine),
                showLetters
              )
            }
          />
          <Checkbox
            label="Area"
            checked={showArea}
            onChange={() =>
              toggle(setShowArea, engine?.setArea.bind(engine), showArea)
            }
          />
          <Checkbox
            label="Walls"
            checked={showWalls}
            onChange={() =>
              toggle(setShowWalls, engine?.setWalls.bind(engine), showWalls)
            }
          />
          <Checkbox
            label="Ceiling Slopes"
            checked={showSlopes}
            onChange={() =>
              toggle(setShowSlopes, engine?.setSlopes.bind(engine), showSlopes)
            }
          />
          <Checkbox
            label="Insets"
            checked={showInsets}
            onChange={() =>
              toggle(setShowInsets, engine?.setInsets.bind(engine), showInsets)
            }
          />
          {showInsets && (
            <Checkbox
              label="Openings"
              checked={showInsetOpenings}
              indent
              onChange={() =>
                toggle(
                  setShowInsetOpenings,
                  engine?.updateInsetOpenings.bind(engine),
                  showInsetOpenings
                )
              }
            />
          )}
          <Checkbox
            label="Colours"
            checked={showColours}
            onChange={() =>
              toggle(
                setShowColours,
                engine?.setColours.bind(engine),
                showColours
              )
            }
          />
          <Checkbox
            label="Flooring"
            checked={showFlooring}
            onChange={() => {
              const next = !showFlooring;
              setShowFlooring(next);
              engine?.updateFlooring(next);
            }}
          />
          <Checkbox
            label="Locks"
            checked={showLocks}
            onChange={() =>
              toggle(
                setShowLocks,
                engine?.updateLocks.bind(engine),
                showLocks
              )
            }
          />
          <hr className={styles.divider} />

          <button className={styles.btn} onClick={() => engine?.autoCentre()}>
            Centre
          </button>
          <button className={styles.btn} onClick={() => engine?.autoZoom()}>
            Auto Zoom
          </button>
          <button
            className={styles.btn}
            onClick={() => engine?.autoZoomCentre()}
          >
            Auto Zoom/Centre
          </button>
          <hr className={styles.divider} />
          <button
            className={`${styles.btn} ${show3D ? styles.btnActive : styles.btnInfo}`}
            onClick={() => setShow3D((v) => !v)}
          >
            3D Preview
          </button>
        </div>

        {/* Main Canvas Area */}
        <div className={styles.engine}>
          <div className={styles.selectedItem}>
            {itemDetails.join(" > ")}
          </div>
          <div className={styles.zoomSlider}>
            <input
              type="range"
              min={0.05}
              max={2}
              step={0.0001}
              value={zoomLevel}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setZoomLevel(val);
                if (engine) {
                  engine.zoomLevel = val;
                  engine.zoomIn();
                }
              }}
            />
          </div>
          <Engine2D
            ref={engineRef}
            roomShape={roomShape}
            onZoomLevelChange={setZoomLevel}
            onSelectedItemChange={setSelectedItem}
            onWallsListChange={setWalls}
            onAnimationComplete={handleAnimationComplete}
            onRoomDataChanged={handleRoomDataChanged}
          />
          {show3D && (
            <Suspense fallback={null}>
              <Engine3D ref={engine3dRef} roomShape={roomShape} onClose={() => setShow3D(false)} />
            </Suspense>
          )}
        </div>

        {/* Right Settings Panel */}
        <div className={styles.settings}>
          <button
            className={`${styles.btn} ${mode === "all" ? styles.btnActive : ""}`}
            onClick={() => handleModeChange("all")}
          >
            All
          </button>
          <button
            className={`${styles.btn} ${mode === "insets" ? styles.btnActive : ""}`}
            onClick={() => handleModeChange("insets")}
          >
            Insets
          </button>
          <button
            className={`${styles.btn} ${mode === "walls" ? styles.btnActive : ""}`}
            onClick={() => handleModeChange("walls")}
          >
            Walls
          </button>
          <button
            className={`${styles.btn} ${mode === "slopes" ? styles.btnActive : ""}`}
            onClick={() => handleModeChange("slopes")}
          >
            Ceiling Slopes
          </button>
          <hr className={styles.divider} />

          <button
            className={`${styles.btn} ${freeEdit ? styles.btnActive : styles.btnInfo}`}
            onClick={handleFreeEdit}
          >
            Edit Room Shape
          </button>
          {freeEdit && (
            <Checkbox
              label="Snap to 100mm"
              checked={snapToGrid}
              indent
              onChange={() => {
                const next = !snapToGrid;
                setSnapToGrid(next);
                engine?.updateSnapToGrid(next);
              }}
            />
          )}
          <hr className={styles.divider} />

          {/* Inset Settings */}
          {selectedItem.type === "inset" && selectedItem.inset && (
            <div>
              <h3 className={styles.sectionTitle}>
                Inset - {String(selectedItem.identity)}
              </h3>
              {selectedItem.inset.type === "door" && (
                <>
                  <label className={styles.fieldLabel}>Door Type</label>
                  <select
                    className={styles.select}
                    value={selectedItem.inset.doorStyle ?? "internal"}
                    onChange={(e) => {
                      const style = e.target.value as DoorStyle;
                      const preset = DOOR_PRESETS[style];
                      const inset = selectedItem.inset!;
                      inset.doorStyle = style;
                      inset.width = preset.width;
                      inset.height = preset.height;
                      if (preset.openings === 2 && inset.openings.length === 1) {
                        const existing = inset.openings[0];
                        existing.width = preset.width / 2;
                        existing.displacement = 0;
                        existing.hanging = "left";
                        existing.identity = "Left Door";
                        inset.openings.push({
                          identity: "Right Door",
                          open: existing.open,
                          hanging: "right",
                          displacement: preset.width,
                          degreesOpen: 0,
                          minDegree: 0,
                          maxDegree: existing.maxDegree,
                          width: preset.width / 2,
                          state: "closed",
                        });
                      } else if (preset.openings === 1 && inset.openings.length > 1) {
                        inset.openings.length = 1;
                        inset.openings[0].width = preset.width;
                        inset.openings[0].identity = DOOR_PRESETS[style].label;
                      } else {
                        for (const op of inset.openings) {
                          op.width = preset.width / inset.openings.length;
                        }
                      }
                      engine?.planView();
                      engine3dRef.current?.refresh();
                      setSelectedItem({ ...selectedItem });
                    }}
                  >
                    {(Object.keys(DOOR_PRESETS) as DoorStyle[]).map((key) => (
                      <option key={key} value={key}>
                        {DOOR_PRESETS[key].label}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {selectedItem.inset.openings.map((opening, i) => {
                const isOpen =
                  opening.state === "open" || opening.state === "opening";
                return (
                  <div key={i}>
                    <button
                      className={`${styles.btn} ${isOpen ? styles.btnActive : ""}`}
                      onClick={() =>
                        handleToggleInset(selectedItem.inset!, i)
                      }
                    >
                      {isOpen ? "Close" : "Open"} {opening.identity}
                    </button>
                    <label className={styles.fieldLabel}>
                      Degrees Open (&deg;)
                    </label>
                    <input
                      type="number"
                      className={styles.input}
                      value={opening.degreesOpen}
                      min={opening.minDegree}
                      max={opening.maxDegree}
                      step={1}
                      onChange={(e) => {
                        opening.degreesOpen = Number(e.target.value);
                        engine?.planView();
                        engine3dRef.current?.refresh();
                      }}
                    />
                  </div>
                );
              })}
              <hr className={styles.divider} />
              <h3 className={styles.sectionTitle}>Position</h3>
              <Checkbox
                label="Locked"
                checked={selectedItem.inset.locked}
                onChange={() => {
                  selectedItem.inset!.locked = !selectedItem.inset!.locked;
                  engine?.planView();
                  setSelectedItem({ ...selectedItem });
                }}
              />
              <hr className={styles.divider} />
              <label className={styles.fieldLabel}>Wall</label>
              <select
                className={styles.select}
                value={selectedItem.inset.wall}
                disabled={selectedItem.inset.locked}
                onChange={(e) => {
                  selectedItem.inset!.wall = Number(e.target.value);
                  engine?.planView();
                  engine3dRef.current?.refresh();
                  setSelectedItem({ ...selectedItem });
                }}
              >
                {wallsList.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
              <SpinnerField
                label="Left Position (mm)"
                value={selectedItem.inset.positionLeft}
                min={10}
                max={
                  (walls[selectedItem.wall]?.length ?? 10000) -
                  10 -
                  selectedItem.inset.width
                }
                step={10}
                disabled={selectedItem.inset.locked}
                onChange={(v) => {
                  selectedItem.inset!.positionLeft = v;
                  engine?.planView();
                  engine3dRef.current?.refresh();
                }}
              />
              <SpinnerField
                label="From Ground (mm)"
                value={selectedItem.inset.positionGround}
                min={0}
                step={10}
                disabled={selectedItem.inset.locked}
                onChange={(v) => {
                  selectedItem.inset!.positionGround = v;
                  engine?.planView();
                  engine3dRef.current?.refresh();
                }}
              />
              <SpinnerField
                label="Width (mm)"
                value={selectedItem.inset.width}
                min={10}
                max={
                  (walls[selectedItem.wall]?.length ?? 10000) -
                  10 -
                  selectedItem.inset.positionLeft
                }
                step={10}
                disabled={selectedItem.inset.locked}
                onChange={(v) => {
                  const inset = selectedItem.inset!;
                  inset.width = v;
                  const n = inset.openings.length;
                  if (n > 0) {
                    const openingW = Math.round(v / n);
                    for (let i = 0; i < n; i++) {
                      const op = inset.openings[i];
                      op.width = openingW;
                      if (op.hanging === "right") {
                        op.displacement = (i + 1) * openingW;
                      } else {
                        op.displacement = i * openingW;
                      }
                    }
                  }
                  engine?.planView();
                  engine3dRef.current?.refresh();
                }}
              />
              <SpinnerField
                label="Height (mm)"
                value={selectedItem.inset.height}
                min={10}
                step={10}
                disabled={selectedItem.inset.locked}
                onChange={(v) => {
                  selectedItem.inset!.height = v;
                  engine?.planView();
                  engine3dRef.current?.refresh();
                }}
              />
            </div>
          )}

          {selectedItem.type === "wall" && (
            <h3 className={styles.sectionTitle}>Wall</h3>
          )}

          {selectedItem.type === "ground" && (
            <div>
              <h3 className={styles.sectionTitle}>Ground</h3>
              <SpinnerField
                label="Angle (\u00B0)"
                value={floorAngle}
                min={0}
                max={360}
                onChange={(v) => {
                  setFloorAngle(v);
                  engine?.updateFloorAngle(v);
                }}
              />
              <SpinnerField
                label="Position X (mm)"
                value={floorPositionX}
                min={0}
                max={1000}
                onChange={(v) => {
                  setFloorPositionX(v);
                  engine?.updateFloorPositionX(v);
                }}
              />
              <SpinnerField
                label="Tile Width (mm)"
                value={floorWidth}
                min={0}
                max={1000}
                onChange={(v) => {
                  setFloorWidth(v);
                  engine?.updateFloorWidth(v);
                }}
              />
              <SpinnerField
                label="Tile Height (mm)"
                value={floorHeight}
                min={0}
                max={1000}
                onChange={(v) => {
                  setFloorHeight(v);
                  engine?.updateFloorHeight(v);
                }}
              />
              <SpinnerField
                label="Position Y (mm)"
                value={floorPositionY}
                min={0}
                max={1000}
                onChange={(v) => {
                  setFloorPositionY(v);
                  engine?.updateFloorPositionY(v);
                }}
              />
              <SpinnerField
                label="Joint Gap (mm)"
                value={floorGap}
                min={0}
                max={100}
                onChange={(v) => {
                  setFloorGap(v);
                  engine?.updateFloorGap(v);
                }}
              />
              <SpinnerField
                label="Offset (mm)"
                value={floorOffset}
                min={-500}
                max={500}
                onChange={(v) => {
                  setFloorOffset(v);
                  engine?.updateFloorOffset(v);
                }}
              />
            </div>
          )}

          {selectedItem.type === "slope" && (() => {
            const slopeData = roomShape.slopes?.find(
              (s) => s.wall === selectedItem.id
            );
            if (!slopeData) return null;
            return (
              <div>
                <h3 className={styles.sectionTitle}>Slope Ceiling</h3>
                <SpinnerField
                  label="Knee Wall Height (mm)"
                  value={slopeData.kneeWallHeight}
                  min={0}
                  max={roomShape.roomHeight - 100}
                  step={10}
                  onChange={(v) => {
                    slopeData.kneeWallHeight = v;
                    engine?.planView();
                    setSelectedItem({ ...selectedItem });
                  }}
                />
                <SpinnerField
                  label="Roof Angle (°)"
                  value={slopeData.roofAngle}
                  min={1}
                  max={89}
                  step={1}
                  onChange={(v) => {
                    slopeData.roofAngle = v;
                    engine?.planView();
                    setSelectedItem({ ...selectedItem });
                  }}
                />
                <SpinnerField
                  label="Room Height (mm)"
                  value={roomShape.roomHeight}
                  min={1000}
                  max={5000}
                  step={10}
                  onChange={(v) => {
                    roomShape.roomHeight = v;
                    engine?.planView();
                    setSelectedItem({ ...selectedItem });
                  }}
                />
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  indent,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  indent?: boolean;
}) {
  return (
    <div className={indent ? styles.subitem : styles.checkRow}>
      <label className={styles.checkLabel}>
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span>{label}</span>
      </label>
    </div>
  );
}

function SpinnerField({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <>
      <label className={styles.fieldLabel}>{label}</label>
      <input
        type="number"
        className={styles.input}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </>
  );
}
