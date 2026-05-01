import { state, progress } from './state';
import { CONFIG } from './config';
import { AudioEngine } from './audio';
import { app, gameScene } from './pixiApp';
import { FloatingText } from './entities/Effects';
import { updateUI, instructionsUI } from './ui';

export function getMousePos(e: MouseEvent | TouchEvent) {
    const rect = app.view.getBoundingClientRect();
    const scale = gameScene.scale.x; 
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    
    return {
        x: (clientX - rect.left - gameScene.position.x) / scale,
        y: (clientY - rect.top - gameScene.position.y) / scale
    };
}

export function handleInputStart(e: MouseEvent | TouchEvent) {
    AudioEngine.init(); 
    const target = e.target as HTMLElement;
    if (target.id === 'newGameBtnGlobal' || target.id === 'skipSectorBtn' || target.id === 'testSpiralBtn' || target.tagName === 'BUTTON') return;
    if (!state.isPlaying || state.isPaused || state.isBallMoving || state.shots <= 0) return;
    
    const pos = getMousePos(e);
    state.isAiming = true; state.chargePower = 2; state.mouseX = pos.x; state.mouseY = pos.y; 
    if (instructionsUI) instructionsUI.style.opacity = '0';
}

export function handleInputMove(e: MouseEvent | TouchEvent) { 
    if (state.isAiming) { 
        const pos = getMousePos(e); state.mouseX = pos.x; state.mouseY = pos.y; 
    } 
}

export function handleInputEnd() {
    if (state.isAiming && state.player) {
        state.isAiming = false;
        const angle = Math.atan2(state.mouseY - state.player.y, state.mouseX - state.player.x);
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
        state.player.vx = Math.cos(angle) * state.chargePower * powerMultiplier; 
        state.player.vy = Math.sin(angle) * state.chargePower * powerMultiplier;
        state.launchPos = { x: state.player.x, y: state.player.y };
        
        state.shots--; state.combo = 1.0; state.chargePower = 0; updateUI();
    }
}

export function initInput() {
    app.view.addEventListener('mousedown', handleInputStart as EventListener);
    app.view.addEventListener('mousemove', handleInputMove as EventListener);
    window.addEventListener('mouseup', handleInputEnd);
    app.view.addEventListener('touchstart', handleInputStart as EventListener, {passive: false});
    app.view.addEventListener('touchmove', handleInputMove as EventListener, {passive: false});
    window.addEventListener('touchend', handleInputEnd);
}