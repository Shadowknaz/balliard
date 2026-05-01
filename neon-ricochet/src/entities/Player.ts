import * as PIXI from 'pixi.js';
import { state, Projectile } from '../state';
import { CONFIG } from '../config';
import { spawnWallSparks, LightningBolt } from './Effects';

export class PlayerBall implements Projectile {
    x: number; y: number; vx: number; vy: number; radius: number;
    trail: {x: number, y: number}[]; color: number; 
    lightningTimer: number; portalCooldown: number; movingFrames: number;
    startX: number; startY: number;

    constructor(x: number, y: number) {
        this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.radius = CONFIG.playerRadius; this.trail = [];
        this.color = CONFIG.colors.player;
        this.lightningTimer = 0; this.portalCooldown = 0; this.movingFrames = 0;
        this.startX = x; this.startY = y;
    }

    updateLogic() {
        let currentFriction = CONFIG.friction;
        if (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1) {
            this.movingFrames++;
            if (this.movingFrames > 240) currentFriction = 0.96; 
            if (this.movingFrames > 420) currentFriction = 0.85; 
        } else this.movingFrames = 0;

        this.vx *= currentFriction; this.vy *= currentFriction;

        const speed = Math.hypot(this.vx, this.vy);
        const MAX_SPEED = 45; 
        if (speed > MAX_SPEED) {
            this.vx = (this.vx / speed) * MAX_SPEED;
            this.vy = (this.vy / speed) * MAX_SPEED;
        }

        if (this.portalCooldown > 0) this.portalCooldown--;
        if (Math.abs(this.vx) < 0.1 && Math.abs(this.vy) < 0.1) { this.vx = 0; this.vy = 0; }

        if (Math.abs(this.vx) > 0 || Math.abs(this.vy) > 0) {
            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > 20) this.trail.shift();
        } else if (this.trail.length > 0) this.trail.shift();

        if (this.lightningTimer > 0) {
            this.lightningTimer--;
            if (this.lightningTimer % 10 === 0) {
                state.nodes.forEach((node: any) => {
                    if (!node.isDestroyed && node.type !== 'obstacle' && node.type !== 'bumper' && Math.hypot(node.x - this.x, node.y - this.y) < 130) {
                        state.lightningBolts.push(new LightningBolt(this.x, this.y, node.x, node.y));
                        node.hit();
                    }
                });
            }
        }
    }

    updateMovement(steps: number) {
        this.x += this.vx / steps; 
        this.y += this.vy / steps;

        if (this.x - this.radius < state.arena.left) { this.x = state.arena.left + this.radius; this.vx = Math.abs(this.vx) * 0.8 + 2; spawnWallSparks(this.x, this.y, 1, 0, this.color); }
        if (this.x + this.radius > state.arena.right) { this.x = state.arena.right - this.radius; this.vx = -Math.abs(this.vx) * 0.8 - 2; spawnWallSparks(this.x, this.y, -1, 0, this.color); }
        if (this.y - this.radius < state.arena.top) { this.y = state.arena.top + this.radius; this.vy = Math.abs(this.vy) * 0.8 + 2; spawnWallSparks(this.x, this.y, 0, 1, this.color); }
        if (this.y + this.radius > state.arena.bottom) { this.y = state.arena.bottom - this.radius; this.vy = -Math.abs(this.vy) * 0.8 - 2; spawnWallSparks(this.x, this.y, 0, -1, this.color); }
    }

    update() {} // Required by Entity interface, but we use updateLogic/updateMovement directly

    draw(gfx: PIXI.Graphics, glowGfx: PIXI.Graphics) {
        if (this.trail.length > 1) {
            glowGfx.lineStyle(this.radius * 1.5, this.color, 0.4);
            glowGfx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) glowGfx.lineTo(this.trail[i].x, this.trail[i].y);
            glowGfx.lineStyle(0);
            
            gfx.lineStyle(this.radius, this.color, 0.3);
            gfx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) gfx.lineTo(this.trail[i].x, this.trail[i].y);
            gfx.lineStyle(0);
        }

        if (this.lightningTimer > 0) {
            glowGfx.beginFill(0x00ffff, 0.6);
            glowGfx.drawCircle(this.x, this.y, this.radius + 8 + Math.random() * 8);
            glowGfx.endFill();
        }

        glowGfx.beginFill(this.color, 0.8); glowGfx.drawCircle(this.x, this.y, this.radius * 1.2); glowGfx.endFill();
        gfx.beginFill(this.color); gfx.drawCircle(this.x, this.y, this.radius); gfx.endFill(); 
        gfx.beginFill(0xffffff); gfx.drawCircle(this.x, this.y, this.radius * 0.5); gfx.endFill(); 
    }
}

export class MiniBall extends PlayerBall {
    lifeTime: number;
    constructor(x: number, y: number, angle: number) {
        super(x, y);
        this.radius = 6; this.lifeTime = 180; 
        this.vx = Math.cos(angle) * 12; this.vy = Math.sin(angle) * 12;
        this.color = CONFIG.colors.miniBall;
    }
    updateLogic() { super.updateLogic(); this.lifeTime--; }
    draw(gfx: PIXI.Graphics, glowGfx: PIXI.Graphics) {
        const alpha = Math.max(0, this.lifeTime / 180);
        glowGfx.beginFill(this.color, alpha * 0.6); glowGfx.drawCircle(this.x, this.y, this.radius * 1.5); glowGfx.endFill();
        gfx.beginFill(this.color, alpha); gfx.drawCircle(this.x, this.y, this.radius); gfx.endFill();
    }
}