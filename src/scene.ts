import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface BouquetScene {
  play(reduced: boolean, elapsed?: number): void;
  finish(): void;
  setMotion(enabled: boolean): void;
  dispose(): void;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const SCENE_SEQUENCE_DURATION = 13;
const ease = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const easeOut = (value: number) => {
  const t = clamp(value);
  return 1 - (1 - t) ** 3;
};

/** A procedural Alstonia scholaris bouquet made from instanced florets and leaves. */
export function createBouquetScene(root: HTMLElement): BouquetScene {
  const mobile = matchMedia('(max-width: 600px)').matches;
  const bouquetLift = mobile ? 0.4 : 0;
  const drawingCanvas = document.createElement('canvas');
  const context = drawingCanvas.getContext('webgl2', {
    alpha: true,
    antialias: !mobile,
    powerPreference: 'low-power',
  });
  if (!context) throw new Error('WebGL2 unavailable');
  const renderer = new THREE.WebGLRenderer({
    canvas: drawingCanvas,
    context,
    alpha: true,
    antialias: !mobile,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.2 : 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  camera.position.set(0, 0.05, 8.7);
  scene.add(new THREE.AmbientLight(0xffe7d9, 1.7));
  const key = new THREE.DirectionalLight(0xffdfbd, 3.4);
  key.position.set(-3, 5, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdca4b9, 2);
  rim.position.set(4, 1, -2);
  scene.add(rim);
  const spot = new THREE.SpotLight(0xffd29e, 18, 14, Math.PI / 5, 0.8, 1.3);
  spot.position.set(0, 5, 4);
  spot.target.position.set(0, -0.2, 0);
  scene.add(spot, spot.target);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 6),
    new THREE.ShadowMaterial({ color: 0x0e0815, opacity: 0.26 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.55;
  floor.receiveShadow = true;
  scene.add(floor);

  const standard = (color: number, roughness = 0.8, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide });
  const stemMat = standard(0x526b43, 0.72);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.48,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const floretMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.58,
    side: THREE.DoubleSide,
  });

  function makeLeafGeometry(): THREE.BufferGeometry {
    const rows = 14;
    const columns = 6;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const y = (t - 0.5) * 0.62;
      const halfWidth = Math.sin(Math.PI * t) ** 0.78 * 0.145;
      for (let column = 0; column <= columns; column++) {
        const across = (column / columns) * 2 - 1;
        const x = across * halfWidth;
        const centerRib = Math.max(0, 1 - Math.abs(across) * 7);
        const z =
          Math.sin(Math.PI * t) *
          ((1 - Math.abs(across)) * 0.026 + centerRib * 0.024);
        positions.push(x, y, z);
        const edgeShade = Math.abs(across) * 0.12;
        colors.push(
          0.78 - edgeShade + centerRib * 0.12,
          0.84 - edgeShade + centerRib * 0.14,
          0.72 - edgeShade + centerRib * 0.1,
        );
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const a = row * (columns + 1) + column;
        const b = a + columns + 1;
        const c = a + 1;
        const d = b + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function makeFloretGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const petalColor = new THREE.Color(0xfff8e7);
    const rows = 5;
    const columns = 2;
    for (let petal = 0; petal < 5; petal++) {
      const angle = (petal / 5) * Math.PI * 2;
      const first = positions.length / 3;
      for (let row = 0; row <= rows; row++) {
        const t = row / rows;
        const radius = 0.012 + t * 0.056;
        const halfWidth = Math.sin(Math.PI * t) ** 0.82 * 0.017;
        for (let column = 0; column <= columns; column++) {
          const across = (column / columns) * 2 - 1;
          const side = across * halfWidth;
          positions.push(
            Math.cos(angle) * radius - Math.sin(angle) * side,
            Math.sin(angle) * radius + Math.cos(angle) * side,
            0.003 + Math.sin(Math.PI * t) * (0.014 + (1 - Math.abs(across)) * 0.006),
          );
          colors.push(petalColor.r, petalColor.g, petalColor.b);
        }
      }
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const a = first + row * (columns + 1) + column;
          const b = a + columns + 1;
          const c = a + 1;
          const d = b + 1;
          indices.push(a, b, c, c, b, d);
        }
      }
    }
    const center = new THREE.SphereGeometry(0.01, 7, 5);
    center.scale(1, 0.88, 0.8);
    center.translate(0, 0, 0.018);
    const centerPosition = center.getAttribute('position');
    const centerColor = new THREE.Color(0xd8d990);
    const centerFirst = positions.length / 3;
    for (let vertex = 0; vertex < centerPosition.count; vertex++) {
      positions.push(
        centerPosition.getX(vertex),
        centerPosition.getY(vertex),
        centerPosition.getZ(vertex),
      );
      colors.push(centerColor.r, centerColor.g, centerColor.b);
    }
    const centerIndex = center.getIndex();
    if (centerIndex) {
      for (let i = 0; i < centerIndex.count; i++) indices.push(centerFirst + centerIndex.getX(i));
    }
    center.dispose();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  const leafGeo = makeLeafGeometry();
  const floretGeo = makeFloretGeometry();
  const leavesPerSprig = mobile ? 5 : 6;
  const flowerCountPerCluster = mobile ? 14 : 18;
  const trailCanvas = document.createElement('canvas');
  trailCanvas.width = trailCanvas.height = 64;
  const trailContext = trailCanvas.getContext('2d');
  if (trailContext) {
    const gradient = trailContext.createRadialGradient(32, 32, 2, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,241,207,.95)');
    gradient.addColorStop(0.32, 'rgba(255,209,171,.48)');
    gradient.addColorStop(1, 'rgba(255,209,171,0)');
    trailContext.fillStyle = gradient;
    trailContext.fillRect(0, 0, 64, 64);
  }
  const trailTexture = new THREE.CanvasTexture(trailCanvas);
  const bouquet = new THREE.Group();
  scene.add(bouquet);

  const sprigSpecs = [
    { x: -0.98, y: 1.13, z: -0.28, baseX: -0.36, baseZ: -0.4, lean: -0.3 },
    { x: -0.67, y: 1.49, z: 0.2, baseX: -0.28, baseZ: 0.08, lean: -0.19 },
    { x: -0.34, y: 1.72, z: -0.12, baseX: -0.19, baseZ: -0.26, lean: -0.08 },
    { x: 0.02, y: 1.59, z: 0.42, baseX: -0.08, baseZ: 0.28, lean: 0.02 },
    { x: 0.34, y: 1.76, z: -0.32, baseX: 0.08, baseZ: -0.38, lean: 0.09 },
    { x: 0.68, y: 1.47, z: 0.24, baseX: 0.19, baseZ: 0.18, lean: 0.19 },
    { x: 1.02, y: 1.15, z: -0.08, baseX: 0.31, baseZ: -0.18, lean: 0.31 },
    { x: -1.16, y: 0.54, z: 0.38, baseX: -0.4, baseZ: 0.22, lean: -0.4 },
    { x: -0.48, y: 0.72, z: -0.46, baseX: -0.14, baseZ: -0.5, lean: -0.12 },
    { x: 0.52, y: 0.7, z: 0.5, baseX: 0.16, baseZ: 0.42, lean: 0.14 },
    { x: 1.18, y: 0.51, z: -0.34, baseX: 0.4, baseZ: -0.42, lean: 0.4 },
  ];
  type Sprig = {
    group: THREE.Group;
    trail: THREE.Points;
    trailPositions: Float32Array;
    start: number;
    flight: THREE.CubicBezierCurve3;
    initialPosition: THREE.Vector3;
    initialRotation: number;
    targetRotation: number;
    landingScale: number;
  };
  const sprigs: Sprig[] = [];
  const clusterOffsets = [
    new THREE.Vector3(-0.16, 0.025, -0.045),
    new THREE.Vector3(0.015, 0.13, 0.065),
    new THREE.Vector3(0.17, 0.015, -0.025),
  ];
  const flowerTints = [0xfffdf2, 0xf4f6df, 0xf7f0d9, 0xeaf1da];

  sprigSpecs.forEach((spec, index) => {
    const group = new THREE.Group();
    const initialPosition = new THREE.Vector3(spec.x, spec.y, spec.z);
    group.position.copy(initialPosition);
    group.rotation.z = spec.lean;
    const base = new THREE.Vector3(
      THREE.MathUtils.clamp(spec.baseX, -0.28, 0.28) - spec.x,
      -1.78 - spec.y,
      0.08 - spec.z,
    );
    const stemGeometries: THREE.BufferGeometry[] = [];
    const mainCurve = new THREE.CatmullRomCurve3([
      base,
      base.clone().lerp(new THREE.Vector3(-spec.lean * 0.22, -0.9, spec.z * 0.08), 0.58),
      new THREE.Vector3(-spec.lean * 0.48, -0.22, spec.z * 0.14),
      new THREE.Vector3(0, 0, 0),
    ]);
    stemGeometries.push(
      new THREE.TubeGeometry(mainCurve, mobile ? 14 : 20, 0.026, mobile ? 4 : 5, false),
    );

    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leavesPerSprig);
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    const leafPositions = mobile
      ? [0.22, 0.39, 0.56, 0.73, 0.88]
      : [0.2, 0.34, 0.48, 0.62, 0.76, 0.88];
    const matrix = new THREE.Matrix4();
    const leafQuaternion = new THREE.Quaternion();
    const leafScale = new THREE.Vector3();
    const leafPosition = new THREE.Vector3();
    const stemAxis = new THREE.Vector3(0, 1, 0);
    const greens = [0x33563c, 0x416a45, 0x3c6043];
    leafPositions.forEach((t, leafIndex) => {
      const side = leafIndex % 2 ? 1 : -1;
      const point = mainCurve.getPoint(t);
      const tangent = mainCurve.getTangent(t);
      const direction = tangent
        .clone()
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(side * 0.72, 0.18 + (leafIndex % 3) * 0.09, side * 0.12))
        .normalize();
      leafQuaternion.setFromUnitVectors(stemAxis, direction);
      leafPosition.copy(point).add(new THREE.Vector3(side * 0.035, 0, side * 0.012));
      const size = 0.78 + ((leafIndex * 7 + index * 3) % 5) * 0.11;
      leafScale.set(size, size, size);
      matrix.compose(leafPosition, leafQuaternion, leafScale);
      leaves.setMatrixAt(leafIndex, matrix);
      leaves.setColorAt(leafIndex, new THREE.Color(greens[(leafIndex + index) % greens.length]));
    });
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    group.add(leaves);

    const florets = new THREE.InstancedMesh(
      floretGeo,
      floretMat,
      flowerCountPerCluster * clusterOffsets.length,
    );
    // The small florets keep their lit petal relief; twig and leaf shadows carry scene depth.
    florets.castShadow = false;
    florets.receiveShadow = false;
    clusterOffsets.forEach((offset, clusterIndex) => {
      const shootStart = offset
        .clone()
        .multiplyScalar(0.48)
        .add(new THREE.Vector3(0, -0.12, -0.01));
      const shootCurve = new THREE.CatmullRomCurve3([
        shootStart,
        shootStart
          .clone()
          .lerp(offset, 0.55)
          .add(new THREE.Vector3(0, 0.045, 0)),
        offset,
      ]);
      stemGeometries.push(new THREE.TubeGeometry(shootCurve, mobile ? 5 : 7, 0.012, 4, false));

      const count = flowerCountPerCluster;
      for (let floretIndex = 0; floretIndex < count; floretIndex++) {
        const vertical = 1 - (2 * (floretIndex + 0.5)) / count;
        const radius = Math.sqrt(Math.max(0, 1 - vertical * vertical));
        const angle = floretIndex * 2.399963229728653 + clusterIndex * 0.31 + index * 0.17;
        const surface = new THREE.Vector3(
          Math.cos(angle) * radius,
          vertical,
          Math.sin(angle) * radius,
        );
        const floretPosition = surface.clone().multiplyScalar(0.115).add(offset);
        const normal = surface
          .clone()
          .add(new THREE.Vector3(0, 0.16, 0.48))
          .normalize();
        const floretRotation = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          normal,
        );
        floretRotation.multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle * 1.7),
        );
        const floretSize = 0.78 + ((floretIndex * 11 + index * 5) % 7) * 0.055;
        const floretScale = new THREE.Vector3(floretSize, floretSize, floretSize);
        matrix.compose(floretPosition, floretRotation, floretScale);
        const instanceIndex = clusterIndex * count + floretIndex;
        florets.setMatrixAt(instanceIndex, matrix);
        const tint = flowerTints[(floretIndex + clusterIndex + index) % flowerTints.length];
        florets.setColorAt(instanceIndex, new THREE.Color(tint));
      }
    });
    florets.instanceMatrix.needsUpdate = true;
    if (florets.instanceColor) florets.instanceColor.needsUpdate = true;
    group.add(florets);
    const mergedStemGeometry = mergeGeometries(stemGeometries, false);
    stemGeometries.forEach((geometry) => geometry.dispose());
    if (mergedStemGeometry) {
      const stems = new THREE.Mesh(mergedStemGeometry, stemMat);
      stems.castShadow = true;
      group.add(stems);
    }
    bouquet.add(group);

    const trailPositions = new Float32Array(10 * 3);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trail = new THREE.Points(
      trailGeometry,
      new THREE.PointsMaterial({
        color: 0xffe7bd,
        map: trailTexture,
        size: 0.105,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    trail.visible = false;
    scene.add(trail);
    sprigs.push({
      group,
      trail,
      trailPositions,
      start: 0.54 + index * 0.34,
      flight: new THREE.CubicBezierCurve3(
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ),
      initialPosition,
      initialRotation: spec.lean,
      targetRotation: index % 2 ? -0.68 : 0.68,
      landingScale: mobile ? 0.58 : 0.68,
    });
  });
  root.dataset.alstoniaSprigs = String(sprigs.length);
  root.dataset.alstoniaClusters = String(sprigs.length * clusterOffsets.length);
  root.dataset.alstoniaFlorets = String(
    sprigs.length * clusterOffsets.length * flowerCountPerCluster,
  );
  root.dataset.alstoniaLeaves = String(sprigs.length * leavesPerSprig);

  function makeFallingClusterGeometry(): THREE.BufferGeometry {
    const pieces: THREE.BufferGeometry[] = [];
    const offsets = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.075, 0.045, 0.012),
      new THREE.Vector3(0.015, 0.085, -0.026),
      new THREE.Vector3(0.075, 0.028, 0.024),
      new THREE.Vector3(-0.04, -0.065, -0.022),
      new THREE.Vector3(0.047, -0.067, 0.008),
    ];
    offsets.forEach((offset, index) => {
      const geometry = floretGeo.clone();
      const rotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        index * 1.047,
      );
      const transform = new THREE.Matrix4().compose(
        offset,
        rotation,
        new THREE.Vector3(0.62, 0.62, 0.62),
      );
      geometry.applyMatrix4(transform);
      pieces.push(geometry);
    });
    const merged = mergeGeometries(pieces, false);
    pieces.forEach((geometry) => geometry.dispose());
    if (!merged) throw new Error('Could not build falling Alstonia cluster');
    return merged;
  }

  type FallingCluster = {
    delay: number;
    duration: number;
    side: number;
    offset: number;
    depth: number;
    scale: number;
    sway: number;
    startHeight: number;
  };
  const fallingClusterGeometry = makeFallingClusterGeometry();
  const fallingClusters: FallingCluster[] = [];
  const fallingClusterCount = mobile ? 24 : 36;
  const fallingClusterMesh = new THREE.InstancedMesh(
    fallingClusterGeometry,
    floretMat,
    fallingClusterCount,
  );
  fallingClusterMesh.frustumCulled = false;
  fallingClusterMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(fallingClusterMesh);
  const fallingTransform = new THREE.Object3D();
  for (let index = 0; index < fallingClusterCount; index++) {
    const row = Math.floor(index / 2);
    fallingClusters.push({
      delay: (index % 2) * 0.32 + row * 0.15 + ((index * 7) % 4) * 0.035,
      duration: 5.2 + (index % 4) * 0.32,
      side: index % 2 ? 1 : -1,
      offset: 0.025 + row * 0.018 + (index % 3) * 0.01,
      depth: -0.55 + ((index * 7) % 11) * 0.11,
      scale: mobile ? 0.88 : 0.96,
      sway: 0.035 + (index % 4) * 0.012,
      startHeight: 0.45 + ((index * 5) % 7) * 0.07,
    });
    fallingTransform.position.set(0, -100, 0);
    fallingTransform.scale.setScalar(0);
    fallingTransform.updateMatrix();
    fallingClusterMesh.setMatrixAt(index, fallingTransform.matrix);
  }
  fallingClusterMesh.instanceMatrix.needsUpdate = true;
  root.dataset.alstoniaFallingClusters = String(fallingClusterCount);

  const makePolygon = (coords: number[], mat: THREE.Material) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    return mesh;
  };
  const wrapBack = standard(0xd7a68f);
  const wrapFront = standard(0xf4d7b8);
  const wrapShade = standard(0xe3baa2);
  const wrapLeft = new THREE.Group();
  const leftPaper = makePolygon(
    [
      -1.8, 0.12, 0.03, -0.88, -1.92, 0.18, 0, -1.95, 0.48, -1.8, 0.12, 0.03, 0, -1.95, 0.48, -0.3,
      -0.2, 0.4,
    ],
    wrapFront,
  );
  leftPaper.geometry.translate(1.8, 0, 0);
  wrapLeft.add(leftPaper);
  wrapLeft.position.x = -1.8;
  const wrapRight = new THREE.Group();
  const rightPaper = makePolygon(
    [
      1.8, 0.12, 0.03, 0.88, -1.92, 0.18, 0, -1.95, 0.48, 1.8, 0.12, 0.03, 0, -1.95, 0.48, 0.3,
      -0.2, 0.42,
    ],
    wrapShade,
  );
  rightPaper.geometry.translate(-1.8, 0, 0);
  wrapRight.add(rightPaper);
  wrapRight.position.x = 1.8;
  const backing = makePolygon([-1.65, 0.36, -0.44, 0, -2.08, -0.5, 1.65, 0.36, -0.44], wrapBack);
  bouquet.add(backing, wrapLeft, wrapRight);
  const ribbon = new THREE.Group();
  const ribbonMat = standard(0xb85d72, 0.48);
  const band = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), ribbonMat);
  band.scale.set(0.18, 0.16, 0.09);
  band.position.z = 0.08;
  ribbon.add(band);
  for (const direction of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.065, 8, 28), ribbonMat);
    loop.position.x = direction * 0.23;
    loop.scale.set(1.05, 0.72, 1);
    loop.rotation.z = direction * 0.35;
    ribbon.add(loop);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.55, 0.03), ribbonMat);
    tail.position.set(direction * 0.12, -0.38, 0.04);
    tail.rotation.z = direction * 0.3;
    ribbon.add(tail);
  }
  ribbon.position.set(0, -1.05, 0.54);
  bouquet.add(ribbon);

  const envelope = new THREE.Group();
  scene.add(envelope);
  const envelopeBack = standard(0xd5bb9b);
  const envelopeFace = standard(0xf5e7d1);
  const envelopeFold = standard(0xe9d3b6);
  const envelopeBase = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.55, 0.06), envelopeBack);
  envelope.add(envelopeBase);
  envelope.add(
    makePolygon([-1.175, -0.775, 0.07, 0, 0.22, 0.11, 1.175, -0.775, 0.07], envelopeFace),
  );
  envelope.add(
    makePolygon([-1.175, 0.775, 0.08, -1.175, -0.775, 0.08, 0, 0.06, 0.13], envelopeFold),
  );
  envelope.add(makePolygon([1.175, 0.775, 0.08, 1.175, -0.775, 0.08, 0, 0.06, 0.13], envelopeFold));
  const flap = new THREE.Group();
  flap.position.set(0, 0.775, 0.02);
  flap.add(makePolygon([-1.175, 0, 0.08, 1.175, 0, 0.08, 0, -0.9, 0.1], envelopeFace));
  envelope.add(flap);
  const seal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.05, 28),
    standard(0xb86e72, 0.38),
  );
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, -0.05, 0.22);
  envelope.add(seal);
  const sealRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.225, 0.018, 7, 30),
    standard(0xf8d79d, 0.3, 0.15),
  );
  sealRing.position.set(0, -0.05, 0.257);
  envelope.add(sealRing);
  const sealLabelCanvas = document.createElement('canvas');
  sealLabelCanvas.width = 256;
  sealLabelCanvas.height = 256;
  const labelCtx = sealLabelCanvas.getContext('2d');
  if (labelCtx) {
    labelCtx.fillStyle = '#fff2d0';
    labelCtx.font = 'bold 56px Georgia';
    labelCtx.textAlign = 'center';
    labelCtx.textBaseline = 'middle';
    labelCtx.fillText('20/10', 128, 128);
  }
  const labelTexture = new THREE.CanvasTexture(sealLabelCanvas);
  const sealLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.43, 0.43),
    new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, depthWrite: false }),
  );
  sealLabel.position.set(0, -0.05, 0.266);
  envelope.add(sealLabel);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: 0xffd1a0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.scale.set(1.1, 1.1, 1);
  glow.position.set(0, -0.05, 0.28);
  envelope.add(glow);
  const innerLetter = new THREE.Group();
  const paperMaterial = standard(0xfff6e8);
  const paperBase = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.76, 0.025), paperMaterial);
  paperBase.position.y = -0.38;
  innerLetter.add(paperBase);
  const innerLetterFold = new THREE.Group();
  const paperFold = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.76, 0.025), paperMaterial);
  paperFold.position.set(0, 0.38, 0.012);
  innerLetterFold.add(paperFold);
  innerLetter.add(innerLetterFold);
  innerLetter.position.y = -0.24;
  envelope.add(innerLetter);
  envelope.visible = false;

  let disposed = false;
  let active = false;
  let complete = false;
  let motionAllowed = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let inView = true;
  let startedAt = 0;
  let completedAtAmbient = 0;
  let frame = 0;
  let lastFrame = 0;
  let letterSideFraction = 0.62;
  const fallback = document.getElementById('scene-fallback')!;
  const observer = new ResizeObserver(resize);
  const controller = new AbortController();

  function resize(): void {
    if (disposed) return;
    const { width, height } = root.getBoundingClientRect();
    if (!width || !height) return;
    const letterCard = document.getElementById('letter-card');
    if (letterCard)
      letterSideFraction = Math.min(
        0.945,
        letterCard.getBoundingClientRect().width / width + 0.055,
      );
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateFlightPaths();
    render(
      active
        ? Math.min((performance.now() - startedAt) / 1000, SCENE_SEQUENCE_DURATION)
        : complete
          ? SCENE_SEQUENCE_DURATION
          : -1,
    );
  }

  function destination(index: number): THREE.Vector3 {
    const width = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 8.7 * camera.aspect;
    const height = width / camera.aspect;
    const points = mobile
      ? [
          [-0.68, 0.58],
          [0.68, 0.58],
          [-0.78, 0.23],
          [0.78, 0.2],
          [-0.78, -0.14],
          [0.78, -0.16],
          [-0.62, -0.52],
          [0.62, -0.55],
          [-0.27, 0.69],
          [0.28, -0.63],
          [0.83, -0.42],
        ]
      : [
          [-0.8, 0.59],
          [0.8, 0.57],
          [-0.87, 0.22],
          [0.86, 0.18],
          [-0.84, -0.15],
          [0.85, -0.16],
          [-0.67, -0.56],
          [0.66, -0.57],
          [-0.28, 0.7],
          [0.27, -0.65],
          [0.85, -0.42],
        ];
    const [x, y] = points[index];
    const depths = [0.42, -0.15, -0.42, 0.34, 0.18, -0.35, -0.52, 0.26, 0.56, -0.22, -0.48];
    return new THREE.Vector3(x * width * 0.49, y * height * 0.49 - bouquetLift, depths[index]);
  }

  function updateFlightPaths(): void {
    sprigs.forEach((sprig, index) => {
      const start = sprig.initialPosition;
      const end = destination(index);
      const direction = index % 2 ? 1 : -1;
      const near = start
        .clone()
        .lerp(end, 0.3)
        .add(new THREE.Vector3(direction * (0.36 + (index % 3) * 0.08), 0.62, 1.38));
      const sweep = start
        .clone()
        .lerp(end, 0.74)
        .add(new THREE.Vector3(-direction * 0.17, 0.2 + (index % 2) * 0.12, 0.66));
      sprig.flight.v0.copy(start);
      sprig.flight.v1.copy(near);
      sprig.flight.v2.copy(sweep);
      sprig.flight.v3.copy(end);
    });
  }

  function render(time: number, ambience = 0): void {
    if (disposed) return;
    const idle = time < 0;
    const storyTime = Math.max(0, time);
    const tilt = idle ? 0 : ease(storyTime / 0.55);
    const orbit = idle ? 0 : ease((storyTime - 3.55) / 0.75) * (1 - ease((storyTime - 6.1) / 1.05));
    const push = idle ? 0 : ease(storyTime / 1.35) * (1 - ease((storyTime - 6.15) / 1.1));
    camera.position.set(
      Math.sin(orbit * Math.PI) * 0.42 + Math.sin(ambience * 0.12) * 0.05,
      0.05 + Math.sin(orbit * Math.PI * 2) * 0.1 + Math.sin(ambience * 0.3) * 0.025,
      8.7 - push * 1.08 + Math.sin(ambience * 0.22) * 0.025,
    );
    camera.lookAt(0, -0.05, 0);
    bouquet.position.y = bouquetLift + Math.sin(ambience * 0.62) * 0.035;
    bouquet.rotation.z = idle
      ? Math.sin(ambience * 0.42) * 0.015
      : -0.085 * tilt + Math.sin(ambience * 0.48) * 0.012;
    bouquet.rotation.y = idle
      ? Math.sin(ambience * 0.37) * 0.018
      : 0.07 * tilt + Math.sin(ambience * 0.37) * 0.012;
    sprigs.forEach((sprig, index) => {
      const { group, trail, trailPositions, start, flight } = sprig;
      const rawProgress = idle ? 0 : clamp((storyTime - start) / 2.35);
      const fall = easeOut(rawProgress);
      if (idle) {
        group.position.copy(sprig.initialPosition);
        group.position.y += Math.sin(ambience * 0.62 + index) * 0.018;
      } else group.position.copy(flight.getPoint(fall));
      group.rotation.z =
        sprig.initialRotation +
        (sprig.targetRotation - sprig.initialRotation) * fall +
        Math.sin(fall * Math.PI * 2.4) * 0.12 * fall * (1 - fall) +
        (idle ? Math.sin(ambience * 0.48 + index) * 0.012 : 0);
      group.rotation.x = Math.sin(fall * Math.PI * 2 + index * 0.8) * 0.11 * fall * (1 - fall);
      group.rotation.y = Math.sin(fall * Math.PI * 2.7 + index) * 0.14 * fall * (1 - fall);
      const scale = 1 - (1 - sprig.landingScale) * fall;
      group.scale.setScalar(scale);

      const trailAttr = trail.geometry.getAttribute('position') as THREE.BufferAttribute;
      trail.visible = !idle && rawProgress > 0.035 && rawProgress < 1.08;
      if (trail.visible) {
        (trail.material as THREE.PointsMaterial).opacity =
          0.54 * (1 - ease((rawProgress - 0.7) / 0.38));
        for (let j = 0; j < 10; j++) {
          const lagged = easeOut(Math.max(0, rawProgress - j * 0.042));
          const point = flight.getPoint(lagged);
          trailPositions[j * 3] = point.x + Math.sin(j * 1.8 + index) * 0.035;
          trailPositions[j * 3 + 1] = point.y + Math.sin(j * 1.5 + index) * 0.025;
          trailPositions[j * 3 + 2] = point.z + 0.04;
        }
        trailAttr.needsUpdate = true;
      }
    });
    const opening = ease((storyTime - 3.4) / 1.65);
    wrapLeft.rotation.y = -opening * 1.1;
    wrapLeft.rotation.z = -opening * 0.27;
    wrapRight.rotation.y = opening * 1.1;
    wrapRight.rotation.z = opening * 0.27;
    const ribbonRelease = ease((storyTime - 0.16) / 1.65);
    ribbon.position.set(
      -1.5 * ribbonRelease,
      -1.05 - Math.sin(ribbonRelease * Math.PI) * 0.38,
      0.54 + ribbonRelease * 0.38,
    );
    ribbon.rotation.set(ribbonRelease * 0.8, -ribbonRelease * 1.1, ribbonRelease * 2.4);
    wrapLeft.visible = wrapRight.visible = ribbon.visible = backing.visible = true;
    const slide = easeOut((storyTime - 5.55) / 1.5);
    envelope.visible = storyTime >= 5.42;
    envelope.position.set(0, -1.1 + slide * 1.4, 0.68 + slide * 0.9);
    envelope.rotation.set(
      Math.sin(orbit * Math.PI) * 0.12,
      Math.sin(orbit * Math.PI) * 0.22,
      -0.12 * (1 - slide),
    );
    const shine = ease((storyTime - 6.65) / 0.95);
    (glow.material as THREE.SpriteMaterial).opacity =
      shine * (1 - ease((storyTime - 8.15) / 0.95)) * 0.56;
    sealRing.scale.setScalar(1 + Math.sin(ambience * 1.4) * 0.025 + shine * 0.16);
    const unfold = ease((storyTime - 7.1) / 1.75);
    flap.rotation.x = -unfold * 2.6;
    innerLetter.position.y = -0.24 + unfold * 0.4;
    innerLetterFold.rotation.x = Math.PI * (1 - unfold);

    const timeAfterLetterOpen = idle || storyTime < 8.9 ? -1 : storyTime - 8.9;
    const fallingClock = complete
      ? 1.28 + Math.max(0, ambience - completedAtAmbient)
      : timeAfterLetterOpen;
    if (fallingClock >= 0) {
      const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 8.7;
      const halfWidth = (viewHeight * camera.aspect) / 2;
      fallingClusters.forEach((cluster, index) => {
        const localTime = fallingClock - cluster.delay;
        if (localTime < 0) {
          fallingTransform.position.set(0, -100, 0);
          fallingTransform.scale.setScalar(0);
          fallingTransform.updateMatrix();
          fallingClusterMesh.setMatrixAt(index, fallingTransform.matrix);
          return;
        }
        const progress = (localTime % cluster.duration) / cluster.duration;
        const edgeIn = ease(progress / 0.13);
        const edgeOut = 1 - ease((progress - 0.82) / 0.16);
        const flutter = Math.sin(progress * Math.PI * 2 + cluster.delay * 4);
        const sideFraction = Math.min(0.97, letterSideFraction + cluster.offset);
        const gravity = progress * progress;
        fallingTransform.position.set(
          cluster.side * halfWidth * sideFraction + flutter * halfWidth * cluster.sway,
          viewHeight * cluster.startHeight - gravity * viewHeight * 1.15,
          cluster.depth + Math.sin(progress * Math.PI * 2.5 + cluster.delay) * 0.07,
        );
        fallingTransform.rotation.set(
          0.42 + flutter * 0.42,
          Math.sin(progress * Math.PI * 2.2 + cluster.delay) * 0.48,
          progress * Math.PI * 2.7 + cluster.delay,
        );
        fallingTransform.scale.setScalar(
          progress < 0.985 ? cluster.scale * Math.min(edgeIn, edgeOut) : 0,
        );
        fallingTransform.updateMatrix();
        fallingClusterMesh.setMatrixAt(index, fallingTransform.matrix);
      });
      fallingClusterMesh.instanceMatrix.needsUpdate = true;
    } else {
      fallingClusters.forEach((_, index) => {
        fallingTransform.position.set(0, -100, 0);
        fallingTransform.scale.setScalar(0);
        fallingTransform.updateMatrix();
        fallingClusterMesh.setMatrixAt(index, fallingTransform.matrix);
      });
      fallingClusterMesh.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }

  function tick(now: number): void {
    frame = 0;
    if (disposed || document.hidden || !inView || !motionAllowed) return;
    if (now - lastFrame > 32) {
      lastFrame = now;
      if (active && now - startedAt >= SCENE_SEQUENCE_DURATION * 1000) {
        active = false;
        complete = true;
        completedAtAmbient = now / 1000;
      }
      render(
        active
          ? Math.min((now - startedAt) / 1000, SCENE_SEQUENCE_DURATION)
          : complete
            ? SCENE_SEQUENCE_DURATION
            : -1,
        now / 1000,
      );
    }
    frame = requestAnimationFrame(tick);
  }
  function wake(): void {
    if (!frame && !disposed && !document.hidden && inView && motionAllowed)
      frame = requestAnimationFrame(tick);
  }
  function finish(): void {
    active = false;
    complete = true;
    completedAtAmbient = performance.now() / 1000;
    cancelAnimationFrame(frame);
    frame = 0;
    render(SCENE_SEQUENCE_DURATION, performance.now() / 1000);
    wake();
  }
  observer.observe(root);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        render(
          active
            ? Math.min((performance.now() - startedAt) / 1000, SCENE_SEQUENCE_DURATION)
            : complete
              ? SCENE_SEQUENCE_DURATION
              : -1,
        );
        wake();
      }
    },
    { signal: controller.signal },
  );
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView) wake();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    { threshold: 0.01 },
  );
  visibilityObserver.observe(root);
  drawingCanvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      dispose();
    },
    { signal: controller.signal },
  );
  root.append(drawingCanvas);
  resize();
  fallback.classList.add('is-replaced');

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    controller.abort();
    observer.disconnect();
    visibilityObserver.disconnect();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.Sprite
      ) {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points)
          geometries.add(object.geometry);
        const material = object.material;
        (Array.isArray(material) ? material : [material]).forEach((mat) => materials.add(mat));
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    labelTexture.dispose();
    trailTexture.dispose();
    renderer.dispose();
    drawingCanvas.remove();
    fallback.classList.remove('is-replaced');
  }
  return {
    play(reduced, elapsed = 0) {
      if (reduced) {
        finish();
        return;
      }
      startedAt = performance.now() - elapsed * 1000;
      active = true;
      complete = false;
      completedAtAmbient = 0;
      wake();
    },
    finish,
    setMotion(enabled) {
      motionAllowed = enabled;
      if (enabled) wake();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
        render(
          active
            ? Math.min((performance.now() - startedAt) / 1000, SCENE_SEQUENCE_DURATION)
            : complete
              ? SCENE_SEQUENCE_DURATION
              : -1,
        );
      }
    },
    dispose,
  };
}
