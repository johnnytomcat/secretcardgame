const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game rooms storage
const rooms = new Map();

// Role configurations based on player count
const roleConfigurations = {
    4: { liberals: 2, fascists: 1, hitler: 1 },
    5: { liberals: 3, fascists: 1, hitler: 1 },
    6: { liberals: 4, fascists: 1, hitler: 1 }
};

// AI Player names
const AI_NAMES = [
    'Otto', 'Heinrich', 'Wilhelm', 'Friedrich', 'Karl',
    'Hans', 'Klaus', 'Ernst', 'Ludwig', 'Werner'
];

// AI decision delay (ms) for more natural feel
const AI_DELAY_MIN = 1500;
const AI_DELAY_MAX = 3500;

function getAIDelay() {
    return Math.floor(Math.random() * (AI_DELAY_MAX - AI_DELAY_MIN)) + AI_DELAY_MIN;
}

// Utility functions
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function createRoom(hostId, hostName) {
    let code;
    do {
        code = generateRoomCode();
    } while (rooms.has(code));

    const room = {
        code,
        hostId,
        players: [{
            id: hostId,
            name: hostName,
            role: null,
            isAlive: true,
            hasVoted: false,
            vote: null
        }],
        gameState: {
            phase: 'lobby', // lobby, roles, election, voting, legislative, executive, results, gameover
            currentPresidentIndex: 0,
            chancellorCandidateId: null,
            currentChancellorId: null,
            previousPresidentId: null,
            previousChancellorId: null,
            liberalPolicies: 0,
            fascistPolicies: 0,
            electionTracker: 0,
            policyDeck: [],
            discardPile: [],
            currentPolicies: [],
            specialElectionNextIndex: null, // Stores normal rotation index after special election
            votes: [],
            executivePower: null,
            winner: null,
            winReason: null
        }
    };

    rooms.set(code, room);
    return room;
}

function getRoom(code) {
    return rooms.get(code);
}

function getPlayerInRoom(room, playerId) {
    return room.players.find(p => p.id === playerId);
}

function assignRoles(room) {
    const playerCount = room.players.length;
    const config = roleConfigurations[playerCount];
    const roles = [];

    for (let i = 0; i < config.liberals; i++) roles.push('liberal');
    for (let i = 0; i < config.fascists; i++) roles.push('fascist');
    roles.push('hitler');

    const shuffledRoles = shuffleArray(roles);
    room.players.forEach((player, index) => {
        player.role = shuffledRoles[index];
    });
}

function initializeDeck(room) {
    room.gameState.policyDeck = [];
    for (let i = 0; i < 6; i++) room.gameState.policyDeck.push('liberal');
    for (let i = 0; i < 11; i++) room.gameState.policyDeck.push('fascist');
    room.gameState.policyDeck = shuffleArray(room.gameState.policyDeck);
    room.gameState.discardPile = [];
}

function drawPolicies(room, count) {
    const policies = [];
    for (let i = 0; i < count; i++) {
        if (room.gameState.policyDeck.length === 0) {
            room.gameState.policyDeck = shuffleArray([...room.gameState.discardPile]);
            room.gameState.discardPile = [];
        }
        policies.push(room.gameState.policyDeck.pop());
    }
    return policies;
}

function getExecutivePower(fascistCount, playerCount) {
    const powers = {
        4: { 3: 'examine', 4: 'execute', 5: 'execute' },
        5: { 3: 'examine', 4: 'execute', 5: 'execute' },
        6: { 3: 'investigate', 4: 'special-election', 5: 'execute' }
    };
    return powers[playerCount]?.[fascistCount] || null;
}

function getPublicGameState(room) {
    return {
        phase: room.gameState.phase,
        currentPresidentIndex: room.gameState.currentPresidentIndex,
        currentPresidentId: room.players[room.gameState.currentPresidentIndex]?.id,
        chancellorCandidateId: room.gameState.chancellorCandidateId,
        currentChancellorId: room.gameState.currentChancellorId,
        previousPresidentId: room.gameState.previousPresidentId,
        previousChancellorId: room.gameState.previousChancellorId,
        liberalPolicies: room.gameState.liberalPolicies,
        fascistPolicies: room.gameState.fascistPolicies,
        electionTracker: room.gameState.electionTracker,
        deckCount: room.gameState.policyDeck.length,
        executivePower: room.gameState.executivePower,
        enactedPolicy: room.gameState.enactedPolicy,
        chaosPolicy: room.gameState.chaosPolicy,
        executedPlayer: room.gameState.executedPlayer,
        winner: room.gameState.winner,
        winReason: room.gameState.winReason,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            isAlive: p.isAlive,
            hasVoted: p.hasVoted,
            isAI: p.isAI || false
        })),
        votes: room.gameState.votes,
        policyCount: room.gameState.currentPolicies?.length || 0
    };
}

function getPrivatePlayerState(room, playerId) {
    const player = getPlayerInRoom(room, playerId);
    if (!player) return null;

    const state = {
        role: player.role,
        isPresident: room.players[room.gameState.currentPresidentIndex]?.id === playerId,
        isChancellor: room.gameState.currentChancellorId === playerId,
        policies: null,
        teammates: null
    };

    // Show policies to president/chancellor during legislative phase
    if (room.gameState.phase === 'legislative-president' && state.isPresident) {
        state.policies = room.gameState.currentPolicies;
    }
    if (room.gameState.phase === 'legislative-chancellor' && state.isChancellor) {
        state.policies = room.gameState.currentPolicies;
    }

    // Show teammates to fascists
    if (player.role === 'fascist' || player.role === 'hitler') {
        const teammates = room.players.filter(p =>
            p.id !== playerId && (p.role === 'fascist' || p.role === 'hitler')
        );
        state.teammates = teammates.map(t => ({
            id: t.id,
            name: t.name,
            role: t.role
        }));
    }

    return state;
}

function broadcastGameState(room) {
    const publicState = getPublicGameState(room);
    room.players.forEach(player => {
        const privateState = getPrivatePlayerState(room, player.id);
        io.to(player.id).emit('gameState', { public: publicState, private: privateState });
    });
}

function advancePresidency(room) {
    room.gameState.previousPresidentId = room.players[room.gameState.currentPresidentIndex]?.id;
    room.gameState.previousChancellorId = room.gameState.currentChancellorId;

    // Check if we're resuming from a special election
    if (room.gameState.specialElectionNextIndex !== null) {
        room.gameState.currentPresidentIndex = room.gameState.specialElectionNextIndex;
        room.gameState.specialElectionNextIndex = null;
        // Ensure this player is alive, otherwise advance normally
        if (!room.players[room.gameState.currentPresidentIndex].isAlive) {
            do {
                room.gameState.currentPresidentIndex = (room.gameState.currentPresidentIndex + 1) % room.players.length;
            } while (!room.players[room.gameState.currentPresidentIndex].isAlive);
        }
    } else {
        do {
            room.gameState.currentPresidentIndex = (room.gameState.currentPresidentIndex + 1) % room.players.length;
        } while (!room.players[room.gameState.currentPresidentIndex].isAlive);
    }

    room.gameState.currentChancellorId = null;
    room.gameState.chancellorCandidateId = null;
}

function checkWinCondition(room) {
    // Liberal policy win
    if (room.gameState.liberalPolicies >= 5) {
        room.gameState.winner = 'liberal';
        room.gameState.winReason = '5 Liberal policies enacted!';
        room.gameState.phase = 'gameover';
        return true;
    }

    // Fascist policy win
    if (room.gameState.fascistPolicies >= 6) {
        room.gameState.winner = 'fascist';
        room.gameState.winReason = '6 Fascist policies enacted!';
        room.gameState.phase = 'gameover';
        return true;
    }

    // Hitler executed
    const hitler = room.players.find(p => p.role === 'hitler');
    if (hitler && !hitler.isAlive) {
        room.gameState.winner = 'liberal';
        room.gameState.winReason = 'Hitler was assassinated!';
        room.gameState.phase = 'gameover';
        return true;
    }

    return false;
}

// ==================== AI PLAYER SYSTEM ====================

function generateAIPlayerId() {
    return 'AI_' + Math.random().toString(36).substr(2, 9);
}

function addAIPlayers(room, targetCount) {
    const usedNames = room.players.map(p => p.name);
    const availableNames = shuffleArray(AI_NAMES.filter(n => !usedNames.includes(n)));

    while (room.players.length < targetCount && availableNames.length > 0) {
        const aiName = availableNames.pop();
        room.players.push({
            id: generateAIPlayerId(),
            name: aiName + ' (CPU)',
            role: null,
            isAlive: true,
            hasVoted: false,
            vote: null,
            isAI: true
        });
    }
}

function isAIPlayer(player) {
    return player && player.isAI === true;
}

function getAIPlayers(room) {
    return room.players.filter(p => p.isAI && p.isAlive);
}

// AI Decision Making Logic
// BALANCE NOTES:
// - Fascists know teammates (per official rules), but must behave less predictably
// - Liberals use heuristic-based suspicion system to compensate for lack of information
// - Both sides have randomness to prevent pattern exploitation by human players
class AIBrain {
    constructor(room, player) {
        this.room = room;
        this.player = player;
        this.role = player.role;
        this.isFascist = this.role === 'fascist' || this.role === 'hitler';

        // Build suspicion scores based on game history (for liberal AI)
        this.suspicionScores = this.buildSuspicionScores();
    }

    // Get known fascist teammates (for fascist AI)
    getTeammates() {
        if (!this.isFascist) return [];
        return this.room.players.filter(p =>
            p.id !== this.player.id &&
            (p.role === 'fascist' || p.role === 'hitler')
        );
    }

    // Build suspicion scores based on observable game events
    // This gives liberal AI some strategic capability without perfect information
    buildSuspicionScores() {
        const scores = {};
        this.room.players.forEach(p => {
            scores[p.id] = 0;
        });

        // Suspicion increases for players who were in governments that enacted fascist policies
        // This is tracked implicitly through game state patterns
        // For now, use fascist policy count as a base suspicion modifier
        const fascistPolicies = this.room.gameState.fascistPolicies;

        // Add slight random variance to prevent predictable targeting
        this.room.players.forEach(p => {
            if (p.id !== this.player.id && p.isAlive) {
                scores[p.id] = Math.random() * 0.3; // Base randomness
            }
        });

        return scores;
    }

    // Get most suspicious player (for liberal decisions)
    getMostSuspicious(candidates) {
        if (candidates.length === 0) return null;

        // Weight random selection by inverse suspicion (prefer less suspicious)
        const weights = candidates.map(c => 1 - (this.suspicionScores[c.id] || 0));
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        let random = Math.random() * totalWeight;
        for (let i = 0; i < candidates.length; i++) {
            random -= weights[i];
            if (random <= 0) return candidates[i];
        }
        return candidates[candidates.length - 1];
    }

    // Decide how to vote on government
    decideVote() {
        const presidentId = this.room.players[this.room.gameState.currentPresidentIndex]?.id;
        const chancellorId = this.room.gameState.chancellorCandidateId;

        const president = this.room.players.find(p => p.id === presidentId);
        const chancellor = this.room.players.find(p => p.id === chancellorId);

        if (this.isFascist) {
            // Fascist voting logic - add randomness to avoid detection
            const teammates = this.getTeammates();
            const teammateIds = teammates.map(t => t.id);

            // Both fascists in government - high chance yes, but not 100%
            if (teammateIds.includes(presidentId) && teammateIds.includes(chancellorId)) {
                return Math.random() > 0.1; // 90% yes (was 100%)
            }

            // Vote yes if Hitler is chancellor and 3+ fascist policies
            // But add small chance of no to avoid obvious pattern
            if (chancellor?.role === 'hitler' && this.room.gameState.fascistPolicies >= 3) {
                return Math.random() > 0.15; // 85% yes (was 100%)
            }

            // One teammate in government - moderate bias
            if (teammateIds.includes(presidentId) || teammateIds.includes(chancellorId)) {
                return Math.random() > 0.35; // 65% yes (was 70%)
            }

            // No teammates - blend in with liberal voting patterns
            return Math.random() > 0.45; // 55% yes (was 50%)
        } else {
            // Liberal voting logic - improved strategic voting

            // Avoid chaos if tracker is high
            if (this.room.gameState.electionTracker >= 2) {
                return Math.random() > 0.25; // 75% yes to avoid chaos
            }

            // Be more cautious if many fascist policies enacted
            if (this.room.gameState.fascistPolicies >= 4) {
                return Math.random() > 0.55; // 45% yes - more skeptical
            }

            if (this.room.gameState.fascistPolicies >= 3) {
                return Math.random() > 0.5; // 50% yes
            }

            // Default: similar to fascist blend-in rate for balance
            return Math.random() > 0.4; // 60% yes
        }
    }

    // Choose chancellor as president
    chooseChancellor() {
        const alivePlayers = this.room.players.filter(p => p.isAlive);
        const validCandidates = this.room.players.filter(p =>
            p.isAlive &&
            p.id !== this.player.id &&
            p.id !== this.room.gameState.previousChancellorId &&
            (alivePlayers.length <= 5 || p.id !== this.room.gameState.previousPresidentId)
        );

        if (validCandidates.length === 0) return null;

        if (this.isFascist) {
            const teammates = this.getTeammates().filter(t =>
                validCandidates.some(c => c.id === t.id)
            );

            // Critical win condition: Hitler as chancellor with 3+ fascist policies
            // But don't ALWAYS do this - adds some unpredictability
            if (teammates.length > 0 && this.room.gameState.fascistPolicies >= 3) {
                const hitler = teammates.find(t => t.role === 'hitler');
                if (hitler && Math.random() > 0.2) { // 80% chance to go for win
                    return hitler.id;
                }
            }

            // Prefer teammates, but not always (to avoid detection)
            if (teammates.length > 0 && Math.random() > 0.3) { // 70% chance to pick teammate
                return teammates[Math.floor(Math.random() * teammates.length)].id;
            }

            // Sometimes pick non-teammate to blend in
            const nonTeammates = validCandidates.filter(c =>
                !teammates.some(t => t.id === c.id)
            );
            if (nonTeammates.length > 0 && Math.random() > 0.5) {
                return nonTeammates[Math.floor(Math.random() * nonTeammates.length)].id;
            }
        } else {
            // Liberal: prefer less suspicious players (weighted random)
            return this.getMostSuspicious(validCandidates)?.id ||
                   validCandidates[Math.floor(Math.random() * validCandidates.length)].id;
        }

        // Fallback: random selection
        return validCandidates[Math.floor(Math.random() * validCandidates.length)].id;
    }

    // Choose which policy to discard as president
    choosePresidentDiscard(policies) {
        const liberalCount = policies.filter(p => p === 'liberal').length;
        const fascistCount = policies.filter(p => p === 'fascist').length;

        if (this.isFascist) {
            const liberalIndex = policies.indexOf('liberal');
            if (liberalIndex !== -1) {
                // Usually discard liberal, but sometimes pass it to avoid suspicion
                if (Math.random() > 0.15) { // 85% discard liberal (was 100%)
                    return liberalIndex;
                }
            }
            // All fascist or chose to keep liberal - discard random
            return Math.floor(Math.random() * policies.length);
        } else {
            // Liberal: discard fascist if possible
            const fascistIndex = policies.indexOf('fascist');
            if (fascistIndex !== -1) {
                return fascistIndex;
            }
            // All liberal, discard random
            return Math.floor(Math.random() * policies.length);
        }
    }

    // Choose which policy to enact as chancellor
    chooseChancellorEnact(policies) {
        const liberalIndex = policies.indexOf('liberal');
        const fascistIndex = policies.indexOf('fascist');

        if (this.isFascist) {
            // Enact fascist if possible, but with more variance to avoid detection
            if (fascistIndex !== -1 && liberalIndex !== -1) {
                // Game state influences decision
                const fascistPolicies = this.room.gameState.fascistPolicies;

                // If close to fascist win, higher chance to enact fascist
                if (fascistPolicies >= 4) {
                    return Math.random() > 0.1 ? fascistIndex : liberalIndex; // 90% fascist
                }

                // Early game: blend in more
                if (fascistPolicies <= 1) {
                    return Math.random() > 0.4 ? fascistIndex : liberalIndex; // 60% fascist
                }

                // Mid game: moderate
                return Math.random() > 0.3 ? fascistIndex : liberalIndex; // 70% fascist (was 80%)
            }
            return fascistIndex !== -1 ? fascistIndex : liberalIndex !== -1 ? liberalIndex : 0;
        } else {
            // Liberal: always enact liberal if possible
            if (liberalIndex !== -1) {
                return liberalIndex;
            }
            return 0; // Forced to enact fascist
        }
    }

    // Choose player to investigate
    chooseInvestigateTarget() {
        const targets = this.room.players.filter(p =>
            p.isAlive && p.id !== this.player.id
        );

        if (targets.length === 0) return null;

        if (this.isFascist) {
            // Fascist strategy: mix of behaviors to avoid detection
            const liberals = targets.filter(t => t.role === 'liberal');
            const teammates = this.getTeammates().filter(t =>
                targets.some(ta => ta.id === t.id)
            );

            // Sometimes investigate teammate and "clear" them
            if (teammates.length > 0 && Math.random() > 0.6) {
                return teammates[Math.floor(Math.random() * teammates.length)].id;
            }

            // Usually investigate a liberal
            if (liberals.length > 0) {
                return liberals[Math.floor(Math.random() * liberals.length)].id;
            }
        }

        // Liberal or fallback: random target (could be improved with suspicion)
        return targets[Math.floor(Math.random() * targets.length)]?.id;
    }

    // Choose player for special election
    chooseSpecialElectionTarget() {
        const targets = this.room.players.filter(p =>
            p.isAlive && p.id !== this.player.id
        );

        if (targets.length === 0) return null;

        if (this.isFascist) {
            // Pick a fascist teammate, but not always
            const teammates = this.getTeammates().filter(t => targets.some(ta => ta.id === t.id));
            if (teammates.length > 0 && Math.random() > 0.25) { // 75% teammate (was 100%)
                return teammates[Math.floor(Math.random() * teammates.length)].id;
            }
        }

        // Random target
        return targets[Math.floor(Math.random() * targets.length)]?.id;
    }

    // Choose player to execute
    chooseExecutionTarget() {
        const targets = this.room.players.filter(p =>
            p.isAlive && p.id !== this.player.id
        );

        if (targets.length === 0) return null;

        if (this.isFascist) {
            // Never execute Hitler - this is critical for fascist win
            const hitler = targets.find(t => t.role === 'hitler');
            const nonHitlerTargets = targets.filter(t => t.role !== 'hitler');

            // Strongly prefer executing liberals, but add some variance
            const liberals = nonHitlerTargets.filter(t => t.role === 'liberal');
            const teammates = this.getTeammates().filter(t =>
                nonHitlerTargets.some(nt => nt.id === t.id)
            );

            if (liberals.length > 0) {
                // 90% chance to target liberal (allows rare "mistakes" for unpredictability)
                if (Math.random() > 0.1) {
                    return liberals[Math.floor(Math.random() * liberals.length)].id;
                }
            }

            // Fallback: pick from non-Hitler, non-teammate targets
            const safeTargets = nonHitlerTargets.filter(t =>
                !teammates.some(tm => tm.id === t.id)
            );
            if (safeTargets.length > 0) {
                return safeTargets[Math.floor(Math.random() * safeTargets.length)].id;
            }

            // Very rare edge case: must pick someone
            if (nonHitlerTargets.length > 0) {
                return nonHitlerTargets[Math.floor(Math.random() * nonHitlerTargets.length)].id;
            }
        } else {
            // Liberal: use weighted random based on suspicion
            // In absence of tracking, pick randomly but could be enhanced
            return targets[Math.floor(Math.random() * targets.length)]?.id;
        }

        return targets[0]?.id;
    }
}

// Process AI actions based on current game phase
function processAIActions(room) {
    if (room.gameState.phase === 'gameover') return;

    const phase = room.gameState.phase;

    switch (phase) {
        case 'election':
            processAIElection(room);
            break;
        case 'voting':
            processAIVoting(room);
            break;
        case 'vote-result':
            // Auto-continue from vote result
            setTimeout(() => {
                if (room.gameState.phase === 'vote-result') {
                    handleContinueFromVote(room);
                }
            }, 2000);
            break;
        case 'legislative-president':
            processAIPresidentLegislative(room);
            break;
        case 'legislative-chancellor':
            processAIChancellorLegislative(room);
            break;
        case 'policy-result':
            setTimeout(() => {
                if (room.gameState.phase === 'policy-result') {
                    handleContinueFromPolicy(room);
                }
            }, 2500);
            break;
        case 'chaos':
            setTimeout(() => {
                if (room.gameState.phase === 'chaos') {
                    handleContinueFromChaos(room);
                }
            }, 2500);
            break;
        case 'executive':
            processAIExecutive(room);
            break;
        case 'execution-result':
            setTimeout(() => {
                if (room.gameState.phase === 'execution-result') {
                    handleContinueFromExecution(room);
                }
            }, 2500);
            break;
    }
}

function processAIElection(room) {
    const president = room.players[room.gameState.currentPresidentIndex];
    if (!isAIPlayer(president)) return;

    setTimeout(() => {
        if (room.gameState.phase !== 'election') return;

        const ai = new AIBrain(room, president);
        const chancellorId = ai.chooseChancellor();

        if (chancellorId) {
            room.gameState.chancellorCandidateId = chancellorId;
            room.gameState.phase = 'voting';
            room.players.forEach(p => {
                p.hasVoted = false;
                p.vote = null;
            });
            room.gameState.votes = [];

            broadcastGameState(room);
            processAIActions(room);
        }
    }, getAIDelay());
}

function processAIVoting(room) {
    const aiPlayers = room.players.filter(p => p.isAI && p.isAlive && !p.hasVoted);

    aiPlayers.forEach((aiPlayer, index) => {
        setTimeout(() => {
            if (room.gameState.phase !== 'voting' || aiPlayer.hasVoted) return;

            const ai = new AIBrain(room, aiPlayer);
            const vote = ai.decideVote();

            aiPlayer.hasVoted = true;
            aiPlayer.vote = vote;

            // Check if all alive players have voted
            const alivePlayers = room.players.filter(p => p.isAlive);
            const allVoted = alivePlayers.every(p => p.hasVoted);

            if (allVoted) {
                handleVotingComplete(room);
            } else {
                broadcastGameState(room);
            }
        }, getAIDelay() + (index * 500)); // Stagger AI votes
    });
}

function processAIPresidentLegislative(room) {
    const president = room.players[room.gameState.currentPresidentIndex];
    if (!isAIPlayer(president)) return;

    setTimeout(() => {
        if (room.gameState.phase !== 'legislative-president') return;

        const ai = new AIBrain(room, president);
        const discardIndex = ai.choosePresidentDiscard(room.gameState.currentPolicies);

        const discarded = room.gameState.currentPolicies.splice(discardIndex, 1)[0];
        room.gameState.discardPile.push(discarded);
        room.gameState.phase = 'legislative-chancellor';

        broadcastGameState(room);
        processAIActions(room);
    }, getAIDelay());
}

function processAIChancellorLegislative(room) {
    const chancellor = room.players.find(p => p.id === room.gameState.currentChancellorId);
    if (!isAIPlayer(chancellor)) return;

    setTimeout(() => {
        if (room.gameState.phase !== 'legislative-chancellor') return;

        const ai = new AIBrain(room, chancellor);
        const enactIndex = ai.chooseChancellorEnact(room.gameState.currentPolicies);

        const enacted = room.gameState.currentPolicies[enactIndex];
        const discardIndex = enactIndex === 0 ? 1 : 0;
        room.gameState.discardPile.push(room.gameState.currentPolicies[discardIndex]);
        room.gameState.currentPolicies = [];

        if (enacted === 'liberal') {
            room.gameState.liberalPolicies++;
        } else {
            room.gameState.fascistPolicies++;
        }

        room.gameState.enactedPolicy = enacted;
        room.gameState.phase = 'policy-result';

        broadcastGameState(room);
        processAIActions(room);
    }, getAIDelay());
}

function processAIExecutive(room) {
    const president = room.players[room.gameState.currentPresidentIndex];
    if (!isAIPlayer(president)) return;

    setTimeout(() => {
        if (room.gameState.phase !== 'executive') return;

        const ai = new AIBrain(room, president);
        const power = room.gameState.executivePower;

        switch (power) {
            case 'investigate':
                const investigateTarget = ai.chooseInvestigateTarget();
                if (investigateTarget) {
                    // AI just "sees" the result, no need to emit
                    room.gameState.executivePower = null;
                    advancePresidency(room);
                    room.gameState.phase = 'election';
                    broadcastGameState(room);
                    processAIActions(room);
                }
                break;

            case 'examine':
                // AI looks at cards, then continues
                room.gameState.executivePower = null;
                advancePresidency(room);
                room.gameState.phase = 'election';
                broadcastGameState(room);
                processAIActions(room);
                break;

            case 'special-election':
                const specialTarget = ai.chooseSpecialElectionTarget();
                if (specialTarget) {
                    const targetIndex = room.players.findIndex(p => p.id === specialTarget);
                    const targetPlayer = room.players.find(p => p.id === specialTarget);
                    if (targetIndex !== -1 && targetPlayer && targetPlayer.isAlive) {
                        // Store the normal next president index
                        let normalNextIndex = room.gameState.currentPresidentIndex;
                        do {
                            normalNextIndex = (normalNextIndex + 1) % room.players.length;
                        } while (!room.players[normalNextIndex].isAlive);
                        room.gameState.specialElectionNextIndex = normalNextIndex;

                        room.gameState.previousPresidentId = president.id;
                        room.gameState.previousChancellorId = room.gameState.currentChancellorId;
                        room.gameState.currentPresidentIndex = targetIndex;
                        room.gameState.currentChancellorId = null;
                        room.gameState.executivePower = null;
                        room.gameState.phase = 'election';
                        broadcastGameState(room);
                        processAIActions(room);
                    }
                }
                break;

            case 'execute':
                const executeTarget = ai.chooseExecutionTarget();
                if (executeTarget) {
                    const target = room.players.find(p => p.id === executeTarget);
                    if (target && target.isAlive) {
                        target.isAlive = false;
                        room.gameState.executedPlayer = { name: target.name, role: target.role };
                        room.gameState.executivePower = null;

                        if (checkWinCondition(room)) {
                            broadcastGameState(room);
                        } else {
                            room.gameState.phase = 'execution-result';
                            broadcastGameState(room);
                            processAIActions(room);
                        }
                    }
                }
                break;
        }
    }, getAIDelay());
}

// Helper functions for AI auto-continue
function handleContinueFromVote(room) {
    if (room.gameState.voteResult === 'passed') {
        room.gameState.currentPolicies = drawPolicies(room, 3);
        room.gameState.phase = 'legislative-president';
    } else {
        if (room.gameState.electionTracker >= 3) {
            const [policy] = drawPolicies(room, 1);
            if (policy === 'liberal') {
                room.gameState.liberalPolicies++;
            } else {
                room.gameState.fascistPolicies++;
            }
            room.gameState.electionTracker = 0;
            room.gameState.chaosPolicy = policy;
            room.gameState.phase = 'chaos';

            if (!checkWinCondition(room)) {
                // Will continue to election after chaos
            }
        } else {
            advancePresidency(room);
            room.gameState.phase = 'election';
        }
    }
    broadcastGameState(room);
    processAIActions(room);
}

function handleContinueFromPolicy(room) {
    if (checkWinCondition(room)) {
        broadcastGameState(room);
        return;
    }

    if (room.gameState.enactedPolicy === 'fascist') {
        const power = getExecutivePower(room.gameState.fascistPolicies, room.players.length);
        if (power) {
            room.gameState.executivePower = power;
            room.gameState.phase = 'executive';
            broadcastGameState(room);
            processAIActions(room);
            return;
        }
    }

    advancePresidency(room);
    room.gameState.phase = 'election';
    broadcastGameState(room);
    processAIActions(room);
}

function handleContinueFromChaos(room) {
    if (!checkWinCondition(room)) {
        advancePresidency(room);
        room.gameState.phase = 'election';
    }
    broadcastGameState(room);
    processAIActions(room);
}

function handleContinueFromExecution(room) {
    advancePresidency(room);
    room.gameState.phase = 'election';
    broadcastGameState(room);
    processAIActions(room);
}

function handleVotingComplete(room) {
    const alivePlayers = room.players.filter(p => p.isAlive);
    const yesVotes = alivePlayers.filter(p => p.vote === true).length;
    const noVotes = alivePlayers.filter(p => p.vote === false).length;
    const passed = yesVotes > noVotes;

    room.gameState.votes = alivePlayers.map(p => ({
        playerId: p.id,
        playerName: p.name,
        vote: p.vote
    }));

    if (passed) {
        room.gameState.electionTracker = 0;
        room.gameState.currentChancellorId = room.gameState.chancellorCandidateId;

        const chancellor = room.players.find(p => p.id === room.gameState.currentChancellorId);
        if (chancellor.role === 'hitler' && room.gameState.fascistPolicies >= 3) {
            room.gameState.winner = 'fascist';
            room.gameState.winReason = 'Hitler was elected Chancellor!';
            room.gameState.phase = 'gameover';
        } else {
            room.gameState.phase = 'vote-result';
            room.gameState.voteResult = 'passed';
        }
    } else {
        room.gameState.electionTracker++;
        room.gameState.phase = 'vote-result';
        room.gameState.voteResult = 'failed';
    }

    broadcastGameState(room);
    processAIActions(room);
}

// ==================== END AI PLAYER SYSTEM ====================

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Create a new room
    socket.on('createRoom', (playerName) => {
        const room = createRoom(socket.id, playerName);
        socket.join(room.code);
        socket.emit('roomCreated', { code: room.code, playerId: socket.id });
        broadcastGameState(room);
    });

    // Join an existing room
    socket.on('joinRoom', ({ code, playerName }) => {
        const room = getRoom(code.toUpperCase());

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.gameState.phase !== 'lobby') {
            socket.emit('error', { message: 'Game already in progress' });
            return;
        }

        if (room.players.length >= 6) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        room.players.push({
            id: socket.id,
            name: playerName,
            role: null,
            isAlive: true,
            hasVoted: false,
            vote: null
        });

        socket.join(code.toUpperCase());
        socket.emit('roomJoined', { code: room.code, playerId: socket.id });
        broadcastGameState(room);
    });

    // Start the game
    socket.on('startGame', (code) => {
        const room = getRoom(code);
        if (!room) return;

        if (socket.id !== room.hostId) {
            socket.emit('error', { message: 'Only the host can start the game' });
            return;
        }

        // Allow starting with at least 1 human player, fill rest with AI
        if (room.players.length < 1) {
            socket.emit('error', { message: 'Need at least 1 player' });
            return;
        }

        // Validate max player count (should be enforced by joinRoom, but double-check)
        if (room.players.length > 6) {
            socket.emit('error', { message: 'Too many players (max 6)' });
            return;
        }

        // Add AI players to reach minimum of 4, max of 6
        const targetPlayerCount = Math.min(6, Math.max(4, room.players.length));
        addAIPlayers(room, targetPlayerCount);

        // Final validation that we have a valid player count for role configuration
        if (room.players.length < 4 || room.players.length > 6) {
            socket.emit('error', { message: 'Invalid player count. Game requires 4-6 players.' });
            return;
        }

        // Initialize game
        assignRoles(room);
        initializeDeck(room);
        room.gameState.phase = 'election';
        room.gameState.currentPresidentIndex = Math.floor(Math.random() * room.players.length);

        broadcastGameState(room);

        // Start AI processing
        processAIActions(room);
    });

    // Nominate chancellor
    socket.on('nominateChancellor', ({ code, chancellorId }) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'election') return;

        const currentPresident = room.players[room.gameState.currentPresidentIndex];
        if (socket.id !== currentPresident.id) return;

        // Validate chancellor choice
        const chancellor = room.players.find(p => p.id === chancellorId);
        if (!chancellor || !chancellor.isAlive) return;
        if (chancellorId === currentPresident.id) return;
        if (chancellorId === room.gameState.previousChancellorId) return;
        const alivePlayers = room.players.filter(p => p.isAlive);
        if (alivePlayers.length > 5 && chancellorId === room.gameState.previousPresidentId) return;

        room.gameState.chancellorCandidateId = chancellorId;
        room.gameState.phase = 'voting';
        room.players.forEach(p => {
            p.hasVoted = false;
            p.vote = null;
        });
        room.gameState.votes = [];

        broadcastGameState(room);
        // Trigger AI voting
        processAIActions(room);
    });

    // Cast vote
    socket.on('vote', ({ code, vote }) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'voting') return;

        const player = getPlayerInRoom(room, socket.id);
        if (!player || !player.isAlive || player.hasVoted) return;

        player.hasVoted = true;
        player.vote = vote;

        // Check if all alive players have voted
        const alivePlayers = room.players.filter(p => p.isAlive);
        const allVoted = alivePlayers.every(p => p.hasVoted);

        if (allVoted) {
            // Use shared voting complete handler
            handleVotingComplete(room);
        } else {
            broadcastGameState(room);
        }
    });

    // Continue from vote result
    socket.on('continueFromVote', (code) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'vote-result') return;

        // Use shared handler that also triggers AI
        handleContinueFromVote(room);
    });

    // Continue from chaos
    socket.on('continueFromChaos', (code) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'chaos') return;

        // Use shared handler that also triggers AI
        handleContinueFromChaos(room);
    });

    // President discards policy
    socket.on('presidentDiscard', ({ code, discardIndex }) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'legislative-president') return;

        const currentPresident = room.players[room.gameState.currentPresidentIndex];
        if (socket.id !== currentPresident.id) return;

        const discarded = room.gameState.currentPolicies.splice(discardIndex, 1)[0];
        room.gameState.discardPile.push(discarded);
        room.gameState.phase = 'legislative-chancellor';

        broadcastGameState(room);
        // Trigger AI chancellor if needed
        processAIActions(room);
    });

    // Chancellor enacts policy
    socket.on('chancellorEnact', ({ code, enactIndex }) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'legislative-chancellor') return;

        if (socket.id !== room.gameState.currentChancellorId) return;

        const enacted = room.gameState.currentPolicies[enactIndex];
        const discardIndex = enactIndex === 0 ? 1 : 0;
        room.gameState.discardPile.push(room.gameState.currentPolicies[discardIndex]);
        room.gameState.currentPolicies = [];

        if (enacted === 'liberal') {
            room.gameState.liberalPolicies++;
        } else {
            room.gameState.fascistPolicies++;
        }

        room.gameState.enactedPolicy = enacted;
        room.gameState.phase = 'policy-result';

        broadcastGameState(room);
        // Trigger auto-continue for policy result
        processAIActions(room);
    });

    // Continue from policy result
    socket.on('continueFromPolicy', (code) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'policy-result') return;

        // Use shared handler that also triggers AI
        handleContinueFromPolicy(room);
    });

    // Executive action: Investigate
    socket.on('investigate', ({ code, targetId }) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'executive' || room.gameState.executivePower !== 'investigate') return;

        const currentPresident = room.players[room.gameState.currentPresidentIndex];
        if (socket.id !== currentPresident.id) return;

        const target = room.players.find(p => p.id === targetId);
        if (!target || !target.isAlive) return;

        // Send investigation result only to president
        socket.emit('investigationResult', {
            targetName: target.name,
            party: target.role === 'liberal' ? 'liberal' : 'fascist'
        });

        room.gameState.executivePower = null;
        advancePresidency(room);
        room.gameState.phase = 'election';
        broadcastGameState(room);
        processAIActions(room);
    });

    // Executive action: Examine
    socket.on('examine', (code) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'executive' || room.gameState.executivePower !== 'examine') return;

        const currentPresident = room.players[room.gameState.currentPresidentIndex];
        if (socket.id !== currentPresident.id) return;

        const topThree = room.gameState.policyDeck.slice(-3).reverse();
        socket.emit('examineResult', { policies: topThree });
    });

    // Continue from examine
    socket.on('continueFromExamine', (code) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'executive' || room.gameState.executivePower !== 'examine') return;

        room.gameState.executivePower = null;
        advancePresidency(room);
        room.gameState.phase = 'election';
        broadcastGameState(room);
        processAIActions(room);
    });

    // Executive action: Special Election
    socket.on('specialElection', ({ code, targetId }) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'executive' || room.gameState.executivePower !== 'special-election') return;

        const currentPresident = room.players[room.gameState.currentPresidentIndex];
        if (socket.id !== currentPresident.id) return;

        const target = room.players.find(p => p.id === targetId);
        if (!target || !target.isAlive) return;

        const targetIndex = room.players.findIndex(p => p.id === targetId);

        // Store the normal next president index for after the special election
        let normalNextIndex = room.gameState.currentPresidentIndex;
        do {
            normalNextIndex = (normalNextIndex + 1) % room.players.length;
        } while (!room.players[normalNextIndex].isAlive);
        room.gameState.specialElectionNextIndex = normalNextIndex;

        room.gameState.previousPresidentId = currentPresident.id;
        room.gameState.previousChancellorId = room.gameState.currentChancellorId;
        room.gameState.currentPresidentIndex = targetIndex;
        room.gameState.currentChancellorId = null;
        room.gameState.executivePower = null;
        room.gameState.phase = 'election';

        broadcastGameState(room);
        processAIActions(room);
    });

    // Executive action: Execute
    socket.on('execute', ({ code, targetId }) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'executive' || room.gameState.executivePower !== 'execute') return;

        const currentPresident = room.players[room.gameState.currentPresidentIndex];
        if (socket.id !== currentPresident.id) return;

        const target = room.players.find(p => p.id === targetId);
        if (!target || !target.isAlive) return;

        target.isAlive = false;
        room.gameState.executedPlayer = { name: target.name, role: target.role };
        room.gameState.executivePower = null;

        if (checkWinCondition(room)) {
            broadcastGameState(room);
            return;
        }

        room.gameState.phase = 'execution-result';
        broadcastGameState(room);
        processAIActions(room);
    });

    // Continue from execution
    socket.on('continueFromExecution', (code) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'execution-result') return;

        // Use shared handler that also triggers AI
        handleContinueFromExecution(room);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);

        // Find and handle room cleanup
        rooms.forEach((room, code) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                if (room.gameState.phase === 'lobby') {
                    room.players.splice(playerIndex, 1);
                    if (room.players.length === 0) {
                        rooms.delete(code);
                    } else {
                        if (room.hostId === socket.id) {
                            room.hostId = room.players[0].id;
                        }
                        broadcastGameState(room);
                    }
                } else {
                    // Mark player as disconnected but keep in game
                    room.players[playerIndex].disconnected = true;
                    broadcastGameState(room);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
