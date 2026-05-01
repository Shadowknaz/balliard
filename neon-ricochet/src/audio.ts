export const AudioEngine = {
    ctx: null as AudioContext | null,
    enabled: true,

    init() {
        if (!this.ctx) {
            // Поддержка для старых браузеров
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    play(freq: number, type: OscillatorType, duration: number, vol: number, slideFreq: number | null = null) {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
        }
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    shoot() { this.play(300, 'triangle', 0.3, 0.15, 50); },
    bumperNote(freq: number) { this.play(freq, 'sine', 0.2, 0.08); },
    bounce() { this.play(450, 'sine', 0.1, 0.05); },
    explode() { this.play(120, 'square', 0.4, 0.1, 20); },
    
    // Wormhole activation sound - descending whoosh effect
    wormhole() {
        this.play(800, 'sine', 0.4, 0.15, 100);
        this.play(600, 'triangle', 0.3, 0.1, 150);
    },
    
    // Wall destruction sound - crunch/break effect
    wallBreak() {
        this.play(200, 'sawtooth', 0.2, 0.12, 80);
        this.play(150, 'square', 0.3, 0.08, 50);
    },
    
    levelUp() { 
        this.play(300, 'sine', 0.1, 0.1); 
        setTimeout(() => this.play(400, 'sine', 0.1, 0.1), 100);
        setTimeout(() => this.play(600, 'sine', 0.3, 0.1), 200);
    },
    
    error() { this.play(150, 'sawtooth', 0.3, 0.1, 100); }
};