import { state, progress, resetProgress as stateResetProgress } from './state';
import { UPGRADES_DB, LOGICAL_W, LOGICAL_H, CONFIG } from './config';
import { FloatingText } from './entities/Effects';
import { initLevel } from './levelGen';
import { textContainer, resizeCanvas } from './pixiApp'; // Импортируем из pixiApp

// Экспортируем элементы DOM, чтобы к ним был доступ извне
export const scoreUI = document.getElementById('scoreUI')!;
export const shotsUI = document.getElementById('shotsUI')!;
export const comboUI = document.getElementById('comboUI')!;
export const levelUI = document.getElementById('levelUI')!;
export const sectorUI = document.getElementById('sectorUI')!;
export const xpBarUI = document.getElementById('xpBarUI')!;
export const centerMessage = document.getElementById('center-message')!;
export const msgTitle = document.getElementById('msg-title')!;
export const msgDesc = document.getElementById('msg-desc')!;
export const restartBtn = document.getElementById('restartBtn')!;
export const instructionsUI = document.getElementById('instructionsUI')!;
export const levelupModal = document.getElementById('levelup-modal')!;
export const upgradeOptions = document.getElementById('upgrade-options')!;
export const inventoryPanel = document.getElementById('inventory-panel')!;
export const skipSectorBtn = document.getElementById('skipSectorBtn')!;
export const mainMenu = document.getElementById('main-menu')!;
export const settingsModal = document.getElementById('settings-modal')!;
export const inventoryModal = document.getElementById('inventory-modal')!;
export const encyclopediaModal = document.getElementById('encyclopedia-modal')!;
export const resolutionSelect = document.getElementById('resolutionSelect') as HTMLSelectElement;
export const inventoryGrid = document.getElementById('inventory-grid')!;
export const encyclopediaGrid = document.getElementById('encyclopedia-grid')!;

// Управление главным меню
export function showMainMenu() {
    mainMenu.classList.remove('hidden');
    settingsModal.classList.add('hidden');
    inventoryModal.classList.add('hidden');
    encyclopediaModal.classList.add('hidden');
    document.getElementById('showMainMenuBtn')!.classList.add('hidden');
    document.getElementById('newGameBtnGlobal')!.classList.add('hidden');
    document.getElementById('testSpiralBtn')!.classList.add('hidden');
    document.getElementById('testBrainBtn')!.classList.add('hidden');
    document.getElementById('debugSkipBtn')!.classList.add('hidden');
    state.isPaused = true;
}

export function hideMainMenu() {
    mainMenu.classList.add('hidden');
    document.getElementById('showMainMenuBtn')!.classList.remove('hidden');
    document.getElementById('newGameBtnGlobal')!.classList.remove('hidden');
    document.getElementById('testSpiralBtn')!.classList.remove('hidden');
    document.getElementById('testBrainBtn')!.classList.remove('hidden');
    document.getElementById('debugSkipBtn')!.classList.remove('hidden');
    state.isPaused = false;
}

export function showSettings() {
    settingsModal.classList.remove('hidden');
    mainMenu.classList.add('hidden');
    // Загружаем сохраненное разрешение
    const savedResolution = localStorage.getItem('gameResolution');
    if (savedResolution) {
        resolutionSelect.value = savedResolution;
    }
}

export function showInventory() {
    inventoryModal.classList.remove('hidden');
    mainMenu.classList.add('hidden');
    updateInventoryModal();
}

export function showEncyclopedia() {
    encyclopediaModal.classList.remove('hidden');
    mainMenu.classList.add('hidden');
    updateEncyclopediaModal();
}

export function updateEncyclopediaModal() {
    encyclopediaGrid.innerHTML = '';
    for (let key in UPGRADES_DB) {
        const item = UPGRADES_DB[key];
        const card = document.createElement('div');
        card.className = 'inv-card'; // Reuse inv-card styling
        card.style.borderColor = '#00f3ff';
        card.innerHTML = `
            <div class="inv-lvl">Max Lv ${item.maxLvl}</div>
            <div class="inv-title" style="color: #00f3ff;">${item.title}</div>
            <div class="inv-desc">${item.desc}</div>
        `;
        encyclopediaGrid.appendChild(card);
    }
}

export function updateInventoryModal() {
    inventoryGrid.innerHTML = '';
    for (let key in progress.upgrades) {
        if (progress.upgrades[key] > 0) {
            const card = document.createElement('div');
            card.className = 'inv-card';
            card.innerHTML = `
                <div class="inv-lvl">Lv ${progress.upgrades[key]}</div>
                <div class="inv-title">${UPGRADES_DB[key].title}</div>
                <div class="inv-desc">${UPGRADES_DB[key].desc}</div>
            `;
            inventoryGrid.appendChild(card);
        }
    }
    if (inventoryGrid.children.length === 0) {
        inventoryGrid.innerHTML = '<p style="color: #a0a0b5; grid-column: 1/-1; text-align: center;">Пока нет открытых предметов</p>';
    }
}

export function saveResolution() {
    const resolution = resolutionSelect.value;
    localStorage.setItem('gameResolution', resolution);
    const [width, height] = resolution.split('x').map(Number);
    console.log(`Resolution set to ${width}x${height}`);
    // Можно добавить применение разрешения здесь если нужно
}

export function updateUI() {
    scoreUI.innerText = state.score.toString(); 
    shotsUI.innerText = state.shots.toString(); 
    comboUI.innerText = `x${state.combo.toFixed(1)}`;
    if (state.combo > 1) { 
        comboUI.style.transform = `scale(${Math.min(1 + state.combo*0.1, 1.5)})`; 
        setTimeout(() => comboUI.style.transform = 'scale(1)', 100); 
    }
}

export function updateInventoryUI() {
    inventoryPanel.innerHTML = '';
    for (let key in progress.upgrades) {
        if (progress.upgrades[key] > 0) {
            const slot = document.createElement('div'); slot.className = 'inv-slot';
            slot.innerHTML = `<div class="inv-lvl">Lv ${progress.upgrades[key]}</div><div class="inv-title">${UPGRADES_DB[key].title}</div>`;
            inventoryPanel.appendChild(slot);
        }
    }
}

export function updateRPG_UI() {
    levelUI.innerText = progress.level.toString(); 
    if (sectorUI) sectorUI.innerText = progress.sector.toString();
    xpBarUI.style.width = `${Math.min(100, (progress.xp / progress.xpRequired) * 100)}%`;
}

// Этот метод нужно экспортировать для использования в main.ts или audio.ts (если потребуется)
export function triggerLevelUp() {
    state.isPaused = true; upgradeOptions.innerHTML = '';
    let availableKeys = Object.keys(UPGRADES_DB).filter(k => progress.upgrades[k] < UPGRADES_DB[k].maxLvl);
    if (progress.upgrades.delayed > 0) availableKeys = availableKeys.filter(k => k !== 'piercing');
    else if (progress.upgrades.piercing > 0) availableKeys = availableKeys.filter(k => k !== 'delayed');

    if (availableKeys.length === 0) {
        state.shots += 3; 
        state.floatingTexts.push(new FloatingText(LOGICAL_W/2, LOGICAL_H/2, "+3 Броска!", CONFIG.colors.nodeBlue)); 
        updateUI(); 
        state.isPaused = false; 
        return;
    }

    availableKeys.sort(() => 0.5 - Math.random());
    const selected = [];
    for (let key of availableKeys) {
        if (selected.length >= 3) break;
        if ((key === 'piercing' && selected.includes('delayed')) || (key === 'delayed' && selected.includes('piercing'))) continue;
        selected.push(key);
    }

    selected.forEach(key => {
        const upg = UPGRADES_DB[key];
        const card = document.createElement('div'); card.className = 'upgrade-card';
        card.innerHTML = `<h3>${upg.title} <span class="lvl">Lvl ${progress.upgrades[key] + 1}</span></h3><p>${upg.desc}</p>`;
        card.onclick = () => { 
            progress.upgrades[key]++; 
            updateInventoryUI(); 
            levelupModal.classList.add('hidden'); 
            setTimeout(() => state.isPaused = false, 300); 
        };
        upgradeOptions.appendChild(card);
    });
    levelupModal.classList.remove('hidden');
}

export function checkGameOver() {
    const targetsLeft = state.nodes.filter(n => !n.isDestroyed && !['obstacle', 'bumper', 'mine', 'repulsor', 'speedBumper', 'boss', 'brainBoss'].includes(n.type)).length;
    const bossAlive = state.nodes.some(n => (n.type === 'boss' || n.type === 'brainBoss') && !n.isDestroyed);
    
    if (targetsLeft === 0 || state.shots <= 0) {
        state.isPlaying = false;
        let percentage = Math.min(100, state.totalTargets > 0 ? Math.round(((state.totalTargets - targetsLeft) / state.totalTargets) * 100) : 100);
        
        if (bossAlive && state.shots <= 0) {
            msgTitle.innerText = "Босс не повержен!"; msgTitle.style.color = "#ff003c";
            msgDesc.innerText = `Энергия исчерпана, а босс уцелел.\nВесь прогресс утерян!`;
            restartBtn.innerText = "Начать заново"; 
            restartBtn.onclick = () => { stateResetProgress(); initLevel(false, textContainer, resizeCanvas); };
        } else {
            msgTitle.innerText = targetsLeft === 0 ? "Сектор Зачищен!" : "Время вышло";
            msgTitle.style.color = targetsLeft === 0 ? "#00f3ff" : "#ffff00"; 
            msgDesc.innerText = `Уничтожено: ${percentage}%\nНажми, чтобы перейти дальше. Опыт сохраняется!`;
            restartBtn.innerText = "Следующий сектор"; 
            restartBtn.onclick = () => { progress.sector++; initLevel(false, textContainer, resizeCanvas); };
        }
        centerMessage.classList.remove('hidden'); skipSectorBtn.classList.add('hidden');
    }
}