import {Injectable} from '@angular/core';
import FontFaceObserver from 'fontfaceobserver';
import {Subject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Engine2dService {
  private originalViewPortX: any;
  private originalViewPortY: any;
  private oldWidth: number;
  private oldHeight: number;

  canvasElement: any;
  canvasToolsElement: any;
  context: CanvasRenderingContext2D;
  contextTools: CanvasRenderingContext2D;
  width: number;
  height: number;
  scale = 0.1;
  viewPortX = 200;
  viewPortY = 200;
  zoomLevel;
  ratio = 2;
  x;
  y;
  lastX;
  lastY;
  roomShape;
  gridSize = 1000;

  private zoomLevelChange = new Subject<number>();
  zoomLevelChanged$ = this.zoomLevelChange.asObservable();

  private selectedItem = new Subject();
  selectedItem$ = this.selectedItem.asObservable();

  private wallsList = new Subject();
  wallsList$ = this.wallsList.asObservable();

  private distance: number;
  private textDistance: number;
  showMeasurements = true;
  showWalls = true;
  showCorners = true;
  showLetters = true;
  showArea = true;
  showSlopes = true;
  showGround = true;
  wallWidth = 200;
  itemDefinitions: any[];
  activeItem = {type: '', id: -1, poly: [], wall: -1, identity: -1};
  isDragging = false;
  isMoving = false;
  showTools = false;
  showCornerHandles = false;
  showInsetMeasurements = true;
  showInsets = true;
  insetDistance: number;
  showGrid = true;
  showColours = true;
  showRulers = false;
  showFlooring = false;
  showLocks = true;
  showInsetOpenings = true;

  floorAngle = 0;

  private contextInsets: CanvasRenderingContext2D;
  private canvasInsetsElement: any;
  private angles;
  private walls;
  private minX;
  private minY;
  private maxX;
  private maxY;
  private insets;
  private ground;
  private canvasControlsElement: any;
  private contextControls: CanvasRenderingContext2D;
  private centerX: number;
  private centerY: number;
  private lastScale: any;
  private mode = 'all';
  private flooring;
  private floorGap = 0;
  private floorOffset = 0;
  private floorPositionX = 0;
  private floorPositionY = 0;
  private floorWidth = 1000;
  private floorHeight = 500;
  private canvasTilesElement;
  private contextTiles: CanvasRenderingContext2D;
  private canvasGridElement: any;
  private contextGrid: CanvasRenderingContext2D;
  private dragItem: any;
  private freeEdit = false;
  private snapToGrid = false;



  constructor() {

    this.flooring = new Image();
    this.flooring.src = '/assets/floor.jpg';
  }

  startEngine(canvasGrid, canvas, canvasInsets, canvasTools, canvasControls, canvasTiles, roomShape) {
    this.canvasGridElement = canvasGrid;
    this.canvasElement = canvas;
    this.canvasToolsElement = canvasTools;
    this.canvasInsetsElement = canvasTools;
    this.canvasTilesElement = canvasTiles;
    this.canvasControlsElement = canvasControls;

    this.roomShape = roomShape;

    this.contextGrid = this.canvasGridElement.getContext('2d');
    this.context = this.canvasElement.getContext('2d');
    this.contextTools = this.canvasToolsElement.getContext('2d');
    this.contextTiles = this.canvasTilesElement.getContext('2d');
    this.contextInsets = this.canvasInsetsElement.getContext('2d');
    this.contextControls = this.canvasControlsElement.getContext('2d');

    this.canvasControlsElement.onwheel = (event) => {
      this.wheelInit(event);
    };

    this.canvasControlsElement.addEventListener('touchstart', (event) => {
      if (event.touches.length > 1) {
        return false;
      }
      this.isDragging = true;
      this.originalViewPortX = this.viewPortX;
      this.originalViewPortY = this.viewPortY;
      [this.lastX, this.lastY] = this.returnPosition(event, true);
      this.checkCollisions(event, true);
      this.planView();
    });
    this.canvasControlsElement.addEventListener('touchmove', (event) => {
      if (event.touches.length > 1) {
        return false;
      }
      this.mouseActions(event, true);
    });
    this.canvasControlsElement.addEventListener('touchend', (event) => {
      if (event.touches.length > 1) {
        return false;
      }
      this.isDragging = false;
      [this.lastX, this.lastY] = this.returnPosition(event, true);
    });

    this.canvasControlsElement.addEventListener('mousedown', (event) => {
      this.isDragging = true;
      this.originalViewPortX = this.viewPortX;
      this.originalViewPortY = this.viewPortY;
      [this.lastX, this.lastY] = this.returnPosition(event, false);
      if (!this.isMoving) {
        this.checkCollisions(event, false);
        this.planView();
      }
    });
    this.canvasControlsElement.addEventListener('mousemove', (event) => {
      if (this.isDragging) {
        this.isMoving = true;
      }
      this.mouseActions(event, false);
    });
    this.canvasControlsElement.addEventListener('mouseover', (event) => {
    });
    this.canvasControlsElement.addEventListener('mouseup', (event) => {
      this.isMoving = false;
      this.isDragging = false;
      this.dragItem = false;
      this.mouseActions(event, false);
      this.planView();
    });
    this.canvasControlsElement.addEventListener('mouseout', (event) => {
      this.isDragging = false;
      this.isMoving = false;
      this.mouseActions(event, false);
      this.planView();
    });

    const font = new FontFaceObserver('plex');

    font.load().then(() => {
      this.configurePlanView();
      this.planView();
    });

    this.resize();
    this.autoZoom();
    this.autoCentre();
    this.selectedItem.next(this.activeItem);
  }

  wheelInit(event) {
    event.preventDefault();

    let centerX = 0;
    let centerY = 0;

    [centerX, centerY] = this.returnPosition(event, false);

    const wheel = event.deltaY;

    if (this.scale > 2) {
      this.scale = 2;
    }
    if (this.scale < 0.05) {
      this.scale = 0.05;
    }
    if ((this.scale > 0.05 || wheel > 0) && (this.scale < 2 || wheel < 0)) {
      const zoom = Math.exp(wheel * 0.002);
      this.scale *= zoom;
      this.viewPortX += centerX / (this.scale * zoom) - centerX / this.scale;
      this.viewPortY += centerY / (this.scale * zoom) - centerY / this.scale;
      this.zoomLevel = this.scale;
      this.zoomLevelChange.next(this.zoomLevel);
      this.planView();
      return false;
    }

  }

  returnPosition(event, touchEvents) {
    const bounds = event.target.getBoundingClientRect();
    let x: number;
    let y: number;
    if (touchEvents === true) {
      x = (event.touches[0].pageX - bounds.left) * this.ratio;
      y = (event.touches[0].pageY - bounds.top) * this.ratio;
    } else {
      x = (event.clientX - bounds.left) * this.ratio;
      y = (event.clientY - bounds.top) * this.ratio;
    }

    return [x, y];
  }

  resize() {
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

    if (!isNaN(this.oldWidth)) {
      this.viewPortX -= (this.oldWidth - this.width) / this.scale;
      this.viewPortY -= (this.oldHeight - this.height) / this.scale;
    }
    this.planView();
  }

  mouseActions(event, touchEvents) {
    [this.x, this.y] = this.returnPosition(event, touchEvents);

    // const walls = [];
    // let closestWall = -1;
    // let currentWall = 999999999;
    // for (const [index, wall] of this.walls.entries()) {
    //
    //   const dist = this.calculateDistanceFromWall(
    //     this.x,
    //     this.y,
    //   (wall.x1 + this.viewPortX) * this.scale,
    //   (wall.y1 + this.viewPortY) * this.scale,
    //   (wall.x2 + this.viewPortX) * this.scale,
    //   (wall.y2 + this.viewPortY) * this.scale
    //   );
    //   // walls.push(dist);
    //   if (dist < currentWall) {
    //     currentWall = dist;
    //     closestWall = index;
    //   }
    // }

    // console.log(closestWall);

    if (this.isDragging) {

      this.viewPortX = this.originalViewPortX - ((this.lastX - this.x) / this.scale);
      this.viewPortY = this.originalViewPortY - ((this.lastY - this.y) / this.scale);
      this.planView();
    }
    if (this.dragItem) {

      if (this.dragItem.type === 'grabHandle') {
        this.roomShape.path[this.dragItem.wall].x = ((this.x - this.lastX) / this.scale + this.dragItem.origin.x);
        this.roomShape.path[this.dragItem.wall].y = ((this.y - this.lastY) / this.scale + this.dragItem.origin.y);
      }

      if (this.dragItem.type === 'inset') {
        if(this.dragItem.inset.locked){
          return false;
        }
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

        if (this.dragItem.inset.wall !== closestWall) {


          if (currentWall < (500 * this.scale)) {

            this.dragItem.inset.wall = closestWall;
            this.dragItem.wall = closestWall;
            const ssin = Math.sin(this.walls[this.dragItem.wall].angle);
            const scos = Math.cos(this.walls[this.dragItem.wall].angle);

            this.dragItem.origin.left =
              Math.round(
                (this.x - (this.walls[this.dragItem.wall].x1 + this.viewPortX) * this.scale) / this.scale * scos +
                (this.y - (this.walls[this.dragItem.wall].y1 + this.viewPortY) * this.scale) / this.scale * ssin) - ((this.dragItem.inset.width / 2));

            this.lastX = this.x;
            this.lastY = this.y;
          }

        }

        let position;

        const sin = Math.sin(this.walls[this.dragItem.wall].angle);
        const cos = Math.cos(this.walls[this.dragItem.wall].angle);

        position = Math.round(((this.x - this.lastX) / this.scale * cos + (this.y - this.lastY) / this.scale * sin) + this.dragItem.origin.left);


        if (position < 10) {
          position = 10;
        }
        if (position > this.walls[this.dragItem.wall].length - 10 - this.dragItem.inset.width) {
          position = this.walls[this.dragItem.wall].length - 10 - this.dragItem.inset.width;
        }

        this.roomShape.insets[this.dragItem.id].positionLeft = position;
      }

      this.planView();
    }
  }


  zoomIn() {
    const centerX = this.canvasElement.width / this.ratio;
    const centerY = this.canvasElement.height / this.ratio;
    this.viewPortX += centerX / (this.zoomLevel) - centerX / this.scale;
    this.viewPortY += centerY / (this.zoomLevel) - centerY / this.scale;
    this.scale = this.zoomLevel;
    this.zoomLevelChange.next(this.zoomLevel);
    this.planView();
  }

  autoCentre() {
    const oldScale = this.scale;

    this.scale = 1;

    const width = (this.maxX - this.minX);
    const height = (this.maxY - this.minY);

    this.viewPortX = 0 - this.minX + (this.width - (width / 2));
    this.viewPortY = 0 - this.minY + (this.height - (height / 2));

    this.zoomLevel = oldScale;
    this.zoomIn();
    this.planView();
  }


  getMaxMin() {
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
    const ratioX = this.width / ((this.maxX - this.minX));
    const ratioY = this.height / ((this.maxY - this.minY));
    if (ratioX > ratioY) {
      this.scale = ratioY;
    } else {
      this.scale = ratioX;
    }
    this.scale = this.scale * 1.3;
    this.zoomLevel = this.scale;
    this.zoomLevelChange.next(this.zoomLevel);
    this.planView();
  }

  autoZoomCentre() {
    this.autoZoom();
    setTimeout(() => {
      this.autoCentre();
    });

    setTimeout(() => {
      this.autoZoom();
    });

  }

  configurePlanView() {
    this.canvasTilesElement.height = this.canvasElement.offsetHeight * this.ratio;
    this.canvasTilesElement.width = this.canvasElement.offsetWidth * this.ratio;
    this.canvasGridElement.height = this.canvasElement.offsetHeight * this.ratio;
    this.canvasGridElement.width = this.canvasElement.offsetWidth * this.ratio;
    this.canvasElement.height = this.canvasElement.offsetHeight * this.ratio;
    this.canvasElement.width = this.canvasElement.offsetWidth * this.ratio;
    this.canvasToolsElement.height = this.canvasToolsElement.offsetHeight * this.ratio;
    this.canvasToolsElement.width = this.canvasToolsElement.offsetWidth * this.ratio;
    this.canvasControlsElement.height = this.canvasControlsElement.offsetHeight * this.ratio;
    this.canvasControlsElement.width = this.canvasControlsElement.offsetWidth * this.ratio;
  }

  planView() {
    this.itemDefinitions = [];
    this.context.clearRect(0, 0, this.canvasElement.width * this.ratio, this.canvasElement.height * this.ratio);
    this.contextTiles.clearRect(0, 0, this.canvasElement.width * this.ratio, this.canvasElement.height * this.ratio);
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

  drawMenu(x1, y1, id, wall) {
    const controlSize = 150;
    this.contextControls.strokeStyle = '#bbbbbb';
    this.contextControls.lineWidth = 40 * this.scale;
    this.contextControls.fillStyle = '#ffffff';
    this.contextControls.shadowColor = 'rgba(0, 0, 0, 0.2)';
    this.contextControls.shadowBlur = 6;
    this.contextControls.shadowOffsetX = 0;
    this.contextControls.shadowOffsetY = 6;
    this.contextControls.beginPath();
    this.contextControls.arc(x1, y1, controlSize * this.scale, 0, 2 * Math.PI);
    this.contextControls.stroke();
    this.contextControls.fill();
    this.contextControls.shadowBlur = 0;
    this.contextControls.shadowOffsetX = 0;
    this.contextControls.shadowOffsetY = 0;

    this.contextControls.lineWidth = 30 * this.scale;
    this.contextControls.lineCap = 'round';
    this.contextControls.beginPath();
    this.contextControls.moveTo(x1 - (70 * this.scale), y1 + (70 * this.scale));
    this.contextControls.lineTo(x1 + (70 * this.scale), y1 + (70 * this.scale));
    this.contextControls.stroke();

    this.contextControls.beginPath();
    this.contextControls.moveTo(x1 - (70 * this.scale), y1);
    this.contextControls.lineTo(x1 + (70 * this.scale), y1);
    this.contextControls.stroke();

    this.contextControls.beginPath();
    this.contextControls.moveTo(x1 - (70 * this.scale), y1 - (70 * this.scale));
    this.contextControls.lineTo(x1 + (70 * this.scale), y1 - (70 * this.scale));
    this.contextControls.stroke();

    this.itemDefinitions.push({
      type: 'control',
      identity: this.activeItem.type,
      id,
      wall,
      poly: [
        {x: x1 - (controlSize * this.scale), y: y1 - (controlSize * this.scale)},
        {x: x1 + (controlSize * this.scale), y: y1 - (controlSize * this.scale)},
        {x: x1 + (controlSize * this.scale), y: y1 + (controlSize * this.scale)},
        {x: x1 - (controlSize * this.scale), y: y1 + (controlSize * this.scale)},
        {x: x1 - (controlSize * this.scale), y: y1 - (controlSize * this.scale)},
      ]
    });
  }

  drawControls() {
    // this.contextControls.clearRect(0, 0, this.canvasElement.width * this.ratio, this.canvasElement.height * this.ratio);
    //
    // for (const def of this.itemDefinitions) {
    //   if (def.type === this.activeItem.type && def.id === this.activeItem.id) {
    //
    //     const D = this.getPolygonCentroid(def.poly);
    //
    //     if (typeof this.walls[this.activeItem.wall] !== 'undefined') {
    //       let context = this.context;
    //       if (this.activeItem.type === 'inset') {
    //         context = this.contextControls;
    //       }
    //       context.strokeStyle = '#2ac600';
    //       context.fillStyle = '#87d85b';
    //       context.lineWidth = 3;
    //       context.beginPath();
    //       context.arc(D.x, D.y, 50 * this.scale, 0, Math.PI * 2);
    //       context.fill();
    //
    //       context.moveTo(D.x, D.y);
    //       D.x = D.x + ((500 * this.scale) * Math.cos(this.walls[this.activeItem.wall].angle - (Math.PI / 2)));
    //       D.y = D.y + ((500 * this.scale) * Math.sin(this.walls[this.activeItem.wall].angle - (Math.PI / 2)));
    //       context.lineTo(D.x, D.y);
    //       context.stroke();
    //     }
    //
    //     this.drawMenu(D.x, D.y, this.activeItem.id, this.activeItem.wall);
    //   }
    // }
  }


  drawGround() {
    const ground = this.ground;
    this.context.lineCap = 'round';
    this.context.strokeStyle = '#444444';
    if (this.showColours) {
      this.context.fillStyle = '#4444ff';
    } else {
      this.context.fillStyle = 'transparent';
    }

    this.context.lineWidth = 2;

    let startPoint = 0;
    let endPoint = 0;
    const angles = [];

    const walls = [];
    let oldX = 0;
    let oldY = 0;
    let startX = 0;
    let startY = 0;

    const groundPoly = [];
    this.context.beginPath();
    this.contextTiles.beginPath();

    // @ts-ignore
    // tslint:disable-next-line:no-shadowed-variable
    for (const [index, path] of ground.entries()) {
      // draw floor

      if (index === 0) {
        if (ground) {
          this.context.moveTo(
            (path.x + this.viewPortX) * this.scale,
            (path.y + this.viewPortY) * this.scale
          );
          this.contextTiles.moveTo(
            (path.x + this.viewPortX) * this.scale,
            (path.y + this.viewPortY) * this.scale
          );
        }
        oldX = path.x;
        oldY = path.y;
        startX = path.x;
        startY = path.y;
      } else {
        if (ground) {
          this.context.lineTo(
            (path.x + this.viewPortX) * this.scale,
            (path.y + this.viewPortY) * this.scale
          );
          this.contextTiles.lineTo(
            (path.x + this.viewPortX) * this.scale,
            (path.y + this.viewPortY) * this.scale
          );
        }
        walls.push({
          x1: Math.round(oldX),
          y1: Math.round(oldY),
          x2: Math.round(path.x),
          y2: Math.round(path.y),
          length: Math.round(this.calculateLength(oldX, oldY, path.x, path.y))
        });
      }

      groundPoly.push({x: (path.x + this.viewPortX) * this.scale, y: (path.y + this.viewPortY) * this.scale});

      oldX = path.x;
      oldY = path.y;

      startPoint = index - 1;
      endPoint = index + 1;

      if (startPoint < 0) {
        // @ts-ignore
        startPoint = ground.length - 1;
      }
      // @ts-ignore
      if (endPoint > ground.length - 1) {
        endPoint = 0;
      }

      const angle = (
        this.findAngle(
          ground[startPoint],
          ground[index],
          ground[endPoint]
        )
      );

      angles.push(angle);

    }
    walls.push({
      x1: Math.round(oldX),
      y1: Math.round(oldY),
      x2: Math.round(startX),
      y2: Math.round(startY),
      length: Math.round(this.calculateLength(oldX, oldY, startX, startY))
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
      if (this.activeItem.type === 'ground' && this.activeItem.id === 0) {
        if (this.showFlooring) {
          this.context.strokeStyle = 'rgba(0,255,0,0.5)';
          this.context.lineWidth = 20;
        }
      }


      if (this.showFlooring) {

        this.contextTiles.fillStyle = '#775314';
        this.contextTiles.fill();

        this.contextTiles.save();
        this.contextTiles.clip();
        this.contextTiles.translate(
          ((this.minX + (this.maxX - this.minX) / 2) + this.viewPortX) * this.scale,
          ((this.minY + (this.maxY - this.minY) / 2) + this.viewPortY) * this.scale,
        );
        this.contextTiles.rotate(this.floorAngle);

        for (let i = -(this.maxX / this.floorWidth); i < (this.maxX / this.floorWidth) + (this.maxX / this.floorWidth); i++) {
          for (let j = -(this.maxY / this.floorHeight); j < (this.maxY / this.floorHeight) + (this.maxY / this.floorHeight); j++) {
            let offset = 0;
            if ((j % 2) === 0) {
              offset = this.floorOffset;
            }

            this.contextTiles.drawImage(
              this.flooring,
              ((this.minX + (i * this.floorGap) + (i * this.floorWidth + offset) + this.floorPositionX)) * this.scale,
              ((this.minY + (j * this.floorGap) + (j * this.floorHeight) + this.floorPositionY)) * this.scale,
              this.floorWidth * this.scale, this.floorHeight * this.scale
            );
          }
        }

        this.contextTiles.restore();
      }

      this.context.stroke();


      if (this.activeItem.type === 'ground' && this.activeItem.id === 0) {
        if (!this.showFlooring) {
          this.context.fillStyle = 'rgba(70,255,0,0.2)';
          this.context.fill();
        }

      } else {
        if (!this.showFlooring) {
          if (this.showColours) {
            this.context.fillStyle = 'rgba(255,235,190,0.2)';
            if (this.mode === 'all') {
              this.context.fillStyle = 'rgba(255,235,190,0.5)';
            }
          }
          this.context.fill();
        }
      }
    }

    if (this.mode === 'all') {
      this.itemDefinitions.push({type: 'ground', id: 0, wall: -99, poly: groundPoly});
    }
    this.wallsList.next(this.walls);

    this.angles = angles;
    this.walls = walls;
  }

  drawGrid() {
    this.contextGrid.clearRect(0, 0, this.canvasElement.width * this.ratio, this.canvasElement.height * this.ratio);

    let lines = 0;
    if (this.canvasElement.offsetWidth > this.canvasElement.offsetHeight) {
      lines = (this.canvasElement.offsetWidth * 2) / this.gridSize;
    } else {
      lines = (this.canvasElement.offsetHeight * 2) / this.gridSize;
    }

    if (this.gridSize !== 0 && this.showGrid) {
      this.contextGrid.lineWidth = 1;
      this.contextGrid.strokeStyle = '#cccccc';

      for (let i = 0 - this.gridSize; i < ((lines / this.scale) * this.gridSize) + this.gridSize; i = i + this.gridSize) {
        this.contextGrid.beginPath();
        this.contextGrid.moveTo(0, (i + (this.viewPortY % this.gridSize)) * this.scale);
        this.contextGrid.lineTo(this.canvasElement.offsetWidth * 2, (i + (this.viewPortY % this.gridSize)) * this.scale);
        this.contextGrid.stroke();
        this.contextGrid.beginPath();
        this.contextGrid.moveTo((i + (this.viewPortX % this.gridSize)) * this.scale, 0);
        this.contextGrid.lineTo((i + (this.viewPortX % this.gridSize)) * this.scale, this.canvasElement.offsetHeight * 2);
        this.contextGrid.stroke();
      }
    }

    if (this.showRulers) {
      this.contextGrid.strokeStyle = '#333333';
      this.contextGrid.lineWidth = 1;
      let size = 100;
      for (let i = size; i < ((lines * this.gridSize) / this.scale); i = i + size) {
        this.contextGrid.beginPath();
        this.contextGrid.moveTo((i + (this.viewPortX % size)) * this.scale, 0);
        this.contextGrid.lineTo((i + (this.viewPortX % size)) * this.scale, 20);
        this.contextGrid.stroke();
        this.contextGrid.beginPath();
        this.contextGrid.moveTo(0, (i + (this.viewPortY % size)) * this.scale);
        this.contextGrid.lineTo(20, (i + (this.viewPortY % size)) * this.scale);
        this.contextGrid.stroke();
      }
      this.contextGrid.strokeStyle = '#222222';
      size = 500;
      for (let i = size; i < ((lines * this.gridSize) / this.scale); i = i + size) {
        this.contextGrid.beginPath();
        this.contextGrid.moveTo((i + (this.viewPortX % size)) * this.scale, 0);
        this.contextGrid.lineTo((i + (this.viewPortX % size)) * this.scale, 40);
        this.contextGrid.stroke();
        this.contextGrid.beginPath();
        this.contextGrid.moveTo(0, (i + (this.viewPortY % size)) * this.scale);
        this.contextGrid.lineTo(40, (i + (this.viewPortY % size)) * this.scale);
        this.contextGrid.stroke();
      }
    }

  }

  drawArea() {

    const minX = this.minX;
    const minY = this.minY;
    const maxX = this.maxX;
    const maxY = this.maxY;

    const ground = this.ground;

    const D = this.getPolygonCentroid(this.roomShape.path);
    if (this.showArea) {
      const area = (this.areaFromCoords(ground) / 1000).toFixed(2).replace(/\.00$/, '');

      this.context.font = (200 * this.scale) + 'px plex bold';
      this.context.textAlign = 'center';
      this.context.fillStyle = '#888888';
      if (this.showFlooring) {
        this.context.fillStyle = '#ffffff';
      }
      this.context.fillText(
        area.toString() + 'm²',
        ((D.x) + this.viewPortX) * this.scale,
        (((D.y) + this.viewPortY) + 80) * this.scale
      );
    }
  }

  drawCorners() {
    const ground = this.ground;
    const angles = this.angles;
    const walls = this.walls;

    // Add corner Information
    this.context.lineWidth = 3;
    this.context.strokeStyle = '#888888';
    if (this.showFlooring) {
      this.context.strokeStyle = '#ffffff';
    }
    // @ts-ignore
    for (const [index, path] of ground.entries()) {

      let startPoint = index;
      let endPoint = index + 1;

      if (startPoint < 0) {
        // @ts-ignore
        startPoint = ground.length - 1;
      }
      // @ts-ignore
      if (endPoint > ground.length - 1) {
        endPoint = 0;
      }

      const wallAngle = this.findWallAngle(
        ground[startPoint],
        ground[endPoint]
      );

      const start = wallAngle;
      const end = wallAngle + angles[index];
      const midPoint = wallAngle + (angles[index] / 2);
      walls[index].angle = wallAngle;

      if (this.showCorners && this.showMeasurements) {
        this.context.strokeStyle = '#dddddd';
        if (this.showFlooring) {
          this.context.strokeStyle = '#ffffff';
        }
        this.context.fillStyle = '#888888';
        this.context.beginPath();
        this.context.arc(
          (path.x + this.viewPortX) * this.scale,
          (path.y + this.viewPortY) * this.scale,
          450 * this.scale,
          start,
          end
        );
        this.context.stroke();


        this.context.font = (150 * this.scale) + 'px plex bold';
        this.context.textAlign = 'center';
        if (this.showFlooring) {
          this.context.fillStyle = '#ffffff';
        }
        this.context.fillText(
          Math.round((angles[index] * 180) / Math.PI).toString() + '°',
          ((((path.x + this.viewPortX) + (220 * Math.cos(midPoint))) + 10) * this.scale),
          ((((path.y + this.viewPortY) + (220 * Math.sin(midPoint))) + 40) * this.scale)
        );

        this.context.fillStyle = '#bbbbbb';
        if (this.showFlooring) {
          this.context.fillStyle = '#ffffff';
        }
        this.context.save();
        this.context.translate(
          (((path.x + this.viewPortX) + (450 * Math.cos(start))) * this.scale),
          (((path.y + this.viewPortY) + (450 * Math.sin(start))) * this.scale)
        );

        this.drawTriangle(start);
        this.context.restore();

        this.context.save();
        this.context.translate(
          (((path.x + this.viewPortX) + (450 * Math.cos(end))) * this.scale),
          (((path.y + this.viewPortY) + (450 * Math.sin(end))) * this.scale)
        );

        this.drawTriangle(this.invertAngle(end));
        this.context.restore();
      }
    }

  }

  drawLetters() {
    const walls = this.walls;

    if (this.showLetters) {
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
        if ((wall.angle * (180 / Math.PI)) === 180 && this.showMeasurements) {
          offset = 190 * this.scale;
        }

        const x1 = (wall.x1 + this.viewPortX) * this.scale;
        const y1 = (wall.y1 + 100 + this.viewPortY) * this.scale;
        const x2 = (wall.x2 + this.viewPortX) * this.scale;
        const y2 = (wall.y2 + 100 + this.viewPortY) * this.scale;

        const distance = Math.round(this.calculateLength(x1, y1, x2, y2) / 2);
        const textMeasure = this.calculatePerpendicularLine(x1, x2, y1, y2, this.textDistance);
        const D = this.calculatePositionAlongWall(textMeasure[0], textMeasure[1], distance);
        this.context.font = (200 * this.scale) + 'px plex bold';
        this.context.textAlign = 'center';
        this.context.fillStyle = '#444444';
        this.context.fillText(
          String.fromCharCode(65 + index),
          D.x, D.y - offset
        );
      }
    }
  }

  drawWalls() {
    const ground = this.ground;
    const angles = this.angles;
    const walls = this.walls;
    this.context.fillStyle = '#eeeeee';

    this.context.lineWidth = 2;
    if (this.showWalls) {
      for (const [index, wall] of walls.entries()) {

        let startPoint = index;
        let endPoint = index + 1;

        if (startPoint < 0) {
          // @ts-ignore
          startPoint = ground.length - 1;
        }
        // @ts-ignore
        if (endPoint > ground.length - 1) {
          endPoint = 0;
        }

        const x1 = (wall.x1 + this.viewPortX) * this.scale;
        const y1 = (wall.y1 + this.viewPortY) * this.scale;
        const x2 = (wall.x2 + this.viewPortX) * this.scale;
        const y2 = (wall.y2 + this.viewPortY) * this.scale;

        if (this.activeItem.type === 'wall' && this.activeItem.id === index) {

          this.context.strokeStyle = '#33e200';
          this.context.fillStyle = '#9fff6b';

        } else {
          this.context.fillStyle = '#eeeeee';
          if (this.showColours) {

            this.context.strokeStyle = 'rgba(255,165,0,0.5)';

            this.context.fillStyle = 'rgba(255,221,134,0.5)';
            if (this.mode === 'all' || this.mode === 'walls') {
              this.context.strokeStyle = 'orange';
              this.context.fillStyle = '#ffdd86';
            }

          } else {

            this.context.strokeStyle = 'rgba(153,153,153,0.5)';
            this.context.fillStyle = 'rgba(0,0,0,0,0.5)';
            if (this.mode === 'all' || this.mode === 'walls') {
              this.context.strokeStyle = '#999999';
              this.context.fillStyle = '#eeeeee';
            }
          }
        }


        const length = this.wallWidth * this.scale;

        const thetaStart = wall.angle - 1.5708 - ((Math.PI - angles[startPoint]) / 2);
        const thetaEnd = wall.angle - 1.5708 + ((Math.PI - angles[endPoint]) / 2);


        const x4 = x1 + (Math.abs(length / Math.sin((angles[startPoint] / 2))) * Math.cos(thetaStart));
        const y4 = y1 + (Math.abs(length / Math.sin((angles[startPoint] / 2))) * Math.sin(thetaStart));

        const x3 = x2 + (Math.abs(length / Math.sin((angles[endPoint] / 2))) * Math.cos(thetaEnd));
        const y3 = y2 + (Math.abs(length / Math.sin((angles[endPoint] / 2))) * Math.sin(thetaEnd));

        if (this.mode === 'all' || this.mode === 'walls') {
          this.itemDefinitions.push({
            type: 'wall',
            id: index,
            wall: index,
            poly: [
              {x: x1, y: y1}, {x: x2, y: y2}, {x: x3, y: y3}, {x: x4, y: y4}]
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

  sortArrayOfObjects = (arr, key) => {
    return arr.sort((a, b) => {
      return a[key] - b[key];
    });
  };

  drawMeasurements() {
    const minX = this.minX;
    const minY = this.minY;
    const maxX = this.maxX;
    const maxY = this.maxY;
    const walls = this.walls;
    const insets = this.insets;
    if (this.showColours) {
      this.context.strokeStyle = '#75aaff';
      this.context.fillStyle = '#75aaff';
    } else {
      this.context.strokeStyle = '#888888';
      this.context.fillStyle = '#888888';
    }
    this.context.lineWidth = 2;

    if (this.showMeasurements) {
      // measurements

      // this.distance = (450 + this.wallWidth) * this.scale;
      this.insetDistance = (200 + this.wallWidth) * this.scale;
      for (const [index, wall] of walls.entries()) {
        if (this.showColours) {
          this.context.fillStyle = '#4466ff';
          this.context.strokeStyle = '#4466ff';
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
        if (this.showDegrees(wall.angle) === 0) {
          y1 = (minY + this.viewPortY) * this.scale;
          y2 = (minY + this.viewPortY) * this.scale;
        }
        if (this.showDegrees(wall.angle) === 90) {
          x1 = (maxX + this.viewPortX) * this.scale;
          x2 = (maxX + this.viewPortX) * this.scale;
          rot = -(Math.PI);
          textOffset = 10;
        }
        if (this.showDegrees(wall.angle) === 180) {
          y1 = (maxY + this.viewPortY) * this.scale;
          y2 = (maxY + this.viewPortY) * this.scale;
        }
        if (this.showDegrees(wall.angle) === -90) {
          x1 = (minX + this.viewPortX) * this.scale;
          x2 = (minX + this.viewPortX) * this.scale;
          textOffset = 10;
        }

        const length = Math.round(this.calculateLength(wall.x1, wall.y1, wall.x2, wall.y2));
        const wallLength = length;
        const measure = this.calculatePerpendicularLine(x1, x2, y1, y2, this.distance);
        const insetMeasure = this.calculatePerpendicularLine(x1, x2, y1, y2, this.insetDistance);
        const distance = Math.round(this.calculateLength(x1, y1, x2, y2) / 2);
        const C = this.calculatePositionAlongWall(measure[0], measure[1], distance);

        this.context.beginPath();
        this.context.moveTo(measure[0].x, measure[0].y);
        this.context.lineTo(measure[1].x, measure[1].y);
        this.context.stroke();

        this.context.save();
        this.context.translate(measure[0].x, measure[0].y);
        this.context.rotate(wall.angle);
        this.context.moveTo(0, -(80 * this.scale));
        this.context.lineTo(0, (80 * this.scale));
        this.context.stroke();
        this.context.moveTo(distance * 2, -(80 * this.scale));
        this.context.lineTo(distance * 2, (80 * this.scale));
        this.context.stroke();
        this.context.restore();

        this.context.save();
        this.context.translate(C.x, C.y);
        let offset = 0;
        let angle = wall.angle;
        if ((wall.angle * (180 / Math.PI)) === 180) {
          angle = 0;
          offset = 190 * this.scale;
        }
        if ((wall.angle * (180 / Math.PI)) === 90) {
          angle = -1.5707;
          offset = 190 * this.scale;
        }
        this.context.font = (150 * this.scale) + 'px plex';
        this.context.textAlign = 'center';
        if (this.showColours) {

          this.context.fillStyle = '#4466ff';
        }
        this.context.rotate(angle + rot);
        this.context.fillText(
          length.toString() + 'mm',
          0, -(40 + textOffset) * this.scale
        );
        this.context.restore();

        if (typeof insets !== 'undefined') {
          let wallInsets = false;
          const insetLocations = [];

          const newInsets = [];
          for (const inset of insets) {
            newInsets.push(inset);
          }
          newInsets.sort((a, b) => {
            return a.positionLeft - b.positionLeft;
          });

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
            this.context.fillStyle = '#aaaaaa';
            this.context.strokeStyle = '#aaaaaa';
            if (wallInsets) {
              this.context.beginPath();
              this.context.moveTo(insetMeasure[0].x, insetMeasure[0].y);
              this.context.lineTo(insetMeasure[1].x, insetMeasure[1].y);
              this.context.stroke();

              this.context.save();
              this.context.translate(insetMeasure[0].x, insetMeasure[0].y);
              this.context.rotate(wall.angle);
              this.context.moveTo(0, -(80 * this.scale));
              this.context.lineTo(0, (80 * this.scale));
              this.context.stroke();
              this.context.moveTo(distance * 2, -(80 * this.scale));
              this.context.lineTo(distance * 2, (80 * this.scale));
              this.context.stroke();
              this.context.restore();


              let insetOffset = 0;
              let insetAngle = wall.angle;
              if ((wall.angle * (180 / Math.PI)) === 180) {
                insetAngle = 0;
                insetOffset = 0;
              }
              if ((wall.angle * (180 / Math.PI)) === 90) {
                insetAngle = -1.5707;
                insetOffset = -10 * this.scale;
              }

              this.context.font = (150 * this.scale) + 'px plex';
              this.context.textAlign = 'center';
              // tslint:disable-next-line:no-shadowed-variable
              let length;
              let D;
              let CC;
              let DD;
              let lastLocation = 0;
              for (const location of insetLocations) {
                CC = this.calculatePositionAlongWall(insetMeasure[0], insetMeasure[1], location * this.scale);
                DD = this.calculatePositionAlongWall(insetMeasure[0], insetMeasure[1], lastLocation * this.scale);

                this.context.save();
                this.context.translate(CC.x, CC.y);
                this.context.rotate(wall.angle);
                this.context.moveTo(0, -(80 * this.scale));
                this.context.lineTo(0, (80 * this.scale));
                this.context.stroke();
                this.context.restore();

                length = this.calculateLength(CC.x, CC.y, DD.x, DD.y);
                D = this.calculatePositionAlongWall({x: CC.x, y: CC.y}, {x: DD.x, y: DD.y}, length / 2);
                this.context.save();
                this.context.translate(D.x, D.y);
                if (location - lastLocation < 600) {
                  this.context.font = (((location - lastLocation) / 5) * this.scale) + 'px plex';
                }
                this.context.rotate(insetAngle + rot);
                if ((location - lastLocation) > 0) {
                  this.context.fillText(
                    (location - lastLocation).toString() + 'mm',
                    0, -(40 + 10) * this.scale + insetOffset
                  );
                }

                this.context.restore();

                lastLocation = location;

              }

              CC = this.calculatePositionAlongWall(insetMeasure[0], insetMeasure[1], lastLocation * this.scale);
              DD = this.calculatePositionAlongWall(insetMeasure[0], insetMeasure[1], distance * 2);
              length = this.calculateLength(CC.x, CC.y, DD.x, DD.y);
              D = this.calculatePositionAlongWall({x: CC.x, y: CC.y}, {x: DD.x, y: DD.y}, length / 2);
              this.context.save();
              this.context.translate(D.x, D.y);
              if (wallLength - lastLocation < 600) {
                this.context.font = (((wallLength - lastLocation) / 5) * this.scale) + 'px plex';
              }
              this.context.rotate(insetAngle + rot);
              this.context.fillText(
                (wallLength - lastLocation).toString() + 'mm',
                0, -(40 + 10) * this.scale + insetOffset
              );
              this.context.restore();
            }
          }

        }
      }
    }
  }

  drawCornerHandles() {
    const ground = this.ground;
    const angles = this.angles;
    const walls = this.walls;

    if (this.showCornerHandles) {
      for (const [index, wall] of walls.entries()) {

        let startPoint = index;
        let endPoint = index + 1;

        if (startPoint < 0) {
          // @ts-ignore
          startPoint = ground.length - 1;
        }
        // @ts-ignore
        if (endPoint > ground.length - 1) {
          endPoint = 0;
        }

        const x1 = (wall.x1 + this.viewPortX) * this.scale;
        const y1 = (wall.y1 + this.viewPortY) * this.scale;
        const length = this.wallWidth * this.scale;
        const thetaStart = wall.angle - 1.5708 - ((Math.PI - angles[startPoint]) / 2);
        const x4 = x1 + (Math.abs(length / Math.sin((angles[startPoint] / 2))) * Math.cos(thetaStart));
        const y4 = y1 + (Math.abs(length / Math.sin((angles[startPoint] / 2))) * Math.sin(thetaStart));
        const D = this.calculatePositionAlongWall(
          {x: x1, y: y1},
          {x: x4, y: y4},
          this.calculateLength(x1, y1, x4, y4) / 2
        );
        this.itemDefinitions.push({
          type: 'grabHandle',
          id: index,
          wall: index,
          poly: [
            {x: D.x - 200 * this.scale, y: D.y - 200 * this.scale},
            {x: D.x - 200 * this.scale, y: D.y + 200 * this.scale},
            {x: D.x + 200 * this.scale, y: D.y + 200 * this.scale},
            {x: D.x + 200 * this.scale, y: D.y - 200 * this.scale}
          ],
          origin: {
            x: wall.x1,
            y: wall.y1
          }
        });
        this.renderCornerGrabHandle(this.context, D.x, D.y, 0);
      }
    }
  }

  drawInsets(recordInset = true) {
    const ground = this.ground;
    const angles = this.angles;
    const walls = this.walls;
    this.contextInsets.clearRect(0, 0, this.canvasElement.width * this.ratio, this.canvasElement.height * this.ratio);

    if (this.showInsets) {
      if (typeof this.roomShape.insets !== 'undefined') {
        for (const [index, inset] of this.roomShape.insets.entries()) {

          const x1 = (walls[inset.wall].x1 + this.viewPortX) * this.scale;
          const y1 = (walls[inset.wall].y1 + this.viewPortY) * this.scale;
          const x2 = (walls[inset.wall].x2 + this.viewPortX) * this.scale;
          const y2 = (walls[inset.wall].y2 + this.viewPortY) * this.scale;

          const A = this.calculatePositionAlongWall({x: x1, y: y1}, {x: x2, y: y2}, inset.positionLeft * this.scale);
          const B = this.calculatePositionAlongWall({x: x1, y: y1}, {x: x2, y: y2}, (inset.positionLeft + inset.width) * this.scale);

          const length = this.wallWidth * this.scale;

          const [C, D] = this.calculatePerpendicularLine(A.x, B.x, A.y, B.y, length);

          this.contextInsets.strokeStyle = 'rgba(153,153,153,0.5)';
          if (this.mode === 'all' || this.mode === 'insets') {
            this.contextInsets.strokeStyle = '#999999';
          }

          if (this.activeItem.type === 'inset' && this.activeItem.id === index) {
            this.contextInsets.fillStyle = 'rgb(70,255,0)';
            if(inset.locked){
              this.contextInsets.strokeStyle = '#ff6666';
            }
          } else {
            this.contextInsets.fillStyle = 'rgba(255,255,255,0.5)';

            if (this.mode === 'all' || this.mode === 'insets') {
              this.contextInsets.fillStyle = 'white';
            }
          }
          this.contextInsets.lineWidth = 2;
          this.contextInsets.beginPath();
          this.contextInsets.moveTo(A.x, A.y);
          this.contextInsets.lineTo(B.x, B.y);

          this.contextInsets.lineTo(D.x, D.y);
          this.contextInsets.lineTo(C.x, C.y);

          this.contextInsets.lineTo(A.x, A.y);
          this.contextInsets.fill();
          this.contextInsets.stroke();

          this.contextInsets.beginPath();
          this.contextInsets.moveTo(A.x, A.y);
          this.contextInsets.lineTo(D.x, D.y);
          this.contextInsets.stroke();

          this.contextInsets.strokeStyle = '#999999';

          if (this.showInsetOpenings) {
            for (const insetItem of inset.openings) {

              const degreesOpen = insetItem.degreesOpen * (Math.PI / 180);
              this.contextInsets.lineWidth = 30 * this.scale;
              this.contextInsets.lineCap = 'round';
              if (insetItem.open === 'inwards') {

                if (this.showFlooring) {
                  this.contextInsets.strokeStyle = '#ffffff';
                }
                const displacement = this.calculatePositionAlongWall(A, B, insetItem.displacement * this.scale);

                if (insetItem.hanging === 'left') {
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(displacement.x, displacement.y);
                  const X = (insetItem.width * this.scale) * Math.cos(walls[inset.wall].angle + degreesOpen) + displacement.x;
                  const Y = (insetItem.width * this.scale) * Math.sin(walls[inset.wall].angle + degreesOpen) + displacement.y;
                  this.contextInsets.lineTo(X, Y);
                  this.contextInsets.stroke();

                  if (degreesOpen > 0.1) {
                    this.contextInsets.beginPath();
                    this.contextInsets.lineWidth = 2;
                    this.contextInsets.arc(displacement.x, displacement.y,
                      (insetItem.width * this.scale) -
                      (20 * this.scale),
                      walls[inset.wall].angle + 0.05,
                      walls[inset.wall].angle + degreesOpen - 0.05
                    );
                    this.contextInsets.stroke();
                  }

                } else if (insetItem.hanging === 'right') {
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(displacement.x, displacement.y);
                  const X = (insetItem.width * this.scale) * Math.cos(walls[inset.wall].angle + (Math.PI) - degreesOpen) + displacement.x;
                  const Y = (insetItem.width * this.scale) * Math.sin(walls[inset.wall].angle + (Math.PI) - degreesOpen) + displacement.y;
                  this.contextInsets.lineTo(X, Y);
                  this.contextInsets.stroke();

                  if (degreesOpen > 0.1) {
                    this.contextInsets.beginPath();
                    this.contextInsets.lineWidth = 2;
                    this.contextInsets.arc(displacement.x, displacement.y,
                      (insetItem.width * this.scale) -
                      (20 * this.scale), walls[inset.wall].angle + (Math.PI) - degreesOpen + 0.05,
                      walls[inset.wall].angle + (Math.PI) - 0.05
                    );
                    this.contextInsets.stroke();
                  }
                } else if (insetItem.hanging === 'top' || insetItem.hanging === 'bottom') {
                  const d = this.calculatePositionAlongWall(B, A, insetItem.displacement * this.scale);
                  const e = this.calculatePositionAlongWall(B, A, (insetItem.displacement + insetItem.width) * this.scale);
                  const f = this.calculatePerpendicularLine(d.x, e.x, d.y, e.y, (insetItem.height * Math.sin(degreesOpen)) * this.scale);
                  this.contextInsets.beginPath();
                  this.contextInsets.lineWidth = 2;
                  this.contextInsets.moveTo(e.x, e.y);
                  this.contextInsets.lineTo(f[1].x, f[1].y);
                  this.contextInsets.lineTo(f[0].x, f[0].y);
                  this.contextInsets.lineTo(d.x, d.y);
                  this.contextInsets.fillStyle = 'rgba(127,127,127,0.1)';
                  this.contextInsets.fill();
                  this.contextInsets.stroke();

                  this.contextInsets.stroke();
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(f[1].x, f[1].y);
                  this.contextInsets.lineTo(f[0].x, f[0].y);
                  this.contextInsets.lineWidth = 30 * this.scale;
                  this.contextInsets.lineCap = 'round';
                  this.contextInsets.stroke();
                }
              } else {
                const displacement = this.calculatePositionAlongWall(C, D, insetItem.displacement * this.scale);

                if (insetItem.hanging === 'left') {
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(displacement.x, displacement.y);
                  const X = (insetItem.width * this.scale) * Math.cos(walls[inset.wall].angle - degreesOpen) + displacement.x;
                  const Y = (insetItem.width * this.scale) * Math.sin(walls[inset.wall].angle - degreesOpen) + displacement.y;
                  this.contextInsets.lineTo(X, Y);
                  this.contextInsets.stroke();

                  if (degreesOpen > 0.1) {
                    this.contextInsets.beginPath();
                    this.contextInsets.lineWidth = 2;
                    this.contextInsets.arc(displacement.x, displacement.y,
                      (insetItem.width * this.scale) -
                      (20 * this.scale),
                      walls[inset.wall].angle - degreesOpen + 0.05,
                      walls[inset.wall].angle - 0.05
                    );
                    this.contextInsets.stroke();
                  }
                } else if (insetItem.hanging === 'right') {
                  this.contextInsets.beginPath();
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(displacement.x, displacement.y);
                  const X = (insetItem.width * this.scale) * Math.cos(walls[inset.wall].angle - (Math.PI) + degreesOpen) + displacement.x;
                  const Y = (insetItem.width * this.scale) * Math.sin(walls[inset.wall].angle - (Math.PI) + degreesOpen) + displacement.y;
                  this.contextInsets.lineTo(X, Y);
                  this.contextInsets.stroke();
                  if (degreesOpen > 0.1) {
                    this.contextInsets.beginPath();
                    this.contextInsets.lineWidth = 2;
                    this.contextInsets.arc(displacement.x, displacement.y,
                      (insetItem.width * this.scale) -
                      (20 * this.scale),
                      walls[inset.wall].angle - Math.PI + 0.05,
                      walls[inset.wall].angle - (Math.PI - degreesOpen) - 0.05,
                    );
                    this.contextInsets.stroke();
                  }
                } else if (insetItem.hanging === 'top' || insetItem.hanging === 'bottom') {
                  const d = this.calculatePositionAlongWall(C, D, insetItem.displacement * this.scale);
                  const e = this.calculatePositionAlongWall(C, D, (insetItem.displacement + insetItem.width) * this.scale);
                  const f = this.calculatePerpendicularLine(d.x, e.x, d.y, e.y, (insetItem.height * Math.sin(degreesOpen)) * this.scale);
                  this.contextInsets.beginPath();
                  this.contextInsets.lineWidth = 2;
                  this.contextInsets.moveTo(e.x, e.y);
                  this.contextInsets.lineTo(f[1].x, f[1].y);
                  this.contextInsets.lineTo(f[0].x, f[0].y);
                  this.contextInsets.lineTo(d.x, d.y);
                  this.contextInsets.fillStyle = 'rgba(127,127,127,0.1)';
                  this.contextInsets.fill();

                  this.contextInsets.stroke();
                  this.contextInsets.beginPath();
                  this.contextInsets.moveTo(f[1].x, f[1].y);
                  this.contextInsets.lineTo(f[0].x, f[0].y);
                  this.contextInsets.lineWidth = 30 * this.scale;
                  this.contextInsets.lineCap = 'round';
                  this.contextInsets.stroke();


                }
              }
            }

          }

          if (inset.locked && this.showLocks) {
            const center = this.getPolygonCentroid([
              {x: A.x, y: A.y},
              {x: B.x, y: B.y},
              {x: D.x, y: D.y},
              {x: C.x, y: C.y},
            ]);

            this.drawPadlock(center);
          }

          if (recordInset) {
            if (this.mode === 'all' || this.mode === 'insets') {
              this.itemDefinitions.push({
                type: 'inset',
                identity: inset.type,
                id: index,
                wall: inset.wall,
                poly: [
                  {x: A.x, y: A.y},
                  {x: B.x, y: B.y},
                  {x: D.x, y: D.y},
                  {x: C.x, y: C.y}
                ],
                inset,
                origin: {left: inset.positionLeft}
              });
            }
          }

          this.contextInsets.lineWidth = 1;
        }
      }
    }
  }

  drawPadlock(center){
    const oldStroke = this.contextInsets.strokeStyle;
    const oldFill = this.contextInsets.fillStyle;
    this.contextInsets.strokeStyle = '#ff0000';
    this.contextInsets.fillStyle = '#ffffff';

    this.contextInsets.beginPath();
    this.contextInsets.lineWidth = 16 * this.scale;
    this.contextInsets.arc(center.x, center.y - (60 * this.scale), 30 * this.scale, Math.PI, Math.PI * 2);
    this.contextInsets.stroke();

    this.contextInsets.beginPath();
    this.contextInsets.moveTo(center.x - (30 * this.scale), center.y - (56 * this.scale));
    this.contextInsets.lineTo(center.x - (30 * this.scale), center.y - (16 * this.scale));
    this.contextInsets.stroke();

    this.contextInsets.beginPath();
    this.contextInsets.moveTo(center.x + (30 * this.scale), center.y - (56 * this.scale));
    this.contextInsets.lineTo(center.x + (30 * this.scale), center.y - (26 * this.scale));
    this.contextInsets.stroke();


    this.contextInsets.beginPath();
    this.contextInsets.lineWidth = 40 * this.scale;
    this.contextInsets.arc(center.x, center.y + (24 * this.scale), 50 * this.scale, 0, 2 * Math.PI);
    this.contextInsets.stroke();
    this.contextInsets.fill();

    this.contextInsets.fillStyle = '#ff0000';
    this.contextInsets.beginPath();
    this.contextInsets.lineWidth = 10 * this.scale;
    this.contextInsets.arc(center.x, center.y + (24 * this.scale), 20 * this.scale, 0, 2 * Math.PI);
    this.contextInsets.stroke();
    this.contextInsets.fill();

    this.contextInsets.strokeStyle = oldStroke;
    this.contextInsets.fillStyle = oldFill;
  }
  drawSlopes() {
    const ground = this.ground;
    const angles = this.angles;
    const walls = this.walls;

    if (this.showSlopes) {
      if (typeof this.roomShape.slopes !== 'undefined') {
        for (const slope of this.roomShape.slopes) {
          const wall = slope.wall;
          const x1 = (walls[wall].x1 + this.viewPortX) * this.scale;
          const y1 = (walls[wall].y1 + this.viewPortY) * this.scale;
          const x2 = (walls[wall].x2 + this.viewPortX) * this.scale;
          const y2 = (walls[wall].y2 + this.viewPortY) * this.scale;
          const depth = Math.round(this.calculateSlopeDepth(this.roomShape.roomHeight, slope.kneeWallHeight, slope.roofAngle));
          const length = depth * this.scale;

          let startPoint = wall;
          let endPoint = wall + 1;

          if (startPoint < 0) {
            // @ts-ignore
            startPoint = ground.length - 1;
          }
          // @ts-ignore
          if (endPoint > ground.length - 1) {
            endPoint = 0;
          }
          let thetaStart;
          let thetaEnd;
          if (angles[startPoint] < Math.PI) {
            thetaStart = walls[wall].angle - 1.5708 - ((Math.PI / 2 - angles[startPoint]));
          } else {
            thetaStart = walls[wall].angle - 1.5708;
          }

          if (angles[endPoint] < Math.PI) {
            thetaEnd = walls[wall].angle - 1.5708 + ((Math.PI / 2 - angles[endPoint]));
          } else {
            thetaEnd = walls[wall].angle - 1.5708;
          }

          if (slope.kneeWallHeight < 2000) {
            const depth2 = Math.round(this.calculate2MeterOffset(this.roomShape.roomHeight, slope.kneeWallHeight, slope.roofAngle));
            const length2 = depth2 * this.scale;

            // const nx4 = x1 - (Math.abs(length2 / Math.sin((angles[startPoint]))) * Math.cos(thetaStart));
            // const ny4 = y1 - (Math.abs(length2 / Math.sin((angles[startPoint]))) * Math.sin(thetaStart));
            //
            // const nx3 = x2 - (Math.abs(length2 / Math.sin((angles[endPoint]))) * Math.cos(thetaEnd));
            // const ny3 = y2 - (Math.abs(length2 / Math.sin((angles[endPoint]))) * Math.sin(thetaEnd));


            let nx4 = x1 - (Math.abs(length2 / Math.sin((angles[startPoint]))) * Math.cos(thetaStart));
            let ny4 = y1 - (Math.abs(length2 / Math.sin((angles[startPoint]))) * Math.sin(thetaStart));

            if (angles[startPoint] > Math.PI) {
              nx4 = x1 - (length2 * Math.cos((walls[wall].angle - (Math.PI / 2))));
              ny4 = y1 - (length2 * Math.sin((walls[wall].angle - (Math.PI / 2))));
            }

            let nx3 = x2 - (Math.abs(length2 / Math.sin((angles[endPoint]))) * Math.cos(thetaEnd));
            let ny3 = y2 - (Math.abs(length2 / Math.sin((angles[endPoint]))) * Math.sin(thetaEnd));

            if (angles[endPoint] > Math.PI) {
              nx3 = x2 - (length2 * Math.cos((walls[wall].angle - (Math.PI / 2))));
              ny3 = y2 - (length2 * Math.sin((walls[wall].angle - (Math.PI / 2))));
            }


            this.context.fillStyle = 'rgba(170,170,170,0.5)';
            if (this.mode === 'all' || this.mode === 'slopes') {
              this.context.fillStyle = '#aaaaaa';
              if (this.showFlooring) {
                this.context.fillStyle = '#ffffff';
              }
            }
            this.context.strokeStyle = 'rgba(170,170,170,0.5)';
            if (this.mode === 'all' || this.mode === 'slopes') {
              this.context.strokeStyle = '#aaaaaa';
              if (this.showFlooring) {
                this.context.strokeStyle = '#ffffff';
              }
            }
            this.context.lineWidth = 4;
            this.context.setLineDash([30 * this.scale, 30 * this.scale]);
            this.context.beginPath();
            this.context.moveTo(nx3, ny3);
            this.context.lineTo(nx4, ny4);
            this.context.stroke();

            const distance2 = Math.round(this.calculateLength(nx3, ny3, nx4, ny4) / 2);
            const C2 = this.calculatePositionAlongWall({x: nx3, y: ny3}, {x: nx4, y: ny4}, distance2);
            if (this.showMeasurements) {
              this.context.save();
              this.context.translate(C2.x, C2.y);
              let offset2 = 0;
              let angle2 = walls[wall].angle;
              if ((walls[wall].angle * (180 / Math.PI)) === 180) {
                angle2 = 0;
                offset2 = 180 * this.scale;
              }
              if ((walls[wall].angle * (180 / Math.PI)) === 90) {
                angle2 = -1.5707;
                offset2 = 180 * this.scale;
              }
              this.context.font = (100 * this.scale) + 'px plex';
              this.context.textAlign = 'center';
              this.context.fillStyle = 'rgba(153,153,153,0.5)';
              if (this.mode === 'all' || this.mode === 'slopes') {
                this.context.fillStyle = '#888888';
                if (this.showFlooring) {
                  this.context.fillStyle = '#ffffff';
                }
              }

              this.context.rotate(angle2);
              this.context.fillText(
                depth2.toString() + 'mm (Offset 2000mm Height)',
                0, -(40 * this.scale) + offset2
              );
              this.context.restore();
            }
          }

          let x4 = x1 - (Math.abs(length / Math.sin((angles[startPoint]))) * Math.cos(thetaStart));
          let y4 = y1 - (Math.abs(length / Math.sin((angles[startPoint]))) * Math.sin(thetaStart));

          if (angles[startPoint] > Math.PI) {
            x4 = x1 - (length * Math.cos((walls[wall].angle - (Math.PI / 2))));
            y4 = y1 - (length * Math.sin((walls[wall].angle - (Math.PI / 2))));
          }

          let x3 = x2 - (Math.abs(length / Math.sin((angles[endPoint]))) * Math.cos(thetaEnd));
          let y3 = y2 - (Math.abs(length / Math.sin((angles[endPoint]))) * Math.sin(thetaEnd));

          if (angles[endPoint] > Math.PI) {
            x3 = x2 - (length * Math.cos((walls[wall].angle - (Math.PI / 2))));
            y3 = y2 - (length * Math.sin((walls[wall].angle - (Math.PI / 2))));
          }

          this.context.strokeStyle = '#aaaaaa';
          if (this.showFlooring) {
            this.context.strokeStyle = '#ffffff';
          }
          if (this.activeItem.type === 'slope' && this.activeItem.id === wall) {
            this.context.fillStyle = 'rgba(70,255,0,0.2)';
            this.context.strokeStyle = 'rgba(70,255,0,0.2)';
          } else {
            let transparency = 0.2;
            if (this.mode === 'all' || this.mode === 'slopes') {
              transparency = 0.3;
            }
            if (this.showColours) {
              this.context.fillStyle = 'rgba(200,200,200,' + transparency + ')';
            } else {
              this.context.fillStyle = 'transparent';
            }
            this.context.strokeStyle = 'rgba(200,200,200,' + transparency + ')';
          }

          this.context.setLineDash([]);

          this.context.beginPath();
          this.context.moveTo(x1, y1);
          this.context.lineTo(x2, y2);
          this.context.lineTo(x3, y3);
          this.context.lineTo(x4, y4);
          this.context.lineTo(x1, y1);

          if (this.mode === 'all' || this.mode === 'slopes') {
            this.itemDefinitions.push({
              type: 'slope',
              identity: 'slope',
              id: wall,
              wall,
              poly: [
                {x: x1, y: y1},
                {x: x2, y: y2},
                {x: x3, y: y3},
                {x: x4, y: y4}]
            });
          }

          this.context.fill();
          this.context.stroke();

          this.context.lineWidth = 4;
          this.context.setLineDash([60 * this.scale, 60 * this.scale]);
          this.context.strokeStyle = 'rgba(170,170,170,0.5)';
          if (this.mode === 'all' || this.mode === 'slopes') {
            this.context.strokeStyle = '#aaaaaa';
            if (this.showFlooring) {
              this.context.strokeStyle = '#ffffff';
            }
          }
          this.context.fillStyle = 'rgba(170,170,170,0.5)';
          if (this.mode === 'all' || this.mode === 'slopes') {
            this.context.fillStyle = '#aaaaaa';
            if (this.showFlooring) {
              this.context.fillStyle = '#ffffff';
            }
          }
          this.context.beginPath();
          if (angles[startPoint] < Math.PI) {
            this.context.lineTo(x2, y2);
          }
          this.context.lineTo(x3, y3);
          this.context.lineTo(x4, y4);

          if (angles[endPoint] < Math.PI) {
            this.context.lineTo(x1, y1);
          }

          this.context.stroke();
          this.context.setLineDash([]);

          const distance = Math.round(this.calculateLength(x3, y3, x4, y4) / 2);
          const C = this.calculatePositionAlongWall({x: x3, y: y3}, {x: x4, y: y4}, distance);
          if (this.showMeasurements) {
            this.context.save();
            this.context.translate(C.x, C.y);
            let offset = 280 * this.scale;
            let angle = walls[wall].angle;
            if ((walls[wall].angle * (180 / Math.PI)) === 180) {
              angle = 0;
              offset = -40;
            }
            if ((walls[wall].angle * (180 / Math.PI)) === 90) {
              angle = -1.5707;
              offset = 280 * this.scale;
            }
            this.context.font = (120 * this.scale) + 'px plex';
            this.context.textAlign = 'center';
            this.context.fillStyle = 'rgba(153,153,153,0.5)';
            if (this.mode === 'all' || this.mode === 'slopes') {
              this.context.fillStyle = '#888888';
              if (this.showFlooring) {
                this.context.fillStyle = '#ffffff';
              }
            }
            this.context.rotate(angle);
            this.context.fillText(
              depth.toString() + 'mm (Offset)',
              0, -(40 * this.scale) + offset
            );
            this.context.restore();
          }
          if (this.showTools) {
            this.renderGrabHandle(this.context, C.x, C.y, walls[wall].angle);
          }
        }
      }
    }
  }


  renderGrabHandle(context, x, y, angle) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.strokeStyle = 'orange';
    context.lineWidth = 60 * this.scale;
    context.fillStyle = '#ffb830';
    context.beginPath();
    context.arc(0, 0, 100 * this.scale, 0, 2 * Math.PI);
    context.stroke();
    context.fill();

    context.strokeStyle = 'white';
    context.lineWidth = 28 * this.scale;
    context.beginPath();
    context.arc(0, 0, 60 * this.scale, 0.87, 2.27);
    context.stroke();

    context.beginPath();
    context.arc(0, 0, 60 * this.scale, 4, 5.4);
    context.stroke();
    context.restore();
  }

  renderCornerGrabHandle(context, x, y, angle) {

    this.renderGrabHandle(context, x, y, angle);

    context.save();
    context.translate(x, y);
    context.rotate(angle);

    context.strokeStyle = 'orange';
    context.lineWidth = 10 * this.scale;
    context.fillStyle = '#ffb830';

    context.beginPath();
    context.moveTo(220 * this.scale, 0);
    context.lineTo(160 * this.scale, 80 * this.scale);
    context.lineTo(160 * this.scale, -80 * this.scale);
    context.lineTo(220 * this.scale, 0);
    context.closePath();
    context.fill();
    context.stroke();

    context.beginPath();
    context.moveTo(-220 * this.scale, 0);
    context.lineTo(-160 * this.scale, -80 * this.scale);
    context.lineTo(-160 * this.scale, 80 * this.scale);
    context.lineTo(-220 * this.scale, 0);
    context.closePath();
    context.fill();
    context.stroke();

    context.beginPath();
    context.moveTo(0, -220 * this.scale);
    context.lineTo(-80 * this.scale, -160 * this.scale);
    context.lineTo(80 * this.scale, -160 * this.scale);
    context.lineTo(0, -220 * this.scale);
    context.closePath();
    context.fill();
    context.stroke();

    context.beginPath();
    context.moveTo(0, 220 * this.scale);
    context.lineTo(80 * this.scale, 160 * this.scale);
    context.lineTo(-80 * this.scale, 160 * this.scale);
    context.lineTo(0, 220 * this.scale);
    context.closePath();
    context.fill();
    context.stroke();

    context.restore();

  }

  calculate2MeterOffset(roomHeight, kneeWallHeight, slopeAngle) {
    const length = 2000 - kneeWallHeight;
    return Math.sin(slopeAngle / 180 * Math.PI) * (length / Math.sin((90 - slopeAngle) / 180 * Math.PI));
  }

  calculateSlopeDepth(roomHeight, kneeWallHeight, slopeAngle) {
    const length = roomHeight - kneeWallHeight;
    return Math.sin(slopeAngle / 180 * Math.PI) * (length / Math.sin((90 - slopeAngle) / 180 * Math.PI));
  }

  showDegrees(rad) {
    return Math.round(rad * (180 / Math.PI));
  }

  calculateLength(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2));
  }

  calculatePerpendicularLine(x1, x2, y1, y2, distance) {
    const AB = {x: x2 - x1, y: y2 - y1};
    const perpendicular = {x: AB.y, y: -AB.x};
    const perpendicularSize = Math.sqrt(AB.x * AB.x + AB.y * AB.y);
    const unit = {x: perpendicular.x / perpendicularSize, y: perpendicular.y / perpendicularSize};
    const sideVector = {x: unit.x * distance, y: unit.y * distance};
    return [
      {x: x1 + sideVector.x, y: y1 + sideVector.y},
      {x: x2 + sideVector.x, y: y2 + sideVector.y}
    ];
  }

  calculateDistanceFromWall(x, y, x1, y1, x2, y2) {

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) { // in case of 0 length line
      param = dot / lenSq;
    }

    let xx;
    let yy;

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

  calculatePositionAlongWall(A, B, distance) {
    const xLen = B.x - A.x;
    const yLen = B.y - A.y;
    const hLen = Math.sqrt(Math.pow(xLen, 2) + Math.pow(yLen, 2));
    const smallerLen = distance;
    const ratio = smallerLen / hLen;
    const smallerXLen = xLen * ratio;
    const smallerYLen = yLen * ratio;
    return {x: A.x + smallerXLen, y: A.y + smallerYLen};
  }

  drawTriangle(start) {
    this.context.rotate(start);
    this.context.beginPath();
    this.context.moveTo(0, 0);
    this.context.lineTo(30 * this.scale, 60 * this.scale);
    this.context.lineTo(-30 * this.scale, 60 * this.scale);
    this.context.lineTo(0, 0);
    this.context.stroke();
    this.context.fill();
  }

  invertAngle(angle) {
    return (angle + Math.PI) % (2 * Math.PI);
  }

  findAngle(c, b, a) {

    const ab = {x: b.x - a.x, y: b.y - a.y};
    const cb = {x: b.x - c.x, y: b.y - c.y};

    const dot = (ab.x * cb.x + ab.y * cb.y); // dot product
    const cross = (ab.x * cb.y - ab.y * cb.x); // cross product

    let alpha = Math.atan2(cross, dot);
    if (alpha < 0) {
      alpha = (Math.PI * 2 + alpha);
    }
    return alpha;
  }

  findWallAngle(A, B) {
    return Math.atan2(B.y - A.y, B.x - A.x);
  }

  areaFromCoords(ground) {

    let a = 0;
    let startPoint = 0;
    let endPoint = 0;

    for (const [index, corner] of ground.entries()) {
      startPoint = index;
      endPoint = index + 1;

      if (startPoint < 0) {
        startPoint = ground.length - 1;
      }
      if (endPoint > ground.length - 1) {
        endPoint = 0;
      }

      a += ground[startPoint].x * ground[endPoint].y - ground[startPoint].y * ground[endPoint].x;
    }
    a += ground[0].x * ground[ground.length - 1].y - ground[0].y * ground[ground.length - 1].x;

    return Math.abs(a / 2) / 1000;
  }

  setGrid(gridSize) {
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

  setInsetMeasurements(showInsetMeasurements: any) {
    this.showInsetMeasurements = showInsetMeasurements;
    this.planView();
  }

  setSlopes(showSlopes: any) {
    this.showSlopes = showSlopes;
    this.planView();
  }

  setGround(showGround: boolean) {
    this.showGround = showGround;
    this.planView();
  }

  setTools(showTools: boolean) {
    this.showTools = showTools;
    this.planView();
  }

  setCornerHandles(showCornerHandles: boolean) {
    this.showCornerHandles = showCornerHandles;
    this.planView();
  }

  setRoom(roomShape) {
    this.roomShape = roomShape;
    this.planView();
    this.autoZoomCentre();
    this.activeItem = {type: '', id: -1, poly: [], wall: -1, identity: -1};
    this.selectedItem.next(this.activeItem);
  }

  setInsets(showInsets: boolean) {
    this.showInsets = showInsets;
    this.drawInsets();
  }

  setGridVisible(showGrid: any) {
    this.showGrid = showGrid;
    this.planView();
  }

  setColours(showColours: boolean) {
    this.showColours = showColours;
    this.planView();
  }

  private checkCollisions(event: any, touchEvents) {
    const [x, y] = this.returnPosition(event, touchEvents);
    const arr = this.itemDefinitions.reverse();
    for (const item of arr) {
      if (this.pointIsInPoly({x, y}, item.poly)) {
        if (item.type === 'control') {
          event.preventDefault();
          setTimeout(() => {
            console.log('Control Point');
            console.log(this.activeItem);
          }, 200);
          return;

        } else {

          this.activeItem = item;
          this.selectedItem.next(this.activeItem);

          if (item.type === 'wall') {
            this.isDragging = false;
            return;
          }
          if (item.type === 'ground') {
            return;
          }
          if (item.type === 'slope') {
            return;
          }
          if (item.type === 'inset') {
            // for (const [index, opening] of this.roomShape.insets[item.id].openings.entries()) {
            //   if (opening.state === 'open') {
            //     this.closeInsets(this.roomShape.insets[item.id], index);
            //   } else if (opening.state === 'closed') {
            //     this.openInsets(this.roomShape.insets[item.id], index);
            //   }
            // }
            this.dragItem = item;
            console.log('inset handle', item.poly);
            // this.dragItem.centoid = this.getPolygonCentroid(item.poly);
            this.isDragging = false;
            return;
          }

          if (item.type === 'grabHandle') {
            this.dragItem = item;
            console.log('grab handle', item.origin.x, item.origin.y);
            this.isDragging = false;
            return;
          }
        }
      }
      this.activeItem = {type: '', id: -1, poly: [], wall: -1, identity: -1};
      this.selectedItem.next(this.activeItem);
    }
  }

  getPolygonCentroid(inPts) {
    const pts = JSON.parse(JSON.stringify((inPts)));
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.x !== last.x || first.y !== last.y) {
      pts.push(first);
    }
    let twiceArea = 0;
    let x = 0;
    let y = 0;
    const nPts = pts.length;
    let p1;
    let p2;
    let f;
    for (let i = 0, j = nPts - 1; i < nPts; j = i++) {
      p1 = pts[i];
      p2 = pts[j];
      f = p1.x * p2.y - p2.x * p1.y;
      twiceArea += f;
      x += (p1.x + p2.x) * f;
      y += (p1.y + p2.y) * f;
    }
    f = twiceArea * 3;
    return {x: x / f, y: y / f};
  }

  pointIsInPoly(p, polygon) {
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

    if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
      return false;
    }


    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (
        (polygon[i].y > p.y) !== (polygon[j].y > p.y) &&
        p.x < (polygon[j].x - polygon[i].x) * (p.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x
      ) {
        isInside = !isInside;
      }
    }

    return isInside;
  }

  openInsets(inset, id) {
    const opening = inset.openings[id];
    if (typeof opening !== 'undefined') {
      if (opening.degreesOpen < opening.maxDegree) {
        opening.state = 'opening';
        setTimeout(() => {
          opening.degreesOpen = Math.ceil(0.05 + opening.degreesOpen * 1.025);
          if (opening.degreesOpen > opening.maxDegree) {
            opening.degreesOpen = opening.maxDegree;
          }
          this.drawInsets(false);
          this.openInsets(inset, id);
        });
      } else {
        opening.state = 'open';
      }
    }
  }

  closeInsets(inset, id) {
    const opening = inset.openings[id];
    if (typeof opening !== 'undefined') {
      if (opening.degreesOpen > opening.minDegree) {
        opening.state = 'closing';
        setTimeout(() => {
          opening.degreesOpen = Math.floor(opening.degreesOpen / 1.025 - 0.05);
          if (opening.degreesOpen < opening.minDegree) {
            opening.degreesOpen = opening.minDegree;
          }
          this.drawInsets(false);
          this.closeInsets(inset, id);
        });
      } else {
        opening.state = 'closed';
      }
    }
  }


  onPinchStart(event: any) {
    this.centerX = event.center.x;
    this.centerY = event.center.y;
    this.lastScale = event.scale;
  }

  onPinchEnd(event: any) {

  }

  onPinch(event: any) {
    const zoom = Math.exp(event.scale - this.lastScale);
    if (this.scale > 2) {
      this.scale = 2;
      return false;
    }
    if (this.scale < 0.05) {
      this.scale = 0.05;
      return false;
    }
    if ((this.scale > 0.05 || (event.scale - this.lastScale) > 0) && (this.scale < 2 || (event.scale - this.lastScale) < 0)) {

      this.scale *= zoom;
      this.viewPortX += (this.centerX / (this.scale * zoom) - (this.centerX / this.scale)) * 1.666;
      this.viewPortY += (this.centerY / (this.scale * zoom) - (this.centerY / this.scale)) * 1.666;
      this.zoomLevel = this.scale;
      this.zoomLevelChange.next(this.zoomLevel);

      this.lastScale = event.scale;

      this.planView();
    }
  }


  setMode(mode: string) {
    this.mode = mode;
    this.planView();
  }

  setRulers(showRulers: boolean) {
    this.showRulers = showRulers;
    this.planView();
  }

  updateFlooring(showFlooring: any) {
    this.showFlooring = showFlooring;
    this.planView();
  }

  updateFloorAngle(floorAngle: any) {
    this.floorAngle = floorAngle * (Math.PI / 180);
    this.planView();
  }

  updateFloorGap(floorGap: any) {
    this.floorGap = floorGap;
    this.planView();
  }

  updateFloorPositionX(floorPositionX: any) {
    this.floorPositionX = floorPositionX;
    this.planView();
  }

  updateFloorPositionY(floorPositionY: any) {
    this.floorPositionY = floorPositionY;
    this.planView();
  }

  updateFloorOffset(offset: any) {
    this.floorOffset = offset;
    this.planView();
  }

  updateFloorWidth(floorWidth: number) {
    this.floorWidth = floorWidth;
    this.planView();
  }

  updateFloorHeight(floorHeight: number) {
    this.floorHeight = floorHeight;
  }

  updateSnapToGrid(snapToGrid: any) {
    this.snapToGrid = snapToGrid;
  }

  setFreeEdit() {
    this.freeEdit = !this.freeEdit;
    // this.showTools = this.freeEdit;
    this.showCornerHandles = this.freeEdit;
    this.planView();
    return this.freeEdit;
  }

  updateLocks(showLocks: boolean) {
    this.showLocks = showLocks;
    this.planView();
  }

  updateInsetOpenings(showInsetOpenings: boolean) {
    this.showInsetOpenings = showInsetOpenings;
    this.planView();
  }
}
