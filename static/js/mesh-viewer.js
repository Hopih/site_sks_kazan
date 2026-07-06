/**
 * Interactive 3D product viewers for SKS catalog (Three.js).
 * Types: svarnaya (welded mesh), cpvs (expanded metal), karkasy (rebar cage).
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const SLUG_TO_TYPE = {
    'armaturnye-karkasy': 'karkasy',
    'setka-armaturnaya': 'armaturnaya',
    'setka-cvps': 'cpvs',
    'provoloka': 'provoloka',
};

function resolveMeshType(container) {
    const explicit = container.dataset.meshType;
    if (explicit) return explicit;
    const slug = container.dataset.categorySlug;
    if (slug && SLUG_TO_TYPE[slug]) return SLUG_TO_TYPE[slug];
    return 'svarnaya';
}

function steelMaterial(color = 0xd8dce2, metalness = 1, roughness = 0.12) {
    return new THREE.MeshPhysicalMaterial({
        color,
        metalness,
        roughness,
        clearcoat: 0.45,
        clearcoatRoughness: 0.12,
        reflectivity: 1,
    });
}

function addBar(group, from, to, radius, material) {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    if (len < 0.0001) return;

    const geom = new THREE.CylinderGeometry(radius, radius, len, 10);
    const bar = new THREE.Mesh(geom, material);
    bar.position.copy(start).add(end).multiplyScalar(0.5);
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    group.add(bar);
}

/** Сварная сетка — плоское полотно с точками сварки в узлах */
function createWeldedMesh(size = 2, divisions = 18) {
    const group = new THREE.Group();
    const wireR = 0.007;
    const wireMat = steelMaterial(0xe2e6eb, 1, 0.1);
    const weldMat = steelMaterial(0xb0b7c0, 1, 0.08);

    for (let i = 0; i <= divisions; i++) {
        const t = (i / divisions - 0.5) * size;
        addBar(group, [-size / 2, t, 0], [size / 2, t, 0], wireR, wireMat);
        addBar(group, [t, -size / 2, 0], [t, size / 2, 0], wireR, wireMat);
    }

    for (let i = 0; i <= divisions; i++) {
        for (let j = 0; j <= divisions; j++) {
            const x = (i / divisions - 0.5) * size;
            const y = (j / divisions - 0.5) * size;
            const weld = new THREE.Mesh(
                new THREE.SphereGeometry(wireR * 1.55, 10, 10),
                weldMat,
            );
            weld.position.set(x, y, 0);
            group.add(weld);
        }
    }

    group.rotation.x = -0.28;
    return group;
}

function addInstancedBars(group, segments, radius, material, radialSegments = 8) {
    if (!segments.length) return;

    const geom = new THREE.CylinderGeometry(radius, radius, 1, radialSegments);
    const mesh = new THREE.InstancedMesh(geom, material, segments.length);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    segments.forEach(([from, to], index) => {
        const start = new THREE.Vector3(...from);
        const end = new THREE.Vector3(...to);
        direction.subVectors(end, start);
        const len = direction.length();
        if (len < 0.0001) return;

        position.copy(start).add(end).multiplyScalar(0.5);
        quaternion.setFromUnitVectors(up, direction.normalize());
        scale.set(1, len, 1);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
}

function addInstancedSpheres(group, points, radius, material, segments = 8) {
    if (!points.length) return;

    const geom = new THREE.SphereGeometry(radius, segments, segments);
    const mesh = new THREE.InstancedMesh(geom, material, points.length);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    points.forEach((point, index) => {
        position.set(...point);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
}

function queueCpvsDiamond(segments, surfacePoint, centerS, centerZ, hw, hh) {
    const points = [
        surfacePoint(centerS - hw, centerZ),
        surfacePoint(centerS, centerZ + hh),
        surfacePoint(centerS + hw, centerZ),
        surfacePoint(centerS, centerZ - hh),
    ];

    for (let i = 0; i < points.length; i++) {
        segments.push([points[i], points[(i + 1) % points.length]]);
    }
}

function queueBoundary(segments, surfacePoint, fromS, toS, z, steps) {
    let previous = surfacePoint(fromS, z);
    for (let i = 1; i <= steps; i++) {
        const s = fromS + ((toS - fromS) * i) / steps;
        const next = surfacePoint(s, z);
        segments.push([previous, next]);
        previous = next;
    }
}

/** ЦПВС — рулон с развёрнутым полотном (как на фото) */
function createCpvsMesh() {
    const group = new THREE.Group();
    const wireR = 0.0034;
    const mat = steelMaterial(0xd9dee4, 1, 0.08);
    const shadowMat = steelMaterial(0xaeb8c2, 1, 0.16);
    const edgeMat = steelMaterial(0xc5ccd4, 1, 0.12);

    const mainSegments = [];
    const shadowSegments = [];
    const edgeSegments = [];

    const sheetHalfW = 0.5;
    const flatLength = 1.25;
    const rollRadius = 0.38;
    const layerRise = 0.038;
    const rollTurns = 2.18;
    const rollLength = Math.PI * 2 * rollRadius * rollTurns;
    const cellHalfS = 0.042;
    const cellHalfZ = 0.036;
    const rowCount = 15;
    const flatCols = 24;
    const rollCols = 50;

    const flatSurface = (s, z) => [s, -0.01, z];
    const rollSurface = (s, z) => {
        const theta = s / rollRadius;
        const radius = rollRadius + (theta / (Math.PI * 2)) * layerRise;
        return [
            Math.sin(theta) * radius,
            radius * (1 - Math.cos(theta)) - 0.01,
            z,
        ];
    };

    for (let c = 0; c < flatCols; c++) {
        for (let r = 0; r < rowCount; r++) {
            const rowT = r / (rowCount - 1);
            const centerZ = (rowT - 0.5) * 2 * sheetHalfW;
            const stagger = (r % 2) * cellHalfS;
            const centerS = -flatLength + ((c + 0.7) / flatCols) * flatLength + stagger;
            queueCpvsDiamond(mainSegments, flatSurface, centerS, centerZ, cellHalfS, cellHalfZ);
        }
    }

    for (let c = 0; c < rollCols; c++) {
        for (let r = 0; r < rowCount; r++) {
            const rowT = r / (rowCount - 1);
            const centerZ = (rowT - 0.5) * 2 * sheetHalfW;
            const stagger = (r % 2) * cellHalfS;
            const centerS = ((c + 0.35) / rollCols) * rollLength + stagger;
            const target = centerS > Math.PI * 2 * rollRadius ? shadowSegments : mainSegments;
            queueCpvsDiamond(target, rollSurface, centerS, centerZ, cellHalfS, cellHalfZ);
        }
    }

    queueBoundary(edgeSegments, flatSurface, -flatLength, 0, -sheetHalfW, 28);
    queueBoundary(edgeSegments, flatSurface, -flatLength, 0, sheetHalfW, 28);
    queueBoundary(edgeSegments, rollSurface, 0, rollLength, -sheetHalfW, 64);
    queueBoundary(edgeSegments, rollSurface, 0, rollLength, sheetHalfW, 64);

    addInstancedBars(group, mainSegments, wireR, mat, 8);
    addInstancedBars(group, shadowSegments, wireR * 0.92, shadowMat, 8);
    addInstancedBars(group, edgeSegments, wireR * 1.25, edgeMat, 8);

    // Видимый торец рулона: несколько слоёв подчёркивают, что полотно свёрнуто.
    const endZ = sheetHalfW + 0.018;
    for (let i = 0; i < 4; i++) {
        const radius = rollRadius + i * layerRise * 0.8;
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius, wireR * 1.25, 7, 96),
            i === 0 ? shadowMat : edgeMat,
        );
        ring.position.set(0, radius - 0.01, endZ + i * 0.006);
        group.add(ring);
    }

    const spokes = [];
    for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const outer = rollRadius + layerRise * 2.7;
        const inner = rollRadius * 0.42;
        spokes.push([
            [Math.cos(a) * outer, rollRadius + Math.sin(a) * outer - 0.01, endZ],
            [Math.cos(a) * inner, rollRadius + Math.sin(a) * inner - 0.01, endZ + 0.018],
        ]);
    }
    addInstancedBars(group, spokes, wireR * 1.15, shadowMat, 7);

    group.position.set(0.28, -0.34, 0);
    group.rotation.x = -0.42;
    group.rotation.y = 0.68;
    group.rotation.z = 0.04;
    return group;
}

/** Арматурный каркас — объёмная 3D-cage из прутков */
function createRebarFrame(w = 1.7, h = 0.55, d = 1.1) {
    const group = new THREE.Group();
    const barR = 0.022;
    const mat = steelMaterial(0x9aa3ad, 1, 0.22);
    const tieMat = steelMaterial(0x858d97, 1, 0.28);
    const tieR = 0.014;

    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;

    const corners = [
        [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd],
        [-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd],
    ];

    const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    edges.forEach(([a, b]) => addBar(group, corners[a], corners[b], barR, mat));

    const layers = [-hh * 0.5, 0, hh * 0.5];
    layers.forEach((y) => {
        addBar(group, [-hw, y, -hd], [hw, y, -hd], tieR, tieMat);
        addBar(group, [hw, y, -hd], [hw, y, hd], tieR, tieMat);
        addBar(group, [hw, y, hd], [-hw, y, hd], tieR, tieMat);
        addBar(group, [-hw, y, hd], [-hw, y, -hd], tieR, tieMat);
        addBar(group, [-hw, y, -hd], [hw, y, hd], tieR, tieMat);
        addBar(group, [hw, y, -hd], [-hw, y, hd], tieR, tieMat);
    });

    for (let i = -1; i <= 1; i += 2) {
        addBar(group, [i * hw * 0.6, -hh, -hd], [i * hw * 0.6, hh, -hd], barR * 0.85, mat);
        addBar(group, [i * hw * 0.6, -hh, hd], [i * hw * 0.6, hh, hd], barR * 0.85, mat);
    }

    group.rotation.x = -0.38;
    group.rotation.y = 0.45;
    return group;
}

/** Арматурная сетка — стопка тяжёлых карт, как на складской фотографии */
function createRebarMeshStack() {
    const group = new THREE.Group();
    const barMat = steelMaterial(0x1f2833, 1, 0.28);
    const sideMat = steelMaterial(0x111820, 1, 0.38);
    const weldMat = steelMaterial(0x525f6d, 1, 0.18);

    const w = 2.2;
    const d = 1.34;
    const hw = w / 2;
    const hd = d / 2;
    const layers = 14;
    const layerGap = 0.038;
    const rodR = 0.012;
    const topRodR = 0.014;
    const xBars = 13;
    const zBars = 8;

    const mainSegments = [];
    const sideSegments = [];
    const welds = [];
    const topLayer = layers - 1;

    for (let l = 0; l < layers; l++) {
        const y = (l - (layers - 1) / 2) * layerGap;
        const offsetX = (l % 2) * 0.008;
        const offsetZ = (l % 3) * 0.006;
        const target = l > layers - 4 ? mainSegments : sideSegments;

        for (let i = 0; i < xBars; i++) {
            const z = -hd + (i / (xBars - 1)) * d + offsetZ;
            const overhang = i === 0 || i === xBars - 1 ? 0.05 : 0.025;
            target.push([
                [-hw - overhang + offsetX, y, z],
                [hw + overhang + offsetX, y, z],
            ]);
        }

        for (let j = 0; j < zBars; j++) {
            const x = -hw + (j / (zBars - 1)) * w + offsetX;
            const overhang = j === 0 || j === zBars - 1 ? 0.055 : 0.03;
            target.push([
                [x, y + rodR * 1.7, -hd - overhang + offsetZ],
                [x, y + rodR * 1.7, hd + overhang + offsetZ],
            ]);
        }

        if (l === topLayer) {
            for (let i = 0; i < xBars; i++) {
                const z = -hd + (i / (xBars - 1)) * d + offsetZ;
                for (let j = 0; j < zBars; j++) {
                    const x = -hw + (j / (zBars - 1)) * w + offsetX;
                    welds.push([x, y + rodR * 1.7, z]);
                }
            }
        }
    }

    addInstancedBars(group, sideSegments, rodR, sideMat, 9);
    addInstancedBars(group, mainSegments, topRodR, barMat, 10);
    addInstancedSpheres(group, welds, topRodR * 1.35, weldMat, 9);

    const edgeSegments = [];
    const yBottom = -((layers - 1) / 2) * layerGap - rodR * 1.4;
    const yTop = ((layers - 1) / 2) * layerGap + rodR * 2.8;

    for (let i = 0; i < xBars; i++) {
        const z = -hd + (i / (xBars - 1)) * d;
        edgeSegments.push([[-hw - 0.055, yBottom, z], [-hw - 0.055, yTop, z]]);
        edgeSegments.push([[hw + 0.055, yBottom, z], [hw + 0.055, yTop, z]]);
    }

    for (let j = 0; j < zBars; j++) {
        const x = -hw + (j / (zBars - 1)) * w;
        edgeSegments.push([[x, yBottom, -hd - 0.055], [x, yTop, -hd - 0.055]]);
        edgeSegments.push([[x, yBottom, hd + 0.055], [x, yTop, hd + 0.055]]);
    }

    addInstancedBars(group, edgeSegments, rodR * 0.8, sideMat, 7);

    group.position.set(0.02, -0.08, 0);
    group.rotation.x = -0.48;
    group.rotation.y = 0.62;
    group.rotation.z = -0.03;
    return group;
}

/** Вязальная проволока — ровный бублик с отдельными витками */
function createWireCoil() {
    const group = new THREE.Group();
    const wireMat = steelMaterial(0x727a84, 1, 0.36);
    const strapMat = steelMaterial(0x525860, 1, 0.46);

    const innerR = 0.32;
    const outerR = 0.78;
    const wireR = 0.006;
    const wireCount = 52;
    const coilHeight = 0.28;

    const ringGeom = new THREE.TorusGeometry(1, wireR, 7, 72);
    const wires = new THREE.InstancedMesh(ringGeom, wireMat, wireCount);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Euler(Math.PI / 2, 0, 0);

    for (let i = 0; i < wireCount; i++) {
        const t = i / (wireCount - 1);
        const majorR = innerR + (outerR - innerR) * t;
        const y = (t - 0.5) * coilHeight;

        quaternion.setFromEuler(rotation);
        position.set(0, y, 0);
        scale.set(majorR, majorR, 1);
        matrix.compose(position, quaternion, scale);
        wires.setMatrixAt(i, matrix);
    }

    wires.instanceMatrix.needsUpdate = true;
    group.add(wires);

    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        addBar(
            group,
            [Math.cos(angle) * outerR * 0.96, coilHeight * 0.5, Math.sin(angle) * outerR * 0.96],
            [Math.cos(angle) * outerR * 0.96, -coilHeight * 0.5, Math.sin(angle) * outerR * 0.96],
            0.005,
            strapMat,
        );
    }

    group.rotation.x = -0.28;
    group.rotation.y = 0.25;
    return group;
}

const BUILDERS = {
    svarnaya: createWeldedMesh,
    armaturnaya: createRebarMeshStack,
    cpvs: createCpvsMesh,
    karkasy: createRebarFrame,
    provoloka: createWireCoil,
};

const CAMERA = {
    svarnaya: { pos: [0, 0, 3.6], target: [0, 0, 0] },
    armaturnaya: { pos: [0.2, 0.12, 3.35], target: [0, 0, 0] },
    cpvs: { pos: [0.15, 0.12, 3.7], target: [0, 0.08, 0] },
    karkasy: { pos: [0.3, 0.2, 3.8], target: [0, 0, 0] },
    provoloka: { pos: [0.15, 0.1, 3.3], target: [0, 0, 0] },
};

function createSceneLights(scene, isHero = false) {
    scene.add(new THREE.AmbientLight(0xffffff, isHero ? 0.55 : 0.62));

    const key = new THREE.DirectionalLight(0xffffff, isHero ? 1.6 : 1.35);
    key.position.set(4, 5, 6);
    scene.add(key);

    const fill = new THREE.DirectionalLight(isHero ? 0xe8eef5 : 0xfef3c7, isHero ? 0.35 : 0.42);
    fill.position.set(-5, -1, 3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xdce8f5, isHero ? 0.55 : 0.35);
    rim.position.set(-2, 3, -4);
    scene.add(rim);

    if (isHero) {
        const spec = new THREE.PointLight(0xffffff, 0.9, 12);
        spec.position.set(2, 2, 4);
        scene.add(spec);
    }
}

function createPedestal(scene) {
    const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1.35, 48),
        new THREE.MeshStandardMaterial({
            color: 0x2a3340,
            metalness: 0.5,
            roughness: 0.75,
            transparent: true,
            opacity: 0.4,
        }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.72;
    scene.add(disc);
}

function initMeshViewer(container) {
    container.classList.add('is-loading');

    const sizeMap = {
        hero: [440, 440],
        large: [560, 480],
        small: [320, 190],
    };
    const fallback = sizeMap[container.dataset.size] || [320, 160];
    const meshType = resolveMeshType(container);
    const isHero = container.dataset.size === 'hero';
    const isFloating = isHero;

    let width = container.clientWidth || fallback[0];
    let height = container.clientHeight || fallback[1];

    const scene = new THREE.Scene();
    const camCfg = CAMERA[meshType] || CAMERA.svarnaya;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(...camCfg.pos);
    camera.lookAt(...camCfg.target);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isFloating ? 1.35 : 1.22;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    createSceneLights(scene, isFloating);
    if (!isFloating) createPedestal(scene);

    const build = BUILDERS[meshType] || BUILDERS.svarnaya;
    const model = build();
    scene.add(model);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let autoRotate = true;
    let autoAngle = model.rotation.y;
    let resumeAutoRotateAt = 0;
    const baseTiltX = model.rotation.x;

    function onPointerDown(x, y) {
        dragging = true;
        autoRotate = false;
        resumeAutoRotateAt = Number.POSITIVE_INFINITY;
        lastX = x;
        lastY = y;
    }

    function onPointerMove(x, y) {
        if (!dragging) return;
        model.rotation.y += (x - lastX) * 0.009;
        model.rotation.x = baseTiltX + (y - lastY) * 0.009;
        model.rotation.x = Math.max(baseTiltX - 0.5, Math.min(baseTiltX + 0.5, model.rotation.x));
        lastX = x;
        lastY = y;
    }

    function onPointerUp() {
        dragging = false;
        resumeAutoRotateAt = performance.now() + 2500;
    }

    renderer.domElement.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onPointerUp);

    renderer.domElement.addEventListener('touchstart', (e) => {
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    renderer.domElement.addEventListener('touchmove', (e) => {
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    renderer.domElement.addEventListener('touchend', onPointerUp);

    const clock = new THREE.Clock();
    let isReady = false;

    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        if (!autoRotate && !dragging && performance.now() > resumeAutoRotateAt) {
            autoRotate = true;
            autoAngle = model.rotation.y;
        }

        if (autoRotate) {
            autoAngle += 0.005;
            model.rotation.y = autoAngle;
        }

        if (isFloating) {
            model.position.y = Math.sin(t * 0.9) * 0.03;
        }

        renderer.render(scene, camera);

        if (!isReady) {
            isReady = true;
            container.classList.remove('is-loading');
        }
    }
    animate();

    const ro = new ResizeObserver(() => {
        const w = container.clientWidth || fallback[0];
        const h = container.clientHeight || fallback[1];
        if (w && h) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
    });
    ro.observe(container);

    container._meshViewerResize = () => {
        const w = container.clientWidth || fallback[0];
        const h = container.clientHeight || fallback[1];
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
}

document.querySelectorAll('[data-mesh-viewer]').forEach(initMeshViewer);

export function refreshHeroMeshViewers() {
    document.querySelectorAll('.hero-slide.active [data-mesh-viewer]').forEach((el) => {
        el._meshViewerResize?.();
    });
}

window.refreshHeroMeshViewers = refreshHeroMeshViewers;
