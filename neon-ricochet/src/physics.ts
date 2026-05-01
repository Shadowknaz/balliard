import { state, progress } from './state';
import { CONFIG } from './config';
import { AudioEngine } from './audio';
import { spawnWallSparks, Shockwave, FloatingText } from './entities/Effects';
import { MiniBall } from './entities/Player';

export function checkCollisions(projectiles: any[], timestamp: number) {
    projectiles.forEach(p => {
        if (!p) return;
        
        // Столкновения со стенами
        for (let i = state.walls.length - 1; i >= 0; i--) {
            const w = state.walls[i];
            let dx = w.x2 - w.x1, dy = w.y2 - w.y1, length2 = dx * dx + dy * dy;
            let t = Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / length2));
            let closestX = w.x1 + t * dx, closestY = w.y1 + t * dy;
            let distX = p.x - closestX, distY = p.y - closestY, distance = Math.hypot(distX, distY);
            const wallThickness = w.thickness || 4;
            const minDistWall = p.radius + wallThickness / 2;

            if (distance < minDistWall) {
                if (distance === 0) { distX = 1; distY = 0; distance = minDistWall; }
                let nx = distX / distance, ny = distY / distance;
                p.x += nx * (minDistWall - distance); 
                p.y += ny * (minDistWall - distance);
                let dot = p.vx * nx + p.vy * ny;
                if (dot < 0) {
                    p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny; 
                    p.vx *= 0.98; p.vy *= 0.98;
                    AudioEngine.bounce();
                    
                    if (progress.upgrades.ricochet > 0 && Math.random() < progress.upgrades.ricochet * 0.04) {
                        const newAngle = Math.random() * Math.PI * 2;
                        state.miniBalls.push(new MiniBall(p.x, p.y, newAngle));
                        state.floatingTexts.push(new FloatingText(p.x, p.y, `Рикошет!`, CONFIG.colors.miniBall));
                    }
                    
                    // Handle fragile walls
                    if (w.health !== undefined && w.maxHealth !== undefined) {
                        w.health! -= 1;
                        spawnWallSparks(closestX, closestY, nx, ny, CONFIG.colors.fragileWall);
                        
                        if (w.health! <= 0) {
                            // Wall destroyed
                            AudioEngine.wallBreak();
                            state.particles.push(new Shockwave(closestX, closestY, CONFIG.colors.fragileWall, 40));
                            state.floatingTexts.push(new FloatingText(closestX, closestY, `СТЕНА РАЗРУШЕНА!`, CONFIG.colors.fragileWall));
                            state.shake = Math.min(state.shake + 8, 15);
                            state.walls.splice(i, 1);
                        } else {
                            // Wall damaged but not destroyed
                            state.floatingTexts.push(new FloatingText(closestX, closestY, `${w.health}/${w.maxHealth}`, CONFIG.colors.fragileWall));
                        }
                    } else {
                        spawnWallSparks(closestX, closestY, nx, ny, 0xff003c);
                    }
                }
            }
        }

        // Порталы
        if (p.portalCooldown <= 0) {
            for (let i = 0; i < state.portals.length; i++) {
                let p1 = state.portals[i], p2 = state.portals[(i + 1) % 2]; 
                if (Math.hypot(p.x - p1.x, p.y - p1.y) < p1.radius) {
                    p.x = p2.x; p.y = p2.y; p.portalCooldown = 30; 
                    state.particles.push(new Shockwave(p1.x, p1.y, p1.color, 40)); 
                    state.particles.push(new Shockwave(p2.x, p2.y, p2.color, 40));
                    break; 
                }
            }
        }

        // Столкновения с узлами
        state.nodes.forEach((node: any) => {
            if (node.isDestroyed || node.isDelayedState) return; 
            let dx = p.x - node.x, dy = p.y - node.y;
            let dist = Math.hypot(dx, dy);
            const minDist = p.radius + node.radius;

            if (dist < minDist) {
                if (dist === 0) { dx = 1; dy = 0; dist = 0.1; }

                if (p === state.player && !['obstacle', 'bumper', 'boss', 'brainBoss', 'guardian'].includes(node.type) && Math.random() < progress.upgrades.piercing * 0.05) {
                    if (!node.lastHitTime || timestamp - node.lastHitTime > 200) { 
                        state.floatingTexts.push(new FloatingText(node.x, node.y, `Пронзание!`, CONFIG.colors.nodeBlue)); 
                        node.hit(); node.lastHitTime = timestamp; 
                    } 
                    return; 
                }
                let nx = dx / dist, ny = dy / dist;
                if (node.type === 'guardian' && node.guardianType === 'reflector') {
                    const hitAngle = Math.atan2(dy, dx);
                    const relAngle = hitAngle - node.angle;
                    const sideAngle = Math.round(relAngle / (Math.PI / 3)) * (Math.PI / 3);
                    const normalAngle = sideAngle + node.angle;
                    nx = Math.cos(normalAngle);
                    ny = Math.sin(normalAngle);
                }
                
                p.x += nx * (minDist - dist); p.y += ny * (minDist - dist);
                const dot = p.vx * nx + p.vy * ny;
                let forceX = p.vx - 2 * dot * nx, forceY = p.vy - 2 * dot * ny, restitution = CONFIG.bounceRestitution;
                
                if (node.type === 'bumper') { restitution = 1.8; AudioEngine.bumperNote(node.noteFreq); } 
                else AudioEngine.bounce();
                
                // Speed bumper - pass through and boost velocity
                if (node.type === 'speedBumper') {
                    const speedBoost = 1.5; // 50% speed increase
                    p.vx *= speedBoost;
                    p.vy *= speedBoost;
                    node.hitFlash = 1.0;
                    state.floatingTexts.push(new FloatingText(node.x, node.y - 20, `СКОРОСТЬ!`, CONFIG.colors.speedBumper));
                    state.particles.push(new Shockwave(node.x, node.y, CONFIG.colors.speedBumper, 50));
                    return; // Don't bounce, pass through
                }
                
                if (p === state.player && Math.random() < progress.upgrades.momentum * 0.06) { 
                    restitution = Math.max(restitution, 1.4); 
                    spawnWallSparks(node.x, node.y, nx, ny, 0xb700ff); 
                    state.floatingTexts.push(new FloatingText(node.x, node.y, `Инерция!`, 0xb700ff)); 
                }

                if (Math.hypot(forceX, forceY) < 5) { forceX = nx * 5; forceY = ny * 5; } 
                else { forceX *= restitution; forceY *= restitution; }
                p.vx = forceX; p.vy = forceY;

                if (p === state.player && state.launchPos && progress.upgrades.boomerang > 0 && Math.random() < progress.upgrades.boomerang * 0.02) {
                    p.x = state.launchPos.x;
                    p.y = state.launchPos.y;
                    p.vx = 0;
                    p.vy = 0;
                    state.floatingTexts.push(new FloatingText(p.x, p.y - 20, `Бумеранг!`, 0x00ff88));
                }

                if (node.type !== 'obstacle' && node.type !== 'boss' && node.type !== 'bumper' && node.type !== 'repulsor' && node.type !== 'speedBumper' && Math.random() < progress.upgrades.delayed * 0.08) node.triggerDelay();
                else if (!node.lastHitTime || timestamp - node.lastHitTime > 200) { node.hit(); node.lastHitTime = timestamp; }
            }
        });
    });
}