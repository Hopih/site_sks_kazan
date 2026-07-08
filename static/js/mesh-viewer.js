/**
 * Interactive 3D product viewers for SKS catalog (Three.js).
 * Types: svarnaya (welded mesh), rulonnaya (galvanized roll), polimernaya (polymer-coated roll), cpvs (expanded metal), karkasy (rebar cage).
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const SLUG_TO_TYPE = {
    'armaturnye-karkasy': 'karkasy',
    'setka-armaturnaya': 'armaturnaya',
    'setka-cvps': 'cpvs',
    'setka-rulonnaya': 'rulonnaya',
    'setka-polimernaya': 'polimernaya',
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

/** Рулонная сварная сетка — цилиндрический рулон с видимой ячейкой */
function createRollMesh({
    wireColor = 0xd8e2e8,
    shadowColor = 0x9facb7,
    edgeColor = 0xc7d1d8,
    coreColor = 0x111820,
    innerRadius = 0.2,
    fillCore = false,
} = {}) {
    const group = new THREE.Group();
    const wireMat = steelMaterial(wireColor, 0.88, 0.16);
    const shadowMat = steelMaterial(shadowColor, 0.9, 0.24);
    const edgeMat = steelMaterial(edgeColor, 0.88, 0.18);

    const length = 1.9;
    const halfLength = length / 2;
    const radius = 0.46;
    const wireR = 0.0038;
    const thetaCount = 38;
    const ringCount = 28;
    const thetaSteps = 64;

    const surfacePoint = (theta, x, r = radius) => [
        x,
        Math.cos(theta) * r,
        Math.sin(theta) * r,
    ];

    const lengthSegments = [];
    const ringSegments = [];

    for (let i = 0; i < thetaCount; i++) {
        const theta = (i / thetaCount) * Math.PI * 2;
        const matTarget = Math.sin(theta) < -0.25 ? ringSegments : lengthSegments;
        matTarget.push([surfacePoint(theta, -halfLength), surfacePoint(theta, halfLength)]);
    }

    for (let xIndex = 0; xIndex <= ringCount; xIndex++) {
        const x = -halfLength + (xIndex / ringCount) * length;
        for (let t = 0; t < thetaSteps; t++) {
            const a = (t / thetaSteps) * Math.PI * 2;
            const b = ((t + 1) / thetaSteps) * Math.PI * 2;
            ringSegments.push([surfacePoint(a, x), surfacePoint(b, x)]);
        }
    }

    addInstancedBars(group, ringSegments, wireR, shadowMat, 7);
    addInstancedBars(group, lengthSegments, wireR * 1.05, wireMat, 7);

    [-halfLength, halfLength].forEach((x, index) => {
        const layerCount = fillCore ? 11 : 5;
        for (let layer = 0; layer < layerCount; layer++) {
            const layerRadius = innerRadius + ((radius - innerRadius) * layer) / (layerCount - 1);
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(layerRadius, wireR * (fillCore ? 1.45 : 1.25), 7, 96),
                layer === layerCount - 1 ? edgeMat : shadowMat,
            );
            ring.rotation.y = Math.PI / 2;
            ring.position.x = x + (index === 0 ? -0.01 : 0.01);
            group.add(ring);
        }

        if (fillCore) {
            const spokeSegments = [];
            for (let i = 0; i < 30; i++) {
                const angle = (i / 30) * Math.PI * 2;
                spokeSegments.push([
                    [x, Math.cos(angle) * innerRadius * 0.55, Math.sin(angle) * innerRadius * 0.55],
                    [x, Math.cos(angle) * radius * 0.96, Math.sin(angle) * radius * 0.96],
                ]);
            }
            addInstancedBars(group, spokeSegments, wireR * 1.1, shadowMat, 7);
        }
    });

    // Небольшой внутренний просвет делает рулон узнаваемым даже в маленькой карточке.
    const core = new THREE.Mesh(
        new THREE.CylinderGeometry(innerRadius * 0.96, innerRadius * 0.96, length + 0.035, 64, 1, true),
        new THREE.MeshStandardMaterial({
            color: coreColor,
            metalness: fillCore ? 0.18 : 0.25,
            roughness: fillCore ? 0.55 : 0.7,
            transparent: true,
            opacity: fillCore ? 0.38 : 0.18,
            side: THREE.DoubleSide,
        }),
    );
    core.rotation.z = Math.PI / 2;
    group.add(core);

    group.position.set(0.02, -0.06, 0);
    group.rotation.x = -0.42;
    group.rotation.y = -0.52;
    group.rotation.z = 0.06;
    return group;
}

function createGalvanizedRollMesh() {
    return createRollMesh();
}

function createPolymerCoatedRollMesh() {
    return createRollMesh({
        wireColor: 0x04a85f,
        shadowColor: 0x013f24,
        edgeColor: 0x10c876,
        coreColor: 0x022113,
        innerRadius: 0.08,
        fillCore: true,
    });
}

/** Плоский арматурный каркас — длинная сварная "лесенка" */
function createRebarFrame() {
    const group = new THREE.Group();
    const railMat = steelMaterial(0x9ca5ad, 1, 0.2);
    const crossMat = steelMaterial(0x7f8892, 1, 0.28);
    const weldMat = steelMaterial(0xb4bbc2, 1, 0.16);

    const length = 2.45;
    const halfLength = length / 2;
    const halfWidth = 0.24;
    const railR = 0.015;
    const crossR = 0.012;
    const crossCount = 15;
    const crossOverhang = 0.12;
    const railZ = [-halfWidth, halfWidth];

    const railSegments = [];
    const crossSegments = [];
    const welds = [];

    railZ.forEach((z) => {
        railSegments.push([[-halfLength - 0.08, 0, z], [halfLength + 0.08, 0, z]]);
    });

    for (let i = 0; i < crossCount; i++) {
        const t = i / (crossCount - 1);
        const x = -halfLength + t * length;
        const y = (i % 2) * 0.006;
        crossSegments.push([
            [x, y + railR * 1.15, -halfWidth - crossOverhang],
            [x, y + railR * 1.15, halfWidth + crossOverhang],
        ]);

        railZ.forEach((z) => welds.push([x, y + railR * 1.15, z]));
    }

    addInstancedBars(group, railSegments, railR, railMat, 10);
    addInstancedBars(group, crossSegments, crossR, crossMat, 9);
    addInstancedSpheres(group, welds, crossR * 1.35, weldMat, 8);

    // Небольшие торцевые выпуски делают каркас похожим на реальный прутковый элемент.
    addBar(group, [-halfLength - 0.18, 0, -halfWidth], [-halfLength - 0.08, 0, -halfWidth], railR * 0.9, crossMat);
    addBar(group, [-halfLength - 0.18, 0, halfWidth], [-halfLength - 0.08, 0, halfWidth], railR * 0.9, crossMat);
    addBar(group, [halfLength + 0.08, 0, -halfWidth], [halfLength + 0.18, 0, -halfWidth], railR * 0.9, crossMat);
    addBar(group, [halfLength + 0.08, 0, halfWidth], [halfLength + 0.18, 0, halfWidth], railR * 0.9, crossMat);

    group.position.set(0, -0.1, 0);
    group.rotation.x = -0.5;
    group.rotation.y = 0.76;
    group.rotation.z = -0.08;
    return group;
}

/** Объёмный арматурный каркас — пространственная решётка для фундамента */
function createRebarCage() {
    const group = new THREE.Group();
    const mainMat = steelMaterial(0x34312d, 1, 0.32);
    const tieMat = steelMaterial(0x25282a, 1, 0.4);
    const weldMat = steelMaterial(0x5a5149, 1, 0.24);

    const w = 2.15;
    const d = 1.15;
    const h = 0.34;
    const hw = w / 2;
    const hd = d / 2;
    const hh = h / 2;
    const mainR = 0.013;
    const tieR = 0.0105;
    const xCount = 9;
    const zCount = 7;
    const overhang = 0.12;

    const mainSegments = [];
    const tieSegments = [];
    const welds = [];
    const levels = [-hh, hh];

    levels.forEach((y, levelIndex) => {
        for (let zi = 0; zi < zCount; zi++) {
            const z = -hd + (zi / (zCount - 1)) * d;
            const offsetY = levelIndex * mainR * 1.8;
            mainSegments.push([
                [-hw - overhang, y + offsetY, z],
                [hw + overhang, y + offsetY, z],
            ]);
        }

        for (let xi = 0; xi < xCount; xi++) {
            const x = -hw + (xi / (xCount - 1)) * w;
            tieSegments.push([
                [x, y + mainR * 1.6, -hd - overhang],
                [x, y + mainR * 1.6, hd + overhang],
            ]);
        }

        for (let xi = 0; xi < xCount; xi++) {
            const x = -hw + (xi / (xCount - 1)) * w;
            for (let zi = 0; zi < zCount; zi++) {
                const z = -hd + (zi / (zCount - 1)) * d;
                welds.push([x, y + mainR * 1.6, z]);
            }
        }
    });

    for (let xi = 0; xi < xCount; xi++) {
        const x = -hw + (xi / (xCount - 1)) * w;
        for (let zi = 0; zi < zCount; zi++) {
            const z = -hd + (zi / (zCount - 1)) * d;
            const isOuter = xi === 0 || xi === xCount - 1 || zi === 0 || zi === zCount - 1;
            const target = isOuter ? mainSegments : tieSegments;
            target.push([[x, -hh, z], [x, hh, z]]);
        }
    }

    [-hd, hd].forEach((z) => {
        for (let row = 1; row <= 2; row++) {
            const y = -hh + (row / 3) * h;
            tieSegments.push([[-hw - overhang * 0.6, y, z], [hw + overhang * 0.6, y, z]]);
        }
    });

    [-hw, hw].forEach((x) => {
        for (let row = 1; row <= 2; row++) {
            const y = -hh + (row / 3) * h;
            tieSegments.push([[x, y, -hd - overhang * 0.6], [x, y, hd + overhang * 0.6]]);
        }
    });

    addInstancedBars(group, tieSegments, tieR, tieMat, 8);
    addInstancedBars(group, mainSegments, mainR, mainMat, 10);
    addInstancedSpheres(group, welds, mainR * 1.2, weldMat, 8);

    group.position.set(0.02, -0.1, 0);
    group.rotation.x = -0.48;
    group.rotation.y = 0.58;
    group.rotation.z = -0.02;
    return group;
}

/** Арматурная сетка — одна плоская тяжёлая карта */
function createRebarMeshStack() {
    const group = new THREE.Group();
    const mainMat = steelMaterial(0x202a34, 1, 0.24);
    const crossMat = steelMaterial(0x151d25, 1, 0.32);
    const weldMat = steelMaterial(0x4b5662, 1, 0.18);

    const w = 2.2;
    const d = 1.34;
    const hw = w / 2;
    const hd = d / 2;
    const rodR = 0.018;
    const crossR = 0.015;
    const xBars = 12;
    const zBars = 8;
    const overhang = 0.06;

    const mainSegments = [];
    const crossSegments = [];
    const welds = [];

    for (let i = 0; i < zBars; i++) {
        const z = -hd + (i / (zBars - 1)) * d;
        mainSegments.push([[-hw - overhang, 0, z], [hw + overhang, 0, z]]);
    }

    for (let j = 0; j < xBars; j++) {
        const x = -hw + (j / (xBars - 1)) * w;
        crossSegments.push([[x, rodR * 1.55, -hd - overhang], [x, rodR * 1.55, hd + overhang]]);
    }

    for (let j = 0; j < xBars; j++) {
        const x = -hw + (j / (xBars - 1)) * w;
        for (let i = 0; i < zBars; i++) {
            const z = -hd + (i / (zBars - 1)) * d;
            welds.push([x, rodR * 1.55, z]);
        }
    }

    addInstancedBars(group, mainSegments, rodR, mainMat, 10);
    addInstancedBars(group, crossSegments, crossR, crossMat, 10);
    addInstancedSpheres(group, welds, crossR * 1.35, weldMat, 9);

    group.position.set(0.02, -0.06, 0);
    group.rotation.x = -0.52;
    group.rotation.y = 0.58;
    group.rotation.z = -0.03;
    return group;
}

/** Вязальная проволока — бухта с открытым центром и наружными стяжками */
function createWireCoil() {
    const group = new THREE.Group();
    const wireMat = steelMaterial(0x66727c, 1, 0.22);
    const darkWireMat = steelMaterial(0x242b31, 1, 0.36);
    const strapMat = steelMaterial(0x4d555d, 1, 0.4);

    const innerR = 0.38;
    const outerR = 0.88;
    const wireR = 0.0065;
    const wireCount = 86;
    const coilDepth = 0.34;

    const ringGeom = new THREE.TorusGeometry(1, wireR, 7, 72);
    const wires = new THREE.InstancedMesh(ringGeom, wireMat, wireCount);
    const darkWires = new THREE.InstancedMesh(ringGeom, darkWireMat, Math.floor(wireCount * 0.35));

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Euler(0, 0, 0.04);
    const darkRotation = new THREE.Euler(0, 0, -0.06);

    for (let i = 0; i < wireCount; i++) {
        const t = i / (wireCount - 1);
        const layerT = (i % 18) / 17;
        const bandT = Math.floor(i / 18) / Math.ceil(wireCount / 18);
        const majorR = innerR + (outerR - innerR) * layerT + Math.sin(i * 1.7) * 0.006;
        const z = (bandT - 0.5) * coilDepth + Math.sin(i * 0.9) * 0.012;

        quaternion.setFromEuler(rotation);
        position.set(0, 0, z);
        scale.set(majorR, majorR, 1);
        matrix.compose(position, quaternion, scale);
        wires.setMatrixAt(i, matrix);

        if (i < Math.floor(wireCount * 0.35)) {
            quaternion.setFromEuler(darkRotation);
            position.set(0, 0, z - 0.012);
            scale.set(majorR * 0.98, majorR * 0.98, 1);
            matrix.compose(position, quaternion, scale);
            darkWires.setMatrixAt(i, matrix);
        }
    }

    wires.instanceMatrix.needsUpdate = true;
    darkWires.instanceMatrix.needsUpdate = true;
    group.add(darkWires);
    group.add(wires);

    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + 0.26;
        const nextAngle = angle + 0.38;
        addBar(
            group,
            [Math.cos(angle) * outerR * 1.03, Math.sin(angle) * outerR * 1.03, coilDepth * 0.55],
            [Math.cos(nextAngle) * outerR * 1.03, Math.sin(nextAngle) * outerR * 1.03, -coilDepth * 0.55],
            0.008,
            strapMat,
        );
    }

    const innerTieSegments = [];
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        innerTieSegments.push([
            [Math.cos(angle) * innerR * 0.76, Math.sin(angle) * innerR * 0.76, -coilDepth * 0.48],
            [Math.cos(angle + 0.5) * innerR * 0.76, Math.sin(angle + 0.5) * innerR * 0.76, coilDepth * 0.48],
        ]);
    }
    addInstancedBars(group, innerTieSegments, 0.006, strapMat, 7);

    group.rotation.x = 0.04;
    group.rotation.y = -0.35;
    group.rotation.z = -0.08;
    return group;
}

const BUILDERS = {
    svarnaya: createWeldedMesh,
    armaturnaya: createRebarMeshStack,
    rulonnaya: createGalvanizedRollMesh,
    polimernaya: createPolymerCoatedRollMesh,
    cpvs: createCpvsMesh,
    karkasy: createRebarFrame,
    'karkas-obemnyy': createRebarCage,
    provoloka: createWireCoil,
};

const CAMERA = {
    svarnaya: { pos: [0, 0, 3.6], target: [0, 0, 0] },
    armaturnaya: { pos: [0.2, 0.12, 3.35], target: [0, 0, 0] },
    rulonnaya: { pos: [0.15, 0.12, 3.2], target: [0, 0, 0] },
    polimernaya: { pos: [0.15, 0.12, 3.2], target: [0, 0, 0] },
    cpvs: { pos: [0.15, 0.12, 3.7], target: [0, 0.08, 0] },
    karkasy: { pos: [0.18, 0.08, 2.85], target: [0, -0.03, 0] },
    'karkas-obemnyy': { pos: [0.26, 0.16, 3.45], target: [0, 0, 0] },
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
