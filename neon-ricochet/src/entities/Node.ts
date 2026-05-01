import * as PIXI from 'pixi.js';
import { state, progress, addXp, Entity } from '../state';
import { CONFIG, PENTATONIC, LOGICAL_W, LOGICAL_H } from '../config';
import { AudioEngine } from '../audio';
import { textContainer } from '../pixiApp';
import { Particle, Shockwave, FloatingText, BlackHoleEntity, LaserBeam } from './Effects';
import { MiniBall } from './Player';
import { updateUI, updateRPG_UI } from '../ui';

export function hslToHex(h: number, s: number, l: number): number {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return parseInt(`0x${f(0)}${f(8)}${f(4)}`);
}

export class Node implements Entity {
    x: number; y: number; baseX: number; baseY: number;
    type: string; radius: number; isDestroyed: boolean;
    offset: number; delayedTimer: number; isDelayedState: boolean;
    lastHitTime: number; hitFlash: number; vx: number; vy: number;
    color: number; noteFreq?: number; hp?: number;

    constructor(x: number, y: number, type: string) {
        this.x = x; this.y = y; this.baseX = x; this.baseY = y;
        this.type = type; this.radius = CONFIG.nodeRadius;
        this.isDestroyed = false; this.offset = Math.random() * Math.PI * 2;
        this.delayedTimer = 0; this.isDelayedState = false;
        this.lastHitTime = 0; this.hitFlash = 0; this.vx = 0; this.vy = 0;
        this.color = 0xffffff;
        if (this.type === 'obstacle') this.hp = 2;

        if (this.type === 'bumper') this.noteFreq = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
        this.updateColor();
    }

    updateColor() {
        if (this.type === 'blue') this.color = CONFIG.colors.nodeBlue;
        if (this.type === 'red') this.color = CONFIG.colors.nodeRed;
        if (this.type === 'obstacle') this.color = CONFIG.colors.nodeObstacle;
        if (this.type === 'bumper') this.color = CONFIG.colors.nodeBumper;
        if (this.type === 'extra') this.color = 0x00ff88;
        if (this.type === 'rainbow') this.color = 0xffffff; 
        if (this.type === 'mine') this.color = CONFIG.colors.mine; 
        if (this.type === 'repulsor') this.color = CONFIG.colors.repulsor;
        if (this.type === 'speedBumper') this.color = CONFIG.colors.speedBumper;
    }

    update(time: number = Date.now()) {
        if (this.isDestroyed) return;
        if (this.hitFlash > 0) this.hitFlash -= 0.05;

        if (this.type === 'rainbow') {
            this.color = hslToHex((time * 0.15) % 360, 100, 60);
        }

        if (this.type === 'repulsor') {
            const projectiles = [state.player, ...state.miniBalls];
            projectiles.forEach(p => {
                if (!p) return;
                let dx = p.x - this.x; let dy = p.y - this.y;
                let dist = Math.hypot(dx, dy);
                if (dist === 0) { dx = 1; dy = 0; dist = 0.1; }
                if (dist < 90) {
                    let force = (90 - dist) / 90 * 0.35;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }
            });
            this.radius = CONFIG.nodeRadius + Math.sin(time * 0.005 + this.offset) * 2;
        }

        if (this.type === 'mine') {
            this.hitFlash = Math.sin(time * 0.01 + this.offset) > 0.5 ? 0.3 : 0;
        }
        
        if (this.type === 'speedBumper') {
            this.radius = CONFIG.nodeRadius + Math.sin(time * 0.008 + this.offset) * 3;
        }

        this.vx *= 0.92; this.vy *= 0.92;
        this.baseX += this.vx; this.baseY += this.vy;

        let pushedByWall = false;
        if (this.baseX - this.radius < state.arena.left) { this.baseX = state.arena.left + this.radius; this.vx = 3 + Math.random() * 5; pushedByWall = true; }
        if (this.baseX + this.radius > state.arena.right) { this.baseX = state.arena.right - this.radius; this.vx = -(3 + Math.random() * 5); pushedByWall = true; }
        if (this.baseY - this.radius < state.arena.top) { this.baseY = state.arena.top + this.radius; this.vy = 3 + Math.random() * 5; pushedByWall = true; }
        if (this.baseY + this.radius > state.arena.bottom) { this.baseY = state.arena.bottom - this.radius; this.vy = -(3 + Math.random() * 5); pushedByWall = true; }
        
        if (pushedByWall && this.type !== 'bumper' && this.type !== 'obstacle') this.hitFlash = 0.5;
        
        if (this.isDelayedState) {
            this.delayedTimer--;
            this.x = this.baseX + (Math.random() - 0.5) * 4; this.y = this.baseY + (Math.random() - 0.5) * 4;
            if (this.delayedTimer <= 0) { this.isDelayedState = false; this.explode(); }
            return;
        }

        this.x = this.baseX;
        this.y = this.type !== 'obstacle' && this.type !== 'bumper' && this.type !== 'repulsor' && this.type !== 'speedBumper' ? this.baseY + Math.sin(time * 0.003 + this.offset) * 4 : this.baseY;
    }

    draw(gfx: PIXI.Graphics, glowGfx: PIXI.Graphics) {
        if (this.isDestroyed) return;

        const mainColor = this.hitFlash > 0 || this.isDelayedState ? 0xffffff : this.color;

        if (this.type === 'bumper') {
            glowGfx.beginFill(mainColor, 0.6); glowGfx.drawCircle(this.x, this.y, this.radius * 1.5); glowGfx.endFill();
            gfx.beginFill(mainColor);
            gfx.moveTo(this.x + this.radius * 1.2 * Math.cos(this.offset), this.y + this.radius * 1.2 * Math.sin(this.offset));
            for (let i = 1; i < 6; i++) {
                const angle = (Math.PI / 3) * i + this.offset;
                gfx.lineTo(this.x + this.radius * 1.2 * Math.cos(angle), this.y + this.radius * 1.2 * Math.sin(angle));
            }
            gfx.endFill();
            gfx.beginFill(0x0a0a0f); gfx.drawCircle(this.x, this.y, this.radius * 0.5); gfx.endFill();
        } else if (this.type === 'mine') {
            glowGfx.beginFill(mainColor, 0.8); glowGfx.drawCircle(this.x, this.y, this.radius * 1.5); glowGfx.endFill();
            gfx.beginFill(mainColor); gfx.drawCircle(this.x, this.y, this.radius); gfx.endFill();
            gfx.beginFill(0xffff00); gfx.drawCircle(this.x, this.y, this.radius * 0.4); gfx.endFill();
            gfx.lineStyle(2, 0xffff00);
            gfx.moveTo(this.x - this.radius, this.y); gfx.lineTo(this.x + this.radius, this.y);
            gfx.moveTo(this.x, this.y - this.radius); gfx.lineTo(this.x, this.y + this.radius);
            gfx.lineStyle(0);
        } else if (this.type === 'repulsor') {
            glowGfx.beginFill(mainColor, 0.2); glowGfx.drawCircle(this.x, this.y, 90); glowGfx.endFill(); 
            glowGfx.beginFill(mainColor, 0.6); glowGfx.drawCircle(this.x, this.y, this.radius * 1.5); glowGfx.endFill();
            gfx.beginFill(mainColor); gfx.drawCircle(this.x, this.y, this.radius); gfx.endFill();
            gfx.beginFill(0xffffff); gfx.drawCircle(this.x, this.y, this.radius * 0.3); gfx.endFill();
        } else if (this.type === 'speedBumper') {
            // Speed bumper - hexagonal shape with arrow indicators
            glowGfx.beginFill(mainColor, 0.8); glowGfx.drawCircle(this.x, this.y, this.radius * 2); glowGfx.endFill();
            gfx.beginFill(mainColor);
            gfx.moveTo(this.x + this.radius * 1.3 * Math.cos(this.offset), this.y + this.radius * 1.3 * Math.sin(this.offset));
            for (let i = 1; i < 6; i++) {
                const angle = (Math.PI / 3) * i + this.offset;
                gfx.lineTo(this.x + this.radius * 1.3 * Math.cos(angle), this.y + this.radius * 1.3 * Math.sin(angle));
            }
            gfx.endFill();
            // Inner circle
            gfx.beginFill(0x0a0a0f); gfx.drawCircle(this.x, this.y, this.radius * 0.6); gfx.endFill();
            // Speed arrows
            gfx.beginFill(mainColor);
            for (let i = 0; i < 3; i++) {
                const angle = (Math.PI * 2 / 3) * i + this.offset * 2;
                const arrowX = this.x + Math.cos(angle) * this.radius * 0.4;
                const arrowY = this.y + Math.sin(angle) * this.radius * 0.4;
                gfx.drawCircle(arrowX, arrowY, 3);
            }
            gfx.endFill();
        } else {
            glowGfx.beginFill(mainColor, 0.6); glowGfx.drawCircle(this.x, this.y, this.radius * 1.5); glowGfx.endFill();
            gfx.beginFill(mainColor); gfx.drawCircle(this.x, this.y, this.radius); gfx.endFill();

            if (this.type === 'obstacle') {
                gfx.beginFill(0x1e1e24); gfx.drawCircle(this.x, this.y, this.radius * 0.6); gfx.endFill();
            } else if (this.type === 'extra') {
                gfx.beginFill(0xffffff);
                gfx.drawRect(this.x - 2, this.y - this.radius * 0.5, 4, this.radius);
                gfx.drawRect(this.x - this.radius * 0.5, this.y - 2, this.radius, 4);
                gfx.endFill();
            } else if (this.type === 'rainbow') {
                gfx.beginFill(0xffffff); gfx.drawCircle(this.x, this.y, this.radius * 0.5); gfx.endFill();
            } else {
                gfx.beginFill(0xffffff); gfx.drawCircle(this.x, this.y, this.radius * 0.4); gfx.endFill();
            }
        }
    }

    triggerDelay() {
        this.isDelayedState = true; this.delayedTimer = 60; 
        state.floatingTexts.push(new FloatingText(this.x, this.y - 20, `БЛОК`, CONFIG.colors.nodeObstacle));
    }

    hit() {
        if (this.type === 'obstacle') {
            if (this.hp !== undefined) {
                this.hp--;
                this.hitFlash = 1.0;
                if (this.hp <= 0) {
                    this.explode();
                } else {
                    state.floatingTexts.push(new FloatingText(this.x, this.y, `БЛОК (${this.hp})`, 0xffffff));
                }
            }
            return;
        }
        if (this.type === 'bumper') { this.hitFlash = 1.0; return; }
        if (this.type === 'speedBumper') { this.hitFlash = 1.0; return; }

        if (this.type === 'blue' && Math.random() < progress.upgrades.shockwave * 0.05) {
            this.type = 'red'; 
            state.floatingTexts.push(new FloatingText(this.x, this.y - 15, `Детонация!`, CONFIG.colors.nodeRed));
        }
        this.explode();
    }

    explode() {
        this.isDestroyed = true;
        
        let points = 10;
        if (this.type === 'red') points = 50;
        if (this.type === 'rainbow') points = 150;
        if (this.type === 'extra') points = 30;
        if (this.type === 'mine') points = 100;
        if (this.type === 'repulsor') points = 50;
        if (this.type === 'obstacle') points = 20;

        const totalPoints = Math.floor(points * state.combo);
        state.score += totalPoints;
        state.combo = Math.min(state.combo + 0.2, 5.0);
        
        if (this.type === 'extra') {
            state.shots++;
            state.floatingTexts.push(new FloatingText(this.x, this.y - 30, `+1 БРОСОК!`, 0x00ff88));
        }
        if (this.type === 'rainbow') {
            state.floatingTexts.push(new FloatingText(this.x, this.y - 30, `МЕГА ОПЫТ!`, this.color));
        }

        updateUI();

        let xpGained = 5;
        if (this.type === 'red') xpGained = 15;
        if (this.type === 'rainbow') xpGained = 75;
        if (this.type === 'extra') xpGained = 15;
        if (this.type === 'mine') xpGained = 20;
        if (this.type === 'obstacle') xpGained = 10;
        
        // Начисляем опыт с учетом множителя комбо (чем больше лопнули за раз, тем больше опыта)
        const totalXp = Math.floor(xpGained * state.combo);
        addXp(totalXp);
        updateRPG_UI();

        AudioEngine.explode();
        
        if (this.type === 'mine') {
            state.shake = Math.min(state.shake + 35, 50); 
            state.particles.push(new Shockwave(this.x, this.y, 0xffaa00, 300));
            state.floatingTexts.push(new FloatingText(this.x, this.y - 40, `ВЗРЫВ!`, 0xff4400));
            
            state.nodes.forEach((n: any) => {
                if (!n.isDestroyed && n.type !== 'boss' && Math.hypot(n.x - this.x, n.y - this.y) < 220) {
                    setTimeout(() => { if (!n.isDestroyed) n.hit(); }, Math.hypot(n.x - this.x, n.y - this.y));
                }
            });
            const projectiles = [state.player, ...state.miniBalls];
            projectiles.forEach(p => {
                if (!p) return;
                let dx = p.x - this.x; let dy = p.y - this.y;
                let dist = Math.hypot(dx, dy);
                if (dist === 0) { dx = 1; dy = 0; dist = 0.1; }
                if (dist < 300) {
                    let force = (300 - dist) / 10;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }
            });
        } else {
            state.shake = Math.min(state.shake + (this.type === 'red' || this.type === 'rainbow' ? 12 : 5), 25); 
            state.particles.push(new Shockwave(this.x, this.y, this.color, this.type === 'red' || this.type === 'rainbow' ? 80 : 30));
        }

        state.floatingTexts.push(new FloatingText(this.x, this.y, `+${totalPoints}`, this.color));

        if (this.type === 'red') {
            for(let i=0; i<12; i++) {
                const angle = (Math.PI * 2 / 12) * i;
                state.particles.push(new Particle(this.x, this.y, Math.cos(angle)*6, Math.sin(angle)*6, this.color));
            }
            state.nodes.forEach((n: any) => {
                if (!n.isDestroyed && n.type !== 'obstacle' && n.type !== 'bumper' && Math.hypot(n.x - this.x, n.y - this.y) < 100) {
                    setTimeout(() => { if (!n.isDestroyed) n.hit(); }, Math.hypot(n.x - this.x, n.y - this.y) * 2);
                }
            });
        } else if (this.type === 'rainbow') {
            for(let i=0; i<24; i++) {
                const angle = Math.random() * Math.PI * 2;
                const randomColor = hslToHex(Math.random() * 360, 100, 50);
                state.particles.push(new Particle(this.x, this.y, Math.cos(angle)*6, Math.sin(angle)*6, randomColor));
            }
        } else {
            for(let i=0; i<5; i++) {
                const angle = Math.random() * Math.PI * 2;
                state.particles.push(new Particle(this.x, this.y, Math.cos(angle)*3, Math.sin(angle)*3, this.color));
            }
        }

        if (Math.random() < progress.upgrades.multiball * 0.05) {
            state.floatingTexts.push(new FloatingText(this.x, this.y + 15, `Осколки!`, CONFIG.colors.miniBall));
            for(let i=0; i<2; i++) state.miniBalls.push(new MiniBall(this.x, this.y, Math.random() * Math.PI * 2));
        }

        if (Math.random() < progress.upgrades.blackhole * 0.05) {
            state.floatingTexts.push(new FloatingText(this.x, this.y - 25, `Сингулярность!`, CONFIG.colors.blackHole));
            state.blackHoles.push(new BlackHoleEntity(this.x, this.y));
        }

        if (progress.upgrades.laser > 0 && Math.random() < progress.upgrades.laser * 0.03) {
            state.floatingTexts.push(new FloatingText(this.x, this.y + 25, `Лазер!`, 0xff0000));
            const angle = Math.random() * Math.PI * 2;
            const laserLength = 2000;
            const endX = this.x + Math.cos(angle) * laserLength;
            const endY = this.y + Math.sin(angle) * laserLength;
            
            const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
                let dx = x2 - x1, dy = y2 - y1, length2 = dx * dx + dy * dy;
                if (length2 === 0) return Math.hypot(px - x1, py - y1);
                let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length2));
                return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
            };

            state.particles.push(new LaserBeam(this.x, this.y, endX, endY, 0xff0000));
            
            state.nodes.forEach((n: any) => {
                if (!n.isDestroyed && n !== this) {
                    const dist = distToSegment(n.x, n.y, this.x, this.y, endX, endY);
                    if (dist < n.radius + 5) {
                        n.hit();
                    }
                }
            });
        }

        if (this.type !== 'obstacle' && this.type !== 'bumper' && this.type !== 'boss' && this.type !== 'mine' && this.type !== 'repulsor') {
            state.destroyedCount++;
            if (state.destroyedCount % 3 === 0) {
                const maxShrinkRatio = 0.1; 
                const maxSteps = Math.floor(state.totalTargets / 3) || 1;
                const shrinkRatio = maxShrinkRatio * (Math.min(Math.floor(state.destroyedCount / 3), maxSteps) / maxSteps);

                state.arena.targetLeft = LOGICAL_W * shrinkRatio;
                state.arena.targetRight = LOGICAL_W * (1 - shrinkRatio);
                state.arena.targetTop = LOGICAL_H * shrinkRatio;
                state.arena.targetBottom = LOGICAL_H * (1 - shrinkRatio);

                if (!state.arena.warningShown && shrinkRatio > 0) {
                    state.floatingTexts.push(new FloatingText(LOGICAL_W/2, LOGICAL_H/2, "АРЕНА СУЖАЕТСЯ!", CONFIG.colors.nodeRed));
                    state.arena.warningShown = true;
                }
            }
        }
    }
}

export class BossNode extends Node {
    hp: number; maxHp: number; hpText: PIXI.Text | null;

    constructor(x: number, y: number, isSuper: boolean = false) {
        super(x, y, 'boss');
        this.radius = isSuper ? 65 : 45; 
        this.hp = isSuper ? 7 : Math.floor(Math.random() * 3) + 4; 
        this.maxHp = this.hp; 
        this.color = isSuper ? CONFIG.colors.superBoss : CONFIG.colors.boss;
        
        this.hpText = new PIXI.Text(this.hp.toString(), { fontFamily: 'sans-serif', fontSize: 28, fill: '#ffffff', fontWeight: 'bold' });
        this.hpText.anchor.set(0.5);
        if (textContainer) textContainer.addChild(this.hpText);
    }

    draw(gfx: PIXI.Graphics, glowGfx: PIXI.Graphics) {
        if (this.isDestroyed) return;
        
        if (this.radius === 65) { 
            glowGfx.beginFill(this.color, 0.4); 
            glowGfx.drawCircle(this.x, this.y, this.radius + 15 + Math.sin(Date.now() * 0.005) * 5); 
            glowGfx.endFill();
        }

        const mainColor = this.hitFlash > 0 ? 0xffffff : this.color;
        
        glowGfx.beginFill(mainColor, 0.6); glowGfx.drawCircle(this.x, this.y, this.radius * 1.5); glowGfx.endFill();
        gfx.beginFill(mainColor); gfx.drawCircle(this.x, this.y, this.radius); gfx.endFill();
        gfx.beginFill(0x0a0a0f); gfx.drawCircle(this.x, this.y, this.radius * 0.65); gfx.endFill();

        if (this.hpText && !this.hpText.destroyed) {
            this.hpText.text = this.hp.toString();
            this.hpText.x = this.x; this.hpText.y = this.y;
            this.hpText.style.fill = this.hitFlash > 0 ? '#0a0a0f' : '#ffffff';
        }
    }

    hit() {
        if (this.isDestroyed) return;
        this.hp--; this.hitFlash = 1.0;
        state.floatingTexts.push(new FloatingText(this.x + (Math.random()-0.5)*30, this.y - 30, `-1`, CONFIG.colors.nodeRed));
        this.baseX += (Math.random() - 0.5) * 10; this.baseY += (Math.random() - 0.5) * 10;
        if (this.hp <= 0) this.explode();
    }

    explode() {
        this.isDestroyed = true;
        if (this.hpText) {
            if (this.hpText.parent) this.hpText.parent.removeChild(this.hpText);
            if (!this.hpText.destroyed) this.hpText.destroy();
            this.hpText = null;
        }
        
        const isSuper = this.radius === 65;
        
        if (isSuper) {
            state.floatingTexts.push(new FloatingText(this.x, this.y - 60, `СУПЕР БОСС ПОВЕРЖЕН!`, this.color));
            addXp(300); updateRPG_UI();
            state.score += 2000;
            for(let i=0; i<40; i++) state.particles.push(new Particle(this.x, this.y, Math.cos(Math.PI * 2 / 40 * i)*15, Math.sin(Math.PI * 2 / 40 * i)*15, this.color));
        } else {
            state.score += Math.floor(500 * state.combo); 
            addXp(100); updateRPG_UI();
            state.floatingTexts.push(new FloatingText(this.x, this.y, `БОСС ПОВЕРЖЕН!`, CONFIG.colors.nodeBlue));
            for(let i=0; i<30; i++) state.particles.push(new Particle(this.x, this.y, Math.cos(Math.PI * 2 / 30 * i)*8, Math.sin(Math.PI * 2 / 30 * i)*8, CONFIG.colors.nodeBlue));
        }

        updateUI(); 
        AudioEngine.explode(); state.shake = 35; 
        state.particles.push(new Shockwave(this.x, this.y, this.color, 200));

        state.nodes.forEach((n: any) => {
            if (!n.isDestroyed && n.type !== 'obstacle' && n.type !== 'bumper' && n !== this) {
                const dist = Math.hypot(n.x - this.x, n.y - this.y);
                if (dist < 250) setTimeout(() => { if (!n.isDestroyed) n.hit(); }, dist * 1.5);
            }
        });
        if (Math.random() < progress.upgrades.blackhole * 0.10) state.blackHoles.push(new BlackHoleEntity(this.x, this.y));
    }
}

export class SuperBossNode extends BossNode {
    constructor(x: number, y: number) {
        super(x, y, true); 
    }
}

export type GuardianType = 'suppressor' | 'restorer' | 'reflector';

export class GuardianNode extends Node {
    guardianType: GuardianType;
    hp: number = 2;
    hpText: PIXI.Text | null;
    angle: number = 0;
    revivingTarget: GuardianNode | null = null;
    shotsLeftToRevive: number = 0;
    lastShots: number = 0;

    constructor(x: number, y: number, type: GuardianType) {
        super(x, y, 'guardian');
        this.guardianType = type;
        this.radius = 25;
        this.color = type === 'suppressor' ? 0xff00ff : (type === 'restorer' ? 0x00ff00 : 0xffff00);
        
        this.hpText = new PIXI.Text(this.hp.toString(), { fontFamily: 'sans-serif', fontSize: 18, fill: '#ffffff', fontWeight: 'bold' });
        this.hpText.anchor.set(0.5);
        if (textContainer) textContainer.addChild(this.hpText);
    }

    update(time: number) {
        super.update(time);
        if (this.isDestroyed) return;
        
        this.angle += 0.02;

        if (this.guardianType === 'suppressor') {
            if (state.player) {
                const dist = Math.hypot(this.x - state.player.x, this.y - state.player.y);
                if (dist < 150) {
                    const force = (150 - dist) / 150 * 0.4;
                    state.player.vx += ((state.player.x - this.x) / dist) * force;
                    state.player.vy += ((state.player.y - this.y) / dist) * force;
                    if (Math.random() < 0.1) state.particles.push(new Particle(this.x, this.y, (state.player.x - this.x)*0.01, (state.player.y - this.y)*0.01, this.color));
                }
            }
        }
        else if (this.guardianType === 'restorer') {
            if (this.revivingTarget && this.revivingTarget.isDestroyed) {
                if (state.shots < this.lastShots) {
                    const diff = this.lastShots - state.shots;
                    this.lastShots = state.shots;
                    this.shotsLeftToRevive -= diff;
                    state.floatingTexts.push(new FloatingText(this.x, this.y - 30, `Воскрешение: ${this.shotsLeftToRevive}`, 0x00ff00));
                    
                    if (this.shotsLeftToRevive <= 0) {
                        this.revivingTarget.isDestroyed = false;
                        this.revivingTarget.hp = 2;
                        if (!this.revivingTarget.hpText) {
                            this.revivingTarget.hpText = new PIXI.Text('2', { fontFamily: 'sans-serif', fontSize: 18, fill: '#ffffff', fontWeight: 'bold' });
                            this.revivingTarget.hpText.anchor.set(0.5);
                            if (textContainer) textContainer.addChild(this.revivingTarget.hpText);
                        }
                        state.floatingTexts.push(new FloatingText(this.x, this.y - 50, `ВОСКРЕШЕН!`, 0x00ff00));
                        this.revivingTarget = null;
                    }
                } else if (state.shots > this.lastShots) {
                    this.lastShots = state.shots; 
                }
            } else {
                const brain = state.nodes.find(n => n.type === 'brainBoss') as BrainBossNode;
                if (brain && brain.guardians) {
                    const dead = brain.guardians.find(g => g.isDestroyed);
                    if (dead) {
                        this.revivingTarget = dead;
                        this.shotsLeftToRevive = 4;
                        this.lastShots = state.shots;
                        state.floatingTexts.push(new FloatingText(this.x, this.y - 30, `Начат протокол воскрешения!`, 0x00ff00));
                    }
                }
            }
        }
    }

    draw(gfx: PIXI.Graphics, glowGfx: PIXI.Graphics) {
        if (this.isDestroyed) return;
        
        const mainColor = this.hitFlash > 0 ? 0xffffff : this.color;
        
        if (this.guardianType === 'reflector') {
            glowGfx.beginFill(mainColor, 0.4);
            glowGfx.drawPolygon(this.getPolygonPoints(this.radius * 1.5));
            glowGfx.endFill();
            
            gfx.beginFill(mainColor);
            gfx.drawPolygon(this.getPolygonPoints(this.radius));
            gfx.endFill();
            gfx.beginFill(0x0a0a0f);
            gfx.drawPolygon(this.getPolygonPoints(this.radius * 0.6));
            gfx.endFill();
        } else {
            glowGfx.beginFill(mainColor, 0.4); glowGfx.drawCircle(this.x, this.y, this.radius * 1.5); glowGfx.endFill();
            gfx.beginFill(mainColor); gfx.drawCircle(this.x, this.y, this.radius); gfx.endFill();
            gfx.beginFill(0x0a0a0f); gfx.drawCircle(this.x, this.y, this.radius * 0.6); gfx.endFill();
        }

        if (this.hpText && !this.hpText.destroyed) {
            this.hpText.text = this.hp.toString();
            this.hpText.x = this.x; this.hpText.y = this.y;
            this.hpText.style.fill = this.hitFlash > 0 ? '#0a0a0f' : '#ffffff';
        }
    }
    
    getPolygonPoints(r: number) {
        const pts = [];
        for (let i = 0; i < 6; i++) {
            pts.push(this.x + Math.cos(this.angle + i * Math.PI / 3) * r);
            pts.push(this.y + Math.sin(this.angle + i * Math.PI / 3) * r);
        }
        return pts;
    }

    hit() {
        if (this.isDestroyed) return;
        this.hp--; this.hitFlash = 1.0;
        state.floatingTexts.push(new FloatingText(this.x + (Math.random()-0.5)*30, this.y - 30, `-1`, CONFIG.colors.nodeRed));
        if (this.hp <= 0) this.explode();
    }
    
    explode() {
        super.explode();
        if (this.hpText) {
            if (this.hpText.parent) this.hpText.parent.removeChild(this.hpText);
            if (!this.hpText.destroyed) this.hpText.destroy();
            this.hpText = null;
        }
    }
}

export class BrainBossNode extends BossNode {
    guardians: GuardianNode[] = [];
    baseColor: number = 0x555555;
    activeColor: number = CONFIG.colors.superBoss;
    isAggressive: boolean = false;
    debrisPulled: boolean = false;

    constructor(x: number, y: number) {
        super(x, y, false);
        this.type = 'brainBoss';
        this.hp = 4;
        this.maxHp = 4;
        this.radius = 55;
        this.color = this.baseColor;
        if (this.hpText) {
            this.hpText.text = 'INV';
            this.hpText.style.fill = '#888888';
        }
    }

    update(time: number) {
        super.update(time);
        if (this.isDestroyed) return;

        const anyGuardianAlive = this.guardians.some(g => !g.isDestroyed);
        
        if (!anyGuardianAlive && !this.isAggressive) {
            this.isAggressive = true;
            this.color = this.activeColor;
            state.floatingTexts.push(new FloatingText(this.x, this.y - 60, `ЩИТЫ СНЯТЫ!`, this.activeColor));
            state.shake = 20;
            if (this.hpText) {
                this.hpText.text = this.hp.toString();
                this.hpText.style.fill = '#ffffff';
            }
        } else if (anyGuardianAlive && this.isAggressive) {
            this.isAggressive = false;
            this.color = this.baseColor;
            if (this.hpText) {
                this.hpText.text = 'INV';
                this.hpText.style.fill = '#888888';
            }
            state.floatingTexts.push(new FloatingText(this.x, this.y - 60, `ЩИТЫ ВОССТАНОВЛЕНЫ!`, 0x00f3ff));
        }

        if (this.isAggressive && this.hp <= 1 && !this.debrisPulled) {
            this.debrisPulled = true;
            state.floatingTexts.push(new FloatingText(this.x, this.y - 60, `СБОР МУСОРА!`, 0xffaa00));
            state.nodes.forEach((n: any) => {
                if (n.type === 'obstacle' && !n.isDestroyed) {
                    n.x = this.x + (Math.random() - 0.5) * 150;
                    n.y = this.y + (Math.random() - 0.5) * 150;
                    n.vx = 0; n.vy = 0;
                    n.baseX = n.x; n.baseY = n.y;
                    state.particles.push(new Shockwave(n.x, n.y, CONFIG.colors.nodeObstacle, 50));
                }
            });
            state.shake = 30;
        }
    }

    draw(gfx: PIXI.Graphics, glowGfx: PIXI.Graphics) {
        if (this.isDestroyed) return;

        this.guardians.forEach(g => {
            if (!g.isDestroyed) {
                glowGfx.lineStyle(3, 0x00f3ff, 0.5 + Math.sin(Date.now() * 0.01) * 0.2);
                glowGfx.moveTo(this.x, this.y);
                glowGfx.lineTo(g.x, g.y);
                glowGfx.lineStyle(0);
                
                if (Math.random() < 0.1) {
                    const midX = (this.x + g.x)/2 + (Math.random()-0.5)*20;
                    const midY = (this.y + g.y)/2 + (Math.random()-0.5)*20;
                    gfx.lineStyle(2, 0x00ffff, 0.8);
                    gfx.moveTo(this.x, this.y); gfx.lineTo(midX, midY); gfx.lineTo(g.x, g.y);
                    gfx.lineStyle(0);
                }
            }
        });

        super.draw(gfx, glowGfx);
    }

    hit() {
        if (this.isDestroyed) return;
        if (!this.isAggressive) {
            this.hitFlash = 1.0;
            state.floatingTexts.push(new FloatingText(this.x, this.y - 30, `БРОНЯ!`, 0x00f3ff));
            return;
        }
        super.hit();
        if (this.hpText) this.hpText.text = this.hp.toString();
    }
}