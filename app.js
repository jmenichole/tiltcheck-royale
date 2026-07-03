/**
 * Tiltcheck Royale — Live Spectator (bot-driven CRT view)
 */

const CFG = window.APP_CONFIG || {};

const Synth = {
    ctx: null,
    enabled: true,

    init() {
        if (this.ctx) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new Ctx();
        } catch (_) {}
    },

    beep(freq = 800, duration = 0.05, type = 'triangle') {
        if (!this.enabled || !this.ctx) return;
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    death() {
        this.beep(300, 0.35, 'sawtooth');
    },

    victory() {
        [261.63, 329.63, 392, 523.25].forEach((f, i) => {
            setTimeout(() => this.beep(f, 0.2), i * 100);
        });
    },

    boot() {
        this.beep(440, 0.1, 'square');
        setTimeout(() => this.beep(880, 0.15, 'square'), 120);
    },
};

const Spectator = {
    channelId: null,
    socket: null,
    party: [],
    day: 0,
    distance: 0,
    rations: 0,
    weather: 'Fair',
    phase: 'connecting',
    reconnectTimer: null,

  els: {},

    async init() {
        this.cacheElements();
        this.bindThemeControls();
        await this.runBios();
        await this.resolveChannelId();
        await this.tryDiscordAuth();
        this.connect();
    },

    cacheElements() {
        const ids = [
            'biosScreen', 'waitingScreen', 'errorScreen', 'lobbyScreen', 'gameScreen', 'endScreen',
            'biosText', 'waitingMessage', 'errorMessage', 'lobbyCountdown', 'lobbyRoster',
            'terminalLog', 'rosterList', 'hudDay', 'hudDistance', 'hudRations', 'hudWeather', 'hudAlive',
            'endContent', 'trailScroller',
        ];
        ids.forEach((id) => { this.els[id] = document.getElementById(id); });
    },

    bindThemeControls() {
        ['Green', 'Amber', 'Cyber', 'Vga'].forEach((t) => {
            document.getElementById(`btnTheme${t}`)?.addEventListener('click', (e) => {
                const screen = document.getElementById('crtScreen');
                screen.className = 'crt-screen';
                screen.classList.add(`theme-${t.toLowerCase()}`);
                document.querySelectorAll('.bezel-theme-toggles .theme-btn').forEach((b) => b.classList.remove('active'));
                e.target.classList.add('active');
                Synth.beep(900, 0.04, 'square');
            });
        });

        document.getElementById('powerBtn')?.addEventListener('click', () => {
            const screen = document.getElementById('crtScreen');
            const led = document.getElementById('powerLed');
            if (screen.classList.contains('power-off')) {
                screen.classList.remove('power-off');
                screen.classList.add('power-on');
                led.classList.add('LED-on');
                Synth.boot();
                this.connect();
            } else {
                screen.classList.remove('power-on');
                screen.classList.add('power-off');
                led.classList.remove('LED-on');
                this.disconnect();
                Synth.beep(150, 0.3, 'sawtooth');
            }
        });
    },

    async runBios() {
        const lines = [
            'TILTCHECK ROYALE SPECTATOR V1.0',
            'Copyright (C) 2026 Tiltcheck Royale',
            '--------------------------------------------',
            'Initializing wagon telemetry receiver...',
            'Parody work — not affiliated with Oregon Trail',
            'Linking Discord channel context...',
        ];
        const el = this.els.biosText;
        for (const line of lines) {
            el.textContent += `${line}\n`;
            Synth.beep(800 + Math.random() * 200, 0.01);
            await new Promise((r) => setTimeout(r, 120));
        }
        Synth.boot();
        await new Promise((r) => setTimeout(r, 400));
    },

    async resolveChannelId() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('channelId')) {
            this.channelId = params.get('channelId');
            return;
        }

        if (typeof window.discordSdk !== 'undefined') {
            try {
                const sdk = new window.discordSdk.DiscordSDK(CFG.DISCORD_CLIENT_ID);
                await sdk.ready();
                const channelId = await sdk.commands.getChannelId();
                if (channelId) this.channelId = String(channelId);
            } catch (e) {
                console.warn('Discord channel context unavailable:', e);
            }
        }
    },

    async tryDiscordAuth() {
        if (typeof window.discordSdk === 'undefined' || !CFG.API_URL) return;
        try {
            const sdk = new window.discordSdk.DiscordSDK(CFG.DISCORD_CLIENT_ID);
            await sdk.ready();
            const { code } = await sdk.commands.authorize({
                client_id: CFG.DISCORD_CLIENT_ID,
                response_type: 'code',
                state: '',
                prompt: 'none',
                scope: ['identify'],
            });
            const res = await fetch(`${CFG.API_URL}/api/auth/discord`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            if (res.ok) {
                const { user } = await res.json();
                console.log(`Spectator linked: ${user.username}`);
            }
        } catch (e) {
            console.warn('Discord auth skipped:', e);
        }
    },

    connect() {
        if (!this.channelId) {
            this.showError('No channel ID. Open from Discord via "Open Retro View" or add ?channelId= to the URL.');
            return;
        }

        const wsUrl = CFG.WS_URL || `ws://localhost:8080`;
        this.disconnect();

        try {
            this.socket = new WebSocket(wsUrl);
        } catch (e) {
            this.showError(`WebSocket failed: ${e.message}`);
            return;
        }

        this.socket.onopen = () => {
            this.socket.send(JSON.stringify({ type: 'subscribe', channelId: this.channelId }));
        };

        this.socket.onmessage = (ev) => {
            let data;
            try { data = JSON.parse(ev.data); } catch { return; }
            this.handleMessage(data);
        };

        this.socket.onclose = () => {
            if (this.phase !== 'ended') {
                this.showScreen('waiting');
                this.scheduleReconnect();
            }
        };

        this.socket.onerror = () => {
            this.showError('Cannot reach bot server. Check WS_URL in config.js and that the bot is running.');
        };
    },

    disconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.socket) {
            this.socket.onclose = null;
            this.socket.close();
            this.socket = null;
        }
    },

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 5000);
    },

    handleMessage(data) {
        switch (data.type) {
            case 'waiting':
                this.showScreen('waiting');
                if (data.message) this.els.waitingMessage.innerHTML = `<p>${data.message}</p>`;
                break;
            case 'error':
                this.showError(data.message || 'Unknown error');
                break;
            case 'snapshot':
            case 'lobby_update':
                this.applyLobbyState(data);
                break;
            case 'game_start':
                this.party = data.party || [];
                this.phase = 'running';
                this.showScreen('game');
                this.log('Wagon departed! The battle for Oregon begins.', 'day');
                this.renderRoster();
                this.updateHud();
                Synth.boot();
                break;
            case 'day_update':
                this.applyDayUpdate(data);
                break;
            case 'game_end':
                this.applyEnd(data);
                break;
            default:
                break;
        }
    },

    applyLobbyState(data) {
        this.party = data.party || [];
        this.phase = data.phase || 'lobby';
        if (this.phase === 'lobby') {
            this.showScreen('lobby');
            const sec = data.secondsLeft ?? '?';
            this.els.lobbyCountdown.textContent = `Departing in ${sec} seconds...`;
            this.els.lobbyRoster.innerHTML = this.party
                .map((c) => `<li>${c.displayName || c.name} [${c.profession}]</li>`)
                .join('') || '<li><em>No pioneers yet</em></li>';
        } else if (this.phase === 'running') {
            this.showScreen('game');
            this.party = data.party || this.party;
            this.day = data.day || 0;
            this.distance = data.distance || 0;
            this.rations = data.rations || 0;
            this.weather = data.weather || 'Fair';
            this.renderRoster();
            this.updateHud();
        }
    },

    applyDayUpdate(data) {
        this.phase = 'running';
        this.showScreen('game');
        this.party = data.party || [];
        this.day = data.day || 0;
        this.distance = data.distance || 0;
        this.rations = data.rations || 0;
        this.weather = data.weather || 'Fair';

        const events = data.events || [];
        const hadDeath = events.some((e) => e.type === 'death');
        events.filter((e) => e.type !== 'day').forEach((e) => this.log(e.text, e.type));

        this.renderRoster();
        this.updateHud();
        if (hadDeath) Synth.death();
        else Synth.beep(500, 0.03);
    },

    applyEnd(data) {
        this.phase = 'ended';
        this.disconnect();
        this.showScreen('end');
        const text = data.result?.text || 'The trail has gone quiet.';
        this.els.endContent.innerHTML = `<p class="highlight">${text}</p>`;
        Synth.victory();
    },

    showScreen(name) {
        ['bios', 'waiting', 'error', 'lobby', 'game', 'end'].forEach((s) => {
            const el = this.els[`${s}Screen`];
            if (el) el.classList.toggle('hidden', s !== name);
        });
    },

    showError(msg) {
        this.els.errorMessage.textContent = msg;
        this.showScreen('error');
    },

    log(msg, type = 'passive') {
        const entry = document.createElement('p');
        entry.className = `log-entry log-${type}`;
        const prefix = type !== 'day' && this.day ? `<span class="log-day">[Day ${this.day}]</span> ` : '';
        entry.innerHTML = `${prefix}${msg}`;
        this.els.terminalLog.appendChild(entry);
        this.els.terminalLog.scrollTop = this.els.terminalLog.scrollHeight;
    },

    updateHud() {
        const alive = this.party.filter((c) => c.alive !== false && (c.hp === undefined || c.hp > 0));
        this.els.hudDay.textContent = this.day;
        this.els.hudDistance.textContent = this.distance;
        this.els.hudRations.textContent = Math.max(0, this.rations);
        this.els.hudWeather.textContent = this.weather;
        this.els.hudAlive.textContent = `${alive.length}/${this.party.length}`;
    },

    renderRoster() {
        this.els.rosterList.innerHTML = '';
        this.party.forEach((c) => {
            const dead = c.alive === false || c.hp <= 0;
            const hp = c.hp ?? c.maxHp ?? 100;
            const maxHp = c.maxHp ?? 100;
            const pct = dead ? 0 : Math.max(0, Math.floor((hp / maxHp) * 100));
            let hpClass = 'health-good';
            if (pct < 30) hpClass = 'health-danger';
            else if (pct < 60) hpClass = 'health-warning';

            const card = document.createElement('div');
            card.className = `traveler-card ${dead ? 'dead' : ''}`;
            card.innerHTML = `
                <div class="traveler-info">
                    <span class="traveler-name">${c.displayName || c.name}</span>
                    <span class="traveler-stats">${dead ? 'DIED' : `${hp}/${maxHp} HP`}</span>
                </div>
                <div class="health-container ${hpClass}">
                    <div class="health-bar" style="width:${pct}%"></div>
                </div>
                <div class="traveler-meta">
                    <span class="traveler-inventory">🎒 ${(c.items || []).join(', ') || 'EMPTY'}</span>
                    ${c.kills ? `<span class="tag-disease" style="background:#ff2222;color:#fff;">💀 ${c.kills}</span>` : ''}
                </div>`;
            this.els.rosterList.appendChild(card);
        });
    },
};

window.addEventListener('DOMContentLoaded', () => Spectator.init());
