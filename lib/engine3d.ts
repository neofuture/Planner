import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { FloorPlan, Point, Opening, CeilingLight } from "./types";
import { DOOR_PRESETS, getPerimeter, getCeilingHeight } from "./types";

type RoomShape = FloorPlan;

const MM_TO_M = 0.001;
const EYE_HEIGHT = 1.732;
const KNEEL_HEIGHT = 1.232;
const WALK_SPEED = 2.5;
const PLAYER_RADIUS = 0.35;

interface CollisionSeg {
  ax: number; az: number;
  bx: number; bz: number;
  nx: number; nz: number;
}

interface DoorPivotRef {
  pivot: THREE.Group;
  opening: Opening;
  leftHung: boolean;
  outward: boolean;
  targetDeg: number;
  centerOffset: number; // X offset from pivot to door center (for detection)
}

let engineIdCounter = 0;

export class Engine3d {
  private _id = ++engineIdCounter;
  private renderer!: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private _canvas: HTMLCanvasElement | null = null;
  private _isDragging = false;
  private _hasFocus = false;
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private animationId: number | null = null;
  private roomGroup = new THREE.Group();
  private doorPivots: DoorPivotRef[] = [];
  private doorMeshes: THREE.Object3D[] = [];
  private collisionSegs: CollisionSeg[] = [];
  private currentRoomShape: RoomShape | null = null;
  private needsCollisionRebuild = false;
  private _disposed = false;
  private keys: Record<string, boolean> = {};
  private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _onKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private _onMouseDown: ((e: MouseEvent) => void) | null = null;
  private _onMouseUp: ((e: MouseEvent) => void) | null = null;
  private _onMouseMove: ((e: MouseEvent) => void) | null = null;
  private _targetYaw = 0;
  private _targetPitch = 0;
  private _currentYaw = 0;
  private _currentPitch = 0;
  private _minPitch = 0;
  private _maxPitch = 0;
  private _lookEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private _moveVec = new THREE.Vector3();
  invertY = false;
  kneeling = false;
  onKneelChange: ((kneeling: boolean) => void) | null = null;
  
  private _nightMode = false;
  private ambientLight: THREE.AmbientLight | null = null;
  private hemisphereLight: THREE.HemisphereLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private ceilingLights: THREE.Light[] = [];

  private wallExtMat = new THREE.MeshStandardMaterial({
    name: "wallExt",
    color: 0x8a8a8a,
    roughness: 0.85,
    metalness: 0,
  });

  private wallIntMat = new THREE.MeshStandardMaterial({
    name: "wallInt",
    color: 0xf1e1cc,
    roughness: 0.9,
    metalness: 0,
  });

  private floorMat = new THREE.MeshStandardMaterial({
    name: "floor",
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  
  private floorTexture: THREE.Texture | null = null;
  private floorTexturePath = "/textures/flooring/floor-wood-1.jpg";

  private ceilingMat = new THREE.MeshStandardMaterial({
    name: "ceiling",
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0,
    side: THREE.DoubleSide,
    shadowSide: THREE.BackSide,
  });

  private mouldingMat = new THREE.MeshStandardMaterial({
    name: "moulding",
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0,
    side: THREE.DoubleSide,
    shadowSide: THREE.FrontSide,
  });

  private glassMat = new THREE.MeshPhysicalMaterial({
    name: "glass",
    color: 0xffffff,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.92,
    thickness: 0.006,
    ior: 1.52,
    side: THREE.DoubleSide,
  });

  private frameMat = new THREE.MeshStandardMaterial({
    name: "frame",
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  private doorMat = new THREE.MeshStandardMaterial({
    name: "door",
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0,
  });

  private doorPanelMat = new THREE.MeshStandardMaterial({
    name: "doorPanel",
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0,
  });

  private handleMat = new THREE.MeshStandardMaterial({
    name: "handle",
    color: 0xc0c0c0,
    roughness: 0.15,
    metalness: 0.95,
  });

  // Light fixture materials
  private lightFixtureMat = new THREE.MeshStandardMaterial({
    name: "lightFixture",
    color: 0x1a1a1a,
    roughness: 0.3,
    metalness: 0.8,
  });

  private lightBulbMat = new THREE.MeshStandardMaterial({
    name: "lightBulb",
    color: 0xfff4e0,
    emissive: 0xffc66d,
    emissiveIntensity: 2.0,
    roughness: 0.2,
    metalness: 0,
  });

  private spotlightRimMat = new THREE.MeshStandardMaterial({
    name: "spotlightRim",
    color: 0xffffff,
    roughness: 0.05,
    metalness: 1.0,
  });

  private cableMat = new THREE.MeshStandardMaterial({
    name: "cable",
    color: 0x1a1a1a,
    roughness: 0.6,
    metalness: 0,
  });

  private envMap: THREE.Texture | null = null;
  private groundMesh: THREE.Mesh | null = null;
  private composer: EffectComposer | null = null;
  private gtaoPass: GTAOPass | null = null;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.01, 200);
  }

  start(canvas: HTMLCanvasElement, roomShape: RoomShape) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.setupEnvironment();
    this.setupLighting();
    this.addGroundPlane();
    this.loadFloorTexture();
    this.setupPostProcessing();

    this._canvas = canvas;
    
    const minPolar = Math.PI * 0.15;
    const maxPolar = Math.PI * 0.85;
    this._minPitch = Math.PI / 2 - maxPolar;
    this._maxPitch = Math.PI / 2 - minPolar;
    
    // WASD and arrow keys always active when 3D preview is open
    this._hasFocus = true;
    
    this._onKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      
      this.keys[e.code] = true;
      // Prevent arrow keys from scrolling when 3D is active
      if (e.code.startsWith("Arrow") || e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD") {
        e.preventDefault();
      }
      // E key for door interaction
      if (e.code === "KeyE") {
        this.interactDoor();
      }
      // Shift key for kneeling
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        this.kneeling = true;
        this.onKneelChange?.(true);
        this.requestRender();
      }
    };
    this._onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
      // Release shift to stand up
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        this.kneeling = false;
        this.onKneelChange?.(false);
        this.requestRender();
      }
    };
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
    
    // Mouse drag for look - only when button is pressed
    // Track time to distinguish click (door) vs drag (look)
    let mouseDownTime = 0;
    let pendingDoorHit: DoorPivotRef | null = null;
    const CLICK_TIME_MS = 400; // ms - clicks shorter than this toggle doors
    
    this._onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      this._isDragging = true;
      mouseDownTime = performance.now();
      
      // Raycast to find what we actually clicked on using mouse position
      this.camera.updateMatrixWorld(true);
      this.scene.updateMatrixWorld(true);
      
      // Convert mouse position to normalized device coordinates (-1 to +1)
      const rect = canvas.getBoundingClientRect();
      const mouseNDC = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      this.raycaster.setFromCamera(mouseNDC, this.camera);
      
      // Raycast against door meshes specifically (doors and their frames)
      const hits = this.raycaster.intersectObjects(this.doorMeshes, false);
      
      pendingDoorHit = null;
      
      // Find first hit that has a doorRef
      for (const hit of hits) {
        if (hit.distance > 5) break; // Max 5m range
        const ref = hit.object.userData.doorRef as DoorPivotRef | undefined;
        if (ref) {
          pendingDoorHit = ref;
          break;
        }
      }
      
      canvas.focus();
      // Request pointer lock for smooth FPS-style camera control
      canvas.requestPointerLock();
    };
    this._onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const wasDragging = this._isDragging;
      const hitRef = pendingDoorHit;
      const clickDuration = performance.now() - mouseDownTime;
      this._isDragging = false;
      pendingDoorHit = null;
      // Release pointer lock
      document.exitPointerLock();
      // Quick click with door target = toggle door
      if (wasDragging && clickDuration < CLICK_TIME_MS && hitRef) {
        const op = hitRef.opening;
        if (hitRef.targetDeg > op.minDegree) {
          hitRef.targetDeg = op.minDegree;
          op.state = "closed";
        } else {
          hitRef.targetDeg = op.maxDegree;
          op.state = "open";
        }
      }
    };
    this._onMouseMove = (e: MouseEvent) => {
      if (!this._isDragging) return;
      // Rotate camera while dragging (movementX/Y work with pointer lock)
      this._targetYaw -= e.movementX * 0.002;
      this._targetPitch += e.movementY * 0.002 * (this.invertY ? 1 : -1);
      this._targetPitch = Math.max(this._minPitch, Math.min(this._maxPitch, this._targetPitch));
    };
    canvas.addEventListener("mousedown", this._onMouseDown);
    document.addEventListener("mouseup", this._onMouseUp);
    document.addEventListener("mousemove", this._onMouseMove);

    this.buildRoom(roomShape);
    this.pointCamera(roomShape);

    this.clock.start();
    this.resize();
    this.animate();
  }

  focus() {
    this._canvas?.focus();
  }

  get hasFocus(): boolean {
    return this._hasFocus;
  }
  
  get isDragging(): boolean {
    return this._isDragging;
  }

  private pointCamera(roomShape: RoomShape) {
    const c = this.centroid(getPerimeter(roomShape));
    const cx = c.x * MM_TO_M;
    const cz = c.y * MM_TO_M;

    const eyeY = this.kneeling ? KNEEL_HEIGHT : EYE_HEIGHT;
    this.camera.position.set(cx, eyeY, cz);

    const p0 = getPerimeter(roomShape)[0];
    const p1 = getPerimeter(roomShape)[1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    this.camera.lookAt(cx + dx / len, eyeY, cz + dy / len);

    this._lookEuler.setFromQuaternion(this.camera.quaternion);
    this._targetYaw = this._currentYaw = this._lookEuler.y;
    this._targetPitch = this._currentPitch = this._lookEuler.x;
  }


  private loadFloorTexture() {
    const loader = new THREE.TextureLoader();
    loader.load(
      this.floorTexturePath,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(5, 5);
        texture.colorSpace = THREE.SRGBColorSpace;
        this.floorTexture = texture;
        this.floorMat.map = texture;
        this.floorMat.needsUpdate = true;
        this._needsRender = true;
      },
      undefined,
      (err) => {
        console.warn("Failed to load floor texture:", err);
      }
    );
  }

  setFloorTexture(path: string) {
    this.floorTexturePath = path;
    this.loadFloorTexture();
  }

  private setupEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();

    const skyGeo = new THREE.SphereGeometry(50, 128, 64);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0xd8d4d0,
      side: THREE.BackSide,
    });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));

    const gMat = new THREE.MeshBasicMaterial({ color: 0xb0a898 });
    const gMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      gMat
    );
    gMesh.rotation.x = -Math.PI / 2;
    gMesh.position.y = -1;
    envScene.add(gMesh);

    this.envMap = pmrem.fromScene(envScene, 0, 0.1, 100).texture;
    pmrem.dispose();

    // Only assign env map to materials that need reflections (glass, metal).
    // Do NOT set scene.environment — the sphere tessellation causes visible
    // banding/ridges on painted surfaces even at low intensity.
    this.glassMat.envMap = this.envMap;
    this.handleMat.envMap = this.envMap;
    this.spotlightRimMat.envMap = this.envMap;
  }

  private addGroundPlane() {
    const geo = new THREE.PlaneGeometry(60, 60);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4a6832,
      roughness: 0.95,
      metalness: 0,
    });
    this.groundMesh = new THREE.Mesh(geo, mat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.01;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);
    
    this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xf0ebe0, 0.5);
    this.scene.add(this.hemisphereLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.8);
    this.sunLight.position.set(-8, 15, -10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.setScalar(4096);
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 60;
    this.sunLight.shadow.camera.left = -20;
    this.sunLight.shadow.camera.right = 20;
    this.sunLight.shadow.camera.top = 20;
    this.sunLight.shadow.camera.bottom = -20;
    this.sunLight.shadow.bias = -0.0001;
    this.sunLight.shadow.normalBias = 0.004;
    this.sunLight.shadow.radius = 2;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.fillLight = new THREE.DirectionalLight(0xfff0e0, 0.3);
    this.fillLight.position.set(6, 8, 12);
    this.scene.add(this.fillLight);
  }

  private setupPostProcessing() {
    const el = this.renderer.domElement.parentElement;
    const w = el?.clientWidth ?? 1;
    const h = el?.clientHeight ?? 1;

    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  setNightMode(enabled: boolean) {
    this._nightMode = enabled;
    
    if (enabled) {
      if (this.ambientLight) this.ambientLight.intensity = 0.12;
      if (this.hemisphereLight) this.hemisphereLight.intensity = 0.08;
      if (this.sunLight) this.sunLight.intensity = 0;
      if (this.fillLight) this.fillLight.intensity = 0;
      this.scene.background = new THREE.Color(0x050508);
      
      for (const light of this.ceilingLights) {
        const base = light.userData.baseIntensity ?? 15;
        light.intensity = base * 5;
      }
    } else {
      if (this.ambientLight) this.ambientLight.intensity = 0.4;
      if (this.hemisphereLight) this.hemisphereLight.intensity = 0.5;
      if (this.sunLight) this.sunLight.intensity = 1.8;
      if (this.fillLight) this.fillLight.intensity = 0.3;
      this.scene.background = new THREE.Color(0x87ceeb);
      
      for (const light of this.ceilingLights) {
        const base = light.userData.baseIntensity ?? 15;
        light.intensity = base;
      }
    }
    
    this.requestRender();
  }
  
  get nightMode() {
    return this._nightMode;
  }

  buildRoom(roomShape: RoomShape) {
    this.disposeGroup(this.roomGroup);
    this.scene.remove(this.roomGroup);
    this.roomGroup = new THREE.Group();
    this.doorPivots = [];
    this.doorMeshes = [];
    this.ceilingLights = [];
    this.currentRoomShape = roomShape;

    this.addFloor(roomShape);
    this.addWalls(roomShape);
    this.addSkirting(roomShape);
    this.addCeiling(roomShape);
    this.addLights(roomShape);
    this.buildCollision(roomShape);

    this.scene.add(this.roomGroup);
    this._needsRender = true;
  }

  private buildCollision(roomShape: RoomShape) {
    this.collisionSegs = [];
    const pts = getPerimeter(roomShape);
    const wallT = roomShape.wallThickness * MM_TO_M;

    let signedArea2 = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      signedArea2 += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    const windSign = signedArea2 > 0 ? 1 : -1;

    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const wx1 = p1.x * MM_TO_M;
      const wz1 = p1.y * MM_TO_M;
      const wx2 = p2.x * MM_TO_M;
      const wz2 = p2.y * MM_TO_M;
      const dx = wx2 - wx1;
      const dz = wz2 - wz1;
      const wallLen = Math.sqrt(dx * dx + dz * dz);
      if (wallLen < 0.001) continue;
      const ux = dx / wallLen;
      const uz = dz / wallLen;
      const nx = windSign * (-uz);
      const nz = windSign * ux;

      // Offset collision line to interior wall face
      const offX = nx * wallT;
      const offZ = nz * wallT;

      // Only create gaps for individual door openings that are open enough to walk through
      const MIN_OPEN_DEGREES = 45;
      const gaps: { s: number; e: number }[] = [];
      const doors = roomShape.insets.filter(
        (ins) => ins.wall === i && ins.type === "door"
      );
      for (const door of doors) {
        const doorLeft = door.positionLeft * MM_TO_M;
        for (const op of door.openings) {
          if (op.degreesOpen >= MIN_OPEN_DEGREES) {
            // Calculate the span this opening covers within the door
            const opDisp = op.displacement * MM_TO_M;
            const opWidth = op.width * MM_TO_M;
            // Opening spans from displacement to displacement + width
            gaps.push({
              s: doorLeft + opDisp,
              e: doorLeft + opDisp + opWidth,
            });
          }
        }
      }
      gaps.sort((a, b) => a.s - b.s);

      const segs: { s: number; e: number }[] = [];
      let cursor = 0;
      for (const g of gaps) {
        if (g.s > cursor + 0.001) segs.push({ s: cursor, e: g.s });
        cursor = Math.max(cursor, g.e);
      }
      if (wallLen - cursor > 0.001) segs.push({ s: cursor, e: wallLen });

      for (let si = 0; si < segs.length; si++) {
        const sa = si === 0 ? segs[si].s - PLAYER_RADIUS : segs[si].s;
        const sb = si === segs.length - 1 ? segs[si].e + PLAYER_RADIUS : segs[si].e;
        this.collisionSegs.push({
          ax: wx1 + ux * sa + offX, az: wz1 + uz * sa + offZ,
          bx: wx1 + ux * sb + offX, bz: wz1 + uz * sb + offZ,
          nx, nz,
        });
      }
    }
  }

  private splitExtrudeGroups(geo: THREE.BufferGeometry, _depth: number) {
    if (geo.groups.length !== 2) return;
    const capGrp = geo.groups[0];
    const sideGrp = geo.groups[1];
    const halfCount = capGrp.count / 2;
    geo.clearGroups();
    geo.addGroup(capGrp.start, halfCount, 0);
    geo.addGroup(capGrp.start + halfCount, halfCount, 1);
    geo.addGroup(sideGrp.start, sideGrp.count, 2);
  }

  private centroid(path: Point[]): Point {
    let x = 0,
      y = 0;
    for (const p of path) {
      x += p.x;
      y += p.y;
    }
    return { x: x / path.length, y: y / path.length };
  }

  private addFloor(roomShape: RoomShape) {
    const shape = new THREE.Shape();
    const pts = getPerimeter(roomShape);
    shape.moveTo(pts[0].x * MM_TO_M, pts[0].y * MM_TO_M);
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i].x * MM_TO_M, pts[i].y * MM_TO_M);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, this.floorMat);
    mesh.position.y = 0.001;
    mesh.receiveShadow = true;
    this.roomGroup.add(mesh);
  }

  private addCeiling(roomShape: RoomShape) {
    const pts = getPerimeter(roomShape);
    const ceilingH = getCeilingHeight(roomShape) * MM_TO_M;
    const wallT = roomShape.wallThickness * MM_TO_M;
    const n = pts.length;

    // Build slope lookup by wall index
    const slopeMap = new Map<number, { kneeH: number; angle: number; reach: number }>();
    for (const slope of roomShape.slopes) {
      const kneeH = slope.kneeWallHeight * MM_TO_M;
      const angle = slope.roofAngle * (Math.PI / 180);
      const reach = (ceilingH - kneeH) / Math.tan(angle);
      slopeMap.set(slope.wall, { kneeH, angle, reach });
    }

    // Calculate edge perpendiculars (pointing inward) - same as walls use
    let sa2 = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      sa2 += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    const ccw = sa2 > 0;

    const edgePerp: { nx: number; nz: number }[] = [];
    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const dx = (p2.x - p1.x) * MM_TO_M;
      const dz = (p2.y - p1.y) * MM_TO_M;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.0001) {
        edgePerp.push({ nx: 0, nz: 0 });
        continue;
      }
      if (ccw) {
        edgePerp.push({ nx: -dz / len, nz: dx / len });
      } else {
        edgePerp.push({ nx: dz / len, nz: -dx / len });
      }
    }

    // Calculate interior points (offset inward by wall thickness using miter joints)
    const interiorPts: { x: number; z: number }[] = [];
    for (let i = 0; i < n; i++) {
      const prev = (i - 1 + n) % n;
      const ep = edgePerp[prev], ec = edgePerp[i];
      const px = pts[i].x * MM_TO_M;
      const pz = pts[i].y * MM_TO_M;
      
      if (Math.abs(ep.nx) < 0.0001 && Math.abs(ep.nz) < 0.0001) {
        interiorPts.push({ x: px + ec.nx * wallT, z: pz + ec.nz * wallT });
        continue;
      }
      if (Math.abs(ec.nx) < 0.0001 && Math.abs(ec.nz) < 0.0001) {
        interiorPts.push({ x: px + ep.nx * wallT, z: pz + ep.nz * wallT });
        continue;
      }
      
      const d = ep.nx * ec.nx + ep.nz * ec.nz;
      if (1 + d < 0.001) {
        interiorPts.push({ x: px + ec.nx * wallT, z: pz + ec.nz * wallT });
        continue;
      }
      let mx = (ep.nx + ec.nx) * wallT / (1 + d);
      let mz = (ep.nz + ec.nz) * wallT / (1 + d);
      const ml = Math.sqrt(mx * mx + mz * mz);
      const maxM = wallT * 4;
      if (ml > maxM) {
        const s = maxM / ml;
        mx *= s;
        mz *= s;
      }
      interiorPts.push({ x: px + mx, z: pz + mz });
    }

    // Step 1: Create flat ceiling - same shape as interior floor, at ceiling height
    const ceilingShape = new THREE.Shape();
    ceilingShape.moveTo(interiorPts[0].x, interiorPts[0].z);
    for (let i = 1; i < n; i++) {
      ceilingShape.lineTo(interiorPts[i].x, interiorPts[i].z);
    }
    ceilingShape.closePath();
    
    const ceilingGeo = new THREE.ShapeGeometry(ceilingShape);
    ceilingGeo.rotateX(Math.PI / 2);
    const ceilingMesh = new THREE.Mesh(ceilingGeo, this.ceilingMat);
    ceilingMesh.position.y = ceilingH;
    ceilingMesh.castShadow = true;
    this.roomGroup.add(ceilingMesh);

    // Step 2: Add slopes on top
    if (slopeMap.size === 0) return;

    const vertices: number[] = [];
    const indices: number[] = [];

    // Helper: find intersection of two 2D lines
    // Line 1: p1 + t * d1, Line 2: p2 + s * d2
    // Returns the intersection point or null if parallel
    const lineIntersect = (
      p1x: number, p1z: number, d1x: number, d1z: number,
      p2x: number, p2z: number, d2x: number, d2z: number
    ): { x: number; z: number; t: number } | null => {
      const denom = d1x * d2z - d1z * d2x;
      if (Math.abs(denom) < 0.0001) return null;
      const t = ((p2x - p1x) * d2z - (p2z - p1z) * d2x) / denom;
      return { x: p1x + t * d1x, z: p1z + t * d1z, t };
    };

    for (let i = 0; i < n; i++) {
      const slope = slopeMap.get(i);
      if (!slope) continue;

      const i2 = (i + 1) % n;
      const prevWall = (i - 1 + n) % n;
      const nextWall = i2;
      const ip1 = interiorPts[i];
      const ip2 = interiorPts[i2];
      const perp = edgePerp[i];
      
      // Check if adjacent walls have slopes
      const hasPrevSlope = slopeMap.has(prevWall);
      const hasNextSlope = slopeMap.has(nextWall);

      // Wall direction
      const wallDx = ip2.x - ip1.x;
      const wallDz = ip2.z - ip1.z;
      
      // Default ridge points (directly above corners)
      let ridge1x = ip1.x + perp.nx * slope.reach;
      let ridge1z = ip1.z + perp.nz * slope.reach;
      let ridge2x = ip2.x + perp.nx * slope.reach;
      let ridge2z = ip2.z + perp.nz * slope.reach;
      
      // Extended base points (default to corners)
      let base1x = ip1.x, base1z = ip1.z;
      let base2x = ip2.x, base2z = ip2.z;

      // Extend ridge to meet adjacent walls if they don't have slopes
      if (!hasPrevSlope) {
        // Find where ridge line intersects prevWall line
        const prevIp = interiorPts[prevWall];
        const prevDx = ip1.x - prevIp.x;
        const prevDz = ip1.z - prevIp.z;
        
        const hit = lineIntersect(
          ridge1x, ridge1z, wallDx, wallDz,  // Ridge line (extends along wall direction)
          prevIp.x, prevIp.z, prevDx, prevDz  // PrevWall line
        );
        if (hit && hit.t < 0) {  // Extending backwards from ridge1
          ridge1x = hit.x;
          ridge1z = hit.z;
          // Base extends same direction along slope plane
          base1x = hit.x - perp.nx * slope.reach;
          base1z = hit.z - perp.nz * slope.reach;
        }
      }
      
      if (!hasNextSlope) {
        // Find where ridge line intersects nextWall line
        const nextNextIp = interiorPts[(nextWall + 1) % n];
        const nextDx = nextNextIp.x - ip2.x;
        const nextDz = nextNextIp.z - ip2.z;
        
        const hit = lineIntersect(
          ridge2x, ridge2z, wallDx, wallDz,  // Ridge line
          ip2.x, ip2.z, nextDx, nextDz  // NextWall line
        );
        if (hit && hit.t > 0) {  // Extending forwards from ridge2
          ridge2x = hit.x;
          ridge2z = hit.z;
          // Base extends same direction
          base2x = hit.x - perp.nx * slope.reach;
          base2z = hit.z - perp.nz * slope.reach;
        }
      }

      // Slope quad from extended base (at kneeH) to extended ridge (at ceilingH)
      const baseIdx = vertices.length / 3;
      vertices.push(base1x, slope.kneeH, base1z);
      vertices.push(base2x, slope.kneeH, base2z);
      vertices.push(ridge2x, ceilingH, ridge2z);
      vertices.push(ridge1x, ceilingH, ridge1z);
      indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
      indices.push(baseIdx, baseIdx + 2, baseIdx + 3);

      // Vertical soffit: closes gap between kneeH and ceilingH at wall face
      const soffitIdx = vertices.length / 3;
      vertices.push(base1x, slope.kneeH, base1z);
      vertices.push(base2x, slope.kneeH, base2z);
      vertices.push(base2x, ceilingH, base2z);
      vertices.push(base1x, ceilingH, base1z);
      indices.push(soffitIdx, soffitIdx + 1, soffitIdx + 2);
      indices.push(soffitIdx, soffitIdx + 2, soffitIdx + 3);
    }

    if (vertices.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const slopeMesh = new THREE.Mesh(geometry, this.ceilingMat);
      slopeMesh.castShadow = true;
      this.roomGroup.add(slopeMesh);
    }

    // Step 3: Fill corners where slopes meet or extend along non-sloped walls
    for (let i = 0; i < n; i++) {
      const slope1 = slopeMap.get(i);
      const prevWall = (i - 1 + n) % n;
      const slope2 = slopeMap.get(prevWall);
      
      if (slope1 && slope2) {
        // Two slopes meet at this corner - add corner triangle
        const ip = interiorPts[i];
        const perp1 = edgePerp[i];
        const perpPrev = edgePerp[prevWall];
        
        const cornerY = Math.max(slope1.kneeH, slope2.kneeH);
        const ridge1x = ip.x + perp1.nx * slope1.reach;
        const ridge1z = ip.z + perp1.nz * slope1.reach;
        const ridge2x = ip.x + perpPrev.nx * slope2.reach;
        const ridge2z = ip.z + perpPrev.nz * slope2.reach;
        
        const triGeo = new THREE.BufferGeometry();
        const triVerts = [
          ip.x, cornerY, ip.z,
          ridge1x, ceilingH, ridge1z,
          ridge2x, ceilingH, ridge2z,
        ];
        triGeo.setAttribute("position", new THREE.Float32BufferAttribute(triVerts, 3));
        triGeo.setIndex([0, 1, 2]);
        triGeo.computeVertexNormals();
        const triMesh = new THREE.Mesh(triGeo, this.ceilingMat);
        triMesh.castShadow = true;
        this.roomGroup.add(triMesh);
      }
      // No separate extensions needed - the main slope is already extended to meet adjacent walls
    }
  }

  private addLights(roomShape: RoomShape) {
    const lights = roomShape.lights ?? [];
    const ceilingH = getCeilingHeight(roomShape) * MM_TO_M;

    for (const light of lights) {
      const x = light.x * MM_TO_M;
      const z = light.y * MM_TO_M;

      if (light.type === "pendant") {
        this.addPendantLight(x, z, ceilingH, light);
      } else if (light.type === "spotlight") {
        this.addSpotlight(x, z, ceilingH, light);
      }
    }
  }

  private addPendantLight(x: number, z: number, ceilingH: number, light: CeilingLight) {
    const cableLength = (light.cableLength ?? 150) * MM_TO_M;
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Ceiling rose (mounting plate)
    const roseRadius = 0.04;
    const roseHeight = 0.015;
    const roseGeo = new THREE.CylinderGeometry(roseRadius, roseRadius, roseHeight, 16);
    const roseMesh = new THREE.Mesh(roseGeo, this.lightFixtureMat);
    roseMesh.position.y = ceilingH - roseHeight / 2;
    roseMesh.castShadow = true;
    group.add(roseMesh);

    // Twisted cable
    const cableRadius = 0.004;
    const cableGeo = new THREE.CylinderGeometry(cableRadius, cableRadius, cableLength, 8);
    const cableMesh = new THREE.Mesh(cableGeo, this.cableMat);
    cableMesh.position.y = ceilingH - roseHeight - cableLength / 2;
    group.add(cableMesh);

    // Bulb socket
    const socketRadius = 0.018;
    const socketHeight = 0.045;
    const socketGeo = new THREE.CylinderGeometry(socketRadius, socketRadius * 0.9, socketHeight, 12);
    const socketMesh = new THREE.Mesh(socketGeo, this.lightFixtureMat);
    socketMesh.position.y = ceilingH - roseHeight - cableLength - socketHeight / 2;
    socketMesh.castShadow = true;
    group.add(socketMesh);

    // Edison bulb shape
    const bulbY = ceilingH - roseHeight - cableLength - socketHeight;
    
    // Bulb base (narrower part inside socket)
    const bulbBaseGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.02, 12);
    const bulbBaseMesh = new THREE.Mesh(bulbBaseGeo, this.lightBulbMat);
    bulbBaseMesh.position.y = bulbY - 0.01;
    group.add(bulbBaseMesh);

    // Bulb main body (teardrop shape using lathe)
    const bulbPoints = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const y = -t * 0.08;
      const r = Math.sin(t * Math.PI) * 0.028 + 0.008;
      bulbPoints.push(new THREE.Vector2(r, y));
    }
    const bulbGeo = new THREE.LatheGeometry(bulbPoints, 16);
    const bulbMesh = new THREE.Mesh(bulbGeo, this.lightBulbMat);
    bulbMesh.position.y = bulbY - 0.02;
    group.add(bulbMesh);

    // Add actual point light
    const lightColor = this.getLightColor(light, 2700);
    const baseIntensity = (light.intensity ?? 1) * 15;
    const pointLight = new THREE.PointLight(lightColor, baseIntensity, 8);
    pointLight.position.y = bulbY - 0.05;
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 512;
    pointLight.shadow.mapSize.height = 512;
    pointLight.userData.baseIntensity = baseIntensity;
    if (this._nightMode) {
      pointLight.intensity = baseIntensity * 2.5;
    }
    group.add(pointLight);
    this.ceilingLights.push(pointLight);

    this.roomGroup.add(group);
  }

  private addSpotlight(x: number, z: number, ceilingH: number, light: CeilingLight) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const outerRadius = 0.06;
    const innerRadius = 0.025;
    const depth = 0.015;

    // Chrome outer ring/bezel - torus for 3D appearance
    const torusGeo = new THREE.TorusGeometry(outerRadius - 0.008, 0.008, 16, 32);
    torusGeo.rotateX(Math.PI / 2);
    const torusMesh = new THREE.Mesh(torusGeo, this.spotlightRimMat);
    torusMesh.position.y = ceilingH - 0.008;
    group.add(torusMesh);

    // Chrome disc/plate (flat ring between outer and inner)
    const plateGeo = new THREE.CylinderGeometry(outerRadius - 0.012, outerRadius - 0.012, 0.003, 32);
    const plateMesh = new THREE.Mesh(plateGeo, this.spotlightRimMat);
    plateMesh.position.y = ceilingH - depth / 2;
    group.add(plateMesh);

    // Inner chrome ring around bulb
    const innerTorusGeo = new THREE.TorusGeometry(innerRadius + 0.005, 0.005, 12, 24);
    innerTorusGeo.rotateX(Math.PI / 2);
    const innerTorusMesh = new THREE.Mesh(innerTorusGeo, this.spotlightRimMat);
    innerTorusMesh.position.y = ceilingH - depth;
    group.add(innerTorusMesh);

    // Glowing bulb/lens in center
    const lightColor = this.getLightColor(light, 4000);
    
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: lightColor,
      emissiveIntensity: (light.intensity ?? 1) * 3,
      roughness: 0.2,
      metalness: 0,
      transparent: true,
      opacity: 0.95,
    });
    
    // Bulb as a slight dome
    const bulbGeo = new THREE.SphereGeometry(innerRadius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    bulbGeo.rotateX(Math.PI);
    const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
    bulbMesh.position.y = ceilingH - depth;
    group.add(bulbMesh);

    // Flat lens cover
    const lensGeo = new THREE.CircleGeometry(innerRadius, 24);
    lensGeo.rotateX(Math.PI / 2);
    const lensMesh = new THREE.Mesh(lensGeo, bulbMat);
    lensMesh.position.y = ceilingH - depth + 0.001;
    group.add(lensMesh);

    // Add actual spotlight for scene illumination
    const baseIntensity = (light.intensity ?? 1) * 30;
    const beamAngle = (light.beamAngle ?? 40) * Math.PI / 180;
    
    const spotLight = new THREE.SpotLight(lightColor, baseIntensity);
    spotLight.position.y = ceilingH - depth - 0.01;
    spotLight.angle = beamAngle / 2;
    spotLight.penumbra = 0.4;
    spotLight.decay = 2;
    spotLight.distance = 8;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 512;
    spotLight.shadow.mapSize.height = 512;
    
    // Target pointing down
    const target = new THREE.Object3D();
    target.position.set(x, 0, z);
    this.roomGroup.add(target);
    spotLight.target = target;
    spotLight.userData.baseIntensity = baseIntensity;
    if (this._nightMode) {
      spotLight.intensity = baseIntensity * 2.5;
    }
    
    group.add(spotLight);
    this.ceilingLights.push(spotLight);

    this.roomGroup.add(group);
  }

  private getLightColor(light: CeilingLight, defaultColorTemp: number): number {
    if (light.rgb) {
      return (light.rgb.r << 16) | (light.rgb.g << 8) | light.rgb.b;
    }
    return this.colorTempToRGB(light.colorTemp ?? defaultColorTemp);
  }

  private colorTempToRGB(kelvin: number): number {
    // Convert color temperature to RGB
    const temp = kelvin / 100;
    let r: number, g: number, b: number;

    if (temp <= 66) {
      r = 255;
      g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661));
    } else {
      r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
      g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
    }

    if (temp >= 66) {
      b = 255;
    } else if (temp <= 19) {
      b = 0;
    } else {
      b = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
    }

    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }

  private addWalls(roomShape: RoomShape) {
    const pts = getPerimeter(roomShape);
    const wallH = getCeilingHeight(roomShape) * MM_TO_M;
    const wallT = roomShape.wallThickness * MM_TO_M;
    const n = pts.length;

    const edgeData: { dx: number; dz: number; len: number; ex: number; ez: number }[] = [];
    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const dx = (p2.x - p1.x) * MM_TO_M;
      const dz = (p2.y - p1.y) * MM_TO_M;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.0001) {
        edgeData.push({ dx: 0, dz: 0, len: 0, ex: 0, ez: 0 });
        continue;
      }
      edgeData.push({
        dx: dx / len, dz: dz / len, len,
        ex: -dz / len, ez: dx / len,
      });
    }

    const miterVecs: { x: number; z: number }[] = [];
    for (let i = 0; i < n; i++) {
      const prev = (i - 1 + n) % n;
      const ep = edgeData[prev], ec = edgeData[i];
      if (ep.len < 0.0001 || ec.len < 0.0001) {
        miterVecs.push({ x: 0, z: 0 });
        continue;
      }
      const d = ep.ex * ec.ex + ep.ez * ec.ez;
      if (1 + d < 0.001) {
        miterVecs.push({ x: ec.ex * wallT, z: ec.ez * wallT });
        continue;
      }
      let mx = (ep.ex + ec.ex) * wallT / (1 + d);
      let mz = (ep.ez + ec.ez) * wallT / (1 + d);
      const ml = Math.sqrt(mx * mx + mz * mz);
      const maxM = wallT * 4;
      if (ml > maxM) { const s = maxM / ml; mx *= s; mz *= s; }
      miterVecs.push({ x: mx, z: mz });
    }

    let sa2 = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      sa2 += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    const ccw = sa2 > 0;
    const extIdx = 0, intIdx = 1;
    const wallMats = [this.wallExtMat, this.wallIntMat];

    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const ed = edgeData[i];
      if (ed.len < 0.0001) continue;
      const len = ed.len;
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      const insets = roomShape.insets.filter((ins) => ins.wall === i);

      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(len, 0);
      shape.lineTo(len, wallH);
      shape.lineTo(0, wallH);
      shape.closePath();

      // Store hole bounds for miter exclusion
      const holeBounds: { hL: number; hR: number; hB: number; hT: number }[] = [];
      for (const ins of insets) {
        const l = ins.positionLeft * MM_TO_M;
        const b = ins.positionGround * MM_TO_M;
        const w = ins.width * MM_TO_M;
        const h = ins.height * MM_TO_M;
        const sillDrop = ins.type === "window" ? 0.04 : 0;
        const hm = ins.type === "door" ? 0.005 : 0.002;
        const eps = 0.0002;
        const hL = Math.max(eps, l - hm);
        const hR = Math.min(len - eps, l + w + hm);
        const hB = Math.max(eps, b - sillDrop - hm);
        const hT = Math.min(wallH - eps, b + h + hm);
        holeBounds.push({ hL, hR, hB, hT });
        const hole = new THREE.Path();
        hole.moveTo(hL, hB);
        hole.lineTo(hR, hB);
        hole.lineTo(hR, hT);
        hole.lineTo(hL, hT);
        hole.closePath();
        shape.holes.push(hole);
      }

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: wallT,
        bevelEnabled: false,
      });

      const ni = (i + 1) % n;
      const ms = miterVecs[i].x * ed.dx + miterVecs[i].z * ed.dz;
      const me = miterVecs[ni].x * ed.dx + miterVecs[ni].z * ed.dz;
      if (Math.abs(ms) > 0.0001 || Math.abs(me) > 0.0001) {
        const posAttr = geo.getAttribute("position");
        const arr = posAttr.array as Float32Array;
        for (let vi = 0; vi < posAttr.count; vi++) {
          const z = arr[vi * 3 + 2];
          if (z > 0.0001) {
            const x = arr[vi * 3];
            const y = arr[vi * 3 + 1];
            // Skip vertices that are on hole edges (keep holes perpendicular)
            let isHoleEdge = false;
            for (const hb of holeBounds) {
              // Check if vertex is on the edge of this hole
              const onHoleX = (Math.abs(x - hb.hL) < 0.001 || Math.abs(x - hb.hR) < 0.001) && y >= hb.hB - 0.001 && y <= hb.hT + 0.001;
              const onHoleY = (Math.abs(y - hb.hB) < 0.001 || Math.abs(y - hb.hT) < 0.001) && x >= hb.hL - 0.001 && x <= hb.hR + 0.001;
              if (onHoleX || onHoleY) {
                isHoleEdge = true;
                break;
              }
            }
            if (!isHoleEdge) {
              const t = Math.max(0, Math.min(1, x / len));
              arr[vi * 3] += (z / wallT) * (ms + (me - ms) * t);
            }
          }
        }
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();
      }

      this.splitExtrudeGroups(geo, wallT);
      if (geo.groups.length >= 3) {
        geo.groups[0].materialIndex = ccw ? extIdx : intIdx;
        geo.groups[1].materialIndex = ccw ? intIdx : extIdx;
        geo.groups[2].materialIndex = ccw ? intIdx : extIdx;
      }

      const mesh = new THREE.Mesh(geo, wallMats);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.position.set(p1.x * MM_TO_M, 0, p1.y * MM_TO_M);
      mesh.rotation.y = -angle;
      this.roomGroup.add(mesh);

      for (const ins of insets) {
        const il = ins.positionLeft * MM_TO_M;
        const ib = ins.positionGround * MM_TO_M;
        const iw = ins.width * MM_TO_M;
        const ih = ins.height * MM_TO_M;
        const sd = ins.type === "window" ? 0.04 : 0;
        const fg = ins.type === "door" ? 0.005 : 0.002;
        this.addOpeningChamfer(p1, angle, il - fg, ib - sd - fg, iw + fg * 2, ih + sd + fg * 2, wallT, ins.type === "door");
        this.addInset(ins, p1, angle, wallT, roomShape);
      }
    }
  }


  private addArchitrave(
    parent: THREE.Group,
    l: number, b: number, w: number, h: number,
    wallT: number
  ) {
    const archW = 0.058;  // 58mm wide
    const archD = 0.015;  // 15mm projection from wall

    // Regency profile cross-section built from smooth curves
    // wo: 0 = inner edge (at door frame), archW = outer edge (on wall)
    // dpo: 0 = wall surface, archD = peak projection into room
    const profile = this.buildArchProfile(archW, archD);

    // How far the architrave overlaps the frame (leaves ~8mm of casing visible)
    const inset = 0.048;

    // Left vertical piece
    this.buildMouldingStrip(parent, profile,
      (wo, dpo) => [l + inset - wo, b,                    wallT + dpo],
      (wo, dpo) => [l + inset - wo, b + h - inset + wo,   wallT + dpo]
    );

    // Right vertical piece (flip winding — x increases with wo here, opposite to left/top)
    this.buildMouldingStrip(parent, profile,
      (wo, dpo) => [l + w - inset + wo, b,                    wallT + dpo],
      (wo, dpo) => [l + w - inset + wo, b + h - inset + wo,   wallT + dpo],
      true
    );

    // Top horizontal piece
    this.buildMouldingStrip(parent, profile,
      (wo, dpo) => [l + inset - wo,     b + h - inset + wo, wallT + dpo],
      (wo, dpo) => [l + w - inset + wo, b + h - inset + wo, wallT + dpo]
    );
  }

  private buildArchProfile(w: number, d: number): [number, number][] {
    const pts: [number, number][] = [];

    const bezier2 = (
      x0: number, y0: number,
      cx: number, cy: number,
      x1: number, y1: number,
      n: number, skipFirst = false
    ) => {
      const start = skipFirst ? 1 : 0;
      for (let i = start; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        pts.push([
          u * u * x0 + 2 * u * t * cx + t * t * x1,
          u * u * y0 + 2 * u * t * cy + t * t * y1,
        ]);
      }
    };

    // 1. Inner quirk / rebate step
    pts.push([0, 0]);
    pts.push([0, d * 0.12]);
    pts.push([w * 0.03, d * 0.12]);
    pts.push([w * 0.03, d * 0.28]);

    // 2. Large ogee: concave sweep into convex peak
    bezier2(w * 0.03, d * 0.28, w * 0.08, d * 0.58, w * 0.14, d * 0.84, 6, true);
    bezier2(w * 0.14, d * 0.84, w * 0.20, d * 1.04, w * 0.28, d, 6, true);

    // 3. Concave sweep down from peak to fillet
    bezier2(w * 0.28, d, w * 0.36, d * 0.82, w * 0.42, d * 0.60, 6, true);

    // 4. Flat fillet
    pts.push([w * 0.46, d * 0.56]);

    // 5. Small convex bead
    bezier2(w * 0.46, d * 0.56, w * 0.50, d * 0.65, w * 0.54, d * 0.56, 4, true);

    // 6. Transition down to back-band
    pts.push([w * 0.58, d * 0.48]);
    pts.push([w * 0.62, d * 0.42]);

    // 7. Back-band: flat, substantial outer section
    pts.push([w * 0.62, d * 0.72]);
    pts.push([w * 0.96, d * 0.72]);

    // 8. Outer edge lip
    pts.push([w * 0.96, d * 0.60]);
    pts.push([w, d * 0.60]);
    pts.push([w, 0]);

    return pts;
  }

  private buildSkirtingProfile(h: number, d: number): [number, number][] {
    const pts: [number, number][] = [];

    const bezier2 = (
      x0: number, y0: number,
      cx: number, cy: number,
      x1: number, y1: number,
      n: number, skipFirst = false
    ) => {
      const start = skipFirst ? 1 : 0;
      for (let i = start; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        pts.push([
          u * u * x0 + 2 * u * t * cx + t * t * x1,
          u * u * y0 + 2 * u * t * cy + t * t * y1,
        ]);
      }
    };

    // Bottom edge
    pts.push([0, 0]);
    pts.push([0, d]);

    // Flat face up to 55% height
    pts.push([h * 0.55, d]);

    // Small fillet step inward
    pts.push([h * 0.58, d * 0.92]);

    // Concave sweep toward wall
    bezier2(h * 0.58, d * 0.92, h * 0.64, d * 0.50, h * 0.70, d * 0.38, 6, true);

    // Convex ogee outward to peak
    bezier2(h * 0.70, d * 0.38, h * 0.76, d * 0.22, h * 0.82, d * 0.62, 6, true);
    bezier2(h * 0.82, d * 0.62, h * 0.86, d * 0.78, h * 0.90, d * 0.65, 4, true);

    // Top taper back to wall
    bezier2(h * 0.90, d * 0.65, h * 0.94, d * 0.40, h * 0.97, d * 0.20, 4, true);
    pts.push([h, d * 0.12]);
    pts.push([h, 0]);

    return pts;
  }

  private addSkirting(roomShape: RoomShape) {
    const pts = getPerimeter(roomShape);
    const wallT = roomShape.wallThickness * MM_TO_M;
    const n = pts.length;
    const skirtH = 0.070;
    const skirtD = 0.018;

    let sa2 = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      sa2 += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    const ccw = sa2 > 0;
    const skirtZ = ccw ? wallT : 0;
    const zSign = ccw ? 1 : -1;

    const profile = this.buildSkirtingProfile(skirtH, skirtD);

    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const dx = (p2.x - p1.x) * MM_TO_M;
      const dz = (p2.y - p1.y) * MM_TO_M;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.001) continue;
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      const doors = roomShape.insets.filter(
        (ins) => ins.wall === i && ins.type === "door"
      );
      const doorSpans: { s: number; e: number }[] = [];
      for (const door of doors) {
        const doorLeft = door.positionLeft * MM_TO_M;
        const doorRight = (door.positionLeft + door.width) * MM_TO_M;
        doorSpans.push({ s: doorLeft, e: doorRight });
      }
      doorSpans.sort((a, b) => a.s - b.s);

      const gaps: { s: number; e: number }[] = [];
      let cursor = 0;
      for (const span of doorSpans) {
        if (span.s > cursor + 0.001) gaps.push({ s: cursor, e: span.s });
        cursor = Math.max(cursor, span.e);
      }
      if (len - cursor > 0.001) gaps.push({ s: cursor, e: len });

      for (const gap of gaps) {
        const parent = new THREE.Group();
        parent.position.set(p1.x * MM_TO_M, 0, p1.y * MM_TO_M);
        parent.rotation.y = -angle;

        this.buildMouldingStrip(parent, profile,
          (wo, dpo) => [gap.s, wo, skirtZ + dpo * zSign],
          (wo, dpo) => [gap.e, wo, skirtZ + dpo * zSign]
        );

        this.roomGroup.add(parent);
      }
    }
  }

  private buildMouldingStrip(
    parent: THREE.Group,
    profile: [number, number][],
    mapStart: (wo: number, dpo: number) => [number, number, number],
    mapEnd: (wo: number, dpo: number) => [number, number, number],
    flip = false
  ) {
    const np = profile.length;
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < np; i++) {
      const [wo, dpo] = profile[i];
      const s = mapStart(wo, dpo);
      const e = mapEnd(wo, dpo);
      vertices.push(s[0], s[1], s[2]);
      vertices.push(e[0], e[1], e[2]);
    }

    for (let i = 0; i < np - 1; i++) {
      const a = i * 2, b = i * 2 + 1;
      const c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      if (flip) {
        indices.push(a, d, c);
        indices.push(a, b, d);
      } else {
        indices.push(a, c, d);
        indices.push(a, d, b);
      }
    }

    for (let i = 1; i < np - 1; i++) {
      if (flip) {
        indices.push(0, i * 2, (i + 1) * 2);
      } else {
        indices.push(0, (i + 1) * 2, i * 2);
      }
    }

    for (let i = 1; i < np - 1; i++) {
      if (flip) {
        indices.push(1, (i + 1) * 2 + 1, i * 2 + 1);
      } else {
        indices.push(1, i * 2 + 1, (i + 1) * 2 + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.mouldingMat);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    parent.add(mesh);
  }

  private addOpeningChamfer(
    wallStart: Point,
    wallAngle: number,
    l: number,
    b: number,
    w: number,
    h: number,
    wallT: number,
    skipBottom = false
  ) {
    const c = 0.025;

    for (const exterior of [false, true]) {
      const fz = exterior ? wallT : 0;
      const iz = exterior ? wallT - c : c;

      const positions: number[] = [];
      const idx: number[] = [];
      let vi = 0;

      const quad = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        cx: number, cy: number, cz: number,
        dx: number, dy: number, dz: number
      ) => {
        positions.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
        idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
        vi += 4;
      };

      const tri = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        cx: number, cy: number, cz: number
      ) => {
        positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        idx.push(vi, vi + 1, vi + 2);
        vi += 3;
      };

      // Left edge
      quad(
        l, b + c, fz, l, b + h - c, fz,
        l + c, b + h - c, iz, l + c, b + c, iz
      );
      // Right edge
      quad(
        l + w, b + h - c, fz, l + w, b + c, fz,
        l + w - c, b + c, iz, l + w - c, b + h - c, iz
      );
      // Top edge
      quad(
        l + c, b + h, fz, l + w - c, b + h, fz,
        l + w - c, b + h - c, iz, l + c, b + h - c, iz
      );

      if (!skipBottom) {
        // Bottom edge
        quad(
          l + w - c, b, fz, l + c, b, fz,
          l + c, b + c, iz, l + w - c, b + c, iz
        );
      }

      // Top corner triangles
      tri(l, b + h - c, fz, l, b + h, fz, l + c, b + h - c, iz);
      tri(l, b + h, fz, l + c, b + h, fz, l + c, b + h - c, iz);
      tri(l + w, b + h, fz, l + w, b + h - c, fz, l + w - c, b + h - c, iz);
      tri(l + w - c, b + h, fz, l + w, b + h, fz, l + w - c, b + h - c, iz);

      if (!skipBottom) {
        // Bottom corner triangles
        tri(l, b, fz, l, b + c, fz, l + c, b + c, iz);
        tri(l + c, b, fz, l, b, fz, l + c, b + c, iz);
        tri(l + w, b + c, fz, l + w, b, fz, l + w - c, b + c, iz);
        tri(l + w, b, fz, l + w - c, b, fz, l + w - c, b + c, iz);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();

      const chamferMat = exterior ? this.wallExtMat : this.wallIntMat;
      const chamferMesh = new THREE.Mesh(geo, chamferMat);
      chamferMesh.castShadow = exterior;
      chamferMesh.receiveShadow = exterior;
      chamferMesh.position.set(wallStart.x * MM_TO_M, 0, wallStart.y * MM_TO_M);
      chamferMesh.rotation.y = -wallAngle;
      this.roomGroup.add(chamferMesh);
    }
  }

  private addInset(
    ins: RoomShape["insets"][number],
    wallStart: Point,
    wallAngle: number,
    wallT: number,
    roomShape: RoomShape
  ) {
    const l = ins.positionLeft * MM_TO_M;
    const b = ins.positionGround * MM_TO_M;
    const w = ins.width * MM_TO_M;
    const h = ins.height * MM_TO_M;
    const frameW = 0.065;

    const parent = new THREE.Group();
    parent.position.set(wallStart.x * MM_TO_M, 0, wallStart.y * MM_TO_M);
    parent.rotation.y = -wallAngle;

    if (ins.type === "window") {
      const frameD = 0.10;
      const mid = frameD / 2;
      const innerW = w - frameW * 2;
      const innerH = h - frameW * 2;

      // Two-part frame profile: exterior half is full-width, interior half
      // is narrower — the step between them IS the rebate.
      const rebStep = 0.012;
      const halfD = frameD / 2;
      const extZ = mid - halfD / 2;
      const intZ = mid + halfD / 2;
      const intFW = frameW - rebStep;

      // Sash profile: 30% width, 15% depth — slim like real uPVC sash
      const sashBarW = frameW * 0.30;
      const sashBarD = frameD * 0.15;
      const fixedZ = mid;
      const gap = 0.002;

      // ── Two-part outer frame (creates visible rebate step) ──
      // Top bar
      this.addFrameBar(parent, l + w / 2, b + h - frameW / 2, extZ, w, frameW, halfD);
      this.addFrameBar(parent, l + w / 2, b + h - intFW / 2, intZ, w, intFW, halfD);
      // Bottom bar
      this.addFrameBar(parent, l + w / 2, b + frameW / 2, extZ, w, frameW, halfD);
      this.addFrameBar(parent, l + w / 2, b + intFW / 2, intZ, w, intFW, halfD);
      // Left bar
      this.addFrameBar(parent, l + frameW / 2, b + h / 2, extZ, frameW, h, halfD);
      this.addFrameBar(parent, l + intFW / 2, b + h / 2, intZ, intFW, h, halfD);
      // Right bar
      this.addFrameBar(parent, l + w - frameW / 2, b + h / 2, extZ, frameW, h, halfD);
      this.addFrameBar(parent, l + w - intFW / 2, b + h / 2, intZ, intFW, h, halfD);

      // ── Sill (chamfered wedge profile for water run-off) ──
      const sillW = w + 0.12;
      const sillProj = 0.12;
      const sillOuter = -sillProj;
      const sillInner = mid + frameD / 2;
      const sillTotalD = sillInner - sillOuter;
      const sillHBack = 0.035;
      const sillHFront = 0.018;
      const noseProj = 0.008;
      const noseH = 0.012;

      const sillShape = new THREE.Shape();
      sillShape.moveTo(0, 0);
      sillShape.lineTo(0, sillHBack);
      sillShape.lineTo(sillTotalD, sillHFront);
      sillShape.lineTo(sillTotalD + noseProj, sillHFront);
      sillShape.lineTo(sillTotalD + noseProj, sillHFront - noseH);
      sillShape.lineTo(sillTotalD, sillHFront - noseH);
      sillShape.lineTo(sillTotalD, 0);
      sillShape.closePath();

      const sillGeo = new THREE.ExtrudeGeometry(sillShape, {
        depth: sillW,
        bevelEnabled: false,
      });
      const sillMesh = new THREE.Mesh(sillGeo, this.frameMat);
      sillMesh.rotation.y = Math.PI / 2;
      sillMesh.position.set(
        l + w / 2 - sillW / 2,
        b - sillHBack,
        sillInner
      );
      sillMesh.castShadow = false;
      parent.add(sillMesh);

      if (ins.openings.length === 0) {
        const glass = new THREE.Mesh(
          new THREE.PlaneGeometry(innerW, innerH),
          this.glassMat
        );
        glass.position.set(l + w / 2, b + h / 2, fixedZ);
        parent.add(glass);
        this.addGlazingBeads(
          parent, l + w / 2, b + h / 2, innerW, innerH,
          fixedZ
        );
      } else {
        // ── Mullion dividers (two-part profile, rebate on both sides) ──
        // Mullions/transoms are wider than outer frame — they carry two rebates
        const mullW = frameW * 1.5;
        const mullIntW = Math.max(mullW - rebStep * 2, 0.01);
        const edges = new Set<number>();
        for (const op of ins.openings) {
          const d = op.displacement * MM_TO_M;
          const ow = op.width * MM_TO_M;
          const spanStart = op.hanging === "right" ? d - ow : d;
          const spanEnd = op.hanging === "right" ? d : d + ow;
          if (spanStart > 0.001) edges.add(spanStart);
          if (spanEnd < w - 0.001) edges.add(spanEnd);
        }
        for (const pos of edges) {
          this.addFrameBar(parent, l + pos, b + h / 2, extZ, mullW, innerH, halfD);
          this.addFrameBar(parent, l + pos, b + h / 2, intZ, mullIntW, innerH, halfD);
        }

        // ── Transom dividers for top/bottom hung sashes (two-part) ──
        const transIntH = Math.max(mullW - rebStep * 2, 0.01);
        for (const op of ins.openings) {
          if (op.hanging === "top" || op.hanging === "bottom") {
            const oh = (op.height ?? ins.height) * MM_TO_M;
            const ow2 = op.width * MM_TO_M;
            const disp2 = op.displacement * MM_TO_M;

            if (oh < innerH - 0.001) {
              let transomCY: number;
              if (op.hanging === "top") {
                transomCY = b + h - intFW - oh - mullW / 2;
              } else {
                transomCY = b + intFW + oh + mullW / 2;
              }
              const transomCX = l + disp2 + ow2 / 2;
              this.addFrameBar(parent, transomCX, transomCY, extZ, ow2, mullW, halfD);
              this.addFrameBar(parent, transomCX, transomCY, intZ, ow2, transIntH, halfD);
            }
          }
        }

        // ── Fixed glass for areas not covered by opening sashes ──
        const allSpans: { l: number; r: number }[] = [];
        for (const op of ins.openings) {
          const d2 = op.displacement * MM_TO_M;
          const ow2 = op.width * MM_TO_M;
          const sL = op.hanging === "right" ? d2 - ow2 : d2;
          const sR = op.hanging === "right" ? d2 : d2 + ow2;
          allSpans.push({ l: sL, r: sR });

          if (op.hanging === "top" || op.hanging === "bottom") {
            const oh2 = (op.height ?? ins.height) * MM_TO_M;
            if (oh2 < innerH - 0.001) {
              const cL2 = sL < 0.001 ? intFW + gap : sL + mullW / 2 + gap;
              const cR2 = sR > w - 0.001 ? w - intFW - gap : sR - mullW / 2 - gap;
              const cW2 = cR2 - cL2;
              let fBot: number, fTop: number;
              if (op.hanging === "top") {
                fTop = h - intFW - oh2 - mullW;
                fBot = intFW;
              } else {
                fBot = intFW + oh2 + mullW;
                fTop = h - intFW;
              }
              const fH = fTop - fBot;
              if (fH > 0.01 && cW2 > 0.01) {
                const fcx = l + (cL2 + cR2) / 2;
                const fcy = b + (fBot + fTop) / 2;
                const fg = new THREE.Mesh(
                  new THREE.PlaneGeometry(cW2, fH),
                  this.glassMat
                );
                fg.position.set(fcx, fcy, fixedZ);
                parent.add(fg);
                this.addGlazingBeads(parent, fcx, fcy, cW2, fH, fixedZ);
              }
            }
          }
        }

        allSpans.sort((a, b2) => a.l - b2.l);
        let spanCursor = 0;
        const gapBoundL = (pos: number) =>
          pos < 0.001 ? intFW + gap : pos + mullW / 2 + gap;
        const gapBoundR = (pos: number) =>
          pos > w - 0.001 ? w - intFW - gap : pos - mullW / 2 - gap;

        for (const sp of allSpans) {
          if (sp.l > spanCursor + 0.001) {
            const gL = gapBoundL(spanCursor);
            const gR = gapBoundR(sp.l);
            const gW = gR - gL;
            if (gW > 0.01) {
              const gcx = l + (gL + gR) / 2;
              const gcy = b + h / 2;
              const fg = new THREE.Mesh(
                new THREE.PlaneGeometry(gW, innerH),
                this.glassMat
              );
              fg.position.set(gcx, gcy, fixedZ);
              parent.add(fg);
              this.addGlazingBeads(parent, gcx, gcy, gW, innerH, fixedZ);
            }
          }
          spanCursor = Math.max(spanCursor, sp.r);
        }
        if (w - spanCursor > 0.001) {
          const gL = gapBoundL(spanCursor);
          const gR = gapBoundR(w);
          const gW = gR - gL;
          if (gW > 0.01) {
            const gcx = l + (gL + gR) / 2;
            const gcy = b + h / 2;
            const fg = new THREE.Mesh(
              new THREE.PlaneGeometry(gW, innerH),
              this.glassMat
            );
            fg.position.set(gcx, gcy, fixedZ);
            parent.add(fg);
            this.addGlazingBeads(parent, gcx, gcy, gW, innerH, fixedZ);
          }
        }

        // ── Opening sashes (sized to fit clear opening between frame/mullions) ──
        for (const op of ins.openings) {
          const ow = op.width * MM_TO_M;
          const disp = op.displacement * MM_TO_M;
          const outward = op.open === "outwards";

          const sashZ = outward
            ? mid - halfD + sashBarD / 2
            : mid + halfD - sashBarD / 2;

          // Span boundaries (where mullions / frame edges sit)
          const spanL = op.hanging === "right" ? disp - ow : disp;
          const spanR = op.hanging === "right" ? disp : disp + ow;

          // Clear opening X — use full frameW for mullions (they have
          // two-part profile) and intFW for outer frame bars (sash
          // sits at the interior half depth)
          const clL = spanL < 0.001 ? intFW + gap : spanL + frameW / 2 + gap;
          const clR = spanR > w - 0.001 ? w - intFW - gap : spanR - frameW / 2 - gap;
          const clW = clR - clL;

          if (op.hanging === "left" || op.hanging === "right") {
            const leftHung = op.hanging === "left";
            const pH = h - intFW * 2 - gap * 2;

            const pivotX = leftHung ? l + clL : l + clR;
            const pivot = new THREE.Group();
            pivot.position.set(pivotX, b + intFW + gap, sashZ);

            const glass = new THREE.Mesh(
              new THREE.PlaneGeometry(clW - sashBarW * 2, pH - sashBarW * 2),
              this.glassMat
            );
            glass.position.set(leftHung ? clW / 2 : -clW / 2, pH / 2, 0);
            pivot.add(glass);

            const px = leftHung ? 0 : -clW;
            this.addSashBar(pivot, px, pH - sashBarW, clW, sashBarW, sashBarD);
            this.addSashBar(pivot, px, 0, clW, sashBarW, sashBarD);
            this.addSashBar(pivot, px, 0, sashBarW, pH, sashBarD);
            this.addSashBar(pivot, px + clW - sashBarW, 0, sashBarW, pH, sashBarD);

            const lipOver = 0.012;
            const lipD = 0.010;
            const lipSign = outward ? -1 : 1;
            const lipZ = lipSign * (sashBarD / 2 + lipD / 2);
            const lipBarW = sashBarW + lipOver;
            const lipTW = clW + lipOver * 2;
            const lipTH = pH + lipOver * 2;
            const lipX = px - lipOver;
            const lipY = -lipOver;
            this.addSashBar(pivot, lipX, lipY + lipTH - lipBarW, lipTW, lipBarW, lipD, lipZ);
            this.addSashBar(pivot, lipX, lipY, lipTW, lipBarW, lipD, lipZ);
            this.addSashBar(pivot, lipX, lipY, lipBarW, lipTH, lipD, lipZ);
            this.addSashBar(pivot, lipX + lipTW - lipBarW, lipY, lipBarW, lipTH, lipD, lipZ);

            this.addGlazingBeads(
              pivot, leftHung ? clW / 2 : -clW / 2, pH / 2,
              clW - sashBarW * 2, pH - sashBarW * 2, 0
            );

            parent.add(pivot);
            const centerOffset = leftHung ? clW / 2 : -clW / 2;
            const ref = { pivot, opening: op, leftHung, outward, targetDeg: op.degreesOpen, centerOffset };
            this.doorPivots.push(ref);
            
            // Add window sash meshes to doorMeshes for click detection
            pivot.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.userData.doorRef = ref;
                child.geometry.computeBoundingBox();
                child.geometry.computeBoundingSphere();
                this.doorMeshes.push(child);
              }
            });
            
            // Add invisible clickable plane in the sash opening area
            const clickPlaneX = l + (clL + clR) / 2;
            const clickPlaneY = b + intFW + gap + pH / 2;
            const clickPlaneZ = mid;
            const clickPlaneMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
            const clickPlaneGeo = new THREE.PlaneGeometry(clW, pH);
            const clickPlane = new THREE.Mesh(clickPlaneGeo, clickPlaneMat);
            clickPlane.position.set(clickPlaneX, clickPlaneY, clickPlaneZ);
            clickPlane.userData.doorRef = ref;
            clickPlane.geometry.computeBoundingBox();
            clickPlane.geometry.computeBoundingSphere();
            parent.add(clickPlane);
            this.doorMeshes.push(clickPlane);
          } else if (op.hanging === "top" || op.hanging === "bottom") {
            const oh = (op.height ?? ins.height) * MM_TO_M;
            const topHung = op.hanging === "top";
            const sH = oh - gap * 2;

            const pivot = new THREE.Group();
            pivot.position.set(
              l + (clL + clR) / 2,
              topHung ? b + h - intFW : b + intFW,
              sashZ
            );

            const glass = new THREE.Mesh(
              new THREE.PlaneGeometry(clW - sashBarW * 2, sH - sashBarW * 2),
              this.glassMat
            );
            glass.position.set(0, topHung ? -sH / 2 : sH / 2, 0);
            pivot.add(glass);

            const spx = -clW / 2;
            const spy = topHung ? -sH : 0;
            this.addSashBar(pivot, spx, spy + sH - sashBarW, clW, sashBarW, sashBarD);
            this.addSashBar(pivot, spx, spy, clW, sashBarW, sashBarD);
            this.addSashBar(pivot, spx, spy, sashBarW, sH, sashBarD);
            this.addSashBar(pivot, spx + clW - sashBarW, spy, sashBarW, sH, sashBarD);

            const lipOver = 0.012;
            const lipD = 0.010;
            const lipSign = outward ? -1 : 1;
            const lipZ = lipSign * (sashBarD / 2 + lipD / 2);
            const lipBarW = sashBarW + lipOver;
            const lipTW = clW + lipOver * 2;
            const lipTH = sH + lipOver * 2;
            const lipX = spx - lipOver;
            const lipY = spy - lipOver;
            this.addSashBar(pivot, lipX, lipY + lipTH - lipBarW, lipTW, lipBarW, lipD, lipZ);
            this.addSashBar(pivot, lipX, lipY, lipTW, lipBarW, lipD, lipZ);
            this.addSashBar(pivot, lipX, lipY, lipBarW, lipTH, lipD, lipZ);
            this.addSashBar(pivot, lipX + lipTW - lipBarW, lipY, lipBarW, lipTH, lipD, lipZ);

            this.addGlazingBeads(
              pivot, 0, topHung ? -sH / 2 : sH / 2,
              clW - sashBarW * 2, sH - sashBarW * 2, 0
            );

            parent.add(pivot);
            const ref = {
              pivot,
              opening: op,
              leftHung: false,
              outward,
              targetDeg: op.degreesOpen,
              centerOffset: 0,
            };
            this.doorPivots.push(ref);
            
            // Add window sash meshes to doorMeshes for click detection
            pivot.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.userData.doorRef = ref;
                child.geometry.computeBoundingBox();
                child.geometry.computeBoundingSphere();
                this.doorMeshes.push(child);
              }
            });
            
            // Add invisible clickable plane in the sash opening area
            const clickPlaneX = l + (clL + clR) / 2;
            const clickPlaneY = topHung ? b + h - intFW - sH / 2 : b + intFW + sH / 2;
            const clickPlaneZ = mid;
            const clickPlaneMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
            const clickPlaneGeo = new THREE.PlaneGeometry(clW, sH);
            const clickPlane = new THREE.Mesh(clickPlaneGeo, clickPlaneMat);
            clickPlane.position.set(clickPlaneX, clickPlaneY, clickPlaneZ);
            clickPlane.userData.doorRef = ref;
            clickPlane.geometry.computeBoundingBox();
            clickPlane.geometry.computeBoundingSphere();
            parent.add(clickPlane);
            this.doorMeshes.push(clickPlane);
          }
        }
      }
    }

    if (ins.type === "door") {
      const df = 0.06;
      const gap = 0.01;
      const preset = ins.doorStyle ? DOOR_PRESETS[ins.doorStyle] : null;
      const panelThick = (preset?.thickness ?? 35) * MM_TO_M;

      // Door stop dimensions
      const stopW = 0.012; // 12mm wide
      const stopD = 0.010; // 10mm deep

      // Create U-shaped frame as three pieces (left, top, right) - no bottom
      const ext = 0.008;
      const frameMeshes: THREE.Mesh[] = [];
      
      // Left frame piece
      const leftFrameGeo = new THREE.BoxGeometry(df + ext, h + ext, wallT);
      const leftFrameMesh = new THREE.Mesh(leftFrameGeo, this.frameMat);
      leftFrameMesh.position.set(l + (df - ext) / 2, b + (h + ext) / 2, wallT / 2);
      leftFrameMesh.castShadow = false;
      leftFrameMesh.receiveShadow = false;
      parent.add(leftFrameMesh);
      frameMeshes.push(leftFrameMesh);
      
      // Top frame piece
      const topFrameGeo = new THREE.BoxGeometry(w + ext * 2, df + ext, wallT);
      const topFrameMesh = new THREE.Mesh(topFrameGeo, this.frameMat);
      topFrameMesh.position.set(l + w / 2, b + h + ext / 2 - df / 2, wallT / 2);
      topFrameMesh.castShadow = false;
      topFrameMesh.receiveShadow = false;
      parent.add(topFrameMesh);
      frameMeshes.push(topFrameMesh);
      
      // Right frame piece
      const rightFrameGeo = new THREE.BoxGeometry(df + ext, h + ext, wallT);
      const rightFrameMesh = new THREE.Mesh(rightFrameGeo, this.frameMat);
      rightFrameMesh.position.set(l + w - (df - ext) / 2, b + (h + ext) / 2, wallT / 2);
      rightFrameMesh.castShadow = false;
      rightFrameMesh.receiveShadow = false;
      parent.add(rightFrameMesh);
      frameMeshes.push(rightFrameMesh);

      // Architrave moulding on interior side
      this.addArchitrave(parent, l, b, w, h, wallT);

      const innerW = w - df * 2;
      const innerH = h - df;

      // Pre-calculate meeting edges to detect double doors sharing a meeting stile
      const scale = innerW / w;
      const meetingEdges = new Map<number, number>(); // edge position -> count
      for (const op of ins.openings) {
        const ow = op.width * MM_TO_M;
        const disp = op.displacement * MM_TO_M;
        // Non-hinge edge position (in inner coordinates)
        // Left-hung: hinge at disp, non-hinge at disp + width
        // Right-hung: hinge at disp + width, non-hinge at disp
        const nonHingeEdge = op.hanging === "left"
          ? (disp + ow) * scale
          : disp * scale;
        const rounded = Math.round(nonHingeEdge * 1000); // round to mm for comparison
        meetingEdges.set(rounded, (meetingEdges.get(rounded) ?? 0) + 1);
      }

      for (const op of ins.openings) {
        const ow = op.width * MM_TO_M;
        const disp = op.displacement * MM_TO_M;
        const leftHung = op.hanging === "left";
        const outward = op.open === "outwards";

        // Check if this door's non-hinge edge meets another door
        // Left-hung: hinge at disp, non-hinge at disp + width
        // Right-hung: hinge at disp + width, non-hinge at disp
        const nonHingeEdge = leftHung ? (disp + ow) * scale : disp * scale;
        const rounded = Math.round(nonHingeEdge * 1000);
        const hasMeetingStile = (meetingEdges.get(rounded) ?? 0) >= 2;
        
        // Use minimal gap (0.5mm) where doors meet to eliminate visible gap, full gap (10mm) at frame
        const doorGap = hasMeetingStile ? 0.0005 : gap;
        const panelW = ow * scale - doorGap;
        const panelH = innerH - gap;

        // Door stop position: on the side the door closes against
        // Outward: stop at interior (behind door at Z=panelThick)
        // Inward: stop at exterior (behind door at Z=wallT-panelThick)
        const stopZ = outward ? panelThick + stopD / 2 : wallT - panelThick - stopD / 2;
        const stopInnerL = l + df;
        const stopInnerW = w - df * 2;

        // Add door stop moulding as three pieces (left, top, right) - no bottom
        // Left stop
        const leftStopGeo = new THREE.BoxGeometry(stopW, innerH, stopD);
        const leftStopMesh = new THREE.Mesh(leftStopGeo, this.frameMat);
        leftStopMesh.position.set(stopInnerL + stopW / 2, b + innerH / 2, stopZ);
        leftStopMesh.castShadow = false;
        leftStopMesh.receiveShadow = false;
        parent.add(leftStopMesh);

        // Top stop
        const topStopGeo = new THREE.BoxGeometry(stopInnerW, stopW, stopD);
        const topStopMesh = new THREE.Mesh(topStopGeo, this.frameMat);
        topStopMesh.position.set(stopInnerL + stopInnerW / 2, b + innerH - stopW / 2, stopZ);
        topStopMesh.castShadow = false;
        topStopMesh.receiveShadow = false;
        parent.add(topStopMesh);

        // Right stop
        const rightStopGeo = new THREE.BoxGeometry(stopW, innerH, stopD);
        const rightStopMesh = new THREE.Mesh(rightStopGeo, this.frameMat);
        rightStopMesh.position.set(stopInnerL + stopInnerW - stopW / 2, b + innerH / 2, stopZ);
        rightStopMesh.castShadow = false;
        rightStopMesh.receiveShadow = false;
        parent.add(rightStopMesh);

        const pivot = new THREE.Group();
        // For left-hung: hinge is at left edge of door (at displacement)
        // For right-hung: hinge is at right edge of door (at displacement + door width)
        const pivotX = leftHung
          ? l + df + (disp / w) * innerW
          : l + df + ((disp + ow) / w) * innerW;
        // Door hinge is on the face the door CLOSES against
        // Outward: door closes at interior (0), swings toward exterior
        // Inward: door closes at exterior (wallT), swings toward interior
        const pivotZ = outward ? 0 : wallT;
        pivot.position.set(pivotX, b, pivotZ);

        const doorGroup = this.buildPanelledDoor(panelW, panelH, panelThick, leftHung, ins.hasHandle ?? false);
        // Door sits INSIDE the frame at the hinge face
        // Outward: hinge at 0, door from 0 to panelThick
        // Inward: hinge at wallT, door from wallT-panelThick to wallT
        const doorZOffset = outward ? panelThick / 2 : -panelThick / 2;
        doorGroup.position.set(
          leftHung ? panelW / 2 : -panelW / 2,
          panelH / 2,
          doorZOffset
        );

        pivot.add(doorGroup);
        parent.add(pivot);

        const centerOffset = leftHung ? panelW / 2 : -panelW / 2;
        const ref: DoorPivotRef = { pivot, opening: op, leftHung, outward, targetDeg: op.degreesOpen, centerOffset };
        this.doorPivots.push(ref);
        pivot.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.userData.doorRef = ref;
            child.geometry.computeBoundingBox();
            child.geometry.computeBoundingSphere();
            this.doorMeshes.push(child);
          }
        });

        // Add invisible clickable plane in the door opening area
        // This allows clicking on empty space to toggle the door even when it's open
        const clickPlaneW = panelW;
        const clickPlaneH = panelH;
        const clickPlaneX = leftHung
          ? l + df + (disp / w) * innerW + clickPlaneW / 2
          : l + df + ((disp + ow) / w) * innerW - clickPlaneW / 2;
        const clickPlaneY = b + clickPlaneH / 2;
        const clickPlaneZ = wallT / 2;
        
        const clickPlaneMat = new THREE.MeshBasicMaterial({
          visible: false,
          side: THREE.DoubleSide,
        });
        const clickPlaneGeo = new THREE.PlaneGeometry(clickPlaneW, clickPlaneH);
        const clickPlane = new THREE.Mesh(clickPlaneGeo, clickPlaneMat);
        clickPlane.position.set(clickPlaneX, clickPlaneY, clickPlaneZ);
        clickPlane.rotation.y = 0; // Face along Z axis (through the wall)
        clickPlane.userData.doorRef = ref;
        clickPlane.geometry.computeBoundingBox();
        clickPlane.geometry.computeBoundingSphere();
        parent.add(clickPlane);
        this.doorMeshes.push(clickPlane);

        // Also set doorRef on frame meshes so clicking the frame toggles the door
        // For multiple openings, the first opening's ref is used for the frame
        if (ins.openings.indexOf(op) === 0) {
          for (const fm of frameMeshes) {
            fm.userData.doorRef = ref;
            fm.geometry.computeBoundingBox();
            fm.geometry.computeBoundingSphere();
            this.doorMeshes.push(fm);
          }
        }
      }
    }

    this.roomGroup.add(parent);
  }

  private buildPanelledDoor(w: number, h: number, thick: number, leftHung: boolean, hasHandle: boolean): THREE.Group {
    const group = new THREE.Group();
    const recess = 0.006;
    const panelDepth = thick - recess * 2;

    const stileW = Math.max(w * 0.14, 0.040);
    const centerW = Math.max(w * 0.10, 0.028);
    const topRailH = Math.max(h * 0.055, 0.035);
    const lockRailH = Math.max(h * 0.075, 0.045);
    const btmRailH = Math.max(h * 0.11, 0.065);
    const lockRailCY = h * 0.42;

    const hw = w / 2;
    const hh = h / 2;

    const bar = (cx: number, cy: number, bw: number, bh: number, bd: number, isPanel = false) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, bd),
        isPanel ? this.doorPanelMat : this.doorMat
      );
      mesh.position.set(cx, cy, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      group.add(mesh);
    };

    bar(-hw + stileW / 2, 0, stileW, h, thick);
    bar(hw - stileW / 2, 0, stileW, h, thick);

    const railW = w - stileW * 2;
    bar(0, hh - topRailH / 2, railW, topRailH, thick);
    bar(0, -hh + btmRailH / 2, railW, btmRailH, thick);

    const lockY = -hh + lockRailCY;
    bar(0, lockY, railW, lockRailH, thick);

    const btmMuntinBot = -hh + btmRailH;
    const btmMuntinTop = lockY - lockRailH / 2;
    const btmMuntinH = btmMuntinTop - btmMuntinBot;
    if (btmMuntinH > 0.01) {
      bar(0, (btmMuntinBot + btmMuntinTop) / 2, centerW, btmMuntinH, thick);
    }

    const topMuntinBot = lockY + lockRailH / 2;
    const topMuntinTop = hh - topRailH;
    const topMuntinH = topMuntinTop - topMuntinBot;
    if (topMuntinH > 0.01) {
      bar(0, (topMuntinBot + topMuntinTop) / 2, centerW, topMuntinH, thick);
    }

    const pnlW = (w - stileW * 2 - centerW) / 2;
    const leftCX = -hw + stileW + pnlW / 2;
    const rightCX = hw - stileW - pnlW / 2;

    const addPanel = (cx: number, cy: number, pw: number, ph: number) => {
      const mouldW = 0.015;
      const bevelD = 0.005;
      const panelD = 0.004;
      
      // Recessed flat center panel
      const innerW = pw - mouldW * 2;
      const innerH = ph - mouldW * 2;
      const panelGeo = new THREE.BoxGeometry(innerW, innerH, panelD);
      const panelMesh = new THREE.Mesh(panelGeo, this.doorPanelMat);
      panelMesh.position.set(cx, cy, -(thick / 2 - recess - panelD / 2));
      panelMesh.castShadow = true;
      panelMesh.receiveShadow = false;
      group.add(panelMesh);
      
      // Outer moulding frame (sits between frame and panel)
      // Top moulding
      const topGeo = new THREE.BoxGeometry(pw, mouldW, bevelD);
      const topMesh = new THREE.Mesh(topGeo, this.doorMat);
      topMesh.position.set(cx, cy + ph / 2 - mouldW / 2, -(thick / 2 - recess / 2 - bevelD / 2));
      topMesh.castShadow = true;
      topMesh.receiveShadow = false;
      group.add(topMesh);
      
      // Bottom moulding
      const btmGeo = new THREE.BoxGeometry(pw, mouldW, bevelD);
      const btmMesh = new THREE.Mesh(btmGeo, this.doorMat);
      btmMesh.position.set(cx, cy - ph / 2 + mouldW / 2, -(thick / 2 - recess / 2 - bevelD / 2));
      btmMesh.castShadow = true;
      btmMesh.receiveShadow = false;
      group.add(btmMesh);
      
      // Left moulding
      const leftGeo = new THREE.BoxGeometry(mouldW, ph - mouldW * 2, bevelD);
      const leftMesh = new THREE.Mesh(leftGeo, this.doorMat);
      leftMesh.position.set(cx - pw / 2 + mouldW / 2, cy, -(thick / 2 - recess / 2 - bevelD / 2));
      leftMesh.castShadow = true;
      leftMesh.receiveShadow = false;
      group.add(leftMesh);
      
      // Right moulding
      const rightGeo = new THREE.BoxGeometry(mouldW, ph - mouldW * 2, bevelD);
      const rightMesh = new THREE.Mesh(rightGeo, this.doorMat);
      rightMesh.position.set(cx + pw / 2 - mouldW / 2, cy, -(thick / 2 - recess / 2 - bevelD / 2));
      rightMesh.castShadow = true;
      rightMesh.receiveShadow = false;
      group.add(rightMesh);
    };

    if (btmMuntinH > 0.01) {
      const cy = (btmMuntinBot + btmMuntinTop) / 2;
      addPanel(leftCX, cy, pnlW, btmMuntinH);
      addPanel(rightCX, cy, pnlW, btmMuntinH);
    }
    if (topMuntinH > 0.01) {
      const cy = (topMuntinBot + topMuntinTop) / 2;
      addPanel(leftCX, cy, pnlW, topMuntinH);
      addPanel(rightCX, cy, pnlW, topMuntinH);
    }

    // Add lever handles on both sides of the door (if enabled)
    if (hasHandle) {
      // Handle is on the opposite side from the hinge
      // UK standard handle height: 1000-1050mm from floor (using 1025mm)
      const handleX = leftHung ? hw - stileW / 2 : -hw + stileW / 2;
      const handleY = -hh + 1.025; // 1025mm from bottom of door
      
      // Front handle (exterior side, Z positive)
      // Use left-handed model for left-hung doors (lever points left)
      // Use right-handed model for right-hung doors (lever points right)
      const handleFront = this.buildLeverHandle(leftHung ? "left" : "right");
      handleFront.position.set(handleX, handleY, thick / 2);
      group.add(handleFront);
      
      // Back handle (interior side, Z negative)
      // Mirrored - left-hung door needs right-handed handle on back (from back view, hinge is on right)
      const handleBack = this.buildLeverHandle(leftHung ? "right" : "left");
      handleBack.position.set(handleX, handleY, -thick / 2);
      handleBack.rotation.y = Math.PI; // Face opposite direction
      group.add(handleBack);
    }

    return group;
  }

  private buildLeverHandle(hand: "left" | "right"): THREE.Group {
    const handle = new THREE.Group();
    
    // Direction: left = lever extends in -X, right = lever extends in +X
    const dir = hand === "left" ? -1 : 1;
    
    // === ROSETTE (flush to door surface at Z=0) ===
    // Circular backplate: radius 26mm, depth 8mm
    const roseRadius = 0.026;
    const roseDepth = 0.008;
    const roseGeo = new THREE.CylinderGeometry(roseRadius, roseRadius, roseDepth, 32);
    roseGeo.rotateX(Math.PI / 2);
    const rose = new THREE.Mesh(roseGeo, this.handleMat);
    rose.position.z = roseDepth / 2;
    rose.castShadow = true;
    handle.add(rose);
    
    // === LEVER ASSEMBLY (neck + handle, tilted up 10 degrees) ===
    const leverAssembly = new THREE.Group();
    leverAssembly.position.z = roseDepth; // Start at rose surface
    
    // Tilt up by 10 degrees (rotate around X axis since lever extends along Z then X)
    const tiltAngle = dir * 10 * (Math.PI / 180); // 10 degrees in radians
    leverAssembly.rotation.z = tiltAngle;
    
    // === NECK (short cylinder connecting rose to handle) ===
    // Radius 10mm, length 12mm
    const neckRadius = 0.010;
    const neckLength = 0.012;
    const neckGeo = new THREE.CylinderGeometry(neckRadius, neckRadius, neckLength, 16);
    neckGeo.rotateX(Math.PI / 2); // Point along Z axis (out from door)
    const neck = new THREE.Mesh(neckGeo, this.handleMat);
    neck.position.z = neckLength / 2;
    neck.castShadow = true;
    leverAssembly.add(neck);
    
    // === HANDLE (swept along Bezier curve) ===
    // Profile radius 8mm, total length ~110mm
    const handleRadius = 0.008;
    const handleLength = 0.110;
    const neckEndZ = neckLength;
    
    // Bezier curve: starts at neck end, goes horizontal (along X), 
    // arcs slightly up then gently tapers down
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0, neckEndZ),                                    // Start at neck
      new THREE.Vector3(dir * handleLength * 0.3, 0.008, neckEndZ),         // Control 1: slight rise
      new THREE.Vector3(dir * handleLength * 0.7, 0.005, neckEndZ),         // Control 2: begin descent
      new THREE.Vector3(dir * handleLength, -0.015, neckEndZ)               // End: curved down
    );
    
    const handleGeo = new THREE.TubeGeometry(curve, 32, handleRadius, 12, false);
    const handleMesh = new THREE.Mesh(handleGeo, this.handleMat);
    handleMesh.castShadow = true;
    leverAssembly.add(handleMesh);
    
    // === START CAP (where handle meets neck) ===
    const startCapGeo = new THREE.SphereGeometry(handleRadius, 12, 8);
    const startCap = new THREE.Mesh(startCapGeo, this.handleMat);
    startCap.position.copy(curve.getPoint(0));
    startCap.castShadow = true;
    leverAssembly.add(startCap);
    
    // === TIP (rounded end cap) ===
    const tipGeo = new THREE.SphereGeometry(handleRadius * 0.9, 12, 8);
    const tip = new THREE.Mesh(tipGeo, this.handleMat);
    tip.position.copy(curve.getPoint(1));
    tip.castShadow = true;
    leverAssembly.add(tip);
    
    handle.add(leverAssembly);
    
    return handle;
  }

  private addFrameBar(
    parent: THREE.Group,
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number
  ) {
    const r = 0.003;
    const minDim = Math.min(w, h);
    const cr = Math.min(r, minDim / 2 - 0.0005);

    if (cr < 0.001) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        this.frameMat
      );
      mesh.position.set(cx, cy, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return;
    }

    const shape = new THREE.Shape();
    shape.moveTo(cr, 0);
    shape.lineTo(w - cr, 0);
    shape.absarc(w - cr, cr, cr, -Math.PI / 2, 0, false);
    shape.lineTo(w, h - cr);
    shape.absarc(w - cr, h - cr, cr, 0, Math.PI / 2, false);
    shape.lineTo(cr, h);
    shape.absarc(cr, h - cr, cr, Math.PI / 2, Math.PI, false);
    shape.lineTo(0, cr);
    shape.absarc(cr, cr, cr, Math.PI, Math.PI * 1.5, false);

    const bevelR = Math.min(cr, d / 2 - 0.001);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: d - bevelR * 2,
      bevelEnabled: bevelR > 0.0005,
      bevelThickness: bevelR,
      bevelSize: bevelR,
      bevelSegments: 2,
    });
    const mesh = new THREE.Mesh(geo, this.frameMat);
    mesh.position.set(cx - w / 2, cy - h / 2, cz - d / 2 + bevelR);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }

  private addSashBar(
    group: THREE.Group,
    x: number,
    y: number,
    w: number,
    h: number,
    d: number,
    z = 0
  ) {
    const r = 0.004;
    const minDim = Math.min(w, h);
    const cr = Math.min(r, minDim / 2 - 0.0005);

    if (cr < 0.001) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        this.frameMat
      );
      mesh.position.set(x + w / 2, y + h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return;
    }

    const shape = new THREE.Shape();
    shape.moveTo(cr, 0);
    shape.lineTo(w - cr, 0);
    shape.absarc(w - cr, cr, cr, -Math.PI / 2, 0, false);
    shape.lineTo(w, h - cr);
    shape.absarc(w - cr, h - cr, cr, 0, Math.PI / 2, false);
    shape.lineTo(cr, h);
    shape.absarc(cr, h - cr, cr, Math.PI / 2, Math.PI, false);
    shape.lineTo(0, cr);
    shape.absarc(cr, cr, cr, Math.PI, Math.PI * 1.5, false);

    const bevelR = Math.min(cr, d / 2 - 0.001);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: d - bevelR * 2,
      bevelEnabled: true,
      bevelThickness: bevelR,
      bevelSize: bevelR,
      bevelSegments: 3,
    });

    const mesh = new THREE.Mesh(geo, this.frameMat);
    mesh.position.set(x, y, z - d / 2 + bevelR);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  private addWedgeBar(
    group: THREE.Group,
    x: number,
    y: number,
    w: number,
    h: number,
    zGlass: number,
    bdThick: number,
    bdThin: number,
    thickEdge: "bottom" | "top" | "left" | "right"
  ) {
    // Beads protrude toward +Z (interior / room side)
    const zt = zGlass + bdThick;
    const zn = zGlass + bdThin;
    let z0: number, z1: number, z2: number, z3: number;
    switch (thickEdge) {
      case "bottom":
        z0 = zt; z1 = zt; z2 = zn; z3 = zn; break;
      case "top":
        z0 = zn; z1 = zn; z2 = zt; z3 = zt; break;
      case "left":
        z0 = zt; z1 = zn; z2 = zn; z3 = zt; break;
      case "right":
        z0 = zn; z1 = zt; z2 = zt; z3 = zn; break;
    }

    const f0 = [x, y, zGlass];
    const f1 = [x + w, y, zGlass];
    const f2 = [x + w, y + h, zGlass];
    const f3 = [x, y + h, zGlass];
    const b0 = [x, y, z0];
    const b1 = [x + w, y, z1];
    const b2 = [x + w, y + h, z2];
    const b3 = [x, y + h, z3];

    const positions: number[] = [];
    const indices: number[] = [];
    const addQuad = (a: number[], b: number[], c: number[], d: number[]) => {
      const i = positions.length / 3;
      positions.push(...a, ...b, ...c, ...d);
      indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
    };

    // All windings reversed vs -Z version so normals face outward
    addQuad(b1, b2, b3, b0);
    addQuad(f0, f3, f2, f1);
    addQuad(f1, b1, b0, f0);
    addQuad(b2, f2, f3, b3);
    addQuad(b0, b3, f3, f0);
    addQuad(f1, f2, b2, b1);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.frameMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  private addGlazingBeads(
    group: THREE.Group,
    gcx: number,
    gcy: number,
    gw: number,
    gh: number,
    glassZ: number
  ) {
    const bw = 0.015;
    const bdThick = 0.008;
    const bdThin = 0.002;
    const x0 = gcx - gw / 2;
    const y0 = gcy - gh / 2;

    this.addWedgeBar(group, x0, y0, gw, bw, glassZ, bdThick, bdThin, "bottom");
    this.addWedgeBar(group, x0, y0 + gh - bw, gw, bw, glassZ, bdThick, bdThin, "top");
    this.addWedgeBar(group, x0, y0 + bw, bw, gh - bw * 2, glassZ, bdThick, bdThin, "left");
    this.addWedgeBar(group, x0 + gw - bw, y0 + bw, bw, gh - bw * 2, glassZ, bdThick, bdThin, "right");
  }

  private addBox(
    parent: THREE.Group,
    x: number,
    y: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x + w / 2, y + h / 2, d / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  resize() {
    if (!this.renderer) return;
    const el = this.renderer.domElement.parentElement;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._needsRender = true;
  }

  private updateMovement(delta: number) {
    if (!this._hasFocus) return;

    const k = this.keys;
    const LOOK_SPEED = 2.5;
    const ySign = this.invertY ? -1 : 1;
    if (k["ArrowLeft"])  this._targetYaw += LOOK_SPEED * delta;
    if (k["ArrowRight"]) this._targetYaw -= LOOK_SPEED * delta;
    if (k["ArrowUp"])    this._targetPitch += LOOK_SPEED * delta * ySign;
    if (k["ArrowDown"])  this._targetPitch -= LOOK_SPEED * delta * ySign;
    this._targetPitch = Math.max(this._minPitch, Math.min(this._maxPitch, this._targetPitch));

    const lf = 1 - Math.exp(-20 * delta);
    this._currentYaw += (this._targetYaw - this._currentYaw) * lf;
    this._currentPitch += (this._targetPitch - this._currentPitch) * lf;
    this._lookEuler.set(this._currentPitch, this._currentYaw, 0, "YXZ");
    this.camera.quaternion.setFromEuler(this._lookEuler);

    const dist = WALK_SPEED * delta;
    if (k["KeyW"] || k["KeyS"]) {
      const d = (k["KeyW"] ? dist : 0) + (k["KeyS"] ? -dist : 0);
      this._moveVec.setFromMatrixColumn(this.camera.matrix, 0);
      this._moveVec.crossVectors(this.camera.up, this._moveVec);
      this.camera.position.addScaledVector(this._moveVec, d);
    }
    if (k["KeyA"] || k["KeyD"]) {
      const d = (k["KeyD"] ? dist : 0) + (k["KeyA"] ? -dist : 0);
      this._moveVec.setFromMatrixColumn(this.camera.matrix, 0);
      this.camera.position.addScaledVector(this._moveVec, d);
    }
    this._targetEyeHeight = this.kneeling ? KNEEL_HEIGHT : EYE_HEIGHT;
    this.resolveCollisions();

    if (k["KeyE"]) {
      k["KeyE"] = false;
      this.interactDoor();
    }
  }

  private resolveCollisions() {
    const pos = this.camera.position;
    for (let iter = 0; iter < 5; iter++) {
      let pushed = false;
      for (const seg of this.collisionSegs) {
        const dx = seg.bx - seg.ax;
        const dz = seg.bz - seg.az;
        const len2 = dx * dx + dz * dz;
        if (len2 < 0.0001) continue;

        let t = ((pos.x - seg.ax) * dx + (pos.z - seg.az) * dz) / len2;
        t = Math.max(0, Math.min(1, t));

        const cx = seg.ax + t * dx;
        const cz = seg.az + t * dz;
        const toX = pos.x - cx;
        const toZ = pos.z - cz;
        const dist = Math.sqrt(toX * toX + toZ * toZ);

        if (dist < PLAYER_RADIUS) {
          if (dist < 0.0001) {
            pos.x += seg.nx * PLAYER_RADIUS;
            pos.z += seg.nz * PLAYER_RADIUS;
            pushed = true;
          } else {
            // Push player away from segment - works from both sides
            const push = (PLAYER_RADIUS - dist) / dist;
            pos.x += toX * push;
            pos.z += toZ * push;
            pushed = true;
          }
        }
      }
      if (!pushed) break;
    }
  }

  interactDoor() {
    this.camera.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    this.raycaster.set(this.camera.position.clone(), camDir);
    
    const hits = this.raycaster.intersectObjects(this.doorMeshes, false);
    
    for (const hit of hits) {
      if (hit.distance > 5) break;
      const ref = hit.object.userData.doorRef as DoorPivotRef | undefined;
      if (ref) {
        const op = ref.opening;
        if (ref.targetDeg > op.minDegree) {
          ref.targetDeg = op.minDegree;
          op.state = "closed";
        } else {
          ref.targetDeg = op.maxDegree;
          op.state = "open";
        }
        break;
      }
    }
  }

  private _needsRender = true;

  private updateDoors(delta: number): boolean {
    const MIN_OPEN_DEGREES = 45;
    let animating = false;
    for (const ref of this.doorPivots) {
      const op = ref.opening;
      const prevDeg = op.degreesOpen;
      const diff = ref.targetDeg - op.degreesOpen;
      if (Math.abs(diff) < 0.1) {
        op.degreesOpen = ref.targetDeg;
      } else {
        op.degreesOpen += diff * (1 - Math.exp(-10 * delta));
        animating = true;
      }

      // Check if door crossed the walkable threshold - rebuild collision if so
      const wasOpen = prevDeg >= MIN_OPEN_DEGREES;
      const isOpen = op.degreesOpen >= MIN_OPEN_DEGREES;
      if (wasOpen !== isOpen) {
        this.needsCollisionRebuild = true;
      }

      const rad = op.degreesOpen * (Math.PI / 180);
      const hanging = op.hanging;

      if (hanging === "left" || hanging === "right") {
        let swing = rad;
        // Left-hung: positive rotation swings door away from hinge (correct for outward at Z=0)
        // Right-hung: negative rotation swings door away from hinge
        // Inward doors need opposite rotation since pivot is at exterior face
        if (!ref.leftHung) swing = -swing;
        if (!ref.outward) swing = -swing;
        ref.pivot.rotation.y = swing;
      } else if (hanging === "top") {
        ref.pivot.rotation.x = ref.outward ? rad : -rad;
      } else if (hanging === "bottom") {
        ref.pivot.rotation.x = ref.outward ? -rad : rad;
      }
    }
    return animating;
  }

  private _targetEyeHeight = EYE_HEIGHT;

  requestRender() {
    this._targetEyeHeight = this.kneeling ? KNEEL_HEIGHT : EYE_HEIGHT;
    this._needsRender = true;
  }

  private updateEyeHeight(delta: number): boolean {
    const diff = this._targetEyeHeight - this.camera.position.y;
    if (Math.abs(diff) < 0.001) {
      this.camera.position.y = this._targetEyeHeight;
      return false;
    }
    this.camera.position.y += diff * (1 - Math.exp(-8 * delta));
    return true;
  }

  private animate = () => {
    if (this._disposed) return;
    this.animationId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const hasFocus = this._hasFocus;
    if (hasFocus) this.updateMovement(delta);
    const doorsAnimating = this.updateDoors(delta);
    const heightAnimating = this.updateEyeHeight(delta);

    // Rebuild collision when doors cross the walkable threshold
    if (this.needsCollisionRebuild && this.currentRoomShape) {
      this.buildCollision(this.currentRoomShape);
      this.needsCollisionRebuild = false;
    }

    if (hasFocus || doorsAnimating || heightAnimating || this._needsRender) {
      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer?.render(this.scene, this.camera);
      }
      this._needsRender = false;
    }
  };

  private disposeGroup(group: THREE.Group) {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
  }

  dispose() {
    this._disposed = true;
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    if (this._onMouseMove) document.removeEventListener("mousemove", this._onMouseMove);
    if (this._onMouseUp) document.removeEventListener("mouseup", this._onMouseUp);
    if (this._onMouseDown && this._canvas) {
      this._canvas.removeEventListener("mousedown", this._onMouseDown);
    }
    if (this._onKeyDown) document.removeEventListener("keydown", this._onKeyDown);
    if (this._onKeyUp) document.removeEventListener("keyup", this._onKeyUp);
    document.exitPointerLock();
    this._canvas = null;
    this._hasFocus = false;
    this._isDragging = false;
    this.disposeGroup(this.roomGroup);
    this.composer?.dispose();
    this.renderer?.dispose();
    this.wallExtMat.dispose();
    this.wallIntMat.dispose();
    this.floorMat.dispose();
    this.floorTexture?.dispose();
    this.ceilingMat.dispose();
    this.mouldingMat.dispose();
    this.glassMat.dispose();
    this.frameMat.dispose();
    this.doorMat.dispose();
    this.doorPanelMat.dispose();
    this.handleMat.dispose();
    this.lightFixtureMat.dispose();
    this.lightBulbMat.dispose();
    this.spotlightRimMat.dispose();
    this.cableMat.dispose();
    this.envMap?.dispose();
    if (this.groundMesh) {
      this.groundMesh.geometry.dispose();
      (this.groundMesh.material as THREE.Material).dispose();
    }
  }
}
