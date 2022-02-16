import {Component, AfterViewInit, ViewChild, Input, ElementRef} from '@angular/core';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import {GUI} from 'three/examples/jsm/libs/dat.gui.module.js';

@Component({
  selector: 'app-engine3d',
  templateUrl: './engine3d.component.html',
  styleUrls: ['./engine3d.component.css']
})
export class Engine3dComponent implements AfterViewInit {

  @ViewChild('canvas3d') canvas3dRef: ElementRef;
  @Input() roomShape;

  renderer = null;
  scene = null;
  camera = null;
  controls = null;

  bulbLuminousPowers = {
    '110000 lm (1000W)': 110000,
    '3500 lm (300W)': 3500,
    '1700 lm (100W)': 1700,
    '800 lm (60W)': 800,
    '400 lm (40W)': 400,
    '180 lm (25W)': 180,
    '20 lm (4W)': 20,
    Off: 0
  };

  hemiLuminousIrradiances = {
    '0.0001 lx (Moonless Night)': 0.0001,
    '0.002 lx (Night Airglow)': 0.002,
    '0.5 lx (Full Moon)': 0.5,
    '3.4 lx (City Twilight)': 3.4,
    '50 lx (Living Room)': 50,
    '100 lx (Very Overcast)': 100,
    '350 lx (Office Room)': 350,
    '400 lx (Sunrise/Sunset)': 400,
    '1000 lx (Overcast)': 1000,
    '18000 lx (Daylight)': 18000,
    '50000 lx (Direct Sun)': 50000
  };

  params = {
    shadows: true,
    exposure: 0.68,
    bulbPower: Object.keys(this.bulbLuminousPowers)[2],
    hemiIrradiance: Object.keys(this.hemiLuminousIrradiances)[4]
  };

  private cubeMat;
  private bulbLight;
  private previousShadowMap;
  private ballMat;
  private bulbMat;
  private floorMat;
  private hemiLight;

  private calculateAspectRatio(): number {
    const height = this.canvas3d.clientHeight;
    if (height === 0) {
      return 0;
    }
    return this.canvas3d.offsetWidth / this.canvas3d.offsetHeight;
  }

  private get canvas3d(): HTMLCanvasElement {
    return this.canvas3dRef.nativeElement;
  }

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(20, 800 / 600, 0.1, 100);
  }

  ngAfterViewInit() {
    this.configScene();
    this.configCamera();
    this.configRenderer();
    this.configControls();
    this.createLight();
    this.createMesh();
    this.animate();
  }

  configScene() {
    this.scene.background = new THREE.Color(0x000000);
  }

  configCamera() {
    this.camera.aspect = this.calculateAspectRatio();
    this.camera.updateProjectionMatrix();
    this.camera.position.x = -5;
    this.camera.position.z = 2;
    this.camera.position.y = 1;
  }

  configRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas3d,
      antialias: true,
      alpha: true
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
    // this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.canvas3d.clientWidth, this.canvas3d.clientHeight);
  }

  configControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.autoRotate = false;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.enableKeys = true;
    this.controls.update();

    const gui = new GUI();

    gui.add(this.params, 'hemiIrradiance', Object.keys(this.hemiLuminousIrradiances));
    gui.add(this.params, 'bulbPower', Object.keys(this.bulbLuminousPowers));
    gui.add(this.params, 'exposure', 0, 1);
    gui.add(this.params, 'shadows');
    gui.close();
  }

  createLight() {
    const bulbGeometry = new THREE.SphereBufferGeometry(0.02, 16, 8);
    this.bulbLight = new THREE.PointLight(0xffee88, 1, 100, 2);

    this.bulbMat = new THREE.MeshStandardMaterial({
      emissive: 0xffffee,
      emissiveIntensity: 1,
      color: 0x000000
    });
    this.bulbLight.add(new THREE.Mesh(bulbGeometry, this.bulbMat));
    this.bulbLight.position.set(0, 2, 0);
    this.bulbLight.castShadow = true;
    this.bulbLight.shadow.radius = 10;

    this.scene.add(this.bulbLight);

    this.hemiLight = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.02);
    this.scene.add(this.hemiLight);
  }

  createMesh() {
    this.floorMat = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      color: 0xffffff,
      metalness: 0.2,
      bumpScale: 0.0005
    });

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('assets/textures/hardwood2_diffuse.jpg', (map) => {
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = 4;
      map.repeat.set(10, 24);
      map.encoding = THREE.sRGBEncoding;
      this.floorMat.map = map;
      this.floorMat.needsUpdate = true;
    });

    textureLoader.load('assets/textures/hardwood2_bump.jpg', (map) => {
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = 4;
      map.repeat.set(10, 24);
      this.floorMat.bumpMap = map;
      this.floorMat.needsUpdate = true;
    });

    textureLoader.load('assets/textures/hardwood2_roughness.jpg', (map) => {
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = 4;
      map.repeat.set(10, 24);
      this.floorMat.roughnessMap = map;
      this.floorMat.needsUpdate = true;
    });

    const floorGeometry = new THREE.PlaneBufferGeometry(80, 80);
    const floorMesh = new THREE.Mesh(floorGeometry, this.floorMat);
    floorMesh.receiveShadow = true;
    floorMesh.rotation.x = -Math.PI / 2.0;
    this.scene.add(floorMesh);

    this.cubeMat = new THREE.MeshStandardMaterial({
      roughness: 0.7,
      color: 0xffffff,
      bumpScale: 0.002,
      metalness: 0.2
    });

    textureLoader.load('assets/textures/brick_diffuse.jpg', (map) => {
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = 4;
      map.repeat.set(1, 1);
      map.encoding = THREE.sRGBEncoding;
      this.cubeMat.map = map;
      this.cubeMat.needsUpdate = true;
    });

    textureLoader.load('assets/textures/brick_bump.jpg', (map) => {
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = 4;
      map.repeat.set(1, 1);
      this.cubeMat.bumpMap = map;
      this.cubeMat.needsUpdate = true;
    });

    this.ballMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 1.0
    });

    textureLoader.load('assets/textures/planets/earth_atmos_2048.jpg', (map) => {
      map.anisotropy = 4;
      map.encoding = THREE.sRGBEncoding;
      this.ballMat.map = map;
      this.ballMat.needsUpdate = true;
    });

    textureLoader.load('assets/textures/planets/earth_specular_2048.jpg', (map) => {
      map.anisotropy = 4;
      map.encoding = THREE.sRGBEncoding;
      this.ballMat.metalnessMap = map;
      this.ballMat.needsUpdate = true;
    });

    const ballGeometry = new THREE.SphereBufferGeometry(0.25, 32, 32);
    const ballMesh = new THREE.Mesh(ballGeometry, this.ballMat);
    ballMesh.position.set(1, 0.25, 1);
    ballMesh.rotation.y = Math.PI;
    ballMesh.castShadow = true;
    this.scene.add(ballMesh);

    const boxGeometry = new THREE.BoxBufferGeometry(0.5, 0.5, 0.5);
    const boxMesh = new THREE.Mesh(boxGeometry, this.cubeMat);
    boxMesh.position.set(-0.5, 0.25, -1);
    boxMesh.castShadow = true;
    this.scene.add(boxMesh);

    const boxMesh2 = new THREE.Mesh(boxGeometry, this.cubeMat);
    boxMesh2.position.set(0, 0.25, -5);
    boxMesh2.castShadow = true;
    this.scene.add(boxMesh2);

    const boxMesh3 = new THREE.Mesh(boxGeometry, this.cubeMat);
    boxMesh3.position.set(7, 0.25, 0);
    boxMesh3.castShadow = true;
    this.scene.add(boxMesh3);
  }


  animate() {
    window.requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.render();
  }

  render() {
    this.renderer.toneMappingExposure = Math.pow(this.params.exposure, 5.0); // to allow for very bright scenes.
    this.renderer.shadowMap.enabled = this.params.shadows;
    this.bulbLight.castShadow = this.params.shadows;
    if (this.params.shadows !== this.previousShadowMap) {
      this.ballMat.needsUpdate = true;
      this.cubeMat.needsUpdate = true;
      this.floorMat.needsUpdate = true;
      this.previousShadowMap = this.params.shadows;
    }
    this.bulbLight.power = this.bulbLuminousPowers[this.params.bulbPower];
    this.bulbMat.emissiveIntensity = this.bulbLight.intensity / Math.pow(0.02, 2.0); // convert from intensity to irradiance at bulb surface

    this.hemiLight.intensity = this.hemiLuminousIrradiances[this.params.hemiIrradiance];
    const time = Date.now() * 0.0009;

    this.bulbLight.position.y = Math.cos(time) * 0.25 + 1.25;
    this.bulbLight.position.x = Math.sin(time) * 0.75 + 0.25;
    this.bulbLight.position.z = Math.cos(time) * 1.75 + 0.5;

    this.renderer.render(this.scene, this.camera);

  }

}
