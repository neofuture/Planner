import type {
  Point,
  RoomShape,
  Wall,
  ActiveItem,
  ItemDefinition,
  Inset,
  InteractionMode,
} from "./types";

export type SelectedItemCallback = (item: ActiveItem) => void;
export type WallsListCallback = (walls: Wall[]) => void;
export type ZoomLevelCallback = (zoom: number) => void;
export type AnimationCallback = () => void;
export type RoomDataChangedCallback = () => void;

export class Engine2d {
  private originalViewPortX = 0;
  private originalViewPortY = 0;
  private oldWidth = 0;
  private oldHeight = 0;

  private canvasElement!: HTMLCanvasElement;
  private canvasToolsElement!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D;
  private contextTools!: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  scale = 0.1;
  viewPortX = 200;
  viewPortY = 200;
  zoomLevel = 0;
  ratio = 2;
  private x = 0;
  private y = 0;
  private lastX = 0;
  private lastY = 0;
  roomShape!: RoomShape;
  gridSize = 1000;

  private onSelectedItem: SelectedItemCallback | null = null;
  private onWallsList: WallsListCallback | null = null;
  private onZoomLevelChange: ZoomLevelCallback | null = null;
  private onAnimationComplete: AnimationCallback | null = null;
  private onRoomDataChanged: RoomDataChangedCallback | null = null;

  private distance = 0;
  private textDistance = 0;
  showMeasurements = true;
  showWalls = true;
  showCorners = true;
  showLetters = true;
  showArea = true;
  showSlopes = true;
  showGround = true;
  wallWidth = 300;
  frameDepth = 100;
  private itemDefinitions: ItemDefinition[] = [];
  private activeItem: ActiveItem = {
    type: "",
    id: -1,
    poly: [],
    wall: -1,
    identity: -1,
  };
  private isDragging = false;
  private isMoving = false;
  showTools = false;
  showCornerHandles = false;
  showInsetMeasurements = true;
  showInsets = true;
  private insetDistance = 0;
  showGrid = true;
  showColours = true;
  showRulers = false;
  showFlooring = false;
  showLocks = true;
  showInsetOpenings = true;

  private floorAngle = 0;
  private contextInsets!: CanvasRenderingContext2D;
  private canvasInsetsElement!: HTMLCanvasElement;
  private angles: number[] = [];
  private walls: Wall[] = [];
  private minX = 0;
  private minY = 0;
  private maxX = 0;
  private maxY = 0;
  private insets: Inset[] = [];
  private ground: Point[] = [];
  private canvasControlsElement!: HTMLCanvasElement;
  private contextControls!: CanvasRenderingContext2D;
  private centerX = 0;
  private centerY = 0;
  private lastScale = 0;
  private mode: InteractionMode = "all";
  private flooring!: HTMLCanvasElement;
  private flooringReady = false;
  private floorGap = 0;
  private floorOffset = 0;
  private floorPositionX = 0;
  private floorPositionY = 0;
  private floorWidth = 1000;
  private floorHeight = 500;
  private canvasTilesElement!: HTMLCanvasElement;
  private contextTiles!: CanvasRenderingContext2D;
  private canvasGridElement!: HTMLCanvasElement;
  private contextGrid!: CanvasRenderingContext2D;
  private dragItem: ItemDefinition | false = false;
  private freeEdit = false;
  private snapToGrid = false;
  private _disposed = false;
  private _listeners: { el: EventTarget; type: string; fn: EventListener }[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      this.flooring = this.createWoodTexture(200, 100);
      this.flooringReady = true;
    }
  }

  private createWoodTexture(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#b5864a");
    gradient.addColorStop(0.3, "#a07040");
    gradient.addColorStop(0.5, "#c49555");
    gradient.addColorStop(0.7, "#a07040");
    gradient.addColorStop(1, "#8b6035");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.15;
    for (let y = 0; y < h; y += 2) {
      const offset = Math.sin(y * 0.3) * 3;
      ctx.strokeStyle = y % 6 < 3 ? "#6b4020" : "#c89060";
      ctx.beginPath();
      ctx.moveTo(offset, y + 0.5);
      ctx.lineTo(w + offset, y + 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = "#6b4020";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.globalAlpha = 1.0;

    return c;
  }

  setCallbacks(
    onSelectedItem: SelectedItemCallback,
    onWallsList: WallsListCallback,
    onZoomLevelChange: ZoomLevelCallback,
    onAnimationComplete?: AnimationCallback,
    onRoomDataChanged?: RoomDataChangedCallback
  ) {
    this.onSelectedItem = onSelectedItem;
    this.onWallsList = onWallsList;
    this.onZoomLevelChange = onZoomLevelChange;
    this.onAnimationComplete = onAnimationComplete ?? null;
    this.onRoomDataChanged = onRoomDataChanged ?? null;
  }

  private _on(el: EventTarget, type: string, fn: EventListener) {
    el.addEventListener(type, fn);
    this._listeners.push({ el, type, fn });
  }

  dispose() {
    this._disposed = true;
    for (const { el, type, fn } of this._listeners) {
      el.removeEventListener(type, fn);
    }
    this._listeners = [];
    this.onSelectedItem = null;
    this.onWallsList = null;
    this.onZoomLevelChange = null;
    this.onAnimationComplete = null;
    this.onRoomDataChanged = null;
  }

  startEngine(
    canvasGrid: HTMLCanvasElement,
    canvas: HTMLCanvasElement,
    canvasInsets: HTMLCanvasElement,
    canvasTools: HTMLCanvasElement,
    canvasControls: HTMLCanvasElement,
    canvasTiles: HTMLCanvasElement,
    roomShape: RoomShape
  ) {
    this.canvasGridElement = canvasGrid;
    this.canvasElement = canvas;
    this.canvasToolsElement = canvasTools;
    this.canvasInsetsElement = canvasInsets;
    this.canvasTilesElement = canvasTiles;
    this.canvasControlsElement = canvasControls;
    this.roomShape = roomShape;

    this.contextGrid = this.canvasGridElement.getContext("2d")!;
    this.context = this.canvasElement.getContext("2d")!;
    this.contextTools = this.canvasToolsElement.getContext("2d")!;
    this.contextTiles = this.canvasTilesElement.getContext("2d")!;
    this.contextInsets = this.canvasInsetsElement.getContext("2d")!;
    this.contextControls = this.canvasControlsElement.getContext("2d")!;

    this._on(this.canvasControlsElement, "wheel", (event) => {
      this.wheelInit(event as WheelEvent);
    });

    this._on(this.canvasControlsElement, "touchstart", (event) => {
      const te = event as TouchEvent;
      if (te.touches.length > 1) return;
      this.isDragging = true;
      this.originalViewPortX = this.viewPortX;
      this.originalViewPortY = this.viewPortY;
      [this.lastX, this.lastY] = this.returnPosition(te, true);
      this.checkCollisions(te, true);
      this.planView();
    });
    this._on(this.canvasControlsElement, "touchmove", (event) => {
      const te = event as TouchEvent;
      if (te.touches.length > 1) return;
      this.mouseActions(te, true);
    });
    this._on(this.canvasControlsElement, "touchend", (event) => {
      const te = event as TouchEvent;
      if (te.touches.length > 1) return;
      this.isDragging = false;
    });

    this._on(this.canvasControlsElement, "mousedown", (event) => {
      this.isDragging = true;
      this.originalViewPortX = this.viewPortX;
      this.originalViewPortY = this.viewPortY;
      [this.lastX, this.lastY] = this.returnPosition(event as MouseEvent, false);
      if (!this.isMoving) {
        this.checkCollisions(event as MouseEvent, false);
        this.planView();
      }
    });
    this._on(this.canvasControlsElement, "mousemove", (event) => {
      if (this.isDragging) {
        this.isMoving = true;
        this.mouseActions(event as MouseEvent, false);
      } else if (this.dragItem) {
        this.mouseActions(event as MouseEvent, false);
      }
    });
    this._on(this.canvasControlsElement, "mouseup", () => {
      this.isMoving = false;
      this.isDragging = false;
      this.dragItem = false;
      this.planView();
    });
    this._on(this.canvasControlsElement, "mouseleave", () => {
      if (this.isDragging || this.isMoving) {
        this.isDragging = false;
        this.isMoving = false;
        this.planView();
      }
    });

    this.resize();
    this.configurePlanView();
    this.planView();
    this.autoZoom();
    this.autoCentre();
    this.onSelectedItem?.(this.activeItem);
  }

  private wheelInit(event: WheelEvent) {
    event.preventDefault();
    let centerX = 0;
    let centerY = 0;
    [centerX, centerY] = this.returnPosition(event, false);
    const wheel = event.deltaY;

    if (this.scale > 2) this.scale = 2;
    if (this.scale < 0.05) this.scale = 0.05;
    if (
      (this.scale > 0.05 || wheel > 0) &&
      (this.scale < 2 || wheel < 0)
    ) {
      const zoom = Math.exp(wheel * 0.002);
      this.scale *= zoom;
      this.viewPortX += centerX / (this.scale * zoom) - centerX / this.scale;
      this.viewPortY += centerY / (this.scale * zoom) - centerY / this.scale;
      this.zoomLevel = this.scale;
      this.onZoomLevelChange?.(this.zoomLevel);
      this.planView();
    }
  }

  private returnPosition(
    event: MouseEvent | TouchEvent | WheelEvent,
    touchEvents: boolean
  ): [number, number] {
    const bounds = (event.target as HTMLElement).getBoundingClientRect();
    let x: number;
    let y: number;
    if (touchEvents && "touches" in event) {
      x = (event.touches[0].pageX - bounds.left) * this.ratio;
      y = (event.touches[0].pageY - bounds.top) * this.ratio;
    } else {
      const me = event as MouseEvent;
      x = (me.clientX - bounds.left) * this.ratio;
      y = (me.clientY - bounds.top) * this.ratio;
    }
    return [x, y];
  }

  resize() {
    if (!this.canvasElement) return;
    this.oldWidth = this.width;
    this.oldHeight = this.height;

    this.width = this.canvasElement.offsetWidth;
    this.height = this.canvasElement.offsetHeight;

    this.canvasGridElement.height = this.height * 2;
    this.canvasGridElement.width = this.width * 2;
    this.canvasElement.height = this.height * 2;
    this.canvasElement.width = this.width * 2;
    this.canvasToolsElement.height = this.height * 2;
    this.canvasToolsElement.width = this.width * 2;
    this.canvasTilesElement.height = this.height * 2;
    this.canvasTilesElement.width = this.width * 2;
    this.canvasInsetsElement.height = this.height * 2;
    this.canvasInsetsElement.width = this.width * 2;
    this.canvasControlsElement.height = this.height * 2;
    this.canvasControlsElement.width = this.width * 2;

    if (!isNaN(this.oldWidth) && this.oldWidth > 0) {
      this.viewPortX -= (this.oldWidth - this.width) / this.scale;
      this.viewPortY -= (this.oldHeight - this.height) / this.scale;
    }
    this.planView();
  }

  private mouseActions(
    event: MouseEvent | TouchEvent,
    touchEvents: boolean
  ) {
    [this.x, this.y] = this.returnPosition(event, touchEvents);

    if (this.isDragging) {
      this.viewPortX =
        this.originalViewPortX - (this.lastX - this.x) / this.scale;
      this.viewPortY =
        this.originalViewPortY - (this.lastY - this.y) / this.scale;
      this.planView();
    }
    if (this.dragItem) {
      if (this.dragItem.type === "grabHandle") {
        let newX = (this.x - this.lastX) / this.scale + (this.dragItem.origin?.x ?? 0);
        let newY = (this.y - this.lastY) / this.scale + (this.dragItem.origin?.y ?? 0);
        if (this.snapToGrid) {
          newX = Math.round(newX / 100) * 100;
          newY = Math.round(newY / 100) * 100;
        }
        this.roomShape.path[this.dragItem.wall].x = newX;
        this.roomShape.path[this.dragItem.wall].y = newY;
      }

      if (this.dragItem.type === "inset") {
        if (this.dragItem.inset?.locked) return;

        let closestWall = -1;
        let currentWall = 999999999;
        for (const [index, wall] of this.walls.entries()) {
          const dist = this.calculateDistanceFromWall(
            this.x,
            this.y,
            (wall.x1 + this.viewPortX) * this.scale,
            (wall.y1 + this.viewPortY) * this.scale,
            (wall.x2 + this.viewPortX) * this.scale,
            (wall.y2 + this.viewPortY) * this.scale
          );
          if (dist < currentWall) {
            currentWall = dist;
            closestWall = index;
          }
        }

        if (this.dragItem.inset!.wall !== closestWall) {
          if (currentWall < 500 * this.scale) {
            this.dragItem.inset!.wall = closestWall;
            this.dragItem.wall = closestWall;
            const ssin = Math.sin(this.walls[this.dragItem.wall].angle!);
            const scos = Math.cos(this.walls[this.dragItem.wall].angle!);

            this.dragItem.origin!.left = Math.round(
              ((this.x -
                (this.walls[this.dragItem.wall].x1 + this.viewPortX) *
                  this.scale) /
                this.scale) *
                scos +
                ((this.y -
                  (this.walls[this.dragItem.wall].y1 + this.viewPortY) *
                    this.scale) /
                  this.scale) *
                  ssin -
                this.dragItem.inset!.width / 2
            );
            this.lastX = this.x;
            this.lastY = this.y;
          }
        }

        const sin = Math.sin(this.walls[this.dragItem.wall].angle!);
        const cos = Math.cos(this.walls[this.dragItem.wall].angle!);
        let position = Math.round(
          ((this.x - this.lastX) / this.scale) * cos +
            ((this.y - this.lastY) / this.scale) * sin +
            (this.dragItem.origin?.left ?? 0)
        );

        if (position < 10) position = 10;
        if (
          position >
          this.walls[this.dragItem.wall].length -
            10 -
            this.dragItem.inset!.width
        ) {
          position =
            this.walls[this.dragItem.wall].length -
            10 -
            this.dragItem.inset!.width;
        }

        this.roomShape.insets[this.dragItem.id].positionLeft = position;
      }

      this.planView();
      this.onRoomDataChanged?.();
    }
  }

  zoomIn() {
    if (!this.canvasElement) return;
    const centerX = this.canvasElement.width / this.ratio;
    const centerY = this.canvasElement.height / this.ratio;
    this.viewPortX += centerX / this.zoomLevel - centerX / this.scale;
    this.viewPortY += centerY / this.zoomLevel - centerY / this.scale;
    this.scale = this.zoomLevel;
    this.onZoomLevelChange?.(this.zoomLevel);
    this.planView();
  }

  autoCentre() {
    const oldScale = this.scale;
    this.scale = 1;
    const width = this.maxX - this.minX;
    const height = this.maxY - this.minY;
    this.viewPortX = 0 - this.minX + (this.width - width / 2);
    this.viewPortY = 0 - this.minY + (this.height - height / 2);
    this.zoomLevel = oldScale;
    this.zoomIn();
    this.planView();
  }

  private getMaxMin() {
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    const ground = this.roomShape.path;
    for (const item of ground) {
      maxX = Math.max(maxX, item.x);
      maxY = Math.max(maxY, item.y);
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
    }
    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;
  }

  autoZoom() {
    if (!this.canvasElement || this.width === 0 || this.height === 0) return;
    const dx = this.maxX - this.minX;
    const dy = this.maxY - this.minY;
    if (dx === 0 || dy === 0) return;
    const ratioX = this.width / dx;
    const ratioY = this.height / dy;
    this.scale = (ratioX > ratioY ? ratioY : ratioX) * 1.3;
    this.zoomLevel = this.scale;
    this.onZoomLevelChange?.(this.zoomLevel);
    this.planView();
  }

  autoZoomCentre() {
    this.autoZoom();
    setTimeout(() => {
      if (this._disposed) return;
      this.autoCentre();
      setTimeout(() => {
        if (this._disposed) return;
        this.autoZoom();
      }, 50);
    }, 50);
  }

  private configurePlanView() {
    this.canvasTilesElement.height =
      this.canvasElement.offsetHeight * this.ratio;
    this.canvasTilesElement.width =
      this.canvasElement.offsetWidth * this.ratio;
    this.canvasGridElement.height =
      this.canvasElement.offsetHeight * this.ratio;
    this.canvasGridElement.width =
      this.canvasElement.offsetWidth * this.ratio;
    this.canvasElement.height = this.canvasElement.offsetHeight * this.ratio;
    this.canvasElement.width = this.canvasElement.offsetWidth * this.ratio;
    this.canvasToolsElement.height =
      this.canvasToolsElement.offsetHeight * this.ratio;
    this.canvasToolsElement.width =
      this.canvasToolsElement.offsetWidth * this.ratio;
    this.canvasControlsElement.height =
      this.canvasControlsElement.offsetHeight * this.ratio;
    this.canvasControlsElement.width =
      this.canvasControlsElement.offsetWidth * this.ratio;
  }

  planView() {
    if (this._disposed || !this.context) return;
    this.itemDefinitions = [];
    this.context.clearRect(
      0,
      0,
      this.canvasElement.width * this.ratio,
      this.canvasElement.height * this.ratio
    );
    this.contextTiles.clearRect(
      0,
      0,
      this.canvasElement.width * this.ratio,
      this.canvasElement.height * this.ratio
    );
    this.getMaxMin();
    this.drawGrid();

    this.ground = this.roomShape.path;
    this.insets = this.roomShape.insets;
    this.drawGround();
    this.drawArea();
    this.drawCorners();
    this.drawLetters();
    this.drawSlopes();
    this.drawWalls();
    this.drawInsets();
    this.drawMeasurements();
    this.drawCornerHandles();
    this.drawControls();
  }

  private drawControls() {
    // Controls drawing - currently commented out in original
  }

  private drawGround() {
    const ground = this.ground;
    this.context.lineCap = "round";
    this.context.strokeStyle = "#444444";
    this.context.fillStyle = this.showColours ? "#4444ff" : "transparent";
    this.context.lineWidth = 2;

    const angles: number[] = [];
    const walls: Wall[] = [];
    let oldX = 0;
    let oldY = 0;
    let startX = 0;
    let startY = 0;

    const groundPoly: Point[] = [];
    this.context.beginPath();
    this.contextTiles.beginPath();

    for (const [index, path] of ground.entries()) {
      if (index === 0) {
        this.context.moveTo(
          (path.x + this.viewPortX) * this.scale,
          (path.y + this.viewPortY) * this.scale
        );
        this.contextTiles.moveTo(
          (path.x + this.viewPortX) * this.scale,
          (path.y + this.viewPortY) * this.scale
        );
        oldX = path.x;
        oldY = path.y;
        startX = path.x;
        startY = path.y;
      } else {
        this.context.lineTo(
          (path.x + this.viewPortX) * this.scale,
          (path.y + this.viewPortY) * this.scale
        );
        this.contextTiles.lineTo(
          (path.x + this.viewPortX) * this.scale,
          (path.y + this.viewPortY) * this.scale
        );
        walls.push({
          x1: Math.round(oldX),
          y1: Math.round(oldY),
          x2: Math.round(path.x),
          y2: Math.round(path.y),
          length: Math.round(
            this.calculateLength(oldX, oldY, path.x, path.y)
          ),
        });
      }

      groundPoly.push({
        x: (path.x + this.viewPortX) * this.scale,
        y: (path.y + this.viewPortY) * this.scale,
      });

      oldX = path.x;
      oldY = path.y;

      let startPoint = index - 1;
      let endPoint = index + 1;

      if (startPoint < 0) startPoint = ground.length - 1;
      if (endPoint > ground.length - 1) endPoint = 0;

      const angle = this.findAngle(
        ground[startPoint],
        ground[index],
        ground[endPoint]
      );
      angles.push(angle);
    }
    walls.push({
      x1: Math.round(oldX),
      y1: Math.round(oldY),
      x2: Math.round(startX),
      y2: Math.round(startY),
      length: Math.round(this.calculateLength(oldX, oldY, startX, startY)),
    });

    const path = ground[0];
    if (this.showGround) {
      this.context.lineTo(
        (path.x + this.viewPortX) * this.scale,
        (path.y + this.viewPortY) * this.scale
      );
      this.contextTiles.lineTo(
        (path.x + this.viewPortX) * this.scale,
        (path.y + this.viewPortY) * this.scale
      );
      if (
        this.activeItem.type === "ground" &&
        this.activeItem.id === 0
      ) {
        if (this.showFlooring) {
          this.context.strokeStyle = "rgba(0,255,0,0.5)";
          this.context.lineWidth = 20;
        }
      }

      if (this.showFlooring && this.flooringReady) {
        this.contextTiles.fillStyle = "#775314";
        this.contextTiles.fill();
        this.contextTiles.save();
        this.contextTiles.clip();
        this.contextTiles.translate(
          (this.minX + (this.maxX - this.minX) / 2 + this.viewPortX) *
            this.scale,
          (this.minY + (this.maxY - this.minY) / 2 + this.viewPortY) *
            this.scale
        );
        this.contextTiles.rotate(this.floorAngle);

        for (
          let i = -(this.maxX / this.floorWidth);
          i < this.maxX / this.floorWidth + this.maxX / this.floorWidth;
          i++
        ) {
          for (
            let j = -(this.maxY / this.floorHeight);
            j <
            this.maxY / this.floorHeight + this.maxY / this.floorHeight;
            j++
          ) {
            let offset = 0;
            if (j % 2 === 0) offset = this.floorOffset;
            this.contextTiles.drawImage(
              this.flooring,
              (this.minX +
                i * this.floorGap +
                (i * this.floorWidth + offset) +
                this.floorPositionX) *
                this.scale,
              (this.minY +
                j * this.floorGap +
                j * this.floorHeight +
                this.floorPositionY) *
                this.scale,
              this.floorWidth * this.scale,
              this.floorHeight * this.scale
            );
          }
        }
        this.contextTiles.restore();
      }

      this.context.stroke();

      if (
        this.activeItem.type === "ground" &&
        this.activeItem.id === 0
      ) {
        if (!this.showFlooring) {
          this.context.fillStyle = "rgba(70,255,0,0.2)";
          this.context.fill();
        }
      } else {
        if (!this.showFlooring) {
          if (this.showColours) {
            this.context.fillStyle = "rgba(255,235,190,0.2)";
            if (this.mode === "all") {
              this.context.fillStyle = "rgba(255,235,190,0.5)";
            }
          }
          this.context.fill();
        }
      }
    }

    if (this.mode === "all") {
      this.itemDefinitions.push({
        type: "ground",
        id: 0,
        wall: -99,
        poly: groundPoly,
      });
    }
    this.onWallsList?.(this.walls);

    this.angles = angles;
    this.walls = walls;
  }

  private drawGrid() {
    this.contextGrid.clearRect(
      0,
      0,
      this.canvasElement.width * this.ratio,
      this.canvasElement.height * this.ratio
    );

    let lines = 0;
    if (this.canvasElement.offsetWidth > this.canvasElement.offsetHeight) {
      lines = (this.canvasElement.offsetWidth * 2) / this.gridSize;
    } else {
      lines = (this.canvasElement.offsetHeight * 2) / this.gridSize;
    }

    if (this.gridSize !== 0 && this.showGrid) {
      this.contextGrid.lineWidth = 1;
      this.contextGrid.strokeStyle = "#cccccc";

      for (
        let i = 0 - this.gridSize;
        i < (lines / this.scale) * this.gridSize + this.gridSize;
        i = i + this.gridSize
      ) {
        this.contextGrid.beginPath();
        this.contextGrid.moveTo(
          0,
          (i + (this.viewPortY % this.gridSize)) * this.scale
        );
        this.contextGrid.lineTo(
          this.canvasElement.offsetWidth * 2,
          (i + (this.viewPortY % this.gridSize)) * this.scale
        );
        this.contextGrid.stroke();
        this.contextGrid.beginPath();
        this.contextGrid.moveTo(
          (i + (this.viewPortX % this.gridSize)) * this.scale,
          0
        );
        this.contextGrid.lineTo(
          (i + (this.viewPortX % this.gridSize)) * this.scale,
          this.canvasElement.offsetHeight * 2
        );
        this.contextGrid.stroke();
      }
    }

    if (this.showRulers) {
      this.contextGrid.strokeStyle = "#333333";
      this.contextGrid.lineWidth = 1;
      let size = 100;
      for (
        let i = size;
        i < (lines * this.gridSize) / this.scale;
        i = i + size
      ) {
        this.contextGrid.beginPath();
        this.contextGrid.moveTo(
          (i + (this.viewPortX % size)) * this.scale,
          0
        );
        this.contextGrid.lineTo(
          (i + (this.viewPortX % size)) * this.scale,
          20
        );
        this.contextGrid.stroke();
        this.contextGrid.beginPath();
        this.contextGrid.moveTo(
          0,
          (i + (this.viewPortY % size)) * this.scale
        );
        this.contextGrid.lineTo(
          20,
          (i + (this.viewPortY % size)) * this.scale
        );
        this.contextGrid.stroke();
      }
      this.contextGrid.strokeStyle = "#222222";
      size = 500;
      for (
        let i = size;
        i < (lines * this.gridSize) / this.scale;
        i = i + size
      ) {
        this.contextGrid.beginPath();
        this.contextGrid.moveTo(
          (i + (this.viewPortX % size)) * this.scale,
          0
        );
        this.contextGrid.lineTo(
          (i + (this.viewPortX % size)) * this.scale,
          40
        );
        this.contextGrid.stroke();
        this.contextGrid.beginPath();
        this.contextGrid.moveTo(
          0,
          (i + (this.viewPortY % size)) * this.scale
        );
        this.contextGrid.lineTo(
          40,
          (i + (this.viewPortY % size)) * this.scale
        );
        this.contextGrid.stroke();
      }
    }
  }

  private drawArea() {
    const ground = this.ground;
    const D = this.getPolygonCentroid(this.roomShape.path);
    if (this.showArea) {
      const area = (this.areaFromCoords(ground) / 1000)
        .toFixed(2)
        .replace(/\.00$/, "");
      this.context.font = 200 * this.scale + "px sans-serif";
      this.context.textAlign = "center";
      this.context.fillStyle = this.showFlooring ? "#ffffff" : "#888888";
      this.context.fillText(
        area.toString() + "m\u00B2",
        (D.x + this.viewPortX) * this.scale,
        (D.y + this.viewPortY + 80) * this.scale
      );
    }
  }

  private drawCorners() {
    const ground = this.ground;
    const angles = this.angles;
    const walls = this.walls;

    this.context.lineWidth = 3;
    this.context.strokeStyle = this.showFlooring ? "#ffffff" : "#888888";

    for (const [index, path] of ground.entries()) {
      let startPoint = index;
      let endPoint = index + 1;

      if (startPoint < 0) startPoint = ground.length - 1;
      if (endPoint > ground.length - 1) endPoint = 0;

      const wallAngle = this.findWallAngle(ground[startPoint], ground[endPoint]);
      const start = wallAngle;
      const end = wallAngle + angles[index];
      const midPoint = wallAngle + angles[index] / 2;
      walls[index].angle = wallAngle;

      if (this.showCorners && this.showMeasurements) {
        this.context.strokeStyle = this.showFlooring ? "#ffffff" : "#dddddd";
        this.context.fillStyle = "#888888";
        this.context.beginPath();
        this.context.arc(
          (path.x + this.viewPortX) * this.scale,
          (path.y + this.viewPortY) * this.scale,
          450 * this.scale,
          start,
          end
        );
        this.context.stroke();

        this.context.font = 150 * this.scale + "px sans-serif";
        this.context.textAlign = "center";
        if (this.showFlooring) this.context.fillStyle = "#ffffff";
        this.context.fillText(
          Math.round((angles[index] * 180) / Math.PI).toString() + "\u00B0",
          (path.x + this.viewPortX + 220 * Math.cos(midPoint) + 10) *
            this.scale,
          (path.y + this.viewPortY + 220 * Math.sin(midPoint) + 40) *
            this.scale
        );

        this.context.fillStyle = this.showFlooring ? "#ffffff" : "#bbbbbb";
        this.context.save();
        this.context.translate(
          (path.x + this.viewPortX + 450 * Math.cos(start)) * this.scale,
          (path.y + this.viewPortY + 450 * Math.sin(start)) * this.scale
        );
        this.drawTriangle(start);
        this.context.restore();

        this.context.save();
        this.context.translate(
          (path.x + this.viewPortX + 450 * Math.cos(end)) * this.scale,
          (path.y + this.viewPortY + 450 * Math.sin(end)) * this.scale
        );
        this.drawTriangle(this.invertAngle(end));
        this.context.restore();
      }
    }
  }

  private drawLetters() {
    const walls = this.walls;
    if (this.showLetters) {
      const labelPositions: { x: number; y: number; offset: number; wallMidX: number; wallMidY: number }[] = [];
      const fontSize = 200 * this.scale;
      const minGap = fontSize * 1.6;
      const badgeRadius = fontSize * 0.75;

      for (const [index, wall] of walls.entries()) {
        this.textDistance = (200 + this.wallWidth) * this.scale;
        if (this.showMeasurements) {
          this.textDistance = (600 + this.wallWidth) * this.scale;
        }

        for (const item of this.roomShape.insets) {
          if (item.wall === index && this.showMeasurements) {
            if (this.showInsetMeasurements) {
              this.textDistance = (900 + this.wallWidth) * this.scale;
            }
          }
        }

        let offset = 0;
        if (
          wall.angle! * (180 / Math.PI) === 180 &&
          this.showMeasurements
        ) {
          offset = 190 * this.scale;
        }

        const x1 = (wall.x1 + this.viewPortX) * this.scale;
        const y1 = (wall.y1 + 100 + this.viewPortY) * this.scale;
        const x2 = (wall.x2 + this.viewPortX) * this.scale;
        const y2 = (wall.y2 + 100 + this.viewPortY) * this.scale;

        const wallMidX = (x1 + x2) / 2;
        const wallMidY = (y1 + y2) / 2;

        const distance = Math.round(
          this.calculateLength(x1, y1, x2, y2) / 2
        );
        const textMeasure = this.calculatePerpendicularLine(
          x1,
          x2,
          y1,
          y2,
          this.textDistance
        );
        const D = this.calculatePositionAlongWall(
          textMeasure[0],
          textMeasure[1],
          distance
        );
        labelPositions.push({ x: D.x, y: D.y, offset, wallMidX, wallMidY });
      }

      for (let i = 0; i < labelPositions.length; i++) {
        const pos = labelPositions[i];
        for (let j = 0; j < i; j++) {
          const prev = labelPositions[j];
          const dx = pos.x - prev.x;
          const dy = (pos.y - pos.offset) - (prev.y - prev.offset);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minGap && dist > 0) {
            const push = (minGap - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            pos.x += nx * push;
            pos.y += ny * push;
            labelPositions[j] = {
              ...prev,
              x: prev.x - nx * push,
              y: prev.y - ny * push,
            };
          }
        }
      }

      for (const [index, pos] of labelPositions.entries()) {
        const labelX = pos.x;
        const labelY = pos.y - pos.offset;

        const dx = pos.wallMidX - labelX;
        const dy = pos.wallMidY - labelY;
        const leaderLen = Math.sqrt(dx * dx + dy * dy);

        if (leaderLen > badgeRadius) {
          const nx = dx / leaderLen;
          const ny = dy / leaderLen;
          const startX = labelX + nx * badgeRadius;
          const startY = labelY + ny * badgeRadius;
          const dotRadius = 3 * this.scale;

          this.context.beginPath();
          this.context.moveTo(startX, startY);
          this.context.lineTo(pos.wallMidX, pos.wallMidY);
          this.context.strokeStyle = "#555555";
          this.context.lineWidth = 2 * this.scale;
          this.context.setLineDash([6 * this.scale, 4 * this.scale]);
          this.context.stroke();
          this.context.setLineDash([]);

          this.context.beginPath();
          this.context.arc(pos.wallMidX, pos.wallMidY, dotRadius, 0, Math.PI * 2);
          this.context.fillStyle = "#555555";
          this.context.fill();
        }

        this.context.beginPath();
        this.context.arc(labelX, labelY, badgeRadius, 0, Math.PI * 2);
        this.context.fillStyle = "#ffffff";
        this.context.fill();
        this.context.strokeStyle = "#555555";
        this.context.lineWidth = 2 * this.scale;
        this.context.stroke();

        this.context.font = `bold ${fontSize}px sans-serif`;
        this.context.textAlign = "center";
        this.context.textBaseline = "middle";
        this.context.fillStyle = "#444444";
        this.context.fillText(
          String.fromCharCode(65 + index),
          labelX,
          labelY
        );
      }
      this.context.textBaseline = "alphabetic";
    }
  }

  private drawWalls() {
    const ground = this.ground;
    const angles = this.angles;
    const walls = this.walls;
    this.context.fillStyle = "#eeeeee";
    this.context.lineWidth = 2;

    if (this.showWalls) {
      for (const [index, wall] of walls.entries()) {
        let startPoint = index;
        let endPoint = index + 1;
        if (startPoint < 0) startPoint = ground.length - 1;
        if (endPoint > ground.length - 1) endPoint = 0;

        const x1 = (wall.x1 + this.viewPortX) * this.scale;
        const y1 = (wall.y1 + this.viewPortY) * this.scale;
        const x2 = (wall.x2 + this.viewPortX) * this.scale;
        const y2 = (wall.y2 + this.viewPortY) * this.scale;

        if (
          this.activeItem.type === "wall" &&
          this.activeItem.id === index
        ) {
          this.context.strokeStyle = "#33e200";
          this.context.fillStyle = "#9fff6b";
        } else {
          this.context.fillStyle = "#eeeeee";
          if (this.showColours) {
            this.context.strokeStyle = "rgba(255,165,0,0.5)";
            this.context.fillStyle = "rgba(255,221,134,0.5)";
            if (this.mode === "all" || this.mode === "walls") {
              this.context.strokeStyle = "orange";
              this.context.fillStyle = "#ffdd86";
            }
          } else {
            this.context.strokeStyle = "rgba(153,153,153,0.5)";
            this.context.fillStyle = "rgba(0,0,0,0.5)";
            if (this.mode === "all" || this.mode === "walls") {
              this.context.strokeStyle = "#999999";
              this.context.fillStyle = "#eeeeee";
            }
          }
        }

        const length = this.wallWidth * this.scale;
        const thetaStart =
          wall.angle! - 1.5708 - (Math.PI - angles[startPoint]) / 2;
        const thetaEnd =
          wall.angle! - 1.5708 + (Math.PI - angles[endPoint]) / 2;

        const x4 =
          x1 +
          Math.abs(length / Math.sin(angles[startPoint] / 2)) *
            Math.cos(thetaStart);
        const y4 =
          y1 +
          Math.abs(length / Math.sin(angles[startPoint] / 2)) *
            Math.sin(thetaStart);
        const x3 =
          x2 +
          Math.abs(length / Math.sin(angles[endPoint] / 2)) *
            Math.cos(thetaEnd);
        const y3 =
          y2 +
          Math.abs(length / Math.sin(angles[endPoint] / 2)) *
            Math.sin(thetaEnd);

        if (this.mode === "all" || this.mode === "walls") {
          this.itemDefinitions.push({
            type: "wall",
            id: index,
            wall: index,
            poly: [
              { x: x1, y: y1 },
              { x: x2, y: y2 },
              { x: x3, y: y3 },
              { x: x4, y: y4 },
            ],
          });
        }

        this.context.beginPath();
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2, y2);
        this.context.lineTo(x3, y3);
        this.context.lineTo(x4, y4);
        this.context.fill();
        this.context.stroke();
      }
    }
  }

  private drawMeasurements() {
    const walls = this.walls;
    const insets = this.insets;
    if (this.showColours) {
      this.context.strokeStyle = "#75aaff";
      this.context.fillStyle = "#75aaff";
    } else {
      this.context.strokeStyle = "#888888";
      this.context.fillStyle = "#888888";
    }
    this.context.lineWidth = 2;

    if (this.showMeasurements) {
      this.insetDistance = (200 + this.wallWidth) * this.scale;
      for (const [index, wall] of walls.entries()) {
        if (this.showColours) {
          this.context.fillStyle = "#4466ff";
          this.context.strokeStyle = "#4466ff";
        }
        if (this.showInsetMeasurements) {
          this.distance = (200 + this.wallWidth) * this.scale;
          for (const item of this.roomShape.insets) {
            if (item.wall === index) {
              this.distance = (450 + this.wallWidth) * this.scale;
            }
          }
        } else {
          this.distance = (200 + this.wallWidth) * this.scale;
        }

        let x1 = (wall.x1 + this.viewPortX) * this.scale;
        let y1 = (wall.y1 + this.viewPortY) * this.scale;
        let x2 = (wall.x2 + this.viewPortX) * this.scale;
        let y2 = (wall.y2 + this.viewPortY) * this.scale;

        let rot = 0;
        let textOffset = 0;
        if (this.showDegrees(wall.angle!) === 0) {
          y1 = (this.minY + this.viewPortY) * this.scale;
          y2 = (this.minY + this.viewPortY) * this.scale;
        }
        if (this.showDegrees(wall.angle!) === 90) {
          x1 = (this.maxX + this.viewPortX) * this.scale;
          x2 = (this.maxX + this.viewPortX) * this.scale;
          rot = -Math.PI;
          textOffset = 10;
        }
        if (this.showDegrees(wall.angle!) === 180) {
          y1 = (this.maxY + this.viewPortY) * this.scale;
          y2 = (this.maxY + this.viewPortY) * this.scale;
        }
        if (this.showDegrees(wall.angle!) === -90) {
          x1 = (this.minX + this.viewPortX) * this.scale;
          x2 = (this.minX + this.viewPortX) * this.scale;
          textOffset = 10;
        }

        const length = Math.round(
          this.calculateLength(wall.x1, wall.y1, wall.x2, wall.y2)
        );
        const wallLength = length;
        const measure = this.calculatePerpendicularLine(
          x1,
          x2,
          y1,
          y2,
          this.distance
        );
        const insetMeasure = this.calculatePerpendicularLine(
          x1,
          x2,
          y1,
          y2,
          this.insetDistance
        );
        const distance = Math.round(
          this.calculateLength(x1, y1, x2, y2) / 2
        );
        const C = this.calculatePositionAlongWall(
          measure[0],
          measure[1],
          distance
        );

        this.context.beginPath();
        this.context.moveTo(measure[0].x, measure[0].y);
        this.context.lineTo(measure[1].x, measure[1].y);
        this.context.stroke();

        this.context.save();
        this.context.translate(measure[0].x, measure[0].y);
        this.context.rotate(wall.angle!);
        this.context.moveTo(0, -(80 * this.scale));
        this.context.lineTo(0, 80 * this.scale);
        this.context.stroke();
        this.context.moveTo(distance * 2, -(80 * this.scale));
        this.context.lineTo(distance * 2, 80 * this.scale);
        this.context.stroke();
        this.context.restore();

        this.context.save();
        this.context.translate(C.x, C.y);
        let offset = 0;
        let angle = wall.angle!;
        if (wall.angle! * (180 / Math.PI) === 180) {
          angle = 0;
          offset = 190 * this.scale;
        }
        if (wall.angle! * (180 / Math.PI) === 90) {
          angle = -1.5707;
          offset = 190 * this.scale;
        }
        this.context.font = 150 * this.scale + "px sans-serif";
        this.context.textAlign = "center";
        if (this.showColours) this.context.fillStyle = "#4466ff";
        this.context.rotate(angle + rot);
        this.context.fillText(
          length.toString() + "mm",
          0,
          -(40 + textOffset) * this.scale
        );
        this.context.restore();

        if (typeof insets !== "undefined") {
          let wallInsets = false;
          const insetLocations: number[] = [];

          const newInsets = [...insets].sort(
            (a, b) => a.positionLeft - b.positionLeft
          );

          for (const inset of newInsets) {
            if (inset.wall === index) {
              if (inset.positionLeft > 0) {
                wallInsets = true;
                insetLocations.push(inset.positionLeft);
                insetLocations.push(inset.positionLeft + inset.width);
              }
            }
          }

          if (this.showInsetMeasurements) {
            this.context.fillStyle = "#aaaaaa";
            this.context.strokeStyle = "#aaaaaa";
            if (wallInsets) {
              this.context.beginPath();
              this.context.moveTo(insetMeasure[0].x, insetMeasure[0].y);
              this.context.lineTo(insetMeasure[1].x, insetMeasure[1].y);
              this.context.stroke();

              this.context.save();
              this.context.translate(insetMeasure[0].x, insetMeasure[0].y);
              this.context.rotate(wall.angle!);
              this.context.moveTo(0, -(80 * this.scale));
              this.context.lineTo(0, 80 * this.scale);
              this.context.stroke();
              this.context.moveTo(distance * 2, -(80 * this.scale));
              this.context.lineTo(distance * 2, 80 * this.scale);
              this.context.stroke();
              this.context.restore();

              let insetOffset = 0;
              let insetAngle = wall.angle!;
              if (wall.angle! * (180 / Math.PI) === 180) {
                insetAngle = 0;
              }
              if (wall.angle! * (180 / Math.PI) === 90) {
                insetAngle = -1.5707;
                insetOffset = -10 * this.scale;
              }

              this.context.font = 150 * this.scale + "px sans-serif";
              this.context.textAlign = "center";

              let lastLocation = 0;
              for (const location of insetLocations) {
                const CC = this.calculatePositionAlongWall(
                  insetMeasure[0],
                  insetMeasure[1],
                  location * this.scale
                );
                const DD = this.calculatePositionAlongWall(
                  insetMeasure[0],
                  insetMeasure[1],
                  lastLocation * this.scale
                );

                this.context.save();
                this.context.translate(CC.x, CC.y);
                this.context.rotate(wall.angle!);
                this.context.moveTo(0, -(80 * this.scale));
                this.context.lineTo(0, 80 * this.scale);
                this.context.stroke();
                this.context.restore();

                const segLength = this.calculateLength(
                  CC.x,
                  CC.y,
                  DD.x,
                  DD.y
                );
                const segD = this.calculatePositionAlongWall(
                  { x: CC.x, y: CC.y },
                  { x: DD.x, y: DD.y },
                  segLength / 2
                );
                this.context.save();
                this.context.translate(segD.x, segD.y);
                if (location - lastLocation < 600) {
                  this.context.font =
                    ((location - lastLocation) / 5) * this.scale +
                    "px sans-serif";
                }
                this.context.rotate(insetAngle + rot);
                if (location - lastLocation > 0) {
                  this.context.fillText(
                    (location - lastLocation).toString() + "mm",
                    0,
                    -(40 + 10) * this.scale + insetOffset
                  );
                }
                this.context.restore();
                lastLocation = location;
              }

              const CC = this.calculatePositionAlongWall(
                insetMeasure[0],
                insetMeasure[1],
                lastLocation * this.scale
              );
              const DD = this.calculatePositionAlongWall(
                insetMeasure[0],
                insetMeasure[1],
                distance * 2
              );
              const segLength = this.calculateLength(
                CC.x,
                CC.y,
                DD.x,
                DD.y
              );
              const segD = this.calculatePositionAlongWall(
                { x: CC.x, y: CC.y },
                { x: DD.x, y: DD.y },
                segLength / 2
              );
              this.context.save();
              this.context.translate(segD.x, segD.y);
              if (wallLength - lastLocation < 600) {
                this.context.font =
                  ((wallLength - lastLocation) / 5) * this.scale +
                  "px sans-serif";
              }
              this.context.rotate(insetAngle + rot);
              this.context.fillText(
                (wallLength - lastLocation).toString() + "mm",
                0,
                -(40 + 10) * this.scale + insetOffset
              );
              this.context.restore();
            }
          }
        }
      }
    }
  }

  private drawCornerHandles() {
    const ground = this.ground;
    const angles = this.angles;
    const walls = this.walls;

    if (this.showCornerHandles) {
      for (const [index, wall] of walls.entries()) {
        let startPoint = index;
        let endPoint = index + 1;
        if (startPoint < 0) startPoint = ground.length - 1;
        if (endPoint > ground.length - 1) endPoint = 0;

        const x1 = (wall.x1 + this.viewPortX) * this.scale;
        const y1 = (wall.y1 + this.viewPortY) * this.scale;
        const length = this.wallWidth * this.scale;
        const thetaStart =
          wall.angle! - 1.5708 - (Math.PI - angles[startPoint]) / 2;
        const x4 =
          x1 +
          Math.abs(length / Math.sin(angles[startPoint] / 2)) *
            Math.cos(thetaStart);
        const y4 =
          y1 +
          Math.abs(length / Math.sin(angles[startPoint] / 2)) *
            Math.sin(thetaStart);
        const D = this.calculatePositionAlongWall(
          { x: x1, y: y1 },
          { x: x4, y: y4 },
          this.calculateLength(x1, y1, x4, y4) / 2
        );
        this.itemDefinitions.push({
          type: "grabHandle",
          id: index,
          wall: index,
          poly: [
            { x: D.x - 200 * this.scale, y: D.y - 200 * this.scale },
            { x: D.x - 200 * this.scale, y: D.y + 200 * this.scale },
            { x: D.x + 200 * this.scale, y: D.y + 200 * this.scale },
            { x: D.x + 200 * this.scale, y: D.y - 200 * this.scale },
          ],
          origin: { x: wall.x1, y: wall.y1 },
        });
        this.renderCornerGrabHandle(this.context, D.x, D.y, 0);
      }
    }
  }

  private drawInsets(recordInset = true) {
    const walls = this.walls;
    this.contextInsets.clearRect(
      0,
      0,
      this.canvasElement.width * this.ratio,
      this.canvasElement.height * this.ratio
    );

    if (this.showInsets) {
      if (typeof this.roomShape.insets !== "undefined") {
        for (const [index, inset] of this.roomShape.insets.entries()) {
          const x1 = (walls[inset.wall].x1 + this.viewPortX) * this.scale;
          const y1 = (walls[inset.wall].y1 + this.viewPortY) * this.scale;
          const x2 = (walls[inset.wall].x2 + this.viewPortX) * this.scale;
          const y2 = (walls[inset.wall].y2 + this.viewPortY) * this.scale;

          const A = this.calculatePositionAlongWall(
            { x: x1, y: y1 },
            { x: x2, y: y2 },
            inset.positionLeft * this.scale
          );
          const B = this.calculatePositionAlongWall(
            { x: x1, y: y1 },
            { x: x2, y: y2 },
            (inset.positionLeft + inset.width) * this.scale
          );

          const innerOff = inset.type === "window"
            ? (this.wallWidth - this.frameDepth) * this.scale
            : ((this.wallWidth - this.frameDepth) / 2) * this.scale;
          const outerOff = inset.type === "window"
            ? this.wallWidth * this.scale
            : ((this.wallWidth + this.frameDepth) / 2) * this.scale;
          const midOff = inset.type === "window"
            ? (this.wallWidth - this.frameDepth / 2) * this.scale
            : (this.wallWidth / 2) * this.scale;
          const [fA, fB] = this.calculatePerpendicularLine(A.x, B.x, A.y, B.y, innerOff);
          const [fC, fD] = this.calculatePerpendicularLine(A.x, B.x, A.y, B.y, outerOff);
          const [mA, mB] = this.calculatePerpendicularLine(A.x, B.x, A.y, B.y, midOff);
          const [C, D] = this.calculatePerpendicularLine(
            A.x, B.x, A.y, B.y, this.wallWidth * this.scale
          );

          this.contextInsets.strokeStyle = "rgba(153,153,153,0.5)";
          if (this.mode === "all" || this.mode === "insets") {
            this.contextInsets.strokeStyle = "#999999";
          }

          if (
            this.activeItem.type === "inset" &&
            this.activeItem.id === index
          ) {
            this.contextInsets.fillStyle = "rgb(70,255,0)";
            if (inset.locked) {
              this.contextInsets.strokeStyle = "#ff6666";
            }
          } else {
            this.contextInsets.fillStyle = "rgba(255,255,255,0.5)";
            if (this.mode === "all" || this.mode === "insets") {
              this.contextInsets.fillStyle = "white";
            }
          }
          this.contextInsets.lineWidth = 2;

          if (inset.type === "door") {
            const doorFill =
              this.activeItem.type === "inset" && this.activeItem.id === index
                ? "rgb(70,255,0)"
                : "white";
            this.contextInsets.fillStyle = doorFill;
            this.contextInsets.beginPath();
            this.contextInsets.moveTo(A.x, A.y);
            this.contextInsets.lineTo(B.x, B.y);
            this.contextInsets.lineTo(D.x, D.y);
            this.contextInsets.lineTo(C.x, C.y);
            this.contextInsets.closePath();
            this.contextInsets.fill();

            this.contextInsets.lineWidth = 4;
            this.contextInsets.beginPath();
            this.contextInsets.moveTo(A.x, A.y);
            this.contextInsets.lineTo(C.x, C.y);
            this.contextInsets.stroke();
            this.contextInsets.beginPath();
            this.contextInsets.moveTo(B.x, B.y);
            this.contextInsets.lineTo(D.x, D.y);
            this.contextInsets.stroke();
            this.contextInsets.lineWidth = 2;
          } else {
            this.contextInsets.beginPath();
            this.contextInsets.moveTo(fA.x, fA.y);
            this.contextInsets.lineTo(fB.x, fB.y);
            this.contextInsets.lineTo(fD.x, fD.y);
            this.contextInsets.lineTo(fC.x, fC.y);
            this.contextInsets.lineTo(fA.x, fA.y);
            this.contextInsets.fill();
            this.contextInsets.stroke();

            this.contextInsets.beginPath();
            this.contextInsets.moveTo(fA.x, fA.y);
            this.contextInsets.lineTo(fD.x, fD.y);
            this.contextInsets.stroke();
          }

          if (inset.type === "window") {
            const sillProjection = 50 * this.scale;
            const sillOverhang = 25 * this.scale;
            const frameDir = {
              x: fD.x - fC.x,
              y: fD.y - fC.y,
            };
            const frameLen = Math.sqrt(frameDir.x * frameDir.x + frameDir.y * frameDir.y);
            const uDir = { x: frameDir.x / frameLen, y: frameDir.y / frameLen };
            const sA = { x: fC.x - uDir.x * sillOverhang, y: fC.y - uDir.y * sillOverhang };
            const sB = { x: fD.x + uDir.x * sillOverhang, y: fD.y + uDir.y * sillOverhang };
            const [sC, sD] = this.calculatePerpendicularLine(
              sA.x, sB.x, sA.y, sB.y, sillProjection
            );
            this.contextInsets.save();
            this.contextInsets.beginPath();
            this.contextInsets.moveTo(sA.x, sA.y);
            this.contextInsets.lineTo(sB.x, sB.y);
            this.contextInsets.lineTo(sD.x, sD.y);
            this.contextInsets.lineTo(sC.x, sC.y);
            this.contextInsets.closePath();
            this.contextInsets.fillStyle = "#d9d9d9";
            this.contextInsets.strokeStyle = "#999999";
            this.contextInsets.lineWidth = 2;
            this.contextInsets.fill();
            this.contextInsets.stroke();
            this.contextInsets.restore();
          }

          this.contextInsets.strokeStyle = "#999999";

          if (this.showInsetOpenings) {
            for (const insetItem of inset.openings) {
              const degreesOpen = insetItem.degreesOpen * (Math.PI / 180);
              this.contextInsets.lineWidth = 30 * this.scale;
              this.contextInsets.lineCap = "round";
              if (insetItem.open === "inwards") {
                if (this.showFlooring)
                  this.contextInsets.strokeStyle = "#ffffff";
                const displacement = this.calculatePositionAlongWall(
                  mA,
                  mB,
                  insetItem.displacement * this.scale
                );

                if (insetItem.hanging === "left") {
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(displacement.x, displacement.y);
                  const X =
                    insetItem.width *
                      this.scale *
                      Math.cos(walls[inset.wall].angle! + degreesOpen) +
                    displacement.x;
                  const Y =
                    insetItem.width *
                      this.scale *
                      Math.sin(walls[inset.wall].angle! + degreesOpen) +
                    displacement.y;
                  this.contextInsets.lineTo(X, Y);
                  this.contextInsets.stroke();
                  if (degreesOpen > 0.1) {
                    this.contextInsets.beginPath();
                    this.contextInsets.lineWidth = 2;
                    this.contextInsets.arc(
                      displacement.x,
                      displacement.y,
                      insetItem.width * this.scale - 20 * this.scale,
                      walls[inset.wall].angle! + 0.05,
                      walls[inset.wall].angle! + degreesOpen - 0.05
                    );
                    this.contextInsets.stroke();
                  }
                } else if (insetItem.hanging === "right") {
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(displacement.x, displacement.y);
                  const X =
                    insetItem.width *
                      this.scale *
                      Math.cos(
                        walls[inset.wall].angle! + Math.PI - degreesOpen
                      ) +
                    displacement.x;
                  const Y =
                    insetItem.width *
                      this.scale *
                      Math.sin(
                        walls[inset.wall].angle! + Math.PI - degreesOpen
                      ) +
                    displacement.y;
                  this.contextInsets.lineTo(X, Y);
                  this.contextInsets.stroke();
                  if (degreesOpen > 0.1) {
                    this.contextInsets.beginPath();
                    this.contextInsets.lineWidth = 2;
                    this.contextInsets.arc(
                      displacement.x,
                      displacement.y,
                      insetItem.width * this.scale - 20 * this.scale,
                      walls[inset.wall].angle! + Math.PI - degreesOpen + 0.05,
                      walls[inset.wall].angle! + Math.PI - 0.05
                    );
                    this.contextInsets.stroke();
                  }
                } else if (
                  insetItem.hanging === "top" ||
                  insetItem.hanging === "bottom"
                ) {
                  const d = this.calculatePositionAlongWall(
                    mB,
                    mA,
                    insetItem.displacement * this.scale
                  );
                  const e = this.calculatePositionAlongWall(
                    mB,
                    mA,
                    (insetItem.displacement + insetItem.width) * this.scale
                  );
                  const f = this.calculatePerpendicularLine(
                    d.x,
                    e.x,
                    d.y,
                    e.y,
                    (insetItem.height ?? 0) * Math.sin(degreesOpen) *
                      this.scale
                  );
                  this.contextInsets.beginPath();
                  this.contextInsets.lineWidth = 2;
                  this.contextInsets.moveTo(e.x, e.y);
                  this.contextInsets.lineTo(f[1].x, f[1].y);
                  this.contextInsets.lineTo(f[0].x, f[0].y);
                  this.contextInsets.lineTo(d.x, d.y);
                  this.contextInsets.fillStyle = "rgba(127,127,127,0.1)";
                  this.contextInsets.fill();
                  this.contextInsets.stroke();
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(f[1].x, f[1].y);
                  this.contextInsets.lineTo(f[0].x, f[0].y);
                  this.contextInsets.lineWidth = 30 * this.scale;
                  this.contextInsets.lineCap = "round";
                  this.contextInsets.stroke();
                }
              } else {
                const displacement = this.calculatePositionAlongWall(
                  mA,
                  mB,
                  insetItem.displacement * this.scale
                );
                if (insetItem.hanging === "left") {
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(displacement.x, displacement.y);
                  const X =
                    insetItem.width *
                      this.scale *
                      Math.cos(walls[inset.wall].angle! - degreesOpen) +
                    displacement.x;
                  const Y =
                    insetItem.width *
                      this.scale *
                      Math.sin(walls[inset.wall].angle! - degreesOpen) +
                    displacement.y;
                  this.contextInsets.lineTo(X, Y);
                  this.contextInsets.stroke();
                  if (degreesOpen > 0.1) {
                    this.contextInsets.beginPath();
                    this.contextInsets.lineWidth = 2;
                    this.contextInsets.arc(
                      displacement.x,
                      displacement.y,
                      insetItem.width * this.scale - 20 * this.scale,
                      walls[inset.wall].angle! - degreesOpen + 0.05,
                      walls[inset.wall].angle! - 0.05
                    );
                    this.contextInsets.stroke();
                  }
                } else if (insetItem.hanging === "right") {
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(displacement.x, displacement.y);
                  const X =
                    insetItem.width *
                      this.scale *
                      Math.cos(
                        walls[inset.wall].angle! - Math.PI + degreesOpen
                      ) +
                    displacement.x;
                  const Y =
                    insetItem.width *
                      this.scale *
                      Math.sin(
                        walls[inset.wall].angle! - Math.PI + degreesOpen
                      ) +
                    displacement.y;
                  this.contextInsets.lineTo(X, Y);
                  this.contextInsets.stroke();
                  if (degreesOpen > 0.1) {
                    this.contextInsets.beginPath();
                    this.contextInsets.lineWidth = 2;
                    this.contextInsets.arc(
                      displacement.x,
                      displacement.y,
                      insetItem.width * this.scale - 20 * this.scale,
                      walls[inset.wall].angle! - Math.PI + 0.05,
                      walls[inset.wall].angle! -
                        (Math.PI - degreesOpen) -
                        0.05
                    );
                    this.contextInsets.stroke();
                  }
                } else if (
                  insetItem.hanging === "top" ||
                  insetItem.hanging === "bottom"
                ) {
                  const d = this.calculatePositionAlongWall(
                    mA,
                    mB,
                    insetItem.displacement * this.scale
                  );
                  const e = this.calculatePositionAlongWall(
                    mA,
                    mB,
                    (insetItem.displacement + insetItem.width) * this.scale
                  );
                  const f = this.calculatePerpendicularLine(
                    d.x,
                    e.x,
                    d.y,
                    e.y,
                    (insetItem.height ?? 0) * Math.sin(degreesOpen) *
                      this.scale
                  );
                  this.contextInsets.beginPath();
                  this.contextInsets.lineWidth = 2;
                  this.contextInsets.moveTo(e.x, e.y);
                  this.contextInsets.lineTo(f[1].x, f[1].y);
                  this.contextInsets.lineTo(f[0].x, f[0].y);
                  this.contextInsets.lineTo(d.x, d.y);
                  this.contextInsets.fillStyle = "rgba(127,127,127,0.1)";
                  this.contextInsets.fill();
                  this.contextInsets.stroke();
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(f[1].x, f[1].y);
                  this.contextInsets.lineTo(f[0].x, f[0].y);
                  this.contextInsets.lineWidth = 30 * this.scale;
                  this.contextInsets.lineCap = "round";
                  this.contextInsets.stroke();
                }
              }
            }
          }

          if (inset.locked && this.showLocks) {
            const center = this.getPolygonCentroid([
              { x: fA.x, y: fA.y },
              { x: fB.x, y: fB.y },
              { x: fD.x, y: fD.y },
              { x: fC.x, y: fC.y },
            ]);
            this.drawPadlock(center);
          }

          if (recordInset) {
            if (this.mode === "all" || this.mode === "insets") {
              this.itemDefinitions.push({
                type: "inset",
                identity: inset.type,
                id: index,
                wall: inset.wall,
                poly: [
                  { x: A.x, y: A.y },
                  { x: B.x, y: B.y },
                  { x: D.x, y: D.y },
                  { x: C.x, y: C.y },
                ],
                inset,
                origin: { left: inset.positionLeft },
              });
            }
          }

          this.contextInsets.lineWidth = 1;
        }
      }
    }
  }

  private drawPadlock(center: Point) {
    const oldStroke = this.contextInsets.strokeStyle;
    const oldFill = this.contextInsets.fillStyle;
    this.contextInsets.strokeStyle = "#ff0000";
    this.contextInsets.fillStyle = "#ffffff";

    this.contextInsets.beginPath();
    this.contextInsets.lineWidth = 16 * this.scale;
    this.contextInsets.arc(
      center.x,
      center.y - 60 * this.scale,
      30 * this.scale,
      Math.PI,
      Math.PI * 2
    );
    this.contextInsets.stroke();

    this.contextInsets.beginPath();
    this.contextInsets.moveTo(
      center.x - 30 * this.scale,
      center.y - 56 * this.scale
    );
    this.contextInsets.lineTo(
      center.x - 30 * this.scale,
      center.y - 16 * this.scale
    );
    this.contextInsets.stroke();

    this.contextInsets.beginPath();
    this.contextInsets.moveTo(
      center.x + 30 * this.scale,
      center.y - 56 * this.scale
    );
    this.contextInsets.lineTo(
      center.x + 30 * this.scale,
      center.y - 26 * this.scale
    );
    this.contextInsets.stroke();

    this.contextInsets.beginPath();
    this.contextInsets.lineWidth = 40 * this.scale;
    this.contextInsets.arc(
      center.x,
      center.y + 24 * this.scale,
      50 * this.scale,
      0,
      2 * Math.PI
    );
    this.contextInsets.stroke();
    this.contextInsets.fill();

    this.contextInsets.fillStyle = "#ff0000";
    this.contextInsets.beginPath();
    this.contextInsets.lineWidth = 10 * this.scale;
    this.contextInsets.arc(
      center.x,
      center.y + 24 * this.scale,
      20 * this.scale,
      0,
      2 * Math.PI
    );
    this.contextInsets.stroke();
    this.contextInsets.fill();

    this.contextInsets.strokeStyle = oldStroke;
    this.contextInsets.fillStyle = oldFill;
  }

  private lineIntersect(
    ax: number, ay: number, adx: number, ady: number,
    bx: number, by: number, bdx: number, bdy: number
  ): [number, number] | null {
    const det = adx * bdy - ady * bdx;
    if (Math.abs(det) < 1e-10) return null;
    const dx = bx - ax;
    const dy = by - ay;
    const t = (dx * bdy - dy * bdx) / det;
    return [ax + t * adx, ay + t * ady];
  }

  private slopeCornerPt(
    wallIdx: number,
    isStart: boolean,
    myDepth: number,
    useOffset: boolean
  ): [number, number] {
    const walls = this.walls;
    const angles = this.angles;
    const ground = this.ground;
    const wAngle = walls[wallIdx].angle!;
    const perp = wAngle - Math.PI / 2;
    const cornerIdx = isStart
      ? wallIdx
      : (wallIdx + 1) % ground.length;
    const cx = isStart
      ? (walls[wallIdx].x1 + this.viewPortX) * this.scale
      : (walls[wallIdx].x2 + this.viewPortX) * this.scale;
    const cy = isStart
      ? (walls[wallIdx].y1 + this.viewPortY) * this.scale
      : (walls[wallIdx].y2 + this.viewPortY) * this.scale;

    const adjIdx = isStart
      ? (wallIdx - 1 + walls.length) % walls.length
      : (wallIdx + 1) % walls.length;
    const adjSlope = this.roomShape.slopes?.find(
      (s) => s.wall === adjIdx
    );

    if (adjSlope) {
      if (useOffset && adjSlope.kneeWallHeight >= 2000) {
        // adjacent has no 2m offset — fall through to miter
      } else {
        const adjDepth = useOffset
          ? Math.round(
              this.calculate2MeterOffset(
                this.roomShape.roomHeight,
                adjSlope.kneeWallHeight,
                adjSlope.roofAngle
              )
            ) * this.scale
          : Math.round(
              this.calculateSlopeDepth(
                this.roomShape.roomHeight,
                adjSlope.kneeWallHeight,
                adjSlope.roofAngle
              )
            ) * this.scale;
        const adjAngle = walls[adjIdx].angle!;
        const adjPerp = adjAngle - Math.PI / 2;
        const result = this.lineIntersect(
          cx - myDepth * Math.cos(perp),
          cy - myDepth * Math.sin(perp),
          Math.cos(wAngle),
          Math.sin(wAngle),
          cx - adjDepth * Math.cos(adjPerp),
          cy - adjDepth * Math.sin(adjPerp),
          Math.cos(adjAngle),
          Math.sin(adjAngle)
        );
        if (result) return result;
      }
    }

    if (angles[cornerIdx] >= Math.PI) {
      return [cx - myDepth * Math.cos(perp), cy - myDepth * Math.sin(perp)];
    }
    const sign = isStart ? -1 : 1;
    const theta =
      wAngle - Math.PI / 2 + sign * (Math.PI / 2 - angles[cornerIdx]);
    const sinVal = Math.max(Math.abs(Math.sin(angles[cornerIdx])), 0.333);
    const dist = Math.abs(myDepth / sinVal);
    return [cx - dist * Math.cos(theta), cy - dist * Math.sin(theta)];
  }

  private drawSlopes() {
    const ground = this.ground;
    const walls = this.walls;

    if (!this.showSlopes || !this.roomShape.slopes?.length) return;

    this.context.save();
    this.context.beginPath();
    for (let i = 0; i < ground.length; i++) {
      const gx = (ground[i].x + this.viewPortX) * this.scale;
      const gy = (ground[i].y + this.viewPortY) * this.scale;
      if (i === 0) this.context.moveTo(gx, gy);
      else this.context.lineTo(gx, gy);
    }
    this.context.closePath();
    this.context.clip();

    const polys = this.roomShape.slopes.map((slope) => {
      const w = slope.wall;
      const x1 = (walls[w].x1 + this.viewPortX) * this.scale;
      const y1 = (walls[w].y1 + this.viewPortY) * this.scale;
      const x2 = (walls[w].x2 + this.viewPortX) * this.scale;
      const y2 = (walls[w].y2 + this.viewPortY) * this.scale;
      const depth = Math.round(
        this.calculateSlopeDepth(
          this.roomShape.roomHeight,
          slope.kneeWallHeight,
          slope.roofAngle
        )
      );
      const len = depth * this.scale;
      const [x4, y4] = this.slopeCornerPt(w, true, len, false);
      const [x3, y3] = this.slopeCornerPt(w, false, len, false);

      let depth2: number | null = null;
      let nx4 = 0, ny4 = 0, nx3 = 0, ny3 = 0;
      if (slope.kneeWallHeight < 2000) {
        depth2 = Math.round(
          this.calculate2MeterOffset(
            this.roomShape.roomHeight,
            slope.kneeWallHeight,
            slope.roofAngle
          )
        );
        const len2 = depth2 * this.scale;
        [nx4, ny4] = this.slopeCornerPt(w, true, len2, true);
        [nx3, ny3] = this.slopeCornerPt(w, false, len2, true);
      }

      const selected =
        this.activeItem.type === "slope" && this.activeItem.id === w;
      return {
        w, x1, y1, x2, y2, x3, y3, x4, y4,
        depth, depth2, nx3, ny3, nx4, ny4, selected,
      };
    });

    // Unselected slope fills — single path prevents double transparency
    this.context.setLineDash([]);
    this.context.beginPath();
    for (const s of polys) {
      if (s.selected) continue;
      this.context.moveTo(s.x1, s.y1);
      this.context.lineTo(s.x2, s.y2);
      this.context.lineTo(s.x3, s.y3);
      this.context.lineTo(s.x4, s.y4);
      this.context.closePath();
    }
    let transparency = 0.2;
    if (this.mode === "all" || this.mode === "slopes") transparency = 0.3;
    if (this.showColours) {
      this.context.fillStyle = "rgba(200,200,200," + transparency + ")";
    } else {
      this.context.fillStyle = "transparent";
    }
    this.context.strokeStyle = "rgba(200,200,200," + transparency + ")";
    this.context.fill("nonzero");

    // Selected slope fill
    for (const s of polys) {
      if (!s.selected) continue;
      this.context.beginPath();
      this.context.moveTo(s.x1, s.y1);
      this.context.lineTo(s.x2, s.y2);
      this.context.lineTo(s.x3, s.y3);
      this.context.lineTo(s.x4, s.y4);
      this.context.closePath();
      this.context.fillStyle = "rgba(70,255,0,0.2)";
      this.context.strokeStyle = "rgba(70,255,0,0.2)";
      this.context.fill();
      this.context.stroke();
    }

    // Item definitions for click detection
    if (this.mode === "all" || this.mode === "slopes") {
      for (const s of polys) {
        this.itemDefinitions.push({
          type: "slope",
          identity: "slope",
          id: s.w,
          wall: s.w,
          poly: [
            { x: s.x1, y: s.y1 },
            { x: s.x2, y: s.y2 },
            { x: s.x3, y: s.y3 },
            { x: s.x4, y: s.y4 },
          ],
        });
      }
    }

    // Inner boundary dashed lines
    this.context.lineWidth = 4;
    this.context.setLineDash([60 * this.scale, 60 * this.scale]);
    this.context.strokeStyle = "rgba(170,170,170,0.5)";
    if (this.mode === "all" || this.mode === "slopes") {
      this.context.strokeStyle = this.showFlooring ? "#ffffff" : "#aaaaaa";
    }
    for (const s of polys) {
      this.context.beginPath();
      this.context.moveTo(s.x3, s.y3);
      this.context.lineTo(s.x4, s.y4);
      this.context.stroke();
    }
    this.context.setLineDash([]);

    // 2m offset dashed lines + measurements
    for (const s of polys) {
      if (s.depth2 === null) continue;
      this.context.fillStyle = "rgba(170,170,170,0.5)";
      this.context.strokeStyle = "rgba(170,170,170,0.5)";
      if (this.mode === "all" || this.mode === "slopes") {
        this.context.fillStyle = this.showFlooring ? "#ffffff" : "#aaaaaa";
        this.context.strokeStyle = this.showFlooring ? "#ffffff" : "#aaaaaa";
      }
      this.context.lineWidth = 4;
      this.context.setLineDash([30 * this.scale, 30 * this.scale]);
      this.context.beginPath();
      this.context.moveTo(s.nx3, s.ny3);
      this.context.lineTo(s.nx4, s.ny4);
      this.context.stroke();

      if (this.showMeasurements) {
        const d2 = Math.round(
          this.calculateLength(s.nx3, s.ny3, s.nx4, s.ny4) / 2
        );
        const C2 = this.calculatePositionAlongWall(
          { x: s.nx3, y: s.ny3 },
          { x: s.nx4, y: s.ny4 },
          d2
        );
        this.context.save();
        this.context.translate(C2.x, C2.y);
        let offset2 = 0;
        let angle2 = walls[s.w].angle!;
        if (walls[s.w].angle! * (180 / Math.PI) === 180) {
          angle2 = 0;
          offset2 = 180 * this.scale;
        }
        if (walls[s.w].angle! * (180 / Math.PI) === 90) {
          angle2 = -1.5707;
          offset2 = 180 * this.scale;
        }
        this.context.font = 100 * this.scale + "px sans-serif";
        this.context.textAlign = "center";
        this.context.fillStyle = "rgba(153,153,153,0.5)";
        if (this.mode === "all" || this.mode === "slopes") {
          this.context.fillStyle = this.showFlooring ? "#ffffff" : "#888888";
        }
        this.context.setLineDash([]);
        this.context.rotate(angle2);
        this.context.fillText(
          s.depth2.toString() + "mm (Offset 2000mm Height)",
          0,
          -(40 * this.scale) + offset2
        );
        this.context.restore();
      }
    }
    this.context.setLineDash([]);

    // Main slope offset measurements
    if (this.showMeasurements) {
      for (const s of polys) {
        const distS = Math.round(
          this.calculateLength(s.x3, s.y3, s.x4, s.y4) / 2
        );
        const CS = this.calculatePositionAlongWall(
          { x: s.x3, y: s.y3 },
          { x: s.x4, y: s.y4 },
          distS
        );
        this.context.save();
        this.context.translate(CS.x, CS.y);
        let mOff = 280 * this.scale;
        let mAng = walls[s.w].angle!;
        if (walls[s.w].angle! * (180 / Math.PI) === 180) {
          mAng = 0;
          mOff = -40;
        }
        if (walls[s.w].angle! * (180 / Math.PI) === 90) {
          mAng = -1.5707;
          mOff = 280 * this.scale;
        }
        this.context.font = 120 * this.scale + "px sans-serif";
        this.context.textAlign = "center";
        this.context.fillStyle = "rgba(153,153,153,0.5)";
        if (this.mode === "all" || this.mode === "slopes") {
          this.context.fillStyle = this.showFlooring ? "#ffffff" : "#888888";
        }
        this.context.rotate(mAng);
        this.context.fillText(
          s.depth.toString() + "mm (Offset)",
          0,
          -(40 * this.scale) + mOff
        );
        this.context.restore();
      }
    }

    this.context.restore();
  }

  private renderGrabHandle(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number
  ) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.strokeStyle = "orange";
    context.lineWidth = 60 * this.scale;
    context.fillStyle = "#ffb830";
    context.beginPath();
    context.arc(0, 0, 100 * this.scale, 0, 2 * Math.PI);
    context.stroke();
    context.fill();

    context.strokeStyle = "white";
    context.lineWidth = 28 * this.scale;
    context.beginPath();
    context.arc(0, 0, 60 * this.scale, 0.87, 2.27);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, 60 * this.scale, 4, 5.4);
    context.stroke();
    context.restore();
  }

  private renderCornerGrabHandle(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number
  ) {
    this.renderGrabHandle(context, x, y, angle);
    context.save();
    context.translate(x, y);
    context.rotate(angle);

    context.strokeStyle = "orange";
    context.lineWidth = 10 * this.scale;
    context.fillStyle = "#ffb830";

    const arrows = [
      [220, 0, 160, 80, 160, -80],
      [-220, 0, -160, -80, -160, 80],
      [0, -220, -80, -160, 80, -160],
      [0, 220, 80, 160, -80, 160],
    ];

    for (const [ax, ay, bx, by, cx, cy] of arrows) {
      context.beginPath();
      context.moveTo(ax * this.scale, ay * this.scale);
      context.lineTo(bx * this.scale, by * this.scale);
      context.lineTo(cx * this.scale, cy * this.scale);
      context.lineTo(ax * this.scale, ay * this.scale);
      context.closePath();
      context.fill();
      context.stroke();
    }

    context.restore();
  }

  private calculate2MeterOffset(
    roomHeight: number,
    kneeWallHeight: number,
    slopeAngle: number
  ) {
    const len = 2000 - kneeWallHeight;
    return (
      Math.sin((slopeAngle / 180) * Math.PI) *
      (len / Math.sin(((90 - slopeAngle) / 180) * Math.PI))
    );
  }

  private calculateSlopeDepth(
    roomHeight: number,
    kneeWallHeight: number,
    slopeAngle: number
  ) {
    const len = roomHeight - kneeWallHeight;
    return (
      Math.sin((slopeAngle / 180) * Math.PI) *
      (len / Math.sin(((90 - slopeAngle) / 180) * Math.PI))
    );
  }

  private showDegrees(rad: number) {
    return Math.round(rad * (180 / Math.PI));
  }

  private calculateLength(x1: number, y1: number, x2: number, y2: number) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
  }

  private calculatePerpendicularLine(
    x1: number,
    x2: number,
    y1: number,
    y2: number,
    distance: number
  ): [Point, Point] {
    const AB = { x: x2 - x1, y: y2 - y1 };
    const perpendicular = { x: AB.y, y: -AB.x };
    const perpendicularSize = Math.sqrt(AB.x * AB.x + AB.y * AB.y);
    const unit = {
      x: perpendicular.x / perpendicularSize,
      y: perpendicular.y / perpendicularSize,
    };
    const sideVector = { x: unit.x * distance, y: unit.y * distance };
    return [
      { x: x1 + sideVector.x, y: y1 + sideVector.y },
      { x: x2 + sideVector.x, y: y2 + sideVector.y },
    ];
  }

  private calculateDistanceFromWall(
    x: number,
    y: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx: number;
    let yy: number;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculatePositionAlongWall(
    A: Point,
    B: Point,
    distance: number
  ): Point {
    const xLen = B.x - A.x;
    const yLen = B.y - A.y;
    const hLen = Math.sqrt(Math.pow(xLen, 2) + Math.pow(yLen, 2));
    const ratio = distance / hLen;
    const smallerXLen = xLen * ratio;
    const smallerYLen = yLen * ratio;
    return { x: A.x + smallerXLen, y: A.y + smallerYLen };
  }

  private drawTriangle(start: number) {
    this.context.rotate(start);
    this.context.beginPath();
    this.context.moveTo(0, 0);
    this.context.lineTo(30 * this.scale, 60 * this.scale);
    this.context.lineTo(-30 * this.scale, 60 * this.scale);
    this.context.lineTo(0, 0);
    this.context.stroke();
    this.context.fill();
  }

  private invertAngle(angle: number) {
    return (angle + Math.PI) % (2 * Math.PI);
  }

  private findAngle(c: Point, b: Point, a: Point) {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const cb = { x: b.x - c.x, y: b.y - c.y };
    const dot = ab.x * cb.x + ab.y * cb.y;
    const cross = ab.x * cb.y - ab.y * cb.x;
    let alpha = Math.atan2(cross, dot);
    if (alpha < 0) alpha = Math.PI * 2 + alpha;
    return alpha;
  }

  private findWallAngle(A: Point, B: Point) {
    return Math.atan2(B.y - A.y, B.x - A.x);
  }

  private areaFromCoords(ground: Point[]) {
    let a = 0;
    for (const [index] of ground.entries()) {
      let endPoint = index + 1;
      if (endPoint > ground.length - 1) endPoint = 0;
      a +=
        ground[index].x * ground[endPoint].y -
        ground[index].y * ground[endPoint].x;
    }
    a +=
      ground[0].x * ground[ground.length - 1].y -
      ground[0].y * ground[ground.length - 1].x;
    return Math.abs(a / 2) / 1000;
  }

  private getPolygonCentroid(inPts: Point[]): Point {
    const pts = JSON.parse(JSON.stringify(inPts));
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.x !== last.x || first.y !== last.y) pts.push(first);
    let twiceArea = 0;
    let x = 0;
    let y = 0;
    const nPts = pts.length;
    for (let i = 0, j = nPts - 1; i < nPts; j = i++) {
      const p1 = pts[i];
      const p2 = pts[j];
      const f = p1.x * p2.y - p2.x * p1.y;
      twiceArea += f;
      x += (p1.x + p2.x) * f;
      y += (p1.y + p2.y) * f;
    }
    const fVal = twiceArea * 3;
    return { x: x / fVal, y: y / fVal };
  }

  private pointIsInPoly(p: Point, polygon: Point[]) {
    let isInside = false;
    let minX = polygon[0].x;
    let maxX = polygon[0].x;
    let minY = polygon[0].y;
    let maxY = polygon[0].y;
    for (let n = 1; n < polygon.length; n++) {
      const q = polygon[n];
      minX = Math.min(q.x, minX);
      maxX = Math.max(q.x, maxX);
      minY = Math.min(q.y, minY);
      maxY = Math.max(q.y, maxY);
    }
    if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) return false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (
        polygon[i].y > p.y !== polygon[j].y > p.y &&
        p.x <
          ((polygon[j].x - polygon[i].x) * (p.y - polygon[i].y)) /
            (polygon[j].y - polygon[i].y) +
            polygon[i].x
      ) {
        isInside = !isInside;
      }
    }
    return isInside;
  }

  private checkCollisions(
    event: MouseEvent | TouchEvent,
    touchEvents: boolean
  ) {
    const [x, y] = this.returnPosition(event, touchEvents);
    const arr = [...this.itemDefinitions].reverse();
    for (const item of arr) {
      if (this.pointIsInPoly({ x, y }, item.poly)) {
        if (item.type === "control") {
          event.preventDefault();
          return;
        } else {
          this.activeItem = {
            type: item.type,
            id: item.id,
            poly: item.poly,
            wall: item.wall,
            identity: item.identity ?? -1,
            inset: item.inset,
          };
          this.onSelectedItem?.(this.activeItem);

          if (item.type === "wall") {
            this.isDragging = false;
            return;
          }
          if (item.type === "ground" || item.type === "slope") return;
          if (item.type === "inset") {
            this.dragItem = item;
            this.isDragging = false;
            return;
          }
          if (item.type === "grabHandle") {
            this.dragItem = item;
            this.isDragging = false;
            return;
          }
        }
      }
      this.activeItem = {
        type: "",
        id: -1,
        poly: [],
        wall: -1,
        identity: -1,
      };
      this.onSelectedItem?.(this.activeItem);
    }
  }

  // Public API methods for React component
  setGrid(gridSize: number) {
    this.gridSize = gridSize;
    this.planView();
  }

  setWallWidth(wallWidth: number) {
    this.wallWidth = wallWidth;
    this.planView();
  }

  setWalls(showWalls: boolean) {
    this.showWalls = showWalls;
    this.planView();
  }

  setArea(showArea: boolean) {
    this.showArea = showArea;
    this.planView();
  }

  setLetters(showLetters: boolean) {
    this.showLetters = showLetters;
    this.planView();
  }

  setCorners(showCorners: boolean) {
    this.showCorners = showCorners;
    this.planView();
  }

  setMeasurements(showMeasurements: boolean) {
    this.showMeasurements = showMeasurements;
    this.planView();
  }

  setInsetMeasurements(v: boolean) {
    this.showInsetMeasurements = v;
    this.planView();
  }

  setSlopes(v: boolean) {
    this.showSlopes = v;
    this.planView();
  }

  setGround(v: boolean) {
    this.showGround = v;
    this.planView();
  }

  setTools(v: boolean) {
    this.showTools = v;
    this.planView();
  }

  setCornerHandles(v: boolean) {
    this.showCornerHandles = v;
    this.planView();
  }

  setRoom(roomShape: RoomShape) {
    this.roomShape = roomShape;
    this.planView();
    this.autoZoomCentre();
    this.activeItem = {
      type: "",
      id: -1,
      poly: [],
      wall: -1,
      identity: -1,
    };
    this.onSelectedItem?.(this.activeItem);
  }

  setInsets(v: boolean) {
    this.showInsets = v;
    this.drawInsets();
  }

  setGridVisible(v: boolean) {
    this.showGrid = v;
    this.planView();
  }

  setColours(v: boolean) {
    this.showColours = v;
    this.planView();
  }

  setMode(mode: InteractionMode) {
    this.mode = mode;
    this.planView();
  }

  setRulers(v: boolean) {
    this.showRulers = v;
    this.planView();
  }

  updateFlooring(v: boolean) {
    this.showFlooring = v;
    this.planView();
  }

  updateFloorAngle(v: number) {
    this.floorAngle = v * (Math.PI / 180);
    this.planView();
  }

  updateFloorGap(v: number) {
    this.floorGap = v;
    this.planView();
  }

  updateFloorPositionX(v: number) {
    this.floorPositionX = v;
    this.planView();
  }

  updateFloorPositionY(v: number) {
    this.floorPositionY = v;
    this.planView();
  }

  updateFloorOffset(v: number) {
    this.floorOffset = v;
    this.planView();
  }

  updateFloorWidth(v: number) {
    this.floorWidth = v;
    this.planView();
  }

  updateFloorHeight(v: number) {
    this.floorHeight = v;
    this.planView();
  }

  updateSnapToGrid(v: boolean) {
    this.snapToGrid = v;
  }

  setFreeEdit(): boolean {
    this.freeEdit = !this.freeEdit;
    this.showCornerHandles = this.freeEdit;
    this.planView();
    return this.freeEdit;
  }

  updateLocks(v: boolean) {
    this.showLocks = v;
    this.planView();
  }

  updateInsetOpenings(v: boolean) {
    this.showInsetOpenings = v;
    this.planView();
  }

  openInsets(inset: Inset, id: number) {
    const opening = inset.openings[id];
    if (typeof opening !== "undefined") {
      const target = opening._targetDegree ?? opening.maxDegree;
      if (opening.degreesOpen < target) {
        opening.state = "opening";
        requestAnimationFrame(() => {
          if (this._disposed) return;
          opening.degreesOpen = Math.ceil(
            0.05 + opening.degreesOpen * 1.025
          );
          if (opening.degreesOpen > target) {
            opening.degreesOpen = target;
          }
          this.drawInsets(false);
          this.openInsets(inset, id);
        });
      } else {
        opening.degreesOpen = target;
        opening.state = "open";
        this.onAnimationComplete?.();
      }
    }
  }

  closeInsets(inset: Inset, id: number) {
    const opening = inset.openings[id];
    if (typeof opening !== "undefined") {
      if (opening.state === "open" || opening.state === "opening") {
        opening._targetDegree = opening.degreesOpen;
      }
      if (opening.degreesOpen > opening.minDegree) {
        opening.state = "closing";
        requestAnimationFrame(() => {
          if (this._disposed) return;
          opening.degreesOpen = Math.floor(
            opening.degreesOpen / 1.025 - 0.05
          );
          if (opening.degreesOpen < opening.minDegree) {
            opening.degreesOpen = opening.minDegree;
          }
          this.drawInsets(false);
          this.closeInsets(inset, id);
        });
      } else {
        opening.state = "closed";
        this.onAnimationComplete?.();
      }
    }
  }

  onPinchStart(event: { center: { x: number; y: number }; scale: number }) {
    this.centerX = event.center.x;
    this.centerY = event.center.y;
    this.lastScale = event.scale;
  }

  onPinchEnd() {}

  onPinch(event: { scale: number }) {
    const zoom = Math.exp(event.scale - this.lastScale);
    if (this.scale > 2) {
      this.scale = 2;
      return;
    }
    if (this.scale < 0.05) {
      this.scale = 0.05;
      return;
    }
    if (
      (this.scale > 0.05 || event.scale - this.lastScale > 0) &&
      (this.scale < 2 || event.scale - this.lastScale < 0)
    ) {
      this.scale *= zoom;
      this.viewPortX +=
        (this.centerX / (this.scale * zoom) - this.centerX / this.scale) *
        1.666;
      this.viewPortY +=
        (this.centerY / (this.scale * zoom) - this.centerY / this.scale) *
        1.666;
      this.zoomLevel = this.scale;
      this.onZoomLevelChange?.(this.zoomLevel);
      this.lastScale = event.scale;
      this.planView();
    }
  }
}
