import * as PIXI from 'pixi.js';
import { LOGICAL_W, LOGICAL_H } from './config';
import { state } from './state';

export const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
export const app = new PIXI.Application({
    view: canvas,
    resizeTo: window,
    backgroundColor: 0x0a0a0f,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
});

export const gameScene = new PIXI.Container();
// Это хак для добавления кастомных свойств в TypeScript для Container
export const sceneBase = { x: 0, y: 0 }; 

app.stage.addChild(gameScene);

export const bgGfx = new PIXI.Graphics();
export const gridGfx = new PIXI.Graphics();
export const wallsGlowGfx = new PIXI.Graphics();
export const wallsGfx = new PIXI.Graphics();
export const glowGfx = new PIXI.Graphics();
export const entitiesGfx = new PIXI.Graphics();
export const particlesGfx = new PIXI.Graphics();
export const uiGfx = new PIXI.Graphics();
export const textContainer = new PIXI.Container();

const glowFilter = new PIXI.BlurFilter();
glowFilter.blur = 12;
glowGfx.filters = [glowFilter];
glowGfx.blendMode = PIXI.BLEND_MODES.ADD;

const wallsFilter = new PIXI.BlurFilter();
wallsFilter.blur = 8;
wallsGlowGfx.filters = [wallsFilter];
wallsGlowGfx.blendMode = PIXI.BLEND_MODES.ADD;

entitiesGfx.blendMode = PIXI.BLEND_MODES.ADD;
particlesGfx.blendMode = PIXI.BLEND_MODES.ADD;

gameScene.addChild(bgGfx, gridGfx, wallsGlowGfx, wallsGfx, glowGfx, entitiesGfx, particlesGfx, uiGfx, textContainer);

export const bgStars = Array.from({length: 150}, () => ({
    x: Math.random() * LOGICAL_W,
    y: Math.random() * LOGICAL_H,
    size: Math.random() * 2 + 0.5,
    speedX: (Math.random() - 0.5) * 0.5,
    speedY: (Math.random() - 0.5) * 0.5,
    alpha: Math.random(),
    pulse: (Math.random() - 0.5) * 0.02
}));

export function resizeCanvas() {
    app.resize();
    const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
    const offsetX = (window.innerWidth - LOGICAL_W * scale) / 2;
    const offsetY = (window.innerHeight - LOGICAL_H * scale) / 2;
    
    gameScene.scale.set(scale);
    sceneBase.x = offsetX;
    sceneBase.y = offsetY;
    gameScene.position.set(offsetX, offsetY);
}

// Заменяем коллбэк addXp в state, чтобы он триггерил levelUp
import { addXp as originalAddXp } from './state';
import { triggerLevelUp } from './ui';
// Monkey-patch, чтобы избежать circular dependency
(window as any).triggerLevelUp = triggerLevelUp;