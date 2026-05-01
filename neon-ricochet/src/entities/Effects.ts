import * as PIXI from 'pixi.js';
import { state, Entity } from '../state';
import { CONFIG } from '../config';
import { textContainer } from '../pixiApp'; // Создадим позже
import { AudioEngine } from '../audio';

export function toCssColor(hex: number): string {
    return '#' + hex.toString(16).padStart(6, '0');
}

export class Portal implements Entity {
    x: number; y: number; radius: number; color: number; angle: number;
    constructor(x: number, y: number, color: number) { 
        this.x = x; this.y = y; this.radius = 25; this.color = color; this.angle = 0; 
    }
    update() {
        this.x = Math.max(state.arena.left + this.radius, Math.min(this.x, state.arena.right - this.radius));
        this.y = Math.max(state.arena.top + this.radius, Math.min(this.y, state.arena.bottom - this.radius));
        this.angle += 0.05;
    }
    draw(gfx: PIXI.Graphics, glowGfx: PIXI.Graphics) {
        glowGfx.lineStyle(6, this.color, 0.8);
        glowGfx.drawCircle(this.x, this.y, this.radius + Math.sin(this.angle)*5);
        glowGfx.lineStyle(0);
        
        gfx.lineStyle(4, this.color, 0.8);
        gfx.drawCircle(this.x, this.y, this.radius + Math.sin(this.angle)*5);
        gfx.lineStyle(2, 0xffffff, 1);
        gfx.drawCircle(this.x, this.y, this.radius * 0.6 + Math.cos(this.angle)*3);
        gfx.lineStyle(0);
    }
}

export class LightningBolt implements Entity {
    x1: number; y1: number; x2: number; y2: number; lifeTime: number;
    constructor(x1: number, y1: number, x2: number, y2: number) { 
        this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2; this.lifeTime = 10; 
    }
    update() { this.lifeTime--; }
    draw(gfx: PIXI.Graphics, glowGfx: PIXI.Graphics) {
        if (this.lifeTime <= 0) return;
        const midX = (this.x1 + this.x2)/2 + (Math.random()-0.5)*30;
        const midY = (this.y1 + this.y2)/2 + (Math.random()-0.5)*30;
        
        glowGfx.lineStyle(4 + Math.random() * 4, CONFIG.colors.lightning, 0.6);
        glowGfx.moveTo(this.x1, this.y1); glowGfx.lineTo(midX, midY); glowGfx.lineTo(this.x2, this.y2);
        glowGfx.lineStyle(0);

        gfx.lineStyle(2 + Math.random() * 2, CONFIG.colors.lightning, 1);
        gfx.moveTo(this.x1, this.y1); gfx.lineTo(midX, midY); gfx.lineTo(this.x2, this.y2);
        gfx.lineStyle(0);
    }
}

export class BlackHoleEntity implements Entity {
    x: number; y: number; lifeTime: number; radius: number; pulse: number; color: number;
    constructor(x: number, y: number) { 
        this.x = x; this.y = y; this.lifeTime = 180; this.radius = 15; this.pulse = 0; this.color = CONFIG.colors.blackHole;
    }
    update() {
        this.lifeTime--; this.pulse += 0.2;
        state.nodes.forEach((node: any) => {
            if (node.isDestroyed || node.type === 'obstacle' || node.type === 'boss' || node.type === 'bumper') return;
            let dx = this.x - node.x;
            let dy = this.y - node.y;
            let dist = Math.hypot(dx, dy);
            
            if (dist === 0) { dx = 1; dy = 0; dist = 0.1; }
            
            if (dist < 180) { 
                const force = (180 - dist) / 180;
                node.x += (dx / dist) * force * 5; 
                node.y += (dy / dist) * force * 5;
                node.baseX = node.x; node.baseY = node.y;
                if (dist < this.radius + node.radius) node.explode();
            }
        });
    }
    draw(gfx: PIXI.Graphics, glowGfx: PIXI.Graphics) {
        if (this.lifeTime <= 0) return;
        const alpha = Math.min(1, this.lifeTime / 20); 
        glowGfx.beginFill(0xb700ff, alpha * 0.5); glowGfx.drawCircle(this.x, this.y, this.radius * 2 + Math.sin(this.pulse) * 8); glowGfx.endFill();
        gfx.beginFill(this.color, alpha); gfx.drawCircle(this.x, this.y, this.radius); gfx.endFill();
    }
}

export class Particle implements Entity {
    x: number; y: number; vx: number; vy: number; color: number; alpha: number; radius: number;
    constructor(x: number, y: number, vx: number, vy: number, color: number) { 
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.color = color; this.alpha = 1; this.radius = 3; 
    }
    update() { this.x += this.vx; this.y += this.vy; this.vx *= 0.95; this.vy *= 0.95; this.alpha -= 0.03; }
    draw(gfx: PIXI.Graphics) { 
        if (this.alpha <= 0) return; 
        gfx.beginFill(this.color, this.alpha); gfx.drawCircle(this.x, this.y, this.radius); gfx.endFill(); 
    }
}

export class Shockwave implements Entity { 
    x: number; y: number; color: number; radius: number; maxRadius: number; alpha: number;
    constructor(x: number, y: number, color: number, maxR: number) { 
        this.x=x; this.y=y; this.color=color; this.radius=10; this.maxRadius=maxR; this.alpha=1; 
    }
    update() { this.radius += (this.maxRadius - this.radius)*0.1; this.alpha -= 0.05; }
    draw(gfx: PIXI.Graphics) { 
        if(this.alpha<=0) return; 
        gfx.lineStyle(3, this.color, this.alpha); gfx.drawCircle(this.x, this.y, this.radius); gfx.lineStyle(0); 
    }
}

export class FloatingText implements Entity { 
    x: number; y: number; alpha: number; vy: number; textElement: PIXI.Text | null;
    constructor(x: number, y: number, text: string, colorHex: number) { 
        this.x=x; this.y=y; this.alpha=1; this.vy=-1.5; 
        this.textElement = new PIXI.Text(text, { fontFamily: 'sans-serif', fontSize: 16, fill: toCssColor(colorHex), fontWeight: 'bold' });
        this.textElement.anchor.set(0.5);
        if (textContainer) textContainer.addChild(this.textElement);
    }
    update() { this.y+=this.vy; this.alpha-=0.02; }
    draw() { 
        if(this.alpha <= 0) {
            if (this.textElement) {
                if (this.textElement.parent) this.textElement.parent.removeChild(this.textElement);
                if (!this.textElement.destroyed) this.textElement.destroy();
                this.textElement = null; 
            }
            return; 
        }
        if (this.textElement && !this.textElement.destroyed) {
            this.textElement.x = this.x; 
            this.textElement.y = this.y; 
            this.textElement.alpha = this.alpha;
        }
    }
}

export function spawnWallSparks(x: number, y: number, nx: number, ny: number, color: number = 0xffffff) {
    for (let i = 0; i < 5; i++) {
        const angle = Math.atan2(ny, nx) + (Math.random() - 0.5);
        const speed = Math.random() * 3 + 1;
        state.particles.push(new Particle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, color));
    }
}

export class WormholeEntity implements Entity {
    x: number; y: number; radius: number; angle: number; pulse: number; color: number;
    
    constructor(x: number, y: number) {
        this.x = x; this.y = y; this.radius = 20; this.angle = 0; this.pulse = 0;
        this.color = CONFIG.colors.wormhole;
    }
    
    update() {
        this.angle += 0.08;
        this.pulse += 0.1;
        this.radius = 20 + Math.sin(this.pulse) * 3;
        
        // Check if player ball enters wormhole
        if (state.player) {
            const player = state.player as any;
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            if (dist < this.radius + player.radius && !player.lightningTimer) {
                // Reset player to starting position
                player.x = player.startX;
                player.y = player.startY;
                player.vx = 0;
                player.vy = 0;
                player.trail = [];
                player.portalCooldown = 30;
                
                // Visual and audio feedback
                AudioEngine.wormhole();
                state.particles.push(new Shockwave(this.x, this.y, this.color, 60));
                state.floatingTexts.push(new FloatingText(this.x, this.y - 30, `ЧЕРВОТОЧИНА!`, this.color));
                state.shake = Math.min(state.shake + 10, 20);
            }
        }
    }
    
    draw(gfx: PIXI.Graphics, glowGfx: PIXI.Graphics) {
        // Outer glow
        glowGfx.beginFill(this.color, 0.3);
        glowGfx.drawCircle(this.x, this.y, this.radius * 2.5);
        glowGfx.endFill();
        
        // Swirling effect
        glowGfx.lineStyle(3, this.color, 0.8);
        for (let i = 0; i < 3; i++) {
            const spiralAngle = this.angle + (i * Math.PI * 2 / 3);
            const spiralRadius = this.radius * (0.5 + Math.sin(this.pulse + i) * 0.3);
            const sx = this.x + Math.cos(spiralAngle) * spiralRadius;
            const sy = this.y + Math.sin(spiralAngle) * spiralRadius;
            glowGfx.moveTo(this.x, this.y);
            glowGfx.lineTo(sx, sy);
        }
        glowGfx.lineStyle(0);
        
        // Core
        gfx.beginFill(this.color, 0.9);
        gfx.drawCircle(this.x, this.y, this.radius);
        gfx.endFill();
        
        // Inner swirl
        gfx.beginFill(0x000000, 0.5);
        gfx.drawCircle(this.x, this.y, this.radius * 0.6);
        gfx.endFill();
        
        // Center dot
        gfx.beginFill(0xffffff, 0.8);
        gfx.drawCircle(this.x, this.y, this.radius * 0.2);
        gfx.endFill();
    }
}

export class LaserBeam implements Entity {
    x1: number; y1: number; x2: number; y2: number;
    color: number; lifeTime: number; maxLife: number;
    constructor(x1: number, y1: number, x2: number, y2: number, color: number) {
        this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
        this.color = color; this.lifeTime = 15; this.maxLife = 15;
    }
    update() { this.lifeTime--; }
    draw(gfx: PIXI.Graphics) {
        if (this.lifeTime <= 0) return;
        const alpha = this.lifeTime / this.maxLife;
        gfx.lineStyle(6, this.color, alpha * 0.6);
        gfx.moveTo(this.x1, this.y1); gfx.lineTo(this.x2, this.y2);
        gfx.lineStyle(0);
        gfx.lineStyle(2, 0xffffff, alpha);
        gfx.moveTo(this.x1, this.y1); gfx.lineTo(this.x2, this.y2);
        gfx.lineStyle(0);
    }
}