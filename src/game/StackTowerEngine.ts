import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getAtmosphereColors, getBlockColor } from './colorPalette';
import { soundEngine } from '../audio/soundEngine';
import { hapticEngine } from '../audio/hapticEngine';
import { highScoreService } from '../services/highScoreService';

export type GamePhase = 'idle' | 'playing' | 'gameover';

export type ProgressionTier = 'Easy' | 'Medium' | 'Hard' | 'Insane';

export interface LevelProgressionInfo {
  level: number;
  tier: ProgressionTier;
  speed: number;
}

export function computeProgressionLevel(score: number, speed: number): LevelProgressionInfo {
  const level = Math.floor(Math.max(0, score) / 15) + 1;
  let tier: ProgressionTier = 'Easy';
  if (score >= 90 || speed >= 12.2) {
    tier = 'Insane';
  } else if (score >= 48 || speed >= 9.8) {
    tier = 'Hard';
  } else if (score >= 18 || speed >= 7.2) {
    tier = 'Medium';
  }
  return { level, tier, speed };
}

export interface DropFeedback {
  id: number;
  pointsAdded: number;
  coinsAdded: number;
  pickedUpCoin: boolean;
  isPerfect: boolean;
  combo: number;
  expanded: boolean;
  colorHex: string;
}

export interface GameCallbacks {
  onScoreChange: (
    score: number,
    bestScore: number,
    combo: number,
    levelInfo: LevelProgressionInfo,
    runCoins: number,
  ) => void;
  onPhaseChange: (phase: GamePhase) => void;
  onDropFeedback: (feedback: DropFeedback) => void;
  onGameOver: (
    finalScore: number,
    bestScore: number,
    maxCombo: number,
    runCoins: number,
  ) => void;
}

interface StackedLayer {
  mesh: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  x: number;
  z: number;
  width: number;
  depth: number;
  y: number;
  flash: number;
  bounce: number;
}

interface FallingPiece {
  mesh: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  rz: number;
  life: number;
}

interface ShockwaveEffect {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  duration: number;
  baseWidth: number;
  baseDepth: number;
}

interface FloatingCoinToken {
  group: THREE.Group;
  x: number;
  z: number;
  baseY: number;
  phaseOffset: number;
}

interface CoinPickupBurst {
  group: THREE.Group;
  age: number;
  duration: number;
  startY: number;
}

const INITIAL_SIZE = 3.6;
const BLOCK_HEIGHT = 0.56;
const SLIDE_LIMIT = 5.1;
const BASE_SLIDE_SPEED = 4.6;
const MAX_SLIDE_SPEED = 13.8;
const PERFECT_TOLERANCE = 0.17;
const MIN_SURVIVING_SLAB = 0.045;
const STREAK_TO_EXPAND = 5;
const EXPAND_AMOUNT = 0.34;
const GRAVITY = -28;
const COIN_RADIUS = 0.34;

// Pre-allocated math helpers to ensure zero GC pressure in the render loop
const _tempColor = new THREE.Color();
const _whiteColor = new THREE.Color(0xffffff);

export class StackTowerEngine {
  private container: HTMLElement;
  private callbacks: GameCallbacks;

  private isSoftwareGl: boolean;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private keyLight: THREE.DirectionalLight;

  private bgCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private bgTexture: THREE.CanvasTexture;
  private currentTopBg = new THREE.Color('#141830');
  private currentBottomBg = new THREE.Color('#252B5C');
  private targetTopBg = new THREE.Color('#141830');
  private targetBottomBg = new THREE.Color('#252B5C');

  private sharedBoxGeo: THREE.BoxGeometry;
  private sharedCoinDiscGeo: THREE.CylinderGeometry;
  private sharedCoinCoreGeo: THREE.CylinderGeometry;
  private sharedCoinGoldMat: THREE.MeshStandardMaterial;
  private sharedCoinEmblemMat: THREE.MeshStandardMaterial;
  private shockwaveGeo: THREE.BufferGeometry;

  private pedestalGroup: THREE.Group;
  private pedestalCoreMat!: THREE.MeshPhysicalMaterial;
  private stackGroup: THREE.Group;
  private debrisGroup: THREE.Group;
  private effectsGroup: THREE.Group;

  private layers: StackedLayer[] = [];
  private fallingPieces: FallingPiece[] = [];
  private shockwaves: ShockwaveEffect[] = [];
  private activeCoin: FloatingCoinToken | null = null;
  private coinBursts: CoinPickupBurst[] = [];

  private activeMesh: THREE.Mesh | null = null;
  private activeMat: THREE.MeshPhysicalMaterial | null = null;
  private activeAxis: 'x' | 'z' = 'x';
  private activeDirection: 1 | -1 = 1;
  private activeCenter = 0;
  private activePos = -SLIDE_LIMIT;
  private activeWidth = INITIAL_SIZE;
  private activeDepth = INITIAL_SIZE;
  private activeSpeed = BASE_SLIDE_SPEED;

  private phase: GamePhase = 'idle';
  private totalLayers = 1;
  private score = 0;
  private bestScore = 0;
  private combo = 0;
  private maxCombo = 0;
  private runCoins = 0;
  private seedOffset = 0;
  private feedbackCounter = 0;

  private cameraTargetY = 1.5;
  private cameraCurrentY = 1.5;
  private baseFrustumSize = 13.5;
  private currentZoomOut = 1.0;
  private targetZoomOut = 1.0;
  private shakeIntensity = 0;
  private shakeTime = 0;
  private punchZoom = 0;
  private reducedMotion = false;
  private idleTime = 0;

  private clock = new THREE.Clock();
  private frameId = 0;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: GameCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.bestScore = highScoreService.getBestScore();

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // 1. Detect software WebGL from GPU renderer string
    this.isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 2. Renderer initialization
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    // 3. Scene & Procedural Sky Gradient Texture
    this.scene = new THREE.Scene();

    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = 4;
    this.bgCanvas.height = 256;
    this.bgCtx = this.bgCanvas.getContext('2d')!;
    this.bgTexture = new THREE.CanvasTexture(this.bgCanvas);
    this.bgTexture.colorSpace = THREE.SRGBColorSpace;
    this.updateBackgroundTexture();
    this.scene.background = this.bgTexture;
    this.scene.fog = new THREE.FogExp2(0x1b2048, 0.012);

    // Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Isometric Orthographic Camera
    this.camera = new THREE.OrthographicCamera(-6, 6, 8, -8, 0.1, 180);
    this.updateCameraFrustum(width, height);

    // 5. Three-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xbce3ff, 0x1e1b4b, 0.9);
    hemiLight.position.set(0, 40, 0);
    this.scene.add(hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff5e4, 1.95);
    this.keyLight.position.set(12, 24, 16);
    if (!this.isSoftwareGl) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.width = 1024;
      this.keyLight.shadow.mapSize.height = 1024;
      const d = 9.5;
      this.keyLight.shadow.camera.left = -d;
      this.keyLight.shadow.camera.right = d;
      this.keyLight.shadow.camera.top = d;
      this.keyLight.shadow.camera.bottom = -d;
      this.keyLight.shadow.camera.near = 1;
      this.keyLight.shadow.camera.far = 65;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.75);
    rimLight.position.set(-14, 15, -12);
    this.scene.add(rimLight);

    // 6. Shared Geometries & Coin PBR Materials
    this.sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.sharedCoinDiscGeo = new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, 0.09, 24);
    this.sharedCoinDiscGeo.rotateZ(Math.PI / 2);
    this.sharedCoinCoreGeo = new THREE.CylinderGeometry(
      COIN_RADIUS * 0.66,
      COIN_RADIUS * 0.66,
      0.115,
      16,
    );
    this.sharedCoinCoreGeo.rotateZ(Math.PI / 2);

    this.sharedCoinGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.18,
      metalness: 0.88,
      emissive: 0x854d0e,
      emissiveIntensity: 0.22,
    });
    this.sharedCoinEmblemMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.14,
      metalness: 0.92,
      emissive: 0xa16207,
      emissiveIntensity: 0.28,
    });

    this.shockwaveGeo = this.createFrameRingGeometry();

    // 7. Scene Hierarchy Groups
    this.pedestalGroup = this.buildCompositePedestal();
    this.stackGroup = new THREE.Group();
    this.debrisGroup = new THREE.Group();
    this.effectsGroup = new THREE.Group();

    this.scene.add(this.pedestalGroup);
    this.scene.add(this.stackGroup);
    this.scene.add(this.debrisGroup);
    this.scene.add(this.effectsGroup);

    // Initialize starting idle tower
    this.setupInitialTower();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this.container);
    }
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.clock.start();
    this.startLoop();
  }

  private buildCompositePedestal(): THREE.Group {
    const group = new THREE.Group();

    // Part 1: Soft radial contact shadow plane at base
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(5, 8, 22, 0.65)');
    grad.addColorStop(0.6, 'rgba(5, 8, 22, 0.25)');
    grad.addColorStop(1, 'rgba(5, 8, 22, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6, 8.6),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -5.42;
    group.add(shadowPlane);

    // Part 2: Wide Slate Foundation Terrace
    const foundationMat = new THREE.MeshStandardMaterial({
      color: 0x1e2442,
      roughness: 0.78,
      metalness: 0.16,
    });
    const foundationMesh = new THREE.Mesh(this.sharedBoxGeo, foundationMat);
    foundationMesh.scale.set(5.0, 0.55, 5.0);
    foundationMesh.position.set(0, -5.12, 0);
    foundationMesh.receiveShadow = true;
    group.add(foundationMesh);

    // Part 3: Stepped Metallic Brushed Trim Collar
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.22,
      metalness: 0.86,
    });
    const collarMesh = new THREE.Mesh(this.sharedBoxGeo, collarMat);
    collarMesh.scale.set(4.15, 0.24, 4.15);
    collarMesh.position.set(0, -4.72, 0);
    collarMesh.receiveShadow = true;
    collarMesh.castShadow = !this.isSoftwareGl;
    group.add(collarMesh);

    // Parts 4-7: Four Architectural Corner Buttress Fins
    const buttressMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.48,
      metalness: 0.52,
    });
    const offsets: [number, number][] = [
      [1.82, 1.82],
      [-1.82, 1.82],
      [1.82, -1.82],
      [-1.82, -1.82],
    ];
    for (const [ox, oz] of offsets) {
      const fin = new THREE.Mesh(this.sharedBoxGeo, buttressMat);
      fin.scale.set(0.42, 4.2, 0.42);
      fin.position.set(ox, -2.55, oz);
      fin.castShadow = !this.isSoftwareGl;
      fin.receiveShadow = true;
      group.add(fin);
    }

    // Part 8: Tall Colored Monolith Starter Column (y = -4.6 to y = 0)
    this.pedestalCoreMat = new THREE.MeshPhysicalMaterial({
      color: 0xff5e7e,
      roughness: 0.25,
      metalness: 0.06,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
    });
    const monolith = new THREE.Mesh(this.sharedBoxGeo, this.pedestalCoreMat);
    monolith.scale.set(INITIAL_SIZE, 4.6, INITIAL_SIZE);
    monolith.position.set(0, -2.3, 0);
    monolith.castShadow = !this.isSoftwareGl;
    monolith.receiveShadow = true;
    group.add(monolith);

    return group;
  }

  private createCoinMeshGroup(): THREE.Group {
    const group = new THREE.Group();
    const outerDisc = new THREE.Mesh(this.sharedCoinDiscGeo, this.sharedCoinGoldMat);
    const innerEmblem = new THREE.Mesh(this.sharedCoinCoreGeo, this.sharedCoinEmblemMat);
    outerDisc.castShadow = !this.isSoftwareGl;
    group.add(outerDisc);
    group.add(innerEmblem);
    return group;
  }

  private createFrameRingGeometry(): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    const o = 0.54;
    shape.moveTo(-o, -o);
    shape.lineTo(o, -o);
    shape.lineTo(o, o);
    shape.lineTo(-o, o);
    shape.closePath();

    const hole = new THREE.Path();
    const i = 0.47;
    hole.moveTo(-i, -i);
    hole.lineTo(i, -i);
    hole.lineTo(i, i);
    hole.lineTo(-i, i);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  private createBlockMaterial(color: THREE.Color): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color: color.clone(),
      roughness: 0.24,
      metalness: 0.06,
      clearcoat: 0.42,
      clearcoatRoughness: 0.18,
    });
  }

  private clearActiveCoin(): void {
    if (this.activeCoin) {
      this.effectsGroup.remove(this.activeCoin.group);
      this.activeCoin = null;
    }
  }

  private clearDynamicObjects(): void {
    for (const layer of this.layers) {
      this.stackGroup.remove(layer.mesh);
      layer.material.dispose();
    }
    this.layers = [];

    for (const piece of this.fallingPieces) {
      this.debrisGroup.remove(piece.mesh);
      piece.material.dispose();
    }
    this.fallingPieces = [];

    for (const wave of this.shockwaves) {
      this.effectsGroup.remove(wave.mesh);
      wave.material.dispose();
    }
    this.shockwaves = [];

    this.clearActiveCoin();
    for (const burst of this.coinBursts) {
      this.effectsGroup.remove(burst.group);
    }
    this.coinBursts = [];

    if (this.activeMesh && this.activeMat) {
      this.stackGroup.remove(this.activeMesh);
      this.activeMat.dispose();
      this.activeMesh = null;
      this.activeMat = null;
    }
  }

  private setupInitialTower(): void {
    this.clearDynamicObjects();
    this.seedOffset = Math.random() * 8;
    this.totalLayers = 1;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.runCoins = 0;
    this.activeCenter = 0;
    this.activeWidth = INITIAL_SIZE;
    this.activeDepth = INITIAL_SIZE;
    this.activeSpeed = BASE_SLIDE_SPEED;
    this.currentZoomOut = 1.0;
    this.targetZoomOut = 1.0;
    this.shakeIntensity = 0;
    this.shakeTime = 0;
    this.punchZoom = 0;

    // Color pedestal monolith with layer 0 color
    const baseColor = getBlockColor(0, this.seedOffset);
    this.pedestalCoreMat.color.copy(baseColor);

    const { topHex, bottomHex } = getAtmosphereColors(0, this.seedOffset);
    this.targetTopBg.set(topHex);
    this.targetBottomBg.set(bottomHex);
    this.currentTopBg.copy(this.targetTopBg);
    this.currentBottomBg.copy(this.targetBottomBg);
    this.updateBackgroundTexture();

    // Base anchor slab at layer 0 (y = BLOCK_HEIGHT / 2)
    const slabColor = getBlockColor(1, this.seedOffset);
    const slabMat = this.createBlockMaterial(slabColor);
    const slabMesh = new THREE.Mesh(this.sharedBoxGeo, slabMat);
    slabMesh.scale.set(INITIAL_SIZE, BLOCK_HEIGHT, INITIAL_SIZE);
    slabMesh.position.set(0, BLOCK_HEIGHT * 0.5, 0);
    slabMesh.castShadow = !this.isSoftwareGl;
    slabMesh.receiveShadow = true;
    this.stackGroup.add(slabMesh);

    this.layers.push({
      mesh: slabMesh,
      material: slabMat,
      x: 0,
      z: 0,
      width: INITIAL_SIZE,
      depth: INITIAL_SIZE,
      y: BLOCK_HEIGHT * 0.5,
      flash: 0,
      bounce: 0,
    });

    this.cameraTargetY = 1.8;
    this.cameraCurrentY = 1.8;
    this.callbacks.onScoreChange(
      0,
      this.bestScore,
      0,
      computeProgressionLevel(0, BASE_SLIDE_SPEED),
      0,
    );
  }

  public startNewGame(): void {
    soundEngine.unlock();
    hapticEngine.stop();
    hapticEngine.vibrateTap();
    this.setupInitialTower();
    this.phase = 'playing';
    this.callbacks.onPhaseChange('playing');
    this.spawnNextActiveBlock();
  }

  public setBestScore(nextBest: number): void {
    if (nextBest > this.bestScore) {
      this.bestScore = nextBest;
    }
  }

  private maybeSpawnFloatingCoin(topLayer: StackedLayer, nextY: number): void {
    this.clearActiveCoin();
    // Spawn a collectible 3D Gold Coin every 3rd layer once the slab is wide enough to hold it
    if (this.totalLayers < 2 || this.totalLayers % 3 !== 0) return;
    if (topLayer.width < 0.75 || topLayer.depth < 0.75) return;

    const maxOffsetX = Math.max(0, topLayer.width * 0.28);
    const maxOffsetZ = Math.max(0, topLayer.depth * 0.28);
    const coinX = topLayer.x + (Math.random() * 2 - 1) * maxOffsetX;
    const coinZ = topLayer.z + (Math.random() * 2 - 1) * maxOffsetZ;
    const baseY = nextY + 0.22;

    const coinGroup = this.createCoinMeshGroup();
    coinGroup.position.set(coinX, baseY, coinZ);
    this.effectsGroup.add(coinGroup);

    this.activeCoin = {
      group: coinGroup,
      x: coinX,
      z: coinZ,
      baseY,
      phaseOffset: Math.random() * Math.PI * 2,
    };
  }

  private spawnNextActiveBlock(): void {
    const topLayer = this.layers[this.layers.length - 1];
    const nextLayerNumber = this.totalLayers + 1;
    const blockColor = getBlockColor(nextLayerNumber, this.seedOffset);

    this.activeMat = this.createBlockMaterial(blockColor);
    this.activeMesh = new THREE.Mesh(this.sharedBoxGeo, this.activeMat);
    this.activeWidth = topLayer.width;
    this.activeDepth = topLayer.depth;
    this.activeMesh.scale.set(this.activeWidth, BLOCK_HEIGHT, this.activeDepth);

    // Alternate sliding axis and starting side using monotonic totalLayers
    this.activeAxis = this.totalLayers % 2 === 1 ? 'x' : 'z';
    const spawnFromPositive = Math.floor(this.totalLayers / 2) % 2 === 1;
    this.activeDirection = spawnFromPositive ? -1 : 1;
    this.activeCenter = this.activeAxis === 'x' ? topLayer.x : topLayer.z;
    this.activePos = this.activeCenter + (spawnFromPositive ? SLIDE_LIMIT : -SLIDE_LIMIT);

    // Progressively increase horizontal block speed as the player's score rises
    this.activeSpeed = this.computeBlockSpeed(this.score);

    const nextY = topLayer.y + BLOCK_HEIGHT;
    if (this.activeAxis === 'x') {
      this.activeMesh.position.set(this.activePos, nextY, topLayer.z);
    } else {
      this.activeMesh.position.set(topLayer.x, nextY, this.activePos);
    }

    this.activeMesh.castShadow = !this.isSoftwareGl;
    this.activeMesh.receiveShadow = true;
    this.stackGroup.add(this.activeMesh);

    this.maybeSpawnFloatingCoin(topLayer, nextY);

    this.cameraTargetY = Math.max(1.8, nextY - 0.6);

    const { topHex, bottomHex } = getAtmosphereColors(nextLayerNumber, this.seedOffset);
    this.targetTopBg.set(topHex);
    this.targetBottomBg.set(bottomHex);
  }

  private computeBlockSpeed(score: number): number {
    const smoothRamp = (1 - Math.exp(-score / 45)) * 7.0;
    const milestoneBoost = Math.floor(score / 15) * 0.38;
    return Math.min(MAX_SLIDE_SPEED, BASE_SLIDE_SPEED + smoothRamp + milestoneBoost);
  }

  /**
   * Handles player tap/spacebar action:
   * - If idle -> starts game immediately and spawns first block
   * - If playing -> slices or snaps active block with haptic + audio feedback!
   */
  public handleTapAction(): void {
    soundEngine.unlock();

    if (this.phase === 'idle') {
      this.startNewGame();
      return;
    }

    if (this.phase !== 'playing' || !this.activeMesh || !this.activeMat) {
      return;
    }

    const prevLayer = this.layers[this.layers.length - 1];
    const currentY = prevLayer.y + BLOCK_HEIGHT;
    const isX = this.activeAxis === 'x';

    const currentCoord = isX ? this.activeMesh.position.x : this.activeMesh.position.z;
    const targetCoord = isX ? prevLayer.x : prevLayer.z;
    const delta = currentCoord - targetCoord;
    const absDelta = Math.abs(delta);
    const activeSpan = isX ? this.activeWidth : this.activeDepth;

    // Case 1: Complete Miss (or unplayable sub-millimeter sliver) -> Game Over!
    const remainingOverlap = activeSpan - absDelta;
    if (
      absDelta >= activeSpan ||
      (absDelta > PERFECT_TOLERANCE && remainingOverlap < MIN_SURVIVING_SLAB)
    ) {
      const pushDir = delta === 0 ? this.activeDirection : Math.sign(delta);
      this.spawnFallingDebris(
        this.activeMesh.position.x,
        currentY,
        this.activeMesh.position.z,
        this.activeWidth,
        this.activeDepth,
        this.activeMat.color,
        isX ? pushDir * 2.2 : 0,
        isX ? 0 : pushDir * 2.2,
      );

      this.stackGroup.remove(this.activeMesh);
      this.activeMat.dispose();
      this.activeMesh = null;
      this.activeMat = null;
      this.clearActiveCoin();

      this.triggerGameOver();
      return;
    }

    const blockColorHex = `#${this.activeMat.color.getHexString()}`;
    let newWidth = this.activeWidth;
    let newDepth = this.activeDepth;
    let newX = prevLayer.x;
    let newZ = prevLayer.z;
    let pointsEarned = 1;
    let coinsEarned = 1;
    let isPerfect = false;
    let expanded = false;

    // Case 2: Pure Geometric PERFECT Drop!
    if (absDelta <= PERFECT_TOLERANCE) {
      isPerfect = true;
      this.combo += 1;
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
      }

      const streakBonus = this.combo >= 5 ? 4 : this.combo >= 3 ? 2 : 1;
      pointsEarned = 1 + streakBonus;
      coinsEarned = 2;

      // Check 5-streak block expansion reward
      if (this.combo > 0 && this.combo % STREAK_TO_EXPAND === 0) {
        coinsEarned = 5;
        if (newWidth < INITIAL_SIZE || newDepth < INITIAL_SIZE) {
          newWidth = Math.min(INITIAL_SIZE, newWidth + EXPAND_AMOUNT);
          newDepth = Math.min(INITIAL_SIZE, newDepth + EXPAND_AMOUNT);
          const maxOffsetX = Math.max(0, (INITIAL_SIZE - newWidth) * 0.5);
          const maxOffsetZ = Math.max(0, (INITIAL_SIZE - newDepth) * 0.5);
          newX = THREE.MathUtils.clamp(newX, -maxOffsetX, maxOffsetX);
          newZ = THREE.MathUtils.clamp(newZ, -maxOffsetZ, maxOffsetZ);
          expanded = true;
        }
      }

      if (expanded) {
        soundEngine.playPowerExpand(this.combo);
      } else {
        soundEngine.playPerfectDrop(this.combo);
      }
      hapticEngine.vibratePerfectCombo(this.combo, expanded);

      this.triggerPerfectCameraShake(this.combo, expanded);
      this.spawnShockwave(newX, currentY - BLOCK_HEIGHT * 0.48, newZ, newWidth, newDepth, expanded);
    } else {
      // Case 3: Partial Overlap -> Slice Overhang!
      this.combo = 0;
      const overlap = activeSpan - absDelta;
      const overhang = absDelta;
      const shiftSign = Math.sign(delta);

      if (isX) {
        newWidth = overlap;
        newX = prevLayer.x + delta * 0.5;
        const debrisX = newX + shiftSign * (overlap * 0.5 + overhang * 0.5);
        this.spawnFallingDebris(
          debrisX,
          currentY,
          newZ,
          overhang,
          newDepth,
          this.activeMat.color,
          shiftSign * 2.6,
          0,
        );
      } else {
        newDepth = overlap;
        newZ = prevLayer.z + delta * 0.5;
        const debrisZ = newZ + shiftSign * (overlap * 0.5 + overhang * 0.5);
        this.spawnFallingDebris(
          newX,
          currentY,
          debrisZ,
          newWidth,
          overhang,
          this.activeMat.color,
          0,
          shiftSign * 2.6,
        );
      }

      soundEngine.playSliceDrop(this.totalLayers);
      hapticEngine.vibrateBlockPlaced();
    }

    // Check if landed block overlaps the hovering 3D Gold Coin!
    let pickedUpCoin = false;
    if (this.activeCoin) {
      const withinX = Math.abs(this.activeCoin.x - newX) <= newWidth * 0.5 + COIN_RADIUS * 0.65;
      const withinZ = Math.abs(this.activeCoin.z - newZ) <= newDepth * 0.5 + COIN_RADIUS * 0.65;
      if (isPerfect || (withinX && withinZ)) {
        pickedUpCoin = true;
        coinsEarned += 5;
        soundEngine.playCoinCollect();
        if (!isPerfect) {
          hapticEngine.vibrateCoinPickup();
        }
        const collectedGroup = this.activeCoin.group;
        this.activeCoin = null;
        this.coinBursts.push({
          group: collectedGroup,
          age: 0,
          duration: 0.44,
          startY: collectedGroup.position.y,
        });
      } else {
        this.clearActiveCoin();
      }
    }

    // Commit landed block to tower
    this.activeMesh.scale.set(newWidth, BLOCK_HEIGHT, newDepth);
    this.activeMesh.position.set(newX, currentY, newZ);

    const landedLayer: StackedLayer = {
      mesh: this.activeMesh,
      material: this.activeMat,
      x: newX,
      z: newZ,
      width: newWidth,
      depth: newDepth,
      y: currentY,
      flash: isPerfect ? 0.85 : 0.18,
      bounce: isPerfect ? 1.0 : 0.35,
    };
    this.layers.push(landedLayer);
    this.totalLayers += 1;

    // Prune very deep blocks (> 50 below top) to keep draw calls tiny on endless runs
    if (this.layers.length > 50) {
      const oldest = this.layers.shift()!;
      this.stackGroup.remove(oldest.mesh);
      oldest.material.dispose();
    }

    this.activeMesh = null;
    this.activeMat = null;

    // Update score, run coins & best score
    this.score += pointsEarned;
    this.runCoins += coinsEarned;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        localStorage.setItem('color_stack_best_score', String(this.bestScore));
      } catch {
        // Ignore storage errors
      }
    }

    const nextSpeed = this.computeBlockSpeed(this.score);
    this.callbacks.onScoreChange(
      this.score,
      this.bestScore,
      this.combo,
      computeProgressionLevel(this.score, nextSpeed),
      this.runCoins,
    );

    this.feedbackCounter += 1;
    this.callbacks.onDropFeedback({
      id: this.feedbackCounter,
      pointsAdded: pointsEarned,
      coinsAdded: coinsEarned,
      pickedUpCoin,
      isPerfect,
      combo: this.combo,
      expanded,
      colorHex: blockColorHex,
    });

    this.spawnNextActiveBlock();
  }

  private spawnFallingDebris(
    x: number,
    y: number,
    z: number,
    width: number,
    depth: number,
    color: THREE.Color,
    vx: number,
    vz: number,
  ): void {
    const mat = this.createBlockMaterial(color);
    const mesh = new THREE.Mesh(this.sharedBoxGeo, mat);
    mesh.scale.set(width, BLOCK_HEIGHT, depth);
    mesh.position.set(x, y, z);
    mesh.castShadow = !this.isSoftwareGl;
    this.debrisGroup.add(mesh);

    this.fallingPieces.push({
      mesh,
      material: mat,
      vx,
      vy: 1.2,
      vz,
      rx: vz !== 0 ? Math.sign(vz) * 3.8 : (Math.random() - 0.5) * 0.8,
      rz: vx !== 0 ? -Math.sign(vx) * 3.8 : (Math.random() - 0.5) * 0.8,
      life: 2.2,
    });
  }

  private spawnShockwave(
    x: number,
    y: number,
    z: number,
    width: number,
    depth: number,
    isDouble: boolean,
  ): void {
    const mat = new THREE.MeshBasicMaterial({
      color: isDouble ? 0xffe066 : 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.shockwaveGeo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, 1, depth);
    this.effectsGroup.add(mesh);

    this.shockwaves.push({
      mesh,
      material: mat,
      age: 0,
      duration: isDouble ? 0.65 : 0.48,
      baseWidth: width,
      baseDepth: depth,
    });
  }

  private triggerPerfectCameraShake(combo: number, expanded: boolean): void {
    if (this.reducedMotion) {
      this.punchZoom = -0.012;
      return;
    }
    const streakBoost = Math.min(0.16, (combo - 1) * 0.026);
    const expandBoost = expanded ? 0.09 : 0;
    this.shakeIntensity = Math.min(0.36, 0.14 + streakBoost + expandBoost);
    this.shakeTime = 0;
    this.punchZoom = expanded ? -0.048 : -0.026;
  }

  private triggerGameOver(): void {
    this.phase = 'gameover';
    soundEngine.playGameOver();
    hapticEngine.vibrateGameOver();

    if (!this.reducedMotion) {
      this.shakeIntensity = 0.26;
      this.shakeTime = 0;
    }

    // Smoothly zoom out camera to showcase the retained stacked tower
    const bottomY = this.layers.length > 0 ? this.layers[0].y : 0;
    const topY =
      this.layers.length > 0 ? this.layers[this.layers.length - 1].y : BLOCK_HEIGHT * 0.5;
    const visibleSpan = Math.max(BLOCK_HEIGHT, topY - bottomY + BLOCK_HEIGHT);
    this.targetZoomOut = Math.min(2.35, Math.max(1.12, (visibleSpan + 6.5) / 13.5));
    this.cameraTargetY = Math.max(1.5, (bottomY + topY) * 0.52);

    this.callbacks.onPhaseChange('gameover');
    this.callbacks.onGameOver(this.score, this.bestScore, this.maxCombo, this.runCoins);
  }

  private updateBackgroundTexture(): void {
    const grad = this.bgCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, `#${this.currentTopBg.getHexString()}`);
    grad.addColorStop(1, `#${this.currentBottomBg.getHexString()}`);
    this.bgCtx.fillStyle = grad;
    this.bgCtx.fillRect(0, 0, 4, 256);
    this.bgTexture.needsUpdate = true;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.currentBottomBg);
    }
  }

  private updateCameraFrustum(width: number, height: number): void {
    const aspect = Math.max(0.35, width / Math.max(1, height));
    const zoomFactor = Math.max(0.85, this.currentZoomOut + this.punchZoom);
    const effectiveFrustum =
      aspect < 0.72
        ? this.baseFrustumSize * (0.72 / aspect) * 0.86 * zoomFactor
        : this.baseFrustumSize * zoomFactor;

    this.camera.left = (-effectiveFrustum * aspect) / 2;
    this.camera.right = (effectiveFrustum * aspect) / 2;
    this.camera.top = effectiveFrustum / 2;
    this.camera.bottom = -effectiveFrustum / 2;
    this.camera.updateProjectionMatrix();
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.updateCameraFrustum(width, height);
  };

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
  };

  private handleContextRestored = (): void => {
    if (this.disposed) return;
    this.bgTexture.needsUpdate = true;
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const rawDelta = this.clock.getDelta();
      const dt = Math.min(rawDelta, 0.05);

      this.updateSimulation(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = window.requestAnimationFrame(tick);
      }
    };

    tick();
  }

  private updateSimulation(dt: number): void {
    this.idleTime += dt;

    // 1. Update active sliding block with exact boundary reflection centered around topLayer
    if (this.phase === 'playing' && this.activeMesh) {
      const minBound = this.activeCenter - SLIDE_LIMIT;
      const maxBound = this.activeCenter + SLIDE_LIMIT;
      this.activePos += this.activeDirection * this.activeSpeed * dt;
      if (this.activePos >= maxBound) {
        const overshoot = this.activePos - maxBound;
        this.activePos = Math.max(minBound, maxBound - overshoot);
        this.activeDirection = -1;
      } else if (this.activePos <= minBound) {
        const overshoot = minBound - this.activePos;
        this.activePos = Math.min(maxBound, minBound + overshoot);
        this.activeDirection = 1;
      }

      if (this.activeAxis === 'x') {
        this.activeMesh.position.x = this.activePos;
      } else {
        this.activeMesh.position.z = this.activePos;
      }
    } else if (this.phase === 'idle' && this.layers.length > 0) {
      const top = this.layers[0];
      top.mesh.position.y = BLOCK_HEIGHT * 0.5 + Math.sin(this.idleTime * 2.4) * 0.04;
    }

    // 1b. Spin & hover active 3D Gold Coin + animate picked-up coin bursts
    if (this.activeCoin) {
      this.activeCoin.group.rotation.y += dt * 3.4;
      this.activeCoin.group.position.y =
        this.activeCoin.baseY + Math.sin(this.idleTime * 4.2 + this.activeCoin.phaseOffset) * 0.08;
    }

    for (let i = this.coinBursts.length - 1; i >= 0; i--) {
      const b = this.coinBursts[i];
      b.age += dt;
      const p = Math.min(1, b.age / b.duration);
      const ease = 1 - Math.pow(1 - p, 3);
      b.group.position.y = b.startY + ease * 1.45;
      b.group.rotation.y += dt * 14;
      const scale = Math.max(0.01, 1 - p * 0.85);
      b.group.scale.setScalar(scale);
      if (p >= 1) {
        this.effectsGroup.remove(b.group);
        this.coinBursts.splice(i, 1);
      }
    }

    // 2. Update landed block flash & settle bounce
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (layer.flash > 0.005) {
        layer.flash = THREE.MathUtils.damp(layer.flash, 0, 9.5, dt);
        _tempColor.copy(_whiteColor).multiplyScalar(layer.flash * 0.55);
        layer.material.emissive.copy(_tempColor);
      } else if (layer.flash > 0) {
        layer.flash = 0;
        layer.material.emissive.setHex(0x000000);
      }

      if (layer.bounce > 0.005) {
        layer.bounce = THREE.MathUtils.damp(layer.bounce, 0, 14, dt);
        layer.mesh.position.y = layer.y - Math.sin(layer.bounce * Math.PI) * 0.045;
      }
    }

    // 3. Update sliced falling overhang debris
    for (let i = this.fallingPieces.length - 1; i >= 0; i--) {
      const p = this.fallingPieces[i];
      p.vy += GRAVITY * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.rx * dt;
      p.mesh.rotation.z += p.rz * dt;
      p.life -= dt;

      if (p.life <= 0 || p.mesh.position.y < this.cameraCurrentY - 22) {
        this.debrisGroup.remove(p.mesh);
        p.material.dispose();
        this.fallingPieces.splice(i, 1);
      }
    }

    // 4. Update 3D PERFECT shockwave rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const w = this.shockwaves[i];
      w.age += dt;
      const progress = Math.min(1, w.age / w.duration);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const scaleFactor = 1.0 + easeOut * 0.58;
      w.mesh.scale.set(w.baseWidth * scaleFactor, 1, w.baseDepth * scaleFactor);
      w.material.opacity = (1 - progress) * 0.9;

      if (progress >= 1) {
        this.effectsGroup.remove(w.mesh);
        w.material.dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    // 5. Smooth exponential camera damping, perfect-drop camera shake & light tracking
    const prevZoom = this.currentZoomOut + this.punchZoom;
    this.cameraCurrentY = THREE.MathUtils.damp(this.cameraCurrentY, this.cameraTargetY, 6.2, dt);
    this.currentZoomOut = THREE.MathUtils.damp(this.currentZoomOut, this.targetZoomOut, 4.5, dt);

    if (Math.abs(this.punchZoom) > 0.0004) {
      this.punchZoom = THREE.MathUtils.damp(this.punchZoom, 0, 14.5, dt);
    } else {
      this.punchZoom = 0;
    }

    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    let shakeOffsetZ = 0;

    if (this.shakeIntensity > 0.001) {
      this.shakeTime += dt;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 11.5, dt);
      const lateral = Math.sin(this.shakeTime * 48) * this.shakeIntensity * 0.72;
      const vertical = -Math.cos(this.shakeTime * 38) * this.shakeIntensity;
      shakeOffsetX = -lateral * 0.7071;
      shakeOffsetZ = lateral * 0.7071;
      shakeOffsetY = vertical;
    } else {
      this.shakeIntensity = 0;
    }

    const nextZoom = this.currentZoomOut + this.punchZoom;
    if (Math.abs(nextZoom - prevZoom) > 0.0004) {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.updateCameraFrustum(w, h);
    }

    const camDist = 24;
    if (this.phase === 'gameover') {
      const orbitAngle = Math.PI * 0.25 + Math.sin(this.idleTime * 0.45) * 0.14;
      this.camera.position.set(
        Math.cos(orbitAngle) * camDist * 1.414 + shakeOffsetX,
        this.cameraCurrentY + camDist * 0.86 + shakeOffsetY,
        Math.sin(orbitAngle) * camDist * 1.414 + shakeOffsetZ,
      );
    } else {
      this.camera.position.set(
        camDist + shakeOffsetX,
        this.cameraCurrentY + camDist * 0.86 + shakeOffsetY,
        camDist + shakeOffsetZ,
      );
    }
    this.camera.lookAt(shakeOffsetX, this.cameraCurrentY + shakeOffsetY, shakeOffsetZ);

    this.keyLight.position.set(12, this.cameraCurrentY + 22, 16);
    this.keyLight.target.position.set(0, this.cameraCurrentY, 0);

    // 6. Smooth sky atmosphere transition
    const bgDiff =
      Math.abs(this.currentTopBg.r - this.targetTopBg.r) +
      Math.abs(this.currentBottomBg.b - this.targetBottomBg.b);
    if (bgDiff > 0.002) {
      this.currentTopBg.lerp(this.targetTopBg, Math.min(1, dt * 2.5));
      this.currentBottomBg.lerp(this.targetBottomBg, Math.min(1, dt * 2.5));
      this.updateBackgroundTexture();
    }
  }

  public dispose(): void {
    this.disposed = true;
    hapticEngine.stop();
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );

    this.clearDynamicObjects();
    this.sharedBoxGeo.dispose();
    this.sharedCoinDiscGeo.dispose();
    this.sharedCoinCoreGeo.dispose();
    this.sharedCoinGoldMat.dispose();
    this.sharedCoinEmblemMat.dispose();
    this.shockwaveGeo.dispose();
    this.bgTexture.dispose();
    if (this.scene.environment) {
      this.scene.environment.dispose();
      this.scene.environment = null;
    }
    this.pedestalGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry !== this.sharedBoxGeo) obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of materials) {
          if ('map' in m && m.map instanceof THREE.Texture) {
            m.map.dispose();
          }
          m.dispose();
        }
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
