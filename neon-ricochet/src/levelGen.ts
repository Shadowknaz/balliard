import { state, progress } from './state';
import { CONFIG, LOGICAL_W, LOGICAL_H } from './config';
import { Portal, WormholeEntity } from './entities/Effects';
import { PlayerBall } from './entities/Player';
import { Node, BossNode, SuperBossNode, BrainBossNode, GuardianNode } from './entities/Node';
import { updateUI, updateRPG_UI, updateInventoryUI, centerMessage, skipSectorBtn, instructionsUI } from './ui';

export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    let dx = x2 - x1, dy = y2 - y1, length2 = dx * dx + dy * dy;
    if (length2 === 0) return Math.hypot(px - x1, py - y1);
    let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Новые помощники для генерации разнообразной геометрии

export function addWall(x1: number, y1: number, x2: number, y2: number, thickness = 4, isFragile = false) {
    if (isFragile) {
        state.walls.push({ x1, y1, x2, y2, health: 2, maxHealth: 2, thickness });
    } else {
        state.walls.push({ x1, y1, x2, y2, thickness });
    }
}

export function createBezierCurve(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, thickness = 4, isFragile = false, segments = 10) {
    let lastX = x1, lastY = y1;
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const invT = 1 - t;
        const x = invT * invT * x1 + 2 * invT * t * cx + t * t * x2;
        const y = invT * invT * y1 + 2 * invT * t * cy + t * t * y2;
        addWall(lastX, lastY, x, y, thickness, isFragile);
        lastX = x; lastY = y;
    }
}

export function addWavyWall(x1: number, y1: number, x2: number, y2: number, thickness = 4, isFragile = false, amplitude = 12, frequency = 0.04) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 30) { addWall(x1, y1, x2, y2, thickness, isFragile); return; }
    
    const nx = -dy / len, ny = dx / len;
    const segments = Math.max(3, Math.floor(len / 25));
    
    let lastX = x1, lastY = y1;
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        let x = x1 + dx * t;
        let y = y1 + dy * t;
        if (i < segments) {
            const shift = Math.sin(i * frequency * 30 + Math.random() * 0.5) * amplitude;
            x += nx * shift;
            y += ny * shift;
        }
        addWall(lastX, lastY, x, y, thickness, isFragile);
        lastX = x; lastY = y;
    }
}

export function addBrokenWall(x1: number, y1: number, x2: number, y2: number, thickness = 4, isFragile = false, gapChance = 0.3) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 40) { if (Math.random() > gapChance) addWall(x1, y1, x2, y2, thickness, isFragile); return; }
    
    const segments = Math.max(2, Math.floor(len / 40));
    for (let i = 0; i < segments; i++) {
        if (Math.random() > gapChance) {
            const t1 = i / segments, t2 = (i + 0.6 + Math.random() * 0.3) / segments;
            addWall(x1 + dx * t1, y1 + dy * t1, x1 + dx * t2, y1 + dy * t2, thickness, isFragile);
        }
    }
}

export function trySpawnNode(type: string, startX: number, startY: number, areaWidth: number, areaHeight: number, safeRadius: number, cx: number, cy: number) {
    let x, y, attempts = 0;
    do {
        x = startX + Math.random() * (areaWidth - 40) + 20; y = startY + Math.random() * (areaHeight - 40) + 20;
        let valid = Math.hypot(x - cx, y - cy) >= safeRadius;
        if (valid) for (let p of state.portals) if (Math.hypot(x - p.x, y - p.y) < p.radius + 40) { valid = false; break; }
        if (valid) for (let w of state.walls) if (distToSegment(x, y, w.x1, w.y1, w.x2, w.y2) < CONFIG.nodeRadius + 15) { valid = false; break; }
        if (valid) for (let n of state.nodes) if (Math.hypot(n.x - x, n.y - y) < n.radius + CONFIG.nodeRadius + 8) { valid = false; break; }
        
        if (valid) { state.nodes.push(new Node(x, y, type)); return true; }
        attempts++;
    } while(attempts < 20);
    return false;
}

export function generateMazeWalls(startX: number, startY: number, width: number, height: number, safeCx: number, safeCy: number) {
    const cellSize = 160, cols = Math.floor(width / cellSize), rows = Math.floor(height / cellSize);
    if (cols < 2 || rows < 2) return;

    const offsetX = startX + (width - cols * cellSize) / 2, offsetY = startY + (height - rows * cellSize) / 2;
    const safeRadius = 220; 
    let currentSet: any[] = [], nextSetId = 1;

    const shouldAddWall = (x1: number, y1: number, x2: number, y2: number) => {
        return distToSegment(safeCx, safeCy, x1, y1, x2, y2) > safeRadius;
    };
    
    const isFragileWall = () => Math.random() < 0.15;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) if (!currentSet[c]) currentSet[c] = nextSetId++;
        let bottomWalls = new Array(cols).fill(false);

        for (let c = 0; c < cols - 1; c++) {
            let addWallCheck = Math.random() < 0.45;
            if (r === rows - 1) addWallCheck = currentSet[c] === currentSet[c + 1];

            if (currentSet[c] === currentSet[c + 1] || addWallCheck) {
                let x1 = offsetX + (c + 1) * cellSize; let y1 = offsetY + r * cellSize;
                let x2 = offsetX + (c + 1) * cellSize; let y2 = offsetY + (r + 1) * cellSize;
                if (shouldAddWall(x1, y1, x2, y2)) {
                    const thickness = Math.random() < 0.3 ? 15 : 8;
                    const fragile = isFragileWall();
                    const style = Math.random();
                    if (style < 0.15) addWavyWall(x1, y1, x2, y2, thickness, fragile);
                    else if (style < 0.8) addBrokenWall(x1, y1, x2, y2, thickness, fragile, 0.4);
                    else addWall(x1, y1, x2, y2, thickness, fragile);
                }
            } else {
                let oldSet = currentSet[c + 1];
                for (let i = 0; i < cols; i++) if (currentSet[i] === oldSet) currentSet[i] = currentSet[c];
            }
        }

        if (r < rows - 1) {
            let setsInRow: Record<string, number[]> = {};
            for (let c = 0; c < cols; c++) { if (!setsInRow[currentSet[c]]) setsInRow[currentSet[c]] = []; setsInRow[currentSet[c]].push(c); }
            for (let setId in setsInRow) {
                let cells = setsInRow[setId].sort(() => Math.random() - 0.5);
                for (let i = 1; i < cells.length; i++) {
                    if (Math.random() < 0.5) {
                        bottomWalls[cells[i]] = true;
                        let x1 = offsetX + cells[i] * cellSize; let y1 = offsetY + (r + 1) * cellSize;
                        let x2 = offsetX + (cells[i] + 1) * cellSize; let y2 = offsetY + (r + 1) * cellSize;
                        if (shouldAddWall(x1, y1, x2, y2)) {
                            const thickness = Math.random() < 0.3 ? 15 : 8;
                            const fragile = isFragileWall();
                            const style = Math.random();
                            if (style < 0.15) addWavyWall(x1, y1, x2, y2, thickness, fragile);
                            else if (style < 0.8) addBrokenWall(x1, y1, x2, y2, thickness, fragile, 0.4);
                            else addWall(x1, y1, x2, y2, thickness, fragile);
                        }
                    }
                }
            }
            for (let c = 0; c < cols; c++) if (bottomWalls[c]) currentSet[c] = null;
        }
    }
}

export function generateCaveLevel(cx: number, cy: number) {
    const points = 6;
    const radius = 350;
    for (let i = 0; i < points; i++) {
        if (Math.random() < 0.25) continue; // 25% шанс не создавать стену вообще (разрыв)
        const a1 = (i / points) * Math.PI * 2;
        const a2 = ((i + 1) / points) * Math.PI * 2;
        const x1 = cx + Math.cos(a1) * radius, y1 = cy + Math.sin(a1) * radius;
        const x2 = cx + Math.cos(a2) * radius, y2 = cy + Math.sin(a2) * radius;
        const midA = (a1 + a2) / 2;
        const midR = radius * (0.6 + Math.random() * 0.4);
        const midX = cx + Math.cos(midA) * midR, midY = cy + Math.sin(midA) * midR;
        createBezierCurve(x1, y1, midX, midY, x2, y2, 12, false, 12);
    }
    for (let i = 0; i < 4; i++) {
        const x = cx + (Math.random() - 0.5) * 400, y = cy + (Math.random() - 0.5) * 400;
        if (Math.hypot(x - cx, y - cy) > 150) {
            createBezierCurve(x, y, x + (Math.random()-0.5)*200, y + (Math.random()-0.5)*200, x + (Math.random()-0.5)*100, y + (Math.random()-0.5)*100, 8, Math.random() < 0.3);
        }
    }
}

export function generateRuinsLevel(cx: number, cy: number) {
    for (let i = 0; i < 15; i++) {
        const x = 200 + Math.random() * (LOGICAL_W - 400);
        const y = 200 + Math.random() * (LOGICAL_H - 400);
        if (Math.hypot(x - cx, y - cy) < 180) continue;
        const len = 100 + Math.random() * 200;
        const ang = Math.random() * Math.PI * 2;
        addBrokenWall(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, Math.random() < 0.5 ? 15 : 8, Math.random() < 0.2);
    }
}

export function generateArenaLevel(cx: number, cy: number) {
    const w = 1000, h = 600, bevel = 80;
    const x1 = cx - w/2, x2 = cx + w/2, y1 = cy - h/2, y2 = cy + h/2;
    
    // Периметр со скошенными углами и разрывами на каждой стороне
    addWall(x1 + bevel, y1, cx - 40, y1, 15); // Top gap
    addWall(cx + 40, y1, x2 - bevel, y1, 15); 

    addWall(x1 + bevel, y2, cx - 40, y2, 15); // Bottom gap
    addWall(cx + 40, y2, x2 - bevel, y2, 15); 

    addWall(x2, y1 + bevel, x2, cy - 40, 15); // Right gap
    addWall(x2, cy + 40, x2, y2 - bevel, 15); 

    addWall(x1, y1 + bevel, x1, cy - 40, 15); // Left gap
    addWall(x1, cy + 40, x1, y2 - bevel, 15); 

    // Углы
    addWall(x2 - bevel, y1, x2, y1 + bevel, 15);
    addWall(x2, y2 - bevel, x2 - bevel, y2, 15);
    addWall(x1, y2 - bevel, x1 + bevel, y2, 15);
    addWall(x1, y1 + bevel, x1 + bevel, y1, 15);
    
    // Внутренние "шпоры"
    for (let i = 0; i < 4; i++) {
        const ang = i * Math.PI / 2 + Math.PI / 4;
        const sx = cx + Math.cos(ang) * 200, sy = cy + Math.sin(ang) * 200;
        addWavyWall(sx, sy, sx + Math.cos(ang) * 100, sy + Math.sin(ang) * 100, 8, true);
    }
}

export function generateAdvancedLevel(cx: number, cy: number) {
    // До 11 сектора используем только классический лабиринт (более простой вход в игру)
    if (progress.sector < 11) {
        generateMazeWalls(100, 100, LOGICAL_W - 200, LOGICAL_H - 200, cx, cy);
        return;
    }

    const type = Math.random();
    
    // Порталы теперь генерируются глобально в initLevel

    if (type < 0.25) {
        generateCaveLevel(cx, cy);
    } else if (type < 0.5) {
        generateRuinsLevel(cx, cy);
    } else if (type < 0.75) {
        generateArenaLevel(cx, cy);
    } else {
        generateMazeWalls(100, 100, LOGICAL_W - 200, LOGICAL_H - 200, cx, cy);
    }
}

export function initLevel(forceSpiral = false, textContainer: any, resizeCanvas: () => void) {
    const cx = LOGICAL_W / 2; const cy = LOGICAL_H / 2;
    const isSpiralLevel = forceSpiral || progress.sector === 10;
    const isBrainBossLevel = progress.sector === 20;
    const isEmptyBossLevel = progress.sector === 30;
    const isBossLevel = progress.sector % 5 === 0 && !isSpiralLevel && !isBrainBossLevel && !isEmptyBossLevel;

    const childrenToRemove = [...textContainer.children];
    textContainer.removeChildren();
    childrenToRemove.forEach((c: any) => { if (!c.destroyed) c.destroy(); });

    state.player = new PlayerBall(isSpiralLevel ? 120 : cx, cy);
    state.miniBalls = []; state.nodes = []; state.portals = []; state.walls = []; state.particles = []; state.floatingTexts = []; state.blackHoles = []; state.lightningBolts = []; state.wormholes = [];
    state.shots = CONFIG.maxShots; state.combo = 1.0; state.isPlaying = true; state.isPaused = false; state.isBallMoving = false; state.destroyedCount = 0;
    state.arena = { left: 0, right: LOGICAL_W, top: 0, bottom: LOGICAL_H, targetLeft: 0, targetRight: LOGICAL_W, targetTop: 0, targetBottom: LOGICAL_H, warningShown: false };
    
    updateUI(); updateRPG_UI(); updateInventoryUI(); 
    centerMessage.classList.add('hidden'); skipSectorBtn.classList.add('hidden');
    instructionsUI.style.opacity = (progress.sector === 1 && progress.level === 1 && state.score === 0) ? '1' : '0';

    // Гарантируем порталы для всех уровней после 2 сектора (кроме особых боссов)
    if (progress.sector > 2 && !isSpiralLevel && !isEmptyBossLevel) {
        let p1x: number = 0, p1y: number = 0, p2x: number = 0, p2y: number = 0;
        let valid = false;
        let attempts = 0;
        
        while (!valid && attempts < 100) {
            p1x = 100 + Math.random() * (LOGICAL_W - 200);
            p1y = 100 + Math.random() * (LOGICAL_H - 200);
            p2x = 100 + Math.random() * (LOGICAL_W - 200);
            p2y = 100 + Math.random() * (LOGICAL_H - 200);
            
            if (Math.hypot(p1x - p2x, p1y - p2y) > 600) {
                valid = true;
            }
            attempts++;
        }
        
        if (!valid) {
            p1x = 100; p1y = cy; p2x = LOGICAL_W - 100; p2y = cy;
        }

        state.portals.push(new Portal(p1x, p1y, 0xffaa00)); 
        state.portals.push(new Portal(p2x, p2y, 0x00f3ff)); 
    }

    if (isSpiralLevel) {
        state.nodes.push(new SuperBossNode(cx, cy)); state.shots += 5; updateUI();
        for (let arm = 0; arm < 4; arm++) {
            const angleOffset = (Math.PI * 2 / 4) * arm;
            for (let i = 0; i < 55; i++) {
                const theta = i * 0.35, r = 130 + 18 * theta;
                if (r > Math.min(LOGICAL_W, LOGICAL_H) / 2 - 40) continue;
                const x = cx + Math.cos(theta + angleOffset) * r + (Math.random() - 0.5) * 12, y = cy + Math.sin(theta + angleOffset) * r + (Math.random() - 0.5) * 12;
                const rand = Math.random();
                let type = rand > 0.60 ? 'obstacle' : (rand > 0.45 ? 'bumper' : (rand > 0.30 ? 'red' : 'blue'));
                if (!state.nodes.some(n => Math.hypot(n.x - x, n.y - y) < n.radius + CONFIG.nodeRadius + 2)) state.nodes.push(new Node(x, y, type));
            }
        }
        for(let i = 0; i < 24; i++) if (i % 6 !== 0 && i % 6 !== 1) state.nodes.push(new Node(cx + Math.cos(Math.PI * 2 / 24 * i)*95, cy + Math.sin(Math.PI * 2 / 24 * i)*95, 'obstacle'));
    } else if (isBrainBossLevel) {
        const spawnX = Math.random() < 0.5 ? 60 : LOGICAL_W - 60;
        const spawnY = 150 + Math.random() * (LOGICAL_H - 300);
        state.player = new PlayerBall(spawnX, spawnY);
        
        const brain = new BrainBossNode(cx, cy);
        const g1 = new GuardianNode(cx - 150, cy + 100, 'suppressor');
        const g2 = new GuardianNode(cx + 150, cy + 100, 'restorer');
        const g3 = new GuardianNode(cx, cy - 150, 'reflector');
        brain.guardians = [g1, g2, g3];
        state.nodes.push(brain, g1, g2, g3);
        state.shots += 5; updateUI();
        
        generateAdvancedLevel(cx, cy);
        
        // More variety of nodes
        for (let i = 0; i < 15; i++) trySpawnNode(Math.random() > 0.8 ? 'red' : 'blue', 0, 0, LOGICAL_W, LOGICAL_H, 200, cx, cy);
        for (let i = 0; i < 6; i++) trySpawnNode('obstacle', 0, 0, LOGICAL_W, LOGICAL_H, 200, cx, cy);
        for (let i = 0; i < 3; i++) trySpawnNode('mine', 0, 0, LOGICAL_W, LOGICAL_H, 200, cx, cy);
        for (let i = 0; i < 3; i++) trySpawnNode('repulsor', 0, 0, LOGICAL_W, LOGICAL_H, 200, cx, cy);
        for (let i = 0; i < 3; i++) trySpawnNode('speedBumper', 0, 0, LOGICAL_W, LOGICAL_H, 200, cx, cy);
        if (Math.random() < 0.5) trySpawnNode('rainbow', 0, 0, LOGICAL_W, LOGICAL_H, 200, cx, cy);
        if (Math.random() < 0.5) trySpawnNode('extra', 0, 0, LOGICAL_W, LOGICAL_H, 200, cx, cy);
    } else if (isEmptyBossLevel) {
        state.floatingTexts.push(new FloatingText(cx, cy, `КОМНАТА 3 БОССА (В РАЗРАБОТКЕ)`, 0xffffff));
        state.shots += 1; updateUI();
        for (let i = 0; i < 20; i++) trySpawnNode('blue', 0, 0, LOGICAL_W, LOGICAL_H, 140, cx, cy);
    } else {
        if (isBossLevel) {
            let bx, by, attempts = 0;
            do {
                bx = 100 + Math.random() * (LOGICAL_W - 200);
                by = 100 + Math.random() * (LOGICAL_H - 200);
                let valid = Math.hypot(bx - cx, by - cy) >= 300;
                if (valid) for (let w of state.walls) if (distToSegment(bx, by, w.x1, w.y1, w.x2, w.y2) < 60) { valid = false; break; }
                if (valid) { state.nodes.push(new BossNode(bx, by)); break; }
                attempts++;
            } while(attempts < 50);
            if (attempts >= 50) state.nodes.push(new BossNode(cx, cy - 200));
            state.shots += 2; updateUI();
        }
        
        generateAdvancedLevel(cx, cy);
        
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
            const bumpersInCell = Math.floor(Math.random() * 2) + 1;
            for (let i = 0; i < bumpersInCell; i++) trySpawnNode('bumper', c * LOGICAL_W/3, r * LOGICAL_H/3, LOGICAL_W/3, LOGICAL_H/3, 140, cx, cy);
        }
        
        // Speed bumpers - spawn 1-3 per level
        const speedBumperCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < speedBumperCount; i++) trySpawnNode('speedBumper', 0, 0, LOGICAL_W, LOGICAL_H, 140, cx, cy);
        for (let i = 0; i < 90; i++) trySpawnNode(Math.random() > 0.85 ? 'red' : 'blue', 0, 0, LOGICAL_W, LOGICAL_H, 140, cx, cy);

        if (Math.random() < 0.40) { 
            const extraCount = Math.floor(Math.random() * 3) + 1; 
            for (let i = 0; i < extraCount; i++) trySpawnNode('extra', 0, 0, LOGICAL_W, LOGICAL_H, 140, cx, cy);
        }
        if (Math.random() < 0.25) { 
            const rainbowCount = Math.floor(Math.random() * 2) + 1; 
            for (let i = 0; i < rainbowCount; i++) trySpawnNode('rainbow', 0, 0, LOGICAL_W, LOGICAL_H, 140, cx, cy);
        }

        if (Math.random() < 0.35) {
            const mineCount = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < mineCount; i++) trySpawnNode('mine', 0, 0, LOGICAL_W, LOGICAL_H, 200, cx, cy);
        }
        if (Math.random() < 0.35) {
            const repulsorCount = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < repulsorCount; i++) trySpawnNode('repulsor', 0, 0, LOGICAL_W, LOGICAL_H, 200, cx, cy);
        }
        
        // Wormhole spawn with low chance (5%)
        if (Math.random() < 0.05) {
            let wx, wy, attempts = 0;
            do {
                wx = 200 + Math.random() * (LOGICAL_W - 400);
                wy = 200 + Math.random() * (LOGICAL_H - 400);
                let valid = Math.hypot(wx - cx, wy - cy) >= 200;
                if (valid) for (let w of state.walls) if (distToSegment(wx, wy, w.x1, w.y1, w.x2, w.y2) < 40) { valid = false; break; }
                if (valid) for (let n of state.nodes) if (Math.hypot(n.x - wx, n.y - wy) < n.radius + 50) { valid = false; break; }
                if (valid) { state.wormholes.push(new WormholeEntity(wx, wy)); break; }
                attempts++;
            } while(attempts < 20);
        }
    }
    
    state.totalTargets = state.nodes.filter(n => n.type !== 'obstacle' && n.type !== 'bumper' && n.type !== 'boss' && n.type !== 'mine' && n.type !== 'repulsor' && n.type !== 'speedBumper').length;
    if (state.totalTargets < 20) initLevel(forceSpiral, textContainer, resizeCanvas);
    resizeCanvas();
}