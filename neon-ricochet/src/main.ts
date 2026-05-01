import './style.css';
import { LOGICAL_W, LOGICAL_H, CONFIG } from './config';
import { state, progress, resetProgress } from './state';
import { AudioEngine } from './audio';
import { checkCollisions } from './physics';
import { initLevel } from './levelGen';
import { updateUI, checkGameOver, skipSectorBtn, instructionsUI, showMainMenu, hideMainMenu, showSettings, showInventory, showEncyclopedia, saveResolution } from './ui';
import { app, gameScene, sceneBase, resizeCanvas, bgStars, bgGfx, gridGfx, wallsGlowGfx, wallsGfx, glowGfx, entitiesGfx, particlesGfx, uiGfx, textContainer } from './pixiApp';
import { FloatingText, spawnWallSparks } from './entities/Effects';

// --- УПРАВЛЕНИЕ ---
function getMousePos(e: MouseEvent | TouchEvent) {
    const rect = app.view.getBoundingClientRect();
    const scale = gameScene.scale.x; 
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    
    return {
        x: (clientX - rect.left - gameScene.position.x) / scale,
        y: (clientY - rect.top - gameScene.position.y) / scale
    };
}

function handleInputStart(e: MouseEvent | TouchEvent) {
    AudioEngine.init(); 
    const target = e.target as HTMLElement;
    if (target.id === 'newGameBtnGlobal' || target.id === 'skipSectorBtn' || target.id === 'testSpiralBtn' || target.tagName === 'BUTTON') return;
    if (!state.isPlaying || state.isPaused || state.isBallMoving || state.shots <= 0) return;
    
    const pos = getMousePos(e);
    state.isAiming = true; state.chargePower = 2; state.mouseX = pos.x; state.mouseY = pos.y; 
    instructionsUI.style.opacity = '0';
}

function handleInputMove(e: MouseEvent | TouchEvent) { 
    if (state.isAiming) { 
        const pos = getMousePos(e); state.mouseX = pos.x; state.mouseY = pos.y; 
    } 
}

function handleInputEnd() {
    if (state.isAiming && state.player) {
        state.isAiming = false;
        
        // Рогатка: стреляем в противоположную сторону от мыши
        const angle = Math.atan2(state.player.y - state.mouseY, state.player.x - state.mouseX);
        let powerMultiplier = 1.0;

        if (Math.random() < progress.upgrades.instability * 0.10) {
            powerMultiplier = 0.2 + Math.random() * 3.8; 
            state.floatingTexts.push(new FloatingText(state.player.x, state.player.y - 20, `Нестабильность x${powerMultiplier.toFixed(2)}`, powerMultiplier > 1 ? CONFIG.colors.player : CONFIG.colors.nodeRed));
        }

        if (Math.random() < progress.upgrades.lightning * 0.06) { 
            state.player.lightningTimer = 180; 
            state.floatingTexts.push(new FloatingText(state.player.x, state.player.y + 20, `Шаровая молния!`, CONFIG.colors.lightning)); 
        }

        AudioEngine.shoot(); state.shake = Math.min(state.shake + 8, 20); 
        
        // Сила броска уже рассчитана в тикере на основе дистанции
        state.player.vx = Math.cos(angle) * state.chargePower * powerMultiplier; 
        state.player.vy = Math.sin(angle) * state.chargePower * powerMultiplier;
        
        state.shots--; state.combo = 1.0; state.chargePower = 0; updateUI();
    }
}

window.addEventListener('resize', resizeCanvas);
app.view.addEventListener('mousedown', handleInputStart as EventListener);
app.view.addEventListener('mousemove', handleInputMove as EventListener);
window.addEventListener('mouseup', handleInputEnd);
app.view.addEventListener('touchstart', handleInputStart as EventListener, {passive: false});
app.view.addEventListener('touchmove', handleInputMove as EventListener, {passive: false});
window.addEventListener('touchend', handleInputEnd);

document.getElementById('newGameBtnGlobal')!.addEventListener('click', () => { 
    if (confirm("Начать заново?")) { 
        resetProgress(); 
        state.isPlaying = true;
        initLevel(false, textContainer, resizeCanvas); 
    }
});
document.getElementById('testSpiralBtn')!.addEventListener('click', () => { if (state.isPlaying && confirm("Тест Спирали?")) initLevel(true, textContainer, resizeCanvas); });
document.getElementById('testBrainBtn')!.addEventListener('click', () => { if (state.isPlaying && confirm("Тест Мозга?")) { progress.sector = 20; initLevel(false, textContainer, resizeCanvas); } });
document.getElementById('debugSkipBtn')!.addEventListener('click', () => { if (state.isPlaying) { AudioEngine.levelUp(); progress.sector++; initLevel(false, textContainer, resizeCanvas); }});
document.getElementById('skipSectorBtn')!.addEventListener('click', () => { if (state.isPlaying) { AudioEngine.levelUp(); progress.sector++; initLevel(false, textContainer, resizeCanvas); }});
document.getElementById('showMainMenuBtn')!.addEventListener('click', () => { 
    if (confirm("Вернуться в главное меню? Прогресс текущего уровня будет потерян.")) {
        showMainMenu(); 
    }
});

// Обработчики главного меню
document.getElementById('menuNewGameBtn')!.addEventListener('click', () => {
    hideMainMenu();
    resetProgress();
    state.isPlaying = true;
    initLevel(false, textContainer, resizeCanvas);
});

document.getElementById('menuInventoryBtn')!.addEventListener('click', () => {
    showInventory();
});

document.getElementById('menuSettingsBtn')!.addEventListener('click', () => {
    showSettings();
});

document.getElementById('menuEncyclopediaBtn')!.addEventListener('click', () => {
    showEncyclopedia();
});

document.getElementById('settingsCloseBtn')!.addEventListener('click', () => {
    saveResolution();
    showMainMenu();
});

document.getElementById('inventoryCloseBtn')!.addEventListener('click', () => {
    showMainMenu();
});

document.getElementById('encyclopediaCloseBtn')!.addEventListener('click', () => {
    showMainMenu();
});

// Trajectory prediction function
function calculateTrajectory(startX: number, startY: number, angle: number, power: number, maxBounces: number) {
    const points: {x: number, y: number}[] = [{x: startX, y: startY}];
    let x = startX, y = startY;
    let vx = Math.cos(angle) * power;
    let vy = Math.sin(angle) * power;
    const radius = CONFIG.playerRadius;
    const maxDistance = power * 15; // Maximum preview distance
    let distanceTraveled = 0;
    let bounces = 0;
    
    const stepSize = 10;
    const segments = Math.floor(maxDistance / stepSize);
    
    for (let i = 0; i < segments && bounces < maxBounces; i++) {
        const nextX = x + (vx / Math.hypot(vx, vy)) * stepSize;
        const nextY = y + (vy / Math.hypot(vx, vy)) * stepSize;
        
        let bounced = false;
        
        // Check node collisions first (they can block or bounce)
        for (const node of state.nodes) {
            if (node.isDestroyed || node.isDelayedState) continue;
            
            const dx = nextX - node.x;
            const dy = nextY - node.y;
            const dist = Math.hypot(dx, dy);
            const minDist = radius + node.radius;
            
            if (dist < minDist) {
                if (dist > 0) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const dot = vx * nx + vy * ny;
                    
                    // Only bounce if moving towards the node
                    if (dot < 0) {
                        // Calculate bounce point
                        const bounceX = node.x + nx * node.radius;
                        const bounceY = node.y + ny * node.radius;
                        
                        // Different node types have different behaviors
                        if (node.type === 'speedBumper') {
                            // Speed bumpers don't bounce, just pass through - but for trajectory we still show them
                            // We can continue but reduce bounces or just show the path through it
                            x = bounceX;
                            y = bounceY;
                            points.push({x: bounceX, y: bounceY});
                            bounces++;
                            bounced = true;
                            break;
                        } else if (node.type === 'bumper') {
                            // Bumpers have higher restitution (1.8)
                            vx -= 2 * dot * nx;
                            vy -= 2 * dot * ny;
                            vx *= 1.0; // Higher bounce
                            vy *= 1.0;
                        } else {
                            // Regular bounce with normal restitution (0.98)
                            vx -= 2 * dot * nx;
                            vy -= 2 * dot * ny;
                            vx *= 0.98;
                            vy *= 0.98;
                        }
                        
                        points.push({x: bounceX, y: bounceY});
                        x = bounceX;
                        y = bounceY;
                        bounces++;
                        bounced = true;
                        break;
                    }
                }
            }
        }
        
        // Check wall collisions
        if (!bounced) {
            for (const w of state.walls) {
                const wallThickness = w.thickness || 4;
                const dist = distToSegment(nextX, nextY, w.x1, w.y1, w.x2, w.y2);
                if (dist < radius + wallThickness / 2) {
                    // Calculate bounce
                    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
                    const length2 = dx * dx + dy * dy;
                    if (length2 === 0) continue;
                    
                    const t = Math.max(0, Math.min(1, ((nextX - w.x1) * dx + (nextY - w.y1) * dy) / length2));
                    const closestX = w.x1 + t * dx, closestY = w.y1 + t * dy;
                    const distX = nextX - closestX, distY = nextY - closestY;
                    const distance = Math.hypot(distX, distY);
                    
                    if (distance > 0) {
                        const nx = distX / distance, ny = distY / distance;
                        const dot = vx * nx + vy * ny;
                        
                        if (dot < 0) {
                            vx -= 2 * dot * nx;
                            vy -= 2 * dot * ny;
                            points.push({x: closestX, y: closestY});
                            bounced = true;
                            bounces++;
                            break;
                        }
                    }
                }
            }
        }
        
        // Check arena boundaries
        if (!bounced) {
            if (nextX - radius <= state.arena.left) {
                vx = Math.abs(vx);
                points.push({x: state.arena.left + radius, y: nextY});
                bounces++;
                bounced = true;
            } else if (nextX + radius >= state.arena.right) {
                vx = -Math.abs(vx);
                points.push({x: state.arena.right - radius, y: nextY});
                bounces++;
                bounced = true;
            } else if (nextY - radius <= state.arena.top) {
                vy = Math.abs(vy);
                points.push({x: nextX, y: state.arena.top + radius});
                bounces++;
                bounced = true;
            } else if (nextY + radius >= state.arena.bottom) {
                vy = -Math.abs(vy);
                points.push({x: nextX, y: state.arena.bottom - radius});
                bounces++;
                bounced = true;
            }
        }
        
        if (!bounced) {
            x = nextX;
            y = nextY;
            distanceTraveled += stepSize;
        } else {
            x = points[points.length - 1].x;
            y = points[points.length - 1].y;
        }
    }
    
    // Add intermediate points for visual continuity
    if (points.length > 1) {
        const lastIdx = points.length - 1;
        const lastX = points[lastIdx].x;
        const lastY = points[lastIdx].y;
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy);
        
        if (dist > stepSize * 2) {
            const steps = Math.ceil(dist / (stepSize * 2));
            for (let i = 1; i < steps; i++) {
                const t = i / steps;
                points.push({
                    x: lastX + dx * t,
                    y: lastY + dy * t
                });
            }
        }
    }
    
    // Add final position
    if (points.length === 1 || points[points.length - 1].x !== x || points[points.length - 1].y !== y) {
        points.push({x, y});
    }
    
    return points;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1, dy = y2 - y1;
    const length2 = dx * dx + dy * dy;
    if (length2 === 0) return Math.hypot(px - x1, py - y1);
    let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}


// --- ИГРОВОЙ ЦИКЛ ---
app.ticker.add(() => {
    if (state.isPaused) return;

    if (state.shake > 0) {
        gameScene.position.x = sceneBase.x + (Math.random() - 0.5) * state.shake;
        gameScene.position.y = sceneBase.y + (Math.random() - 0.5) * state.shake;
        state.shake *= 0.9; 
        if (state.shake < 0.5) state.shake = 0;
    } else {
        gameScene.position.x = sceneBase.x;
        gameScene.position.y = sceneBase.y;
    }

    bgGfx.clear(); gridGfx.clear(); wallsGlowGfx.clear(); wallsGfx.clear(); 
    glowGfx.clear(); entitiesGfx.clear(); particlesGfx.clear(); uiGfx.clear();

    bgStars.forEach(s => {
        s.x = (s.x + s.speedX + LOGICAL_W) % LOGICAL_W;
        s.y = (s.y + s.speedY + LOGICAL_H) % LOGICAL_H;
        s.alpha += s.pulse;
        if (s.alpha > 1 || s.alpha < 0.2) s.pulse *= -1;
        bgGfx.beginFill(0x00f3ff, s.alpha * 0.3); bgGfx.drawCircle(s.x, s.y, s.size); bgGfx.endFill();
    });

    gridGfx.lineStyle(1, 0x00f3ff, 0.05);
    const gridSize = 60, time = Date.now() * 0.02, offsetGridX = time % gridSize, offsetGridY = time % gridSize;
    for(let x = -gridSize; x < LOGICAL_W + gridSize; x += gridSize) { gridGfx.moveTo(x + offsetGridX, 0); gridGfx.lineTo(x + offsetGridX, LOGICAL_H); }
    for(let y = -gridSize; y < LOGICAL_H + gridSize; y += gridSize) { gridGfx.moveTo(0, y + offsetGridY); gridGfx.lineTo(LOGICAL_W, y + offsetGridY); }

    state.arena.left += (state.arena.targetLeft - state.arena.left) * 0.05;
    state.arena.right += (state.arena.targetRight - state.arena.right) * 0.05;
    state.arena.top += (state.arena.targetTop - state.arena.top) * 0.05;
    state.arena.bottom += (state.arena.targetBottom - state.arena.bottom) * 0.05;

    const isShrinking = state.arena.targetLeft > 0 || state.arena.targetTop > 0;
    
    wallsGlowGfx.lineStyle(isShrinking ? 8 : 4, isShrinking ? 0xff003c : 0x00f3ff, isShrinking ? 0.8 : 0.4);
    wallsGlowGfx.drawRect(state.arena.left, state.arena.top, state.arena.right - state.arena.left, state.arena.bottom - state.arena.top);
    
    wallsGfx.lineStyle(isShrinking ? 4 : 2, isShrinking ? 0xff003c : 0x00f3ff, isShrinking ? 0.8 : 0.3);
    wallsGfx.drawRect(state.arena.left, state.arena.top, state.arena.right - state.arena.left, state.arena.bottom - state.arena.top);

    if (state.walls.length > 0) {
        const fragileWalls = state.walls.filter(w => w.health !== undefined);
        const normalWalls = state.walls.filter(w => w.health === undefined);
        
        if (fragileWalls.length > 0) {
            fragileWalls.forEach(w => {
                const thick = w.thickness || 4;
                wallsGlowGfx.lineStyle(thick + 4, CONFIG.colors.fragileWall, 0.4);
                wallsGlowGfx.moveTo(w.x1, w.y1); wallsGlowGfx.lineTo(w.x2, w.y2);
                
                wallsGfx.lineStyle(thick, CONFIG.colors.fragileWall, 1);
                wallsGfx.moveTo(w.x1, w.y1); wallsGfx.lineTo(w.x2, w.y2);

                wallsGfx.lineStyle(thick / 2, 0xffffff, 0.3);
                wallsGfx.moveTo(w.x1, w.y1); wallsGfx.lineTo(w.x2, w.y2);
                
                if (w.health !== undefined && w.maxHealth !== undefined && w.health < w.maxHealth) {
                    const ratio = w.health / w.maxHealth;
                    const midX = (w.x1 + w.x2) / 2;
                    const midY = (w.y1 + w.y2) / 2;
                    wallsGfx.lineStyle(2, 0x000000, 0.8 * (1 - ratio));
                    wallsGfx.moveTo(midX - 10, midY - 5);
                    wallsGfx.lineTo(midX, midY);
                    wallsGfx.lineTo(midX + 8, midY + 6);
                }
            });
        }
        
        if (normalWalls.length > 0) {
            normalWalls.forEach(w => {
                const thick = w.thickness || 4;
                wallsGlowGfx.lineStyle(thick + 6, 0xff003c, 0.5);
                wallsGlowGfx.moveTo(w.x1, w.y1); wallsGlowGfx.lineTo(w.x2, w.y2);

                wallsGfx.lineStyle(thick, 0xff003c, 1);
                wallsGfx.moveTo(w.x1, w.y1); wallsGfx.lineTo(w.x2, w.y2);
                
                if (thick >= 12) {
                    wallsGfx.lineStyle(2, 0xffffff, 0.2);
                    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, len = Math.hypot(dx, dy);
                    const nx = -dy / len, ny = dx / len;
                    wallsGfx.moveTo(w.x1 + nx * (thick/4), w.y1 + ny * (thick/4));
                    wallsGfx.lineTo(w.x2 + nx * (thick/4), w.y2 + ny * (thick/4));
                }
            });
        }
    }

    if (state.isAiming && state.player) {
        const dx = state.mouseX - state.player.x;
        const dy = state.mouseY - state.player.y;
        const dist = Math.hypot(dx, dy);
        const maxStretch = 150;
        const cappedDist = Math.min(dist, maxStretch);
        const powerRatio = cappedDist / maxStretch;
        
        state.chargePower = powerRatio * CONFIG.maxLaunchPower;
        
        // Угол выстрела (от мыши)
        const angle = Math.atan2(-dy, -dx);
        
        // Визуализация "натяжения" (линия рогатки)
        const stretchX = state.player.x + (dx / dist) * cappedDist;
        const stretchY = state.player.y + (dy / dist) * cappedDist;
        
        const r = Math.floor(powerRatio * 255), g = Math.floor((1 - powerRatio) * 243), b = 255 - Math.floor(powerRatio * 100);
        const aimColor = (r << 16) + (g << 8) + b;
        
        // Линия натяжения
        uiGfx.lineStyle(2, 0xffffff, 0.4);
        uiGfx.moveTo(state.player.x, state.player.y);
        uiGfx.lineTo(stretchX, stretchY);
        uiGfx.drawCircle(stretchX, stretchY, 4);

        // Индикатор силы и направления
        const indicatorDist = cappedDist * 0.8;
        const endX = state.player.x + Math.cos(angle) * indicatorDist;
        const endY = state.player.y + Math.sin(angle) * indicatorDist;
        
        uiGfx.lineStyle(3 + powerRatio * 5, aimColor, 0.8);
        uiGfx.moveTo(state.player.x, state.player.y); 
        uiGfx.lineTo(endX, endY);
        uiGfx.beginFill(aimColor, 0.8); 
        uiGfx.drawCircle(endX, endY, 5 + powerRatio * 5); 
        uiGfx.endFill();
        
        // Draw predicted trajectory with bounces
        const trajectoryPoints = calculateTrajectory(state.player.x, state.player.y, angle, state.chargePower, 5);
        if (trajectoryPoints.length > 1) {
            uiGfx.lineStyle(2, 0xffffff, 0.3);
            uiGfx.moveTo(trajectoryPoints[0].x, trajectoryPoints[0].y);
            for (let i = 1; i < trajectoryPoints.length; i++) {
                uiGfx.lineTo(trajectoryPoints[i].x, trajectoryPoints[i].y);
                if (i < trajectoryPoints.length - 1) {
                    uiGfx.beginFill(0xffff00, 0.4);
                    uiGfx.drawCircle(trajectoryPoints[i].x, trajectoryPoints[i].y, 3);
                    uiGfx.endFill();
                }
            }
        }
    }

    state.portals.forEach(p => { p.update(); p.draw(entitiesGfx, glowGfx); });
    state.wormholes.forEach(w => { (w as any).update(); (w as any).draw(entitiesGfx, glowGfx); });
    state.nodes.forEach(n => { n.update(Date.now()); n.draw(entitiesGfx, glowGfx); });
    
    [...state.blackHoles, ...state.lightningBolts].forEach(obj => { obj.update(); obj.draw(entitiesGfx, glowGfx); });
    state.blackHoles = state.blackHoles.filter(bh => bh.lifeTime > 0);
    state.lightningBolts = state.lightningBolts.filter(lb => lb.lifeTime > 0);

    state.particles.forEach(p => { p.update(); p.draw(particlesGfx); });
    state.particles = state.particles.filter(p => p.alpha > 0);

    state.floatingTexts.forEach(ft => { ft.update(); ft.draw(); });
    state.floatingTexts = state.floatingTexts.filter(ft => ft.alpha > 0);

    state.miniBalls = state.miniBalls.filter((mb: any) => mb.lifeTime > 0);
    let projectiles = [];
    if (state.player) projectiles.push(state.player);
    projectiles.push(...state.miniBalls);

    let anyMoving = false;
    projectiles.forEach(p => {
        p.updateLogic();
        if (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1) anyMoving = true;
    });

    const PHYSICS_STEPS = 6;
    for (let s = 0; s < PHYSICS_STEPS; s++) {
        projectiles.forEach(p => p.updateMovement(PHYSICS_STEPS));
        checkCollisions(projectiles, Date.now());
    }

    projectiles.forEach(p => p.draw(entitiesGfx, glowGfx));

    projectiles.forEach(p => {
        if (!p) return;
        if (p.x - p.radius <= state.arena.left + 2 || p.x + p.radius >= state.arena.right - 2 || p.y - p.radius <= state.arena.top + 2 || p.y + p.radius >= state.arena.bottom - 2) {
            if (state.nodes.some(n => !n.isDestroyed && (n.type === 'obstacle' || n.type === 'bumper' || n.type === 'boss') && Math.hypot(p.x - n.x, p.y - n.y) < p.radius + n.radius + 3)) {
                const escapeAngle = Math.atan2((LOGICAL_H/2) - p.y, (LOGICAL_W/2) - p.x) + (Math.random() - 0.5) * 1.5;
                p.vx = Math.cos(escapeAngle) * 15; p.vy = Math.sin(escapeAngle) * 15; p.x += p.vx; p.y += p.vy;
                if (p === state.player) { 
                    state.floatingTexts.push(new FloatingText(p.x, p.y, `РЫВОК!`, CONFIG.colors.player)); 
                    spawnWallSparks(p.x, p.y, 0, 0, CONFIG.colors.player); 
                    state.shake += 10; AudioEngine.explode(); 
                }
            }
        }
    });

    const targetsLeftSkip = state.nodes.filter(n => !n.isDestroyed && n.type !== 'obstacle' && n.type !== 'bumper' && n.type !== 'boss' && n.type !== 'mine' && n.type !== 'repulsor' && n.type !== 'speedBumper').length;
    if (state.totalTargets > 0 && targetsLeftSkip / state.totalTargets <= 0.3 && !state.nodes.some(n => n.type === 'boss' && !n.isDestroyed) && state.isPlaying) skipSectorBtn.classList.remove('hidden');
    else skipSectorBtn.classList.add('hidden');

    const wasMoving = state.isBallMoving; state.isBallMoving = anyMoving;
    if (wasMoving && !state.isBallMoving && state.isPlaying) checkGameOver();
});

// Запуск
showMainMenu();
// Не запускаем игру сразу, ждем нажатия кнопки "Новая игра"
state.isPlaying = false;