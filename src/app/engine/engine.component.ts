import {Component, AfterViewInit, ViewChild, Input, ElementRef, OnInit} from '@angular/core';
import {Engine2dService} from './engine2d/engine2d.service';
import {ApiService} from '../services/api.service';

@Component({
  selector: 'app-engine',
  templateUrl: './engine.component.html',
  styleUrls: ['./engine.component.css']
})

export class EngineComponent implements OnInit {

  roomShape;
  roomShape1 = {
    path: [
      {x: 0, y: 0},
      {x: 3333.3333333333333335, y: 0},
      {x: 5000, y: 1666.6666666666666667},
      {x: 5000, y: 5000},
      {x: 0, y: 5000}
    ],
    slopes: [
      {wall: 4, kneeWallHeight: 2000, roofAngle: 45},
      {wall: 3, kneeWallHeight: 2000, roofAngle: 45},
      {wall: 1, kneeWallHeight: 1400, roofAngle: 45}
    ],
    wallThickness: 200,
    roomHeight: 2400,
    insets: [
      {
        wall: 0,
        locked: true,
        type: 'window',
        openings: [
          {
            identity: 'Left Window',
            open: 'outwards',
            hanging: 'left',
            displacement: 0,
            degreesOpen: 45,
            minDegree: 0,
            maxDegree: 135,
            width: 500,
            height: 500,
            state: 'open'
          },
          {
            identity: 'Top Window',
            open: 'outwards',
            hanging: 'top',
            displacement: 500,
            degreesOpen: 45,
            minDegree: 0,
            maxDegree: 45,
            width: 500,
            height: 200,
            state: 'open'
          }
        ],
        positionLeft: 1000,
        positionGround: 1066,
        width: 1000,
        height: 962
      },
      {
        wall: 1,
        locked: false,
        type: 'door',
        openings: [
          {
            identity: 'Left Door',
            open: 'outwards',
            hanging: 'left',
            displacement: 0,
            degreesOpen: 135,
            minDegree: 0,
            maxDegree: 135,
            width: 762,
            height: 500,
            state: 'open'
          },
          {
            identity: 'Right Door',
            open: 'outwards',
            hanging: 'right',
            displacement: 1524,
            degreesOpen: 0,
            minDegree: 0,
            maxDegree: 135,
            width: 762,
            state: 'closed'
          }
        ],
        positionLeft: 416.5,
        positionGround: 0,
        width: 1524,
        height: 1981
      },
      {
        wall: 2,
        locked: false,
        type: 'window',
        openings: [
          {
            identity: 'Left Window',
            open: 'outwards',
            hanging: 'left',
            displacement: 0,
            degreesOpen: 45,
            minDegree: 0,
            maxDegree: 135,
            width: 500,
            height: 500,
            state: 'open'
          },
          {
            identity: 'Top Window',
            open: 'outwards',
            hanging: 'top',
            displacement: 500,
            degreesOpen: 45,
            minDegree: 0,
            maxDegree: 45,
            width: 500,
            height: 200,
            state: 'open'
          }
        ],
        positionLeft: 1000,
        positionGround: 1066,
        width: 1000,
        height: 962
      },
      {
        wall: 3,
        locked: false,
        type: 'door',
        openings: [
          {
            identity: 'Door',
            open: 'inwards',
            hanging: 'right',
            displacement: 762,
            degreesOpen: 90,
            minDegree: 0,
            maxDegree: 90,
            width: 762,
            height: 500,
            state: 'open'
          }
        ],
        positionLeft: 2000,
        positionGround: 0,
        width: 762,
        height: 1981
      },
      {
        wall: 4,
        locked: false,
        type: 'door',
        openings: [
          {
            identity: 'Door',
            open: 'inwards',
            hanging: 'left',
            displacement: 0,
            degreesOpen: 90,
            minDegree: 0,
            maxDegree: 90,
            width: 762,
            height: 500,
            state: 'open'
          }
        ],
        positionLeft: 2000,
        positionGround: 0,
        width: 762,
        height: 1981
      },
    ]
  };

  roomShape2 = {
    path: [
      {x: 0, y: 0},
      {x: 4000, y: 0},
      {x: 4000, y: 2000},
      {x: 5000, y: 2000},
      {x: 5000, y: 5000},
      {x: 3000, y: 5000},
      {x: 3000, y: 3000},
      {x: 0, y: 3000}
    ],
    slopes: [
      {wall: 4, kneeWallHeight: 2000, roofAngle: 45},
      {wall: 3, kneeWallHeight: 2000, roofAngle: 45},
      {wall: 1, kneeWallHeight: 1400, roofAngle: 45}
    ],
    wallThickness: 200,
    roomHeight: 2400,
    insets: [
      {
        wall: 1,
        locked: false,
        type: 'door',
        openings: [
          {
            identity: 'Door',
            open: 'inwards',
            hanging: 'right',
            displacement: 762,
            degreesOpen: 90,
            minDegree: 0,
            maxDegree: 90,
            width: 762,
            height: 500,
            state: 'open'
          }
        ],
        positionLeft: 500,
        positionGround: 0,
        width: 762,
        height: 1981
      },
      {
        wall: 4,
        locked: false,
        type: 'door',
        openings: [
          {
            identity: 'Door',
            open: 'inwards',
            hanging: 'left',
            displacement: 0,
            degreesOpen: 90,
            minDegree: 0,
            maxDegree: 90,
            width: 762,
            height: 500,
            state: 'open'
          }
        ],
        positionLeft: 650,
        positionGround: 0,
        width: 762,
        height: 1981
      },
      {
        wall: 2,
        locked: false,
        type: 'door',
        openings: [
          {
            identity: 'Door',
            open: 'outwards',
            hanging: 'right',
            displacement: 762,
            degreesOpen: 90,
            minDegree: 0,
            maxDegree: 90,
            width: 762,
            height: 500,
            state: 'open'
          }
        ],
        positionLeft: 220,
        positionGround: 0,
        width: 762,
        height: 1981
      },
      {
        wall: 3,
        locked: false,
        type: 'door',
        openings: [
          {
            identity: 'Door',
            open: 'outwards',
            hanging: 'left',
            displacement: 0,
            degreesOpen: 90,
            minDegree: 0,
            maxDegree: 90,
            width: 762,
            height: 500,
            state: 'open'
          }
        ],
        positionLeft: 650,
        positionGround: 0,
        width: 762,
        height: 1981
      }
    ]
  };

  roomShape3 = {
    path: [
      {x: 0, y: 0},
      {x: 6000, y: 0},
      {x: 6000, y: 3000},
      {x: 4200, y: 3000},
      {x: 4200, y: 4200},
      {x: 1800, y: 4200},
      {x: 1800, y: 3000},
      {x: 0, y: 3000}
    ],
    roomHeight: 2500,
    wallThickness: 200,
    slopes: [
      {wall: 4, kneeWallHeight: 2000, roofAngle: 45},
      {wall: 3, kneeWallHeight: 2000, roofAngle: 45},
      {wall: 1, kneeWallHeight: 1400, roofAngle: 45}
    ],
    insets: [
      {
        wall: 0,
        locked: false,
        type: 'door',
        openings: [
          {
            identity: 'Right Door',
            open: 'inwards',
            hanging: 'right',
            displacement: 1524,
            degreesOpen: 135,
            minDegree: 0,
            maxDegree: 135,
            width: 762,
            state: 'open'
          },
          {
            identity: 'Left Door',
            open: 'inwards',
            hanging: 'left',
            displacement: 0,
            degreesOpen: 135,
            minDegree: 0,
            maxDegree: 135,
            width: 762,
            height: 500,
            state: 'open'
          }
        ],
        positionLeft: 2238,
        positionGround: 0,
        width: 1524,
        height: 1981
      },
      {
        wall: 1,
        locked: false,
        type: 'door',
        openings: [
          {
            identity: 'Door',
            open: 'inwards',
            hanging: 'right',
            displacement: 762,
            degreesOpen: 90,
            minDegree: 0,
            maxDegree: 90,
            width: 762,
            height: 500,
            state: 'open'
          }
        ],
        positionLeft: 1100,
        positionGround: 0,
        width: 762,
        height: 1981
      },
      {
        wall: 4,
        locked: false,
        type: 'door',
        openings: [
          {
            identity: 'Door',
            open: 'inwards',
            hanging: 'left',
            displacement: 0,
            degreesOpen: 90,
            minDegree: 0,
            maxDegree: 90,
            width: 762,
            height: 500,
            state: 'open'
          }
        ],
        positionLeft: 850,
        positionGround: 0,
        width: 762,
        height: 1981
      },
      {
        wall: 7,
        locked: false,
        type: 'window',
        openings: [
          {
            identity: 'Window',
            open: 'outwards',
            hanging: 'left',
            displacement: 0,
            degreesOpen: 45,
            minDegree: 0,
            maxDegree: 135,
            width: 460,
            height: 500,
            state: 'open'
          }
        ],
        positionLeft: 1000,
        positionGround: 1066,
        width: 1000,
        height: 962
      }
    ]
  };

  zoomLevel = 0;
  selectedItem = {
    type: '', id: -1, poly: [], wall: -1, identity: -1, inset: {
      openings: [],
      positionLeft: 0,
      positionGround: 0,
      width: 0,
      height: 0,
      wall: 0,
      locked: false
    }
  };

  gridSizes = [
    {
      label: '100mm',
      value: 100
    }, {
      label: '200mm',
      value: 200
    }, {
      label: '250mm',
      value: 250
    }, {
      label: '500mm',
      value: 500
    }, {
      label: '1000mm',
      value: 1000
    }
  ];
  gridSize = 1000;
  itemDetails = [];

  showMeasurements;
  showCorners;
  showLetters;
  showArea;
  showWalls;
  wallWidth = 200;
  showSlopes;
  showGround;
  showTools;
  showCornerHandles;
  showInsets;
  showGrid;
  showInsetMeasurements;
  showColours;
  mode = 'all';
  walls: unknown = [];
  showRulers;
  showFlooring: any;
  floorAngle = 0;
  floorGap = 0;
  floorOffset = 0;
  floorPositionX = 0;
  floorPositionY = 0;
  floorWidth = 1000;
  floorHeight = 500;
  freeEdit = false;
  snapToGrid: any;
  wallsList: any[];
  showLocks = true;
  showInsetOpenings = false;

  constructor(
    public engineService: Engine2dService,
    private apiService: ApiService
  ) {
  }

  ngOnInit() {

    this.apiService.call('/test', 'post', {demo: true}, 'aaa').subscribe((object: any) => {
      console.log('OBJECT', object);
    });

    this.engineService.wallsList$.subscribe((walls) => {
      this.walls = walls;
      this.wallsList = [];

      // @ts-ignore
      // tslint:disable-next-line:forin
      for (const wall in this.walls) {
        this.wallsList.push({
          label: String.fromCharCode(65 + parseInt(wall, 10)),
          value: parseInt(wall, 10)
        });
      }
    });

    this.engineService.selectedItem$.subscribe((item) => {
      // @ts-ignore
      this.selectedItem = item;
      this.itemDetails = [];
      if (this.selectedItem.wall > -1) {
        this.itemDetails.push('Wall ' + String.fromCharCode(65 + this.selectedItem.wall));
      }

      if (this.selectedItem.wall === -99) {
        this.itemDetails.push('Ground');
      }

      if (this.selectedItem.type === 'inset') {
        this.itemDetails.push(this.selectedItem.identity);

      }
      if (this.selectedItem.type === 'slope') {
        this.itemDetails.push(this.selectedItem.identity);

      }
    });
    this.roomShape = this.roomShape1;

    this.showMeasurements = this.engineService.showMeasurements;
    this.showCorners = this.engineService.showCorners;
    this.showLetters = this.engineService.showLetters;
    this.showArea = this.engineService.showArea;
    this.showWalls = this.engineService.showWalls;
    this.showSlopes = this.engineService.showSlopes;
    this.showGround = this.engineService.showGround;
    this.showTools = this.engineService.showTools;
    this.showCornerHandles = this.engineService.showCornerHandles;
    this.showInsets = this.engineService.showInsets;
    this.showGrid = this.engineService.showGrid;
    this.showInsetMeasurements = this.engineService.showInsetMeasurements;
    this.showColours = this.engineService.showColours;
    this.showRulers = this.engineService.showRulers;
    this.showFlooring = this.engineService.showFlooring;
    this.showLocks = this.engineService.showLocks;
    this.showInsetOpenings = this.engineService.showInsetOpenings;
  }

  autoZoom() {
    this.engineService.autoZoom();
  }

  autoCentre() {
    this.engineService.autoCentre();
  }

  autoZoomCentre() {
    this.engineService.autoZoomCentre();
  }

  zoomIn() {
    this.engineService.zoomLevel = this.zoomLevel;
    this.engineService.zoomIn();
  }

  setGrid($event: any) {
    this.engineService.setGrid(this.gridSize);
  }

  setZoomLevel(zoomLevel) {
    this.zoomLevel = zoomLevel;
  }

  updateMeasurements($event: any) {
    this.engineService.setMeasurements(this.showMeasurements);
  }

  updateCorners($event: any) {
    this.engineService.setCorners(this.showCorners);
  }

  updateLetters($event: any) {
    this.engineService.setLetters(this.showLetters);
  }

  updateArea($event: any) {
    this.engineService.setArea(this.showArea);
  }

  updateWalls($event: any) {
    this.engineService.setWalls(this.showWalls);
  }

  setWallWidth() {
    this.engineService.setWallWidth(this.wallWidth);
  }

  updateSlopes($event: any) {
    this.engineService.setSlopes(this.showSlopes);
  }

  updateGround($event: any) {
    this.engineService.setGround(this.showGround);
  }

  updateTools($event: any) {
    this.engineService.setTools(this.showTools);
  }

  updateCornerHandles($event: any) {
    this.engineService.setCornerHandles(this.showCornerHandles);
  }

  setRoomShape(shape: number) {
    if (shape === 1) {
      this.engineService.setRoom(this.roomShape1);
    }
    if (shape === 2) {
      this.engineService.setRoom(this.roomShape2);
    }
    if (shape === 3) {
      this.engineService.setRoom(this.roomShape3);
    }
  }

  updateInsets($event: any) {
    this.engineService.setInsets(this.showInsets);
  }

  updateGrid($event: any) {
    this.engineService.setGridVisible(this.showGrid);
  }

  updateInsetMeasurements($event: any) {
    this.engineService.setInsetMeasurements(this.showInsetMeasurements);
  }

  updateColours($event: any) {
    this.engineService.setColours(this.showColours);
  }

  setMode(mode: string) {
    this.mode = mode;
    this.engineService.setMode(this.mode);
  }

  updatePlan() {
    this.engineService.planView();
  }

  openInsets(inset, id) {
    this.engineService.openInsets(inset, id);
  }

  closeInsets(inset, id) {
    this.engineService.closeInsets(inset, id);
  }

  updateRulers($event: any) {
    this.engineService.setRulers(this.showRulers);

  }

  updateFlooring($event: any) {
    this.engineService.updateFlooring(this.showFlooring);
  }

  updateFloorAngle() {
    this.engineService.updateFloorAngle(this.floorAngle);
  }

  updateFloorPositionX() {
    this.engineService.updateFloorPositionX(this.floorPositionX);
  }

  updateFloorPositionY() {
    this.engineService.updateFloorPositionY(this.floorPositionY);
  }

  updateFloorGap() {
    this.engineService.updateFloorGap(this.floorGap);
  }

  updateFloorOffset() {
    this.engineService.updateFloorOffset(this.floorOffset);
  }

  updateFloorWidth() {
    this.engineService.updateFloorWidth(this.floorWidth);

  }

  updateFloorHeight() {
    this.engineService.updateFloorHeight(this.floorHeight);

  }

  setFreeEdit() {
    this.freeEdit = this.engineService.setFreeEdit();
  }

  setSnapToGrid($event: any) {
    this.engineService.updateSnapToGrid(this.snapToGrid);
  }

  updateLocks($event: any) {
    this.engineService.updateLocks(this.showLocks);

  }

  updateInsetOpenings($event: any) {
    this.engineService.updateInsetOpenings(this.showInsetOpenings);
  }
}

