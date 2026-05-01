import { LOGICAL_W, LOGICAL_H, CONFIG } from './config';

export interface Point { x: number; y: number; }
export interface Entity extends Point { update(time?: number): void; draw(gfx: any, glowGfx: any): void; }
export interface Projectile extends Entity { vx: number; vy: number; radius: number; updateLogic(): void; updateMovement(steps: number): void; }

export const progress = {
    level: 1, 
    sector: 1, 
    xp: 0, 
    xpRequired: 200,
    upgrades: { 
        multiball: 0, delayed: 0, shockwave: 0, momentum: 0, 
        piercing: 0, lightning: 0, instability: 0, blackhole: 0,
        ricochet: 0, boomerang: 0, laser: 0
    } as Record<string, number>
};

export const state = {
    player: null as Projectile | null, 
    miniBalls: [] as Projectile[], 
    nodes: [] as any[], 
    portals: [] as any[], 
    walls: [] as {x1: number, y1: number, x2: number, y2: number, health?: number, maxHealth?: number, thickness?: number}[], 
    particles: [] as Entity[], 
    floatingTexts: [] as Entity[], 
    blackHoles: [] as Entity[], 
    lightningBolts: [] as Entity[],
    wormholes: [] as Entity[],  
    
    score: 0, shots: CONFIG.maxShots, combo: 1.0, totalTargets: 0, 
    isPlaying: true, isPaused: false, destroyedCount: 0, 
    
    arena: { 
        left: 0, right: LOGICAL_W, top: 0, bottom: LOGICAL_H, 
        targetLeft: 0, targetRight: LOGICAL_W, targetTop: 0, targetBottom: LOGICAL_H, 
        warningShown: false 
    },
    
    isAiming: false, mouseX: 0, mouseY: 0, chargePower: 0, isBallMoving: false, shake: 0,
    launchPos: null as Point | null
};

export function resetProgress() {
    progress.level = 1; progress.sector = 1; progress.xp = 0; progress.xpRequired = 200;
    for (let key in progress.upgrades) progress.upgrades[key] = 0;
    state.score = 0; state.walls = [];
}

export function addXp(amount: number) {
    progress.xp += amount;
    if (progress.xp >= progress.xpRequired) { 
        progress.xp -= progress.xpRequired; 
        progress.level++; 
        progress.xpRequired = Math.floor(progress.xpRequired * 1.6); 
        
        // Глобальный вызов модалки уровня (безопасно для модулей)
        if (typeof (window as any).triggerLevelUp === 'function') {
            (window as any).triggerLevelUp();
        }
    }
}