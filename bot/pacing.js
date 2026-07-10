/**
 * Match pacing — phases, highlight filtering, quiet buffer.
 */

const TICK_MS = 3000;
const QUIET_FLUSH_DAYS = 4;
const PHASE_MILES = { killzone: 300, final: 700 };

const DEFAULT_PHASE_FLAVORS = {
    departure: 'The trail opens. Disease and distance await.',
    killzone: 'The trail narrows. Trust breaks.',
    final: 'No escape. Only one wagon reaches the end.',
};

function getPhase(distance) {
    if (distance >= PHASE_MILES.final) return 'final';
    if (distance >= PHASE_MILES.killzone) return 'killzone';
    return 'departure';
}

function getPhaseMultipliers(phase) {
    switch (phase) {
        case 'killzone':
            return { combat: 2.0, disease: 1.25, miles: 1.0 };
        case 'final':
            return { combat: 2.5, disease: 1.25, miles: 1.5, forceCombat: true };
        default:
            return { combat: 1.0, disease: 1.0, miles: 1.0, forceCombat: false };
    }
}

function classifyEventSeverity(event) {
    if (!event?.type) return 'routine';
    if (event.type === 'death') return 'notable';
    if (event.type === 'combat') return 'notable';
    if (event.notable === true) return 'notable';
    if (event.type === 'disease' && event.firstInfection) return 'notable';
    if (event.type === 'item' && event.rareLoot) return 'notable';
    if (event.type === 'day' && event.landmark) return 'notable';
    if (event.type === 'day' && event.river) return 'notable';
    return 'routine';
}

function isNotableEvent(event) {
    return classifyEventSeverity(event) === 'notable';
}

function createQuietBuffer(day, mi, aliveCount) {
    return {
        startDay: day,
        startMi: mi,
        endDay: day,
        endMi: mi,
        aliveMin: aliveCount,
        aliveMax: aliveCount,
        weatherNotes: [],
    };
}

function extendQuietBuffer(buffer, day, mi, aliveCount, weather) {
    buffer.endDay = day;
    buffer.endMi = mi;
    buffer.aliveMin = Math.min(buffer.aliveMin, aliveCount);
    buffer.aliveMax = Math.max(buffer.aliveMax, aliveCount);
    if (weather && !buffer.weatherNotes.includes(weather)) {
        buffer.weatherNotes.push(weather);
    }
    return buffer;
}

function quietBufferDaySpan(buffer) {
    return buffer.endDay - buffer.startDay + 1;
}

function formatQuietSummary(buffer, totalParty) {
    const dayRange = buffer.startDay === buffer.endDay
        ? `Day ${buffer.startDay}`
        : `Days ${buffer.startDay}–${buffer.endDay}`;
    const miRange = `${buffer.startMi}→${buffer.endMi} mi`;
    const weather = buffer.weatherNotes.length ? buffer.weatherNotes[buffer.weatherNotes.length - 1] : 'Fair';
    const alive = buffer.aliveMin === buffer.aliveMax
        ? `${buffer.aliveMax}/${totalParty} alive`
        : `${buffer.aliveMin}–${buffer.aliveMax}/${totalParty} alive`;
    return `⏩ ${dayRange} · ${miRange} · ${weather} · ${alive} · The trail grinds on.`;
}

function getPhaseFlavor(pack, phase) {
    return pack?.phaseFlavors?.[phase] || DEFAULT_PHASE_FLAVORS[phase] || '';
}

module.exports = {
    TICK_MS,
    QUIET_FLUSH_DAYS,
    PHASE_MILES,
    getPhase,
    getPhaseMultipliers,
    classifyEventSeverity,
    isNotableEvent,
    createQuietBuffer,
    extendQuietBuffer,
    quietBufferDaySpan,
    formatQuietSummary,
    getPhaseFlavor,
};
