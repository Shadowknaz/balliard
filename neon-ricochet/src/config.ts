export const LOGICAL_W = 1600;
export const LOGICAL_H = 900;

export const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

export const CONFIG = {
    playerRadius: 12,
    nodeRadius: 15,
    maxShots: 3,
    friction: 0.985, 
    maxLaunchPower: 25,
    chargeRate: 0.45,
    bounceRestitution: 1.2,
    colors: {
        bg: 0x0a0a0f,
        player: 0x00ff44, 
        nodeBlue: 0x00f3ff,
        nodeRed: 0xff003c,
        nodeObstacle: 0x8892b0,
        nodeBumper: 0xffaa00,
        miniBall: 0xffff00,
        lightning: 0x00ffff,
        blackHole: 0x111116,
        boss: 0x0055ff,
        superBoss: 0xb700ff,
        mine: 0xff4400,
        repulsor: 0xdd00ff,
        wormhole: 0x9900ff,
        speedBumper: 0x00ffaa,
        fragileWall: 0xff6600
    }
};

export const UPGRADES_DB: Record<string, { title: string, desc: string, maxLvl: number }> = {
    multiball: { title: "Осколки", desc: "+5% шанс при уничтожении цели выпустить 2 мини-шара.", maxLvl: 5 },
    delayed: { title: "Отсрочка", desc: "+8% шанс: цель станет трамплином перед взрывом.", maxLvl: 5 },
    shockwave: { title: "Детонация", desc: "+5% шанс: мощный взрыв синего шара.", maxLvl: 5 },
    momentum: { title: "Инерция", desc: "+6% шанс ускорения при отскоке.", maxLvl: 5 },
    piercing: { title: "Пронзание", desc: "+5% шанс пролететь сквозь цель.", maxLvl: 5 },
    lightning: { title: "Молния", desc: "+6% шанс стать шаровой молнией на 3с.", maxLvl: 5 },
    instability: { title: "Нестабильность", desc: "+10% шанс случайной силы броска.", maxLvl: 5 },
    blackhole: { title: "Черная дыра", desc: "+5% шанс создать сингулярность.", maxLvl: 5 },
    ricochet: { title: "Дублирующий выстрел", desc: "+4% шанс при отскоке от стены выпустить копию шара.", maxLvl: 3 },
    boomerang: { title: "Отскок назад", desc: "+2% шанс после попадания вернуть шар к месту броска.", maxLvl: 3 },
    laser: { title: "Лазерный луч", desc: "+3% шанс при уничтожении выпустить лазерный луч.", maxLvl: 5 }
};