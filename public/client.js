// Socket connection
const socket = io();

// Game state
let gameState = {
    playerId: null,
    roomCode: null,
    isHost: false,
    public: null,
    private: null
};

// Helper function to render player avatar HTML
function renderPlayerAvatar(player, size = 'medium') {
    const sizeClass = `avatar-${size}`;
    return `<span class="player-avatar ${sizeClass}" style="background-color: ${player.avatarColor}">${player.avatar}</span>`;
}

// Helper function to render player name with avatar
function renderPlayerName(player, showAvatar = true) {
    if (showAvatar && player.avatar) {
        return `${renderPlayerAvatar(player)} <span class="player-name-text">${player.name}</span>`;
    }
    return player.name;
}

// DOM Elements
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const joinCreateSection = document.getElementById('join-create-section');
const roomSection = document.getElementById('room-section');

// ==================== SOUND SYSTEM ====================
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.musicVolume = 0.3;
        this.sfxVolume = 0.5;
        this.currentMusic = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);

            // Separate gains for music and SFX
            this.musicGain = this.audioContext.createGain();
            this.musicGain.gain.value = this.musicVolume;
            this.musicGain.connect(this.masterGain);

            this.sfxGain = this.audioContext.createGain();
            this.sfxGain.gain.value = this.sfxVolume;
            this.sfxGain.connect(this.masterGain);

            this.initialized = true;
            console.log('Sound system initialized');
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    // Generate a tone with envelope
    playTone(frequency, duration, type = 'sine', gainValue = 0.3, attack = 0.01, decay = 0.1) {
        if (!this.initialized || !this.sfxEnabled) return;
        this.resume();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = type;
        osc.frequency.value = frequency;

        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(gainValue, this.audioContext.currentTime + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.audioContext.currentTime + duration);
    }

    // Play noise burst (for clicks, hits)
    playNoise(duration, gainValue = 0.2) {
        if (!this.initialized || !this.sfxEnabled) return;
        this.resume();

        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(gainValue, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

        // Filter for softer click
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start();
        noise.stop(this.audioContext.currentTime + duration);
    }

    // Sound Effects
    buttonClick() {
        this.playTone(800, 0.1, 'square', 0.1);
        this.playNoise(0.05, 0.1);
    }

    playerSelect() {
        this.playTone(440, 0.15, 'sine', 0.2);
        setTimeout(() => this.playTone(660, 0.15, 'sine', 0.2), 50);
    }

    cardDeal() {
        this.playNoise(0.08, 0.3);
        this.playTone(200, 0.1, 'triangle', 0.1);
    }

    cardFlip() {
        this.playNoise(0.05, 0.2);
        this.playTone(600, 0.08, 'sine', 0.15);
    }

    cardSelect() {
        this.playTone(523, 0.1, 'sine', 0.25);
        this.playTone(659, 0.15, 'sine', 0.2);
    }

    voteYes() {
        // Upward arpeggio
        this.playTone(392, 0.15, 'sine', 0.2);
        setTimeout(() => this.playTone(494, 0.15, 'sine', 0.2), 80);
        setTimeout(() => this.playTone(587, 0.2, 'sine', 0.25), 160);
    }

    voteNo() {
        // Downward tones
        this.playTone(392, 0.15, 'sine', 0.2);
        setTimeout(() => this.playTone(330, 0.15, 'sine', 0.2), 100);
        setTimeout(() => this.playTone(262, 0.25, 'sine', 0.15), 200);
    }

    votePassed() {
        // Triumphant chord
        const baseTime = this.audioContext?.currentTime || 0;
        this.playTone(262, 0.4, 'sine', 0.15);
        this.playTone(330, 0.4, 'sine', 0.15);
        this.playTone(392, 0.4, 'sine', 0.15);
        setTimeout(() => {
            this.playTone(523, 0.5, 'sine', 0.2);
        }, 200);
    }

    voteFailed() {
        // Sad descending
        this.playTone(392, 0.3, 'sawtooth', 0.1);
        setTimeout(() => this.playTone(349, 0.3, 'sawtooth', 0.1), 150);
        setTimeout(() => this.playTone(330, 0.4, 'sawtooth', 0.1), 300);
        setTimeout(() => this.playTone(262, 0.5, 'sawtooth', 0.08), 450);
    }

    policyLiberal() {
        // Hopeful rising melody
        const notes = [523, 587, 659, 784];
        notes.forEach((note, i) => {
            setTimeout(() => this.playTone(note, 0.3, 'sine', 0.2), i * 120);
        });
        setTimeout(() => {
            this.playTone(523, 0.4, 'sine', 0.15);
            this.playTone(659, 0.4, 'sine', 0.15);
            this.playTone(784, 0.4, 'sine', 0.15);
        }, 500);
    }

    policyFascist() {
        // Dark, ominous
        this.playTone(130, 0.5, 'sawtooth', 0.15);
        this.playTone(138, 0.5, 'sawtooth', 0.1);
        setTimeout(() => {
            this.playTone(110, 0.6, 'sawtooth', 0.2);
            this.playTone(165, 0.4, 'triangle', 0.1);
        }, 300);
    }

    chaos() {
        // Discordant, alarming
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.playTone(200 + Math.random() * 400, 0.15, 'sawtooth', 0.15);
                this.playNoise(0.1, 0.2);
            }, i * 100);
        }
        setTimeout(() => this.playTone(150, 0.8, 'sawtooth', 0.2), 500);
    }

    execution() {
        // Dramatic hit
        this.playNoise(0.3, 0.4);
        this.playTone(80, 0.8, 'sawtooth', 0.3);
        setTimeout(() => this.playTone(60, 1, 'sine', 0.2), 200);
    }

    gameStart() {
        // Dramatic fanfare
        const fanfare = [392, 392, 392, 523];
        fanfare.forEach((note, i) => {
            setTimeout(() => this.playTone(note, i === 3 ? 0.6 : 0.2, 'square', 0.15), i * 200);
        });
    }

    winLiberal() {
        // Triumphant victory
        const melody = [523, 659, 784, 1047];
        melody.forEach((note, i) => {
            setTimeout(() => {
                this.playTone(note, 0.4, 'sine', 0.2);
                this.playTone(note * 0.5, 0.4, 'sine', 0.1);
            }, i * 200);
        });
        setTimeout(() => {
            this.playTone(1047, 0.8, 'sine', 0.25);
            this.playTone(784, 0.8, 'sine', 0.2);
            this.playTone(523, 0.8, 'sine', 0.15);
        }, 800);
    }

    winFascist() {
        // Dark victory
        const melody = [196, 185, 175, 165];
        melody.forEach((note, i) => {
            setTimeout(() => {
                this.playTone(note, 0.5, 'sawtooth', 0.15);
                this.playTone(note * 1.5, 0.3, 'triangle', 0.1);
            }, i * 250);
        });
        setTimeout(() => {
            this.playTone(110, 1.5, 'sawtooth', 0.2);
            this.playTone(165, 1, 'sawtooth', 0.15);
        }, 1000);
    }

    joinRoom() {
        this.playTone(440, 0.1, 'sine', 0.2);
        this.playTone(554, 0.15, 'sine', 0.2);
        setTimeout(() => this.playTone(659, 0.2, 'sine', 0.25), 100);
    }

    playerJoined() {
        this.playTone(880, 0.15, 'sine', 0.15);
        setTimeout(() => this.playTone(1047, 0.2, 'sine', 0.2), 100);
    }

    error() {
        this.playTone(200, 0.3, 'square', 0.15);
        this.playTone(150, 0.4, 'square', 0.1);
    }

    // ==================== NEW SOUND EFFECTS ====================

    // Your turn notification - attention-grabbing but not jarring
    yourTurn() {
        // Ascending attention chime
        const notes = [523, 659, 784, 1047];
        notes.forEach((note, i) => {
            setTimeout(() => this.playTone(note, 0.15, 'sine', 0.2), i * 80);
        });
        setTimeout(() => {
            this.playTone(1047, 0.3, 'sine', 0.25);
            this.playTone(784, 0.3, 'sine', 0.15);
        }, 350);
    }

    // Investigation reveal - mysterious reveal sound
    investigationReveal() {
        // Mysterious whoosh with reveal
        this.playTone(200, 0.3, 'sine', 0.1);
        setTimeout(() => {
            this.playTone(300, 0.2, 'sine', 0.15);
            this.playTone(450, 0.3, 'triangle', 0.1);
        }, 150);
        setTimeout(() => {
            this.playTone(600, 0.4, 'sine', 0.2);
            this.playNoise(0.1, 0.15);
        }, 300);
    }

    // Special election - dramatic power shift sound
    specialElection() {
        // Dramatic brass-like fanfare
        this.playTone(262, 0.2, 'sawtooth', 0.12);
        this.playTone(330, 0.2, 'sawtooth', 0.12);
        setTimeout(() => {
            this.playTone(392, 0.25, 'sawtooth', 0.15);
            this.playTone(523, 0.25, 'sawtooth', 0.1);
        }, 200);
        setTimeout(() => {
            this.playTone(523, 0.4, 'square', 0.12);
            this.playTone(659, 0.4, 'square', 0.08);
        }, 450);
    }

    // Executive power unlocked - ominous power activation
    executivePowerUnlock() {
        // Dark, ominous power sound
        this.playTone(110, 0.5, 'sawtooth', 0.15);
        this.playTone(165, 0.5, 'sawtooth', 0.1);
        setTimeout(() => {
            this.playTone(82, 0.6, 'sawtooth', 0.2);
            this.playNoise(0.2, 0.15);
        }, 250);
        setTimeout(() => {
            this.playTone(220, 0.4, 'square', 0.12);
            this.playTone(277, 0.4, 'square', 0.08);
        }, 500);
    }

    // Phase transition - subtle whoosh
    phaseTransition() {
        // Soft transition whoosh
        if (!this.initialized || !this.sfxEnabled) return;
        this.resume();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.15);
        osc.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.3);

        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.3);
    }

    // Tension building - for suspenseful moments
    tensionBuild() {
        // Rising tension sound
        if (!this.initialized || !this.sfxEnabled) return;
        this.resume();

        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(80, this.audioContext.currentTime);
        osc1.frequency.linearRampToValueAtTime(150, this.audioContext.currentTime + 1.5);
        osc2.frequency.setValueAtTime(82, this.audioContext.currentTime);
        osc2.frequency.linearRampToValueAtTime(152, this.audioContext.currentTime + 1.5);

        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, this.audioContext.currentTime + 0.5);
        gain.gain.linearRampToValueAtTime(0.12, this.audioContext.currentTime + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1.5);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);

        osc1.start();
        osc2.start();
        osc1.stop(this.audioContext.currentTime + 1.5);
        osc2.stop(this.audioContext.currentTime + 1.5);
    }

    // Election tracker warning - danger imminent
    electionTrackerWarning() {
        // Warning pulse sound
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                this.playTone(440, 0.15, 'square', 0.15);
                this.playTone(220, 0.15, 'square', 0.1);
            }, i * 200);
        }
    }

    // Deck shuffle sound
    deckShuffle() {
        // Multiple quick card sounds
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                this.playNoise(0.04, 0.15 + Math.random() * 0.1);
                this.playTone(150 + Math.random() * 100, 0.05, 'triangle', 0.05);
            }, i * 40 + Math.random() * 20);
        }
    }

    // Hitler elected - dramatic loss condition
    hitlerElected() {
        // Dramatic, ominous reveal
        this.playTone(130, 0.3, 'sawtooth', 0.2);
        this.playTone(138, 0.3, 'sawtooth', 0.15);
        setTimeout(() => {
            this.playTone(87, 0.4, 'sawtooth', 0.25);
            this.playTone(110, 0.4, 'sawtooth', 0.2);
            this.playNoise(0.3, 0.2);
        }, 300);
        setTimeout(() => {
            // Dramatic chord
            this.playTone(65, 1, 'sawtooth', 0.3);
            this.playTone(82, 1, 'sawtooth', 0.2);
            this.playTone(98, 1, 'sawtooth', 0.15);
        }, 600);
    }

    // Role reveal sound - for showing roles
    roleReveal() {
        // Mysterious reveal sound
        this.playTone(330, 0.2, 'sine', 0.15);
        setTimeout(() => this.playTone(392, 0.2, 'sine', 0.15), 100);
        setTimeout(() => this.playTone(494, 0.3, 'sine', 0.2), 200);
        setTimeout(() => {
            this.playNoise(0.1, 0.1);
        }, 350);
    }

    // Veto proposed sound
    vetoProposed() {
        // Questioning, uncertain sound
        this.playTone(392, 0.2, 'sine', 0.15);
        setTimeout(() => this.playTone(370, 0.2, 'sine', 0.15), 150);
        setTimeout(() => this.playTone(392, 0.3, 'triangle', 0.1), 300);
    }

    // Veto approved sound
    vetoApproved() {
        // Confirming descend
        this.playTone(523, 0.2, 'sine', 0.15);
        setTimeout(() => this.playTone(392, 0.2, 'sine', 0.15), 100);
        setTimeout(() => this.playTone(330, 0.3, 'sine', 0.2), 200);
    }

    // Veto rejected sound
    vetoRejected() {
        // Harsh rejection
        this.playTone(200, 0.2, 'square', 0.15);
        setTimeout(() => this.playTone(150, 0.3, 'square', 0.12), 150);
    }

    // Countdown tick
    countdownTick() {
        this.playTone(800, 0.05, 'square', 0.15);
    }

    // Countdown final warning
    countdownWarning() {
        this.playTone(880, 0.1, 'square', 0.2);
        setTimeout(() => this.playTone(880, 0.1, 'square', 0.2), 150);
    }

    // Notification ping - general notification
    notification() {
        this.playTone(880, 0.1, 'sine', 0.2);
        setTimeout(() => this.playTone(1100, 0.15, 'sine', 0.15), 80);
    }

    // Examine cards sound
    examineCards() {
        // Mysterious peek sound
        this.playTone(400, 0.15, 'sine', 0.1);
        setTimeout(() => {
            this.playTone(500, 0.15, 'sine', 0.12);
            this.playNoise(0.05, 0.1);
        }, 100);
        setTimeout(() => this.playTone(600, 0.2, 'sine', 0.15), 200);
    }

    // President turn start
    presidentTurn() {
        // Authoritative announcement
        this.playTone(262, 0.15, 'square', 0.12);
        this.playTone(330, 0.15, 'square', 0.1);
        setTimeout(() => {
            this.playTone(392, 0.25, 'square', 0.15);
        }, 150);
    }

    // Chancellor turn start
    chancellorTurn() {
        // Slightly different tone
        this.playTone(330, 0.15, 'sine', 0.12);
        this.playTone(392, 0.15, 'sine', 0.1);
        setTimeout(() => {
            this.playTone(494, 0.25, 'sine', 0.15);
        }, 150);
    }

    // ==================== END NEW SOUND EFFECTS ====================

    // Background Music System
    startMusic() {
        if (!this.initialized || !this.musicEnabled || this.currentMusic) return;
        this.resume();
        this.playAmbientMusic();
    }

    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.forEach(node => {
                try {
                    node.stop();
                } catch (e) {}
            });
            this.currentMusic = null;
        }
    }

    playAmbientMusic() {
        if (!this.initialized) return;

        this.currentMusic = [];

        // Create ambient drone
        const playDrone = () => {
            if (!this.musicEnabled || !this.initialized) return;

            const baseFreq = 55 + Math.random() * 20; // Low A area
            const duration = 8 + Math.random() * 4;

            // Main drone
            const osc1 = this.audioContext.createOscillator();
            const gain1 = this.audioContext.createGain();
            osc1.type = 'sine';
            osc1.frequency.value = baseFreq;
            gain1.gain.setValueAtTime(0, this.audioContext.currentTime);
            gain1.gain.linearRampToValueAtTime(0.08, this.audioContext.currentTime + 2);
            gain1.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);
            osc1.connect(gain1);
            gain1.connect(this.musicGain);
            osc1.start();
            osc1.stop(this.audioContext.currentTime + duration);

            // Harmonic
            const osc2 = this.audioContext.createOscillator();
            const gain2 = this.audioContext.createGain();
            osc2.type = 'triangle';
            osc2.frequency.value = baseFreq * 1.5;
            gain2.gain.setValueAtTime(0, this.audioContext.currentTime);
            gain2.gain.linearRampToValueAtTime(0.04, this.audioContext.currentTime + 3);
            gain2.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);
            osc2.connect(gain2);
            gain2.connect(this.musicGain);
            osc2.start();
            osc2.stop(this.audioContext.currentTime + duration);

            // High atmospheric pad
            if (Math.random() > 0.5) {
                const osc3 = this.audioContext.createOscillator();
                const gain3 = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();

                osc3.type = 'sine';
                osc3.frequency.value = baseFreq * 4 + Math.random() * 50;
                filter.type = 'lowpass';
                filter.frequency.value = 800;
                gain3.gain.setValueAtTime(0, this.audioContext.currentTime);
                gain3.gain.linearRampToValueAtTime(0.02, this.audioContext.currentTime + 2);
                gain3.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration - 1);

                osc3.connect(filter);
                filter.connect(gain3);
                gain3.connect(this.musicGain);
                osc3.start();
                osc3.stop(this.audioContext.currentTime + duration);
            }

            // Schedule next drone
            if (this.musicEnabled) {
                setTimeout(() => playDrone(), (duration - 2) * 1000);
            }
        };

        // Occasional melodic elements
        const playMelody = () => {
            if (!this.musicEnabled || !this.initialized) return;

            const notes = [110, 130.81, 146.83, 164.81, 196, 220, 246.94];
            const note = notes[Math.floor(Math.random() * notes.length)];

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.value = note;
            filter.type = 'lowpass';
            filter.frequency.value = 600;

            gain.gain.setValueAtTime(0, this.audioContext.currentTime);
            gain.gain.linearRampToValueAtTime(0.06, this.audioContext.currentTime + 0.5);
            gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 3);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);

            osc.start();
            osc.stop(this.audioContext.currentTime + 3);

            // Schedule next melody note
            if (this.musicEnabled) {
                setTimeout(() => playMelody(), 4000 + Math.random() * 8000);
            }
        };

        playDrone();
        setTimeout(() => playMelody(), 3000);
    }

    setMusicVolume(value) {
        this.musicVolume = value;
        if (this.musicGain) {
            this.musicGain.gain.value = value;
        }
    }

    setSfxVolume(value) {
        this.sfxVolume = value;
        if (this.sfxGain) {
            this.sfxGain.gain.value = value;
        }
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (this.musicEnabled) {
            this.startMusic();
        } else {
            this.stopMusic();
        }
        return this.musicEnabled;
    }

    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        return this.sfxEnabled;
    }
}

// Create global sound manager
const soundManager = new SoundManager();

// Initialize sound on first user interaction
function initSoundOnInteraction() {
    soundManager.init();
    soundManager.startMusic();
    document.removeEventListener('click', initSoundOnInteraction);
    document.removeEventListener('keydown', initSoundOnInteraction);
}

document.addEventListener('click', initSoundOnInteraction);
document.addEventListener('keydown', initSoundOnInteraction);

// ==================== END SOUND SYSTEM ====================

// ==================== ANIMATION HELPERS ====================
const AnimationHelper = {
    // Create screen flash effect
    screenFlash(type = 'gold') {
        const flash = document.createElement('div');
        flash.className = `screen-flash ${type}`;
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 300);
    },

    // Create phase transition overlay
    showPhaseTransition(text, duration = 1500) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'phase-transition-overlay';
            overlay.innerHTML = `<div class="phase-transition-text">${text}</div>`;
            document.body.appendChild(overlay);

            setTimeout(() => {
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 400);
            }, duration);
        });
    },

    // Stagger reveal elements with delay
    staggerReveal(elements, baseDelay = 100, className = 'revealing') {
        elements.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add(className);
            }, i * baseDelay);
        });
    },

    // Create waiting dots HTML
    createWaitingDots() {
        return '<span class="waiting-dots"><span></span><span></span><span></span></span>';
    },

    // Animate vote result reveal
    animateVoteResults() {
        const titleEl = document.getElementById('vote-result-title');
        const voteCards = document.querySelectorAll('.vote-result');
        const tallyEl = document.querySelector('.vote-tally');

        // Determine if passed or failed for styling
        const yesCount = document.querySelectorAll('.vote-result.vote-yes').length;
        const noCount = document.querySelectorAll('.vote-result.vote-no').length;
        const passed = yesCount > noCount;

        // Animate title first
        titleEl.classList.add('reveal-title');
        titleEl.classList.add(passed ? 'passed' : 'failed');

        // Then stagger reveal vote cards
        setTimeout(() => {
            this.staggerReveal(voteCards, 150);
        }, 600);

        // Finally reveal tally
        setTimeout(() => {
            if (tallyEl) tallyEl.classList.add('reveal');
        }, 600 + (voteCards.length * 150) + 200);
    },

    // Animate game over reveal
    animateGameOver(winner) {
        const titleEl = document.getElementById('winner-title');
        const roleCards = document.querySelectorAll('.final-role-card');

        // Flash screen
        this.screenFlash(winner);

        // Animate title
        titleEl.classList.add('gameover-title-reveal', winner);

        // Stagger reveal role cards
        setTimeout(() => {
            this.staggerReveal(roleCards, 200, 'reveal');
        }, 1200);
    },

    // Update election tracker danger state
    updateElectionTrackerDanger(tracker) {
        const trackerEl = document.getElementById('election-tracker');
        if (!trackerEl) return;
        trackerEl.classList.remove('election-tracker-danger', 'election-tracker-critical');
        if (tracker === 2) {
            trackerEl.classList.add('election-tracker-danger');
        }
    },

    // Check if Hitler can be elected (3+ fascist policies)
    isHitlerDangerZone(fascistPolicies) {
        return fascistPolicies >= 3;
    },

    // Add tension effect to voting phase
    addVotingTension(container) {
        container.classList.add('heartbeat-pulse');
    }
};

// ==================== END ANIMATION HELPERS ====================

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    createBubbles();
    setupHelpModal();
    setupSoundControls();
});

function setupEventListeners() {
    // Lobby buttons
    document.getElementById('create-room-btn').addEventListener('click', createRoom);
    document.getElementById('join-room-btn').addEventListener('click', joinRoom);
    document.getElementById('start-game-btn').addEventListener('click', startGame);

    // Voting buttons
    document.getElementById('vote-yes').addEventListener('click', () => castVote(true));
    document.getElementById('vote-no').addEventListener('click', () => castVote(false));

    // Continue buttons
    document.getElementById('continue-from-vote').addEventListener('click', continueFromVote);
    document.getElementById('continue-from-policy').addEventListener('click', continueFromPolicy);
    document.getElementById('continue-from-chaos').addEventListener('click', continueFromChaos);
    document.getElementById('continue-from-execution').addEventListener('click', continueFromExecution);

    // Enter key for inputs
    document.getElementById('player-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('create-room-btn').click();
    });
    document.getElementById('room-code').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('join-room-btn').click();
    });
}

// Socket event handlers
socket.on('roomCreated', ({ code, playerId }) => {
    gameState.playerId = playerId;
    gameState.roomCode = code;
    gameState.isHost = true;
    showRoomSection(code);
    soundManager.joinRoom();
});

socket.on('roomJoined', ({ code, playerId }) => {
    gameState.playerId = playerId;
    gameState.roomCode = code;
    gameState.isHost = false;
    showRoomSection(code);
    soundManager.joinRoom();
});

let previousPhase = null;
let roleRevealed = false;

socket.on('gameState', ({ public: publicState, private: privateState }) => {
    const oldPhase = gameState.public?.phase;
    const oldPlayerCount = gameState.public?.players?.length || 0;
    const oldRole = gameState.private?.role;

    gameState.public = publicState;
    gameState.private = privateState;

    // Trigger sounds based on phase changes
    const newPhase = publicState.phase;
    if (newPhase !== oldPhase) {
        handlePhaseChangeSound(oldPhase, newPhase, publicState);
    }

    // Sound when new player joins lobby
    if (publicState.phase === 'lobby' && publicState.players.length > oldPlayerCount) {
        soundManager.playerJoined();
    }

    // Role reveal sound - plays once when player first learns their role
    if (privateState?.role && !roleRevealed && oldPhase === 'lobby' && newPhase !== 'lobby') {
        roleRevealed = true;
        setTimeout(() => soundManager.roleReveal(), 800);
    }

    // Reset role revealed flag if we go back to lobby (new game)
    if (newPhase === 'lobby') {
        roleRevealed = false;
    }

    renderGameState();
});

function handlePhaseChangeSound(oldPhase, newPhase, pubState) {
    const priv = gameState.private;
    const isMyTurn = checkIfMyTurn(newPhase, pubState, priv);

    switch (newPhase) {
        case 'election':
            if (oldPhase === 'lobby') {
                soundManager.gameStart();
            } else {
                // Phase transition sound for returning to election
                soundManager.phaseTransition();
            }
            // Notify president it's their turn
            if (isMyTurn) {
                setTimeout(() => soundManager.yourTurn(), 300);
            }
            break;

        case 'voting':
            soundManager.cardDeal();
            // Build tension during voting
            setTimeout(() => soundManager.tensionBuild(), 500);
            break;

        case 'vote-result':
            // Determine if vote passed or failed
            if (pubState.votes) {
                const yesVotes = pubState.votes.filter(v => v.vote).length;
                const noVotes = pubState.votes.filter(v => !v.vote).length;
                if (yesVotes > noVotes) {
                    soundManager.votePassed();
                    // Check if Hitler was elected (fascist win condition)
                    if (pubState.winner === 'fascist' && pubState.winReason?.includes('Hitler')) {
                        setTimeout(() => soundManager.hitlerElected(), 500);
                    }
                } else {
                    soundManager.voteFailed();
                    // Warning sound if election tracker is getting high
                    if (pubState.electionTracker >= 2) {
                        setTimeout(() => soundManager.electionTrackerWarning(), 600);
                    }
                }
            }
            break;

        case 'legislative-president':
            soundManager.cardDeal();
            // Notify president it's their turn
            if (isMyTurn) {
                setTimeout(() => {
                    soundManager.presidentTurn();
                    soundManager.yourTurn();
                }, 300);
            }
            break;

        case 'legislative-chancellor':
            soundManager.cardFlip();
            // Notify chancellor it's their turn
            if (isMyTurn) {
                setTimeout(() => {
                    soundManager.chancellorTurn();
                    soundManager.yourTurn();
                }, 300);
            }
            break;

        case 'policy-result':
            if (pubState.enactedPolicy === 'liberal') {
                soundManager.policyLiberal();
            } else {
                soundManager.policyFascist();
                // Check if executive power was unlocked
                if (pubState.fascistPolicies >= 3) {
                    setTimeout(() => soundManager.executivePowerUnlock(), 800);
                }
            }
            break;

        case 'chaos':
            soundManager.chaos();
            break;

        case 'executive':
            // Play appropriate sound based on executive power
            soundManager.phaseTransition();
            if (pubState.executivePower === 'special-election') {
                setTimeout(() => soundManager.specialElection(), 200);
            } else if (pubState.executivePower === 'investigate') {
                setTimeout(() => soundManager.examineCards(), 200);
            } else if (pubState.executivePower === 'examine') {
                setTimeout(() => soundManager.examineCards(), 200);
            } else if (pubState.executivePower === 'execute') {
                // Ominous sound before execution choice
                setTimeout(() => soundManager.tensionBuild(), 200);
            }
            // Notify president it's their turn for executive action
            if (isMyTurn) {
                setTimeout(() => soundManager.yourTurn(), 400);
            }
            break;

        case 'execution-result':
            soundManager.execution();
            break;

        case 'gameover':
            if (pubState.winner === 'liberal') {
                soundManager.winLiberal();
            } else {
                // Check if fascists won by Hitler election
                if (pubState.winReason?.includes('Hitler') && pubState.winReason?.includes('Chancellor')) {
                    soundManager.hitlerElected();
                    setTimeout(() => soundManager.winFascist(), 1500);
                } else {
                    soundManager.winFascist();
                }
            }
            break;
    }
}

// Helper function to determine if it's the current player's turn
function checkIfMyTurn(phase, pubState, priv) {
    if (!priv) return false;

    switch (phase) {
        case 'election':
            return priv.isPresident;
        case 'legislative-president':
            return priv.isPresident;
        case 'legislative-chancellor':
            return priv.isChancellor;
        case 'executive':
            return priv.isPresident;
        default:
            return false;
    }
}

socket.on('investigationResult', ({ targetName, party }) => {
    soundManager.investigationReveal();
    showModal(`Investigation Result`, `${targetName}'s party membership is: <strong>${party.toUpperCase()}</strong>`);
});

socket.on('examineResult', ({ policies }) => {
    soundManager.examineCards();
    const policiesHtml = policies.map(p =>
        `<div class="policy-card ${p}">${p.toUpperCase()}</div>`
    ).join('');
    showModal('Top 3 Policies', `<div class="card-selection">${policiesHtml}</div>`, () => {
        socket.emit('continueFromExamine', gameState.roomCode);
    });
});

socket.on('error', ({ message }) => {
    showError(message);
    soundManager.error();
});

// Room functions
function createRoom() {
    const name = document.getElementById('player-name').value.trim();
    if (!name) {
        showError('Please enter your name');
        return;
    }
    socket.emit('createRoom', name);
}

function joinRoom() {
    const name = document.getElementById('player-name').value.trim();
    const code = document.getElementById('room-code').value.trim().toUpperCase();
    if (!name) {
        showError('Please enter your name');
        return;
    }
    if (!code || code.length !== 4) {
        showError('Please enter a valid room code');
        return;
    }
    socket.emit('joinRoom', { code, playerName: name });
}

function startGame() {
    socket.emit('startGame', gameState.roomCode);
}

function showRoomSection(code) {
    joinCreateSection.classList.add('hidden');
    roomSection.classList.remove('hidden');
    document.getElementById('display-room-code').textContent = code;
}

// Game actions
function nominateChancellor(chancellorId) {
    socket.emit('nominateChancellor', { code: gameState.roomCode, chancellorId });
    soundManager.playerSelect();
}

function castVote(vote) {
    socket.emit('vote', { code: gameState.roomCode, vote });
    document.getElementById('vote-buttons').classList.add('hidden');
    document.getElementById('vote-waiting').classList.remove('hidden');
    if (vote) {
        soundManager.voteYes();
    } else {
        soundManager.voteNo();
    }
}

function continueFromVote() {
    socket.emit('continueFromVote', gameState.roomCode);
}

function continueFromPolicy() {
    socket.emit('continueFromPolicy', gameState.roomCode);
}

function continueFromChaos() {
    socket.emit('continueFromChaos', gameState.roomCode);
}

function continueFromExecution() {
    socket.emit('continueFromExecution', gameState.roomCode);
}

// Track selected policies for president multi-select
let presidentSelectedIndices = [];

function presidentSelectPolicy(index) {
    const cards = document.querySelectorAll('#president-policies .policy-card');

    if (presidentSelectedIndices.includes(index)) {
        // Deselect
        presidentSelectedIndices = presidentSelectedIndices.filter(i => i !== index);
        cards[index].classList.remove('selected');
        soundManager.cardSelect();
    } else if (presidentSelectedIndices.length < 2) {
        // Select
        presidentSelectedIndices.push(index);
        cards[index].classList.add('selected');
        soundManager.cardSelect();

        // If 2 selected, submit
        if (presidentSelectedIndices.length === 2) {
            setTimeout(() => {
                socket.emit('presidentSelectPolicies', {
                    code: gameState.roomCode,
                    selectedIndices: presidentSelectedIndices
                });
                presidentSelectedIndices = [];
            }, 300); // Small delay for visual feedback
        }
    }
}

// Legacy function for backwards compatibility
function presidentDiscard(index) {
    socket.emit('presidentDiscard', { code: gameState.roomCode, discardIndex: index });
    soundManager.cardSelect();
}

function chancellorEnact(index) {
    socket.emit('chancellorEnact', { code: gameState.roomCode, enactIndex: index });
    soundManager.cardSelect();
}

function executePlayer(targetId) {
    socket.emit('execute', { code: gameState.roomCode, targetId });
    soundManager.playerSelect();
}

function investigatePlayer(targetId) {
    socket.emit('investigate', { code: gameState.roomCode, targetId });
    soundManager.playerSelect();
}

function specialElection(targetId) {
    socket.emit('specialElection', { code: gameState.roomCode, targetId });
    soundManager.specialElection();
}

function examineCards() {
    socket.emit('examine', gameState.roomCode);
    soundManager.cardFlip();
}

// Render functions
function renderGameState() {
    const { public: pub, private: priv } = gameState;
    if (!pub) return;

    // Lobby phase
    if (pub.phase === 'lobby') {
        renderLobby();
        return;
    }

    // Switch to game screen
    lobbyScreen.classList.remove('active');
    gameScreen.classList.add('active');

    // Update player info bar
    renderPlayerInfoBar();

    // Update board
    updatePolicyTracks();
    document.getElementById('deck-count').textContent = pub.deckCount;
    document.getElementById('election-tracker').textContent = pub.electionTracker;

    // Render current phase
    hideAllPhases();
    switch (pub.phase) {
        case 'election':
            renderElectionPhase();
            break;
        case 'voting':
            renderVotingPhase();
            break;
        case 'vote-result':
            renderVoteResultPhase();
            break;
        case 'legislative-president':
        case 'legislative-chancellor':
            renderLegislativePhase();
            break;
        case 'policy-result':
            renderPolicyResultPhase();
            break;
        case 'chaos':
            renderChaosPhase();
            break;
        case 'executive':
            renderExecutivePhase();
            break;
        case 'execution-result':
            renderExecutionResultPhase();
            break;
        case 'gameover':
            renderGameOverPhase();
            break;
    }
}

function renderLobby() {
    const pub = gameState.public;
    document.getElementById('player-count').textContent = pub.players.length;

    const container = document.getElementById('players-container');
    container.innerHTML = pub.players.map((p, i) => `
        <div class="lobby-player ${p.id === gameState.playerId ? 'you' : ''} ${p.isAI ? 'ai-player' : ''}">
            ${renderPlayerAvatar(p, 'medium')}
            <span class="player-name">${p.name}</span>
            ${i === 0 ? '<span class="host-badge">HOST</span>' : ''}
            ${p.id === gameState.playerId ? '<span class="you-badge">YOU</span>' : ''}
            ${p.isAI ? '<span class="ai-badge">CPU</span>' : ''}
        </div>
    `).join('');

    // Show/hide start button - can start with any number of players (AI will fill)
    const startBtn = document.getElementById('start-game-btn');
    const waitingMsg = document.getElementById('waiting-msg');
    if (gameState.isHost) {
        startBtn.classList.remove('hidden');
        const aiNeeded = Math.max(0, 4 - pub.players.length);
        if (aiNeeded > 0) {
            waitingMsg.textContent = `${aiNeeded} CPU player${aiNeeded > 1 ? 's' : ''} will be added to fill the game`;
        } else {
            waitingMsg.textContent = 'Ready to start!';
        }
        waitingMsg.classList.remove('hidden');
    } else {
        startBtn.classList.add('hidden');
        waitingMsg.textContent = 'Waiting for host to start...';
        waitingMsg.classList.remove('hidden');
    }
}

function renderPlayerInfoBar() {
    const priv = gameState.private;
    const pub = gameState.public;

    const myPlayer = pub.players.find(p => p.id === gameState.playerId);
    document.getElementById('your-name').innerHTML = myPlayer ? renderPlayerName(myPlayer) : '';

    const roleBadge = document.getElementById('your-role-badge');
    if (priv?.role) {
        roleBadge.textContent = priv.role.toUpperCase();
        roleBadge.className = `role-badge ${priv.role}`;
    }

    // Show teammates for fascists
    const teammatesDiv = document.getElementById('teammates-info');
    if (priv?.teammates && priv.teammates.length > 0) {
        teammatesDiv.innerHTML = `<span class="teammates-label">Team:</span> ` +
            priv.teammates.map(t => `<span class="${t.role}">${t.name} (${t.role})</span>`).join(', ');
    } else {
        teammatesDiv.innerHTML = '';
    }
}

function renderElectionPhase() {
    const pub = gameState.public;
    const priv = gameState.private;

    document.getElementById('election-phase').classList.remove('hidden');

    const president = pub.players.find(p => p.id === pub.currentPresidentId);
    const isPresident = priv?.isPresident;

    // Check for Hitler danger zone (3+ fascist policies)
    const hitlerDanger = AnimationHelper.isHitlerDangerZone(pub.fascistPolicies);
    const phaseContainer = document.getElementById('election-phase');

    // Add or remove danger zone class
    if (hitlerDanger) {
        phaseContainer.classList.add('hitler-danger-zone');
    } else {
        phaseContainer.classList.remove('hitler-danger-zone');
    }

    if (isPresident) {
        document.getElementById('election-title').textContent = 'You are the President!';
        document.getElementById('election-info').textContent = 'Select a Chancellor candidate:';

        const container = document.getElementById('chancellor-selection');
        container.innerHTML = pub.players
            .filter(p => p.isAlive && p.id !== pub.currentPresidentId)
            .map(p => {
                const isDisabled = p.id === pub.previousChancellorId ||
                    (pub.players.length > 5 && p.id === pub.previousPresidentId);
                return `
                    <div class="player-card ${isDisabled ? 'disabled' : ''}"
                         ${!isDisabled ? `onclick="nominateChancellor('${p.id}')"` : ''}>
                        ${renderPlayerAvatar(p, 'large')}
                        <h3>${p.name}</h3>
                        ${p.id === pub.previousChancellorId ? '<span class="player-badge">Prev. Chancellor</span>' : ''}
                        ${p.id === pub.previousPresidentId ? '<span class="player-badge">Prev. President</span>' : ''}
                    </div>
                `;
            }).join('');
    } else {
        document.getElementById('election-title').textContent = 'Presidential Election';
        document.getElementById('election-info').innerHTML = `${renderPlayerName(president)} is selecting a Chancellor...`;
        document.getElementById('chancellor-selection').innerHTML = `
            <div class="waiting-spinner"></div>
            <p style="margin-top: 20px; opacity: 0.7;">Waiting ${AnimationHelper.createWaitingDots()}</p>
        `;
    }
}

function renderVotingPhase() {
    const pub = gameState.public;
    document.getElementById('voting-phase').classList.remove('hidden');

    const president = pub.players.find(p => p.id === pub.currentPresidentId);
    const chancellor = pub.players.find(p => p.id === pub.chancellorCandidateId);

    // Check for Hitler danger - add extra tension
    const hitlerDanger = AnimationHelper.isHitlerDangerZone(pub.fascistPolicies);
    const votingArea = document.getElementById('voting-area');

    if (hitlerDanger) {
        votingArea.classList.add('heartbeat-pulse');
    } else {
        votingArea.classList.remove('heartbeat-pulse');
    }

    document.getElementById('vote-info').innerHTML = hitlerDanger
        ? `<span style="color: var(--blood-red);">DANGER ZONE!</span><br>President: ${renderPlayerName(president)} | Chancellor: ${renderPlayerName(chancellor)}`
        : `President: ${renderPlayerName(president)} | Chancellor: ${renderPlayerName(chancellor)}`;

    const myPlayer = pub.players.find(p => p.id === gameState.playerId);
    if (myPlayer?.hasVoted) {
        document.getElementById('vote-buttons').classList.add('hidden');
        document.getElementById('vote-waiting').classList.remove('hidden');
        document.getElementById('vote-waiting').innerHTML = `Waiting for other players ${AnimationHelper.createWaitingDots()}`;
    } else {
        document.getElementById('vote-buttons').classList.remove('hidden');
        document.getElementById('vote-waiting').classList.add('hidden');
    }
}

function renderVoteResultPhase() {
    const pub = gameState.public;
    document.getElementById('vote-result-phase').classList.remove('hidden');

    const yesVotes = pub.votes.filter(v => v.vote).length;
    const noVotes = pub.votes.filter(v => !v.vote).length;
    const passed = yesVotes > noVotes;

    // Screen flash based on result
    AnimationHelper.screenFlash(passed ? 'liberal' : 'fascist');

    document.getElementById('vote-result-title').textContent =
        passed ? 'Government Elected!' : 'Government Rejected!';

    document.getElementById('vote-results').innerHTML = `
        <div class="vote-results-grid">
            ${pub.votes.map(v => `
                <div class="vote-result ${v.vote ? 'vote-yes' : 'vote-no'}">
                    <span class="voter-info">${renderPlayerAvatar({avatar: v.avatar, avatarColor: v.avatarColor}, 'small')} ${v.playerName}</span>
                    <span class="vote-choice">${v.vote ? 'JA!' : 'NEIN!'}</span>
                </div>
            `).join('')}
        </div>
        <p class="vote-tally">Yes: ${yesVotes} | No: ${noVotes}</p>
    `;

    // Trigger staggered vote reveal animation
    setTimeout(() => {
        AnimationHelper.animateVoteResults();
    }, 100);
}

function renderLegislativePhase() {
    const pub = gameState.public;
    const priv = gameState.private;

    if (pub.phase === 'legislative-president') {
        if (priv?.isPresident && priv?.policies) {
            // Reset selection state
            presidentSelectedIndices = [];

            document.getElementById('legislative-president-phase').classList.remove('hidden');
            document.getElementById('legislative-president-info').textContent =
                'Select 2 policies to PASS to Chancellor:';

            document.getElementById('president-policies').innerHTML = priv.policies.map((p, i) => `
                <div class="policy-card ${p}" onclick="presidentSelectPolicy(${i})">
                    ${p.toUpperCase()}
                </div>
            `).join('');
        } else {
            document.getElementById('legislative-waiting-phase').classList.remove('hidden');
            const president = pub.players.find(p => p.id === pub.currentPresidentId);
            document.getElementById('legislative-waiting-info').innerHTML =
                `${renderPlayerName(president)} (President) is reviewing policies ${AnimationHelper.createWaitingDots()}`;
        }
    } else if (pub.phase === 'legislative-chancellor') {
        if (priv?.isChancellor && priv?.policies) {
            document.getElementById('legislative-chancellor-phase').classList.remove('hidden');
            document.getElementById('legislative-chancellor-info').textContent =
                'Choose a policy to ENACT:';

            document.getElementById('chancellor-policies').innerHTML = priv.policies.map((p, i) => `
                <div class="policy-card ${p}" onclick="chancellorEnact(${i})">
                    ${p.toUpperCase()}
                </div>
            `).join('');
        } else {
            document.getElementById('legislative-waiting-phase').classList.remove('hidden');
            const chancellor = pub.players.find(p => p.id === pub.currentChancellorId);
            document.getElementById('legislative-waiting-info').innerHTML =
                `${renderPlayerName(chancellor)} (Chancellor) is choosing a policy ${AnimationHelper.createWaitingDots()}`;
        }
    }
}

function renderPolicyResultPhase() {
    const pub = gameState.public;
    document.getElementById('policy-result-phase').classList.remove('hidden');

    const policy = pub.enactedPolicy;

    // Screen flash for enacted policy
    AnimationHelper.screenFlash(policy);

    document.getElementById('policy-result-title').textContent =
        `${policy?.toUpperCase()} Policy Enacted!`;

    // Check for near-win conditions for extra emphasis
    const liberalNearWin = pub.liberalPolicies >= 4;
    const fascistNearWin = pub.fascistPolicies >= 5;
    const extraClass = (liberalNearWin || fascistNearWin) ? 'final-policy-warning ' + policy : '';

    document.getElementById('policy-result-content').innerHTML = `
        <div class="policy-card large ${policy} ${extraClass}">${policy?.toUpperCase()}</div>
        <p>Liberal: ${pub.liberalPolicies}/5 | Fascist: ${pub.fascistPolicies}/6</p>
        ${liberalNearWin ? '<p class="tension-text" style="color: var(--liberal-light); margin-top: 15px;">Liberals are close to victory!</p>' : ''}
        ${fascistNearWin ? '<p class="tension-text" style="color: var(--blood-red); margin-top: 15px;">Fascists are close to victory!</p>' : ''}
    `;
}

function renderChaosPhase() {
    const pub = gameState.public;
    document.getElementById('chaos-phase').classList.remove('hidden');

    // Screen flash for chaos
    AnimationHelper.screenFlash('gold');

    document.getElementById('chaos-content').innerHTML = `
        <p style="font-size: 1.2em; margin-bottom: 20px;">Three failed governments in a row!</p>
        <p>The top policy was automatically enacted:</p>
        <div class="policy-card large ${pub.chaosPolicy}" style="animation: shake 0.5s ease-in-out;">${pub.chaosPolicy?.toUpperCase()}</div>
        <p style="margin-top: 20px; font-size: 0.9em; opacity: 0.8;">The election tracker has been reset.</p>
    `;
}

function renderExecutivePhase() {
    const pub = gameState.public;
    const priv = gameState.private;

    document.getElementById('executive-phase').classList.remove('hidden');

    const isPresident = priv?.isPresident;
    const power = pub.executivePower;

    if (!isPresident) {
        const president = pub.players.find(p => p.id === pub.currentPresidentId);

        if (power === 'execute') {
            // Show dramatic waiting screen for execution
            document.getElementById('executive-info').innerHTML = `
                <div class="execution-waiting">
                    <div class="execution-icon pulse">💀</div>
                    <div class="execution-waiting-title">EXECUTION IN PROGRESS</div>
                    <div class="execution-waiting-text">${renderPlayerName(president)} is choosing someone to execute...</div>
                </div>
            `;
            document.getElementById('executive-action').innerHTML = `
                <div class="execution-waiting-warning">
                    ⚠️ A player will be eliminated from the game
                </div>
            `;
        } else {
            document.getElementById('executive-info').innerHTML =
                `${renderPlayerName(president)} is using their presidential power ${AnimationHelper.createWaitingDots()}`;
            document.getElementById('executive-action').innerHTML = '<div class="waiting-spinner"></div>';
        }
        return;
    }

    switch (power) {
        case 'investigate':
            document.getElementById('executive-info').textContent = 'Investigate a player\'s loyalty:';
            document.getElementById('executive-action').innerHTML = pub.players
                .filter(p => p.isAlive && p.id !== gameState.playerId)
                .map(p => `
                    <div class="player-card" onclick="investigatePlayer('${p.id}')">
                        ${renderPlayerAvatar(p, 'large')}
                        <h3>${p.name}</h3>
                    </div>
                `).join('');
            break;

        case 'examine':
            document.getElementById('executive-info').textContent = 'Examine the top 3 policy cards:';
            document.getElementById('executive-action').innerHTML = `
                <button class="btn btn-primary" onclick="examineCards()">Examine Cards</button>
            `;
            break;

        case 'special-election':
            document.getElementById('executive-info').textContent = 'Choose the next President:';
            document.getElementById('executive-action').innerHTML = pub.players
                .filter(p => p.isAlive && p.id !== gameState.playerId)
                .map(p => `
                    <div class="player-card" onclick="specialElection('${p.id}')">
                        ${renderPlayerAvatar(p, 'large')}
                        <h3>${p.name}</h3>
                    </div>
                `).join('');
            break;

        case 'execute':
            document.getElementById('executive-info').innerHTML = `
                <div class="execution-warning">
                    <div class="execution-icon">💀</div>
                    <div class="execution-title">EXECUTION ORDER</div>
                    <div class="execution-subtitle">As President, you must choose a player to execute.<br>This decision is permanent. Choose wisely.</div>
                </div>
            `;
            document.getElementById('executive-action').innerHTML = `
                <div class="execution-targets">
                    ${pub.players
                        .filter(p => p.isAlive && p.id !== gameState.playerId)
                        .map(p => `
                            <div class="player-card execute-target" onclick="executePlayer('${p.id}')">
                                ${renderPlayerAvatar(p, 'large')}
                                <h3>${p.name}</h3>
                                <span class="execute-label">☠️ EXECUTE</span>
                            </div>
                        `).join('')}
                </div>
            `;
            break;
    }
}

function renderExecutionResultPhase() {
    const pub = gameState.public;
    document.getElementById('execution-result-phase').classList.remove('hidden');

    // Dramatic screen flash for execution
    AnimationHelper.screenFlash('fascist');

    const executedPlayer = pub.executedPlayer;
    const wasHitler = executedPlayer?.role === 'hitler';
    const roleClass = executedPlayer?.role || '';
    const roleName = executedPlayer?.role?.toUpperCase() || 'UNKNOWN';

    document.getElementById('execution-content').innerHTML = `
        <div class="execution-result-display">
            <div class="execution-skull">💀</div>
            <div class="execution-result-title">EXECUTED</div>
            <div class="execution-victim">
                ${executedPlayer ? renderPlayerAvatar(executedPlayer, 'large') : ''}
                <div class="execution-victim-name">${executedPlayer?.name || 'Unknown'}</div>
            </div>
            <div class="execution-role-reveal">
                <span class="role-was">Their role was</span>
                <span class="revealed-role ${roleClass}">${roleName}</span>
            </div>
            ${wasHitler ? `
                <div class="hitler-killed">
                    🎉 HITLER HAS BEEN KILLED! 🎉
                    <div class="liberals-win-soon">Liberals Win!</div>
                </div>
            ` : ''}
        </div>
    `;
}

function renderGameOverPhase() {
    const pub = gameState.public;
    document.getElementById('gameover-phase').classList.remove('hidden');

    document.getElementById('winner-title').textContent =
        `${pub.winner?.toUpperCase()}S WIN!`;
    document.getElementById('win-reason').textContent = pub.winReason;

    document.getElementById('all-roles').innerHTML = pub.players.map((p, i) => `
        <div class="final-role-card ${p.role || ''}" style="animation-delay: ${i * 0.2}s;">
            ${renderPlayerAvatar(p, 'large')}
            <h3>${p.name}</h3>
            <p class="${p.role}">${p.role?.toUpperCase() || 'Unknown'}</p>
            ${!p.isAlive ? '<span class="executed-badge">EXECUTED</span>' : ''}
        </div>
    `).join('');

    // Trigger game over animations
    setTimeout(() => {
        AnimationHelper.animateGameOver(pub.winner);
    }, 100);

    // Confetti
    createConfetti(pub.winner);
}

function hideAllPhases() {
    document.querySelectorAll('.phase').forEach(p => p.classList.add('hidden'));
}

function updatePolicyTracks() {
    const pub = gameState.public;

    // Liberal track
    const liberalSlots = document.querySelectorAll('#liberal-slots .policy-slot');
    liberalSlots.forEach((slot, i) => {
        slot.classList.toggle('enacted', i < pub.liberalPolicies);
        // Add warning glow to next slot when near win
        slot.classList.remove('final-policy-warning', 'liberal');
        if (pub.liberalPolicies >= 4 && i === pub.liberalPolicies) {
            slot.classList.add('final-policy-warning', 'liberal');
        }
    });

    // Fascist track
    const fascistSlots = document.querySelectorAll('#fascist-slots .policy-slot');
    fascistSlots.forEach((slot, i) => {
        slot.classList.toggle('enacted', i < pub.fascistPolicies);
        // Add warning glow to next slot when near win
        slot.classList.remove('final-policy-warning', 'fascist');
        if (pub.fascistPolicies >= 5 && i === pub.fascistPolicies) {
            slot.classList.add('final-policy-warning', 'fascist');
        }
    });

    // Update election tracker danger state
    AnimationHelper.updateElectionTrackerDanger(pub.electionTracker);
}

// UI Helpers
function showError(message) {
    const toast = document.getElementById('error-toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showModal(title, content, onClose) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${title}</h2>
            <div class="modal-body">${content}</div>
            <button class="btn btn-primary modal-close">OK</button>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
        if (onClose) onClose();
    });
}

// 1945 Wartime Background Animation
function createWartimeBackground() {
    const container = document.getElementById('bubbles');

    // Create searchlights
    createSearchlights(container);

    // Create initial falling documents
    for (let i = 0; i < 5; i++) {
        setTimeout(() => createDocument(container), i * 1000);
    }

    // Create iron cross watermarks
    createIronCrosses(container);

    // Create artillery flash overlay
    createArtilleryFlash(container);

    // Continue creating documents periodically
    setInterval(() => {
        if (document.querySelectorAll('.document').length < 8) {
            createDocument(container);
        }
    }, 3000);
}

function createSearchlights(container) {
    // Create 2-3 searchlight beams
    const positions = [15, 50, 85];
    positions.forEach((pos, index) => {
        const searchlight = document.createElement('div');
        searchlight.className = 'searchlight';
        searchlight.style.left = `${pos}%`;
        searchlight.style.animationDuration = `${8 + index * 3}s`;
        searchlight.style.animationDelay = `${index * 2}s`;
        container.appendChild(searchlight);
    });
}

function createDocument(container) {
    const doc = document.createElement('div');
    doc.className = 'document';

    // Random size for documents
    const width = Math.random() * 40 + 30;
    const height = width * 1.4;
    doc.style.width = `${width}px`;
    doc.style.height = `${height}px`;
    doc.style.left = `${Math.random() * 100}%`;

    // Random animation timing
    const duration = Math.random() * 15 + 12;
    doc.style.animationDuration = `${duration}s`;
    doc.style.animationDelay = `${Math.random() * 2}s`;

    container.appendChild(doc);

    // Remove after animation completes
    setTimeout(() => doc.remove(), (duration + 2) * 1000);
}

function createIronCrosses(container) {
    // Create a few subtle iron cross watermarks
    const positions = [
        { x: 10, y: 20, size: 80 },
        { x: 80, y: 60, size: 100 },
        { x: 50, y: 85, size: 60 }
    ];

    positions.forEach((pos, index) => {
        const cross = document.createElement('div');
        cross.className = 'iron-cross';
        cross.style.left = `${pos.x}%`;
        cross.style.top = `${pos.y}%`;
        cross.style.width = `${pos.size}px`;
        cross.style.height = `${pos.size}px`;
        cross.style.animationDelay = `${index * 5}s`;
        container.appendChild(cross);
    });
}

function createArtilleryFlash(container) {
    const flash = document.createElement('div');
    flash.className = 'artillery-flash';

    // Randomize flash position periodically
    setInterval(() => {
        flash.style.setProperty('--flash-x', `${Math.random() * 100}%`);
        flash.style.setProperty('--flash-y', `${Math.random() * 30}%`);
    }, 8000);

    container.appendChild(flash);
}

// Legacy alias for backward compatibility
function createBubbles() {
    createWartimeBackground();
}

// Confetti
function createConfetti(winner) {
    const colors = winner === 'liberal'
        ? ['#1e3a5f', '#2d4a6f', '#d4c5a9', '#b5a642', '#c9a227']
        : ['#8b0000', '#a31621', '#c9a227', '#d4af37', '#1a1a1a'];

    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 4000);
        }, i * 30);
    }
}

// Help modal
function setupHelpModal() {
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const closeBtn = document.getElementById('close-modal');

    helpBtn.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
        soundManager.buttonClick();
    });
    closeBtn.addEventListener('click', () => {
        helpModal.classList.add('hidden');
        soundManager.buttonClick();
    });
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal.classList.add('hidden');
    });
}

// Sound controls
function setupSoundControls() {
    const musicBtn = document.getElementById('music-btn');
    const sfxBtn = document.getElementById('sfx-btn');
    const musicSlider = document.getElementById('music-volume');
    const sfxSlider = document.getElementById('sfx-volume');

    if (musicBtn) {
        musicBtn.addEventListener('click', () => {
            const enabled = soundManager.toggleMusic();
            musicBtn.textContent = enabled ? '♪' : '♪̸';
            musicBtn.classList.toggle('muted', !enabled);
            soundManager.buttonClick();
        });
    }

    if (sfxBtn) {
        sfxBtn.addEventListener('click', () => {
            const enabled = soundManager.toggleSfx();
            sfxBtn.textContent = enabled ? '🔊' : '🔇';
            sfxBtn.classList.toggle('muted', !enabled);
            if (enabled) soundManager.buttonClick();
        });
    }

    if (musicSlider) {
        musicSlider.addEventListener('input', (e) => {
            soundManager.setMusicVolume(parseFloat(e.target.value));
        });
    }

    if (sfxSlider) {
        sfxSlider.addEventListener('input', (e) => {
            soundManager.setSfxVolume(parseFloat(e.target.value));
        });
    }

    // Add sounds to all buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', () => {
            soundManager.buttonClick();
        });
    });
}
