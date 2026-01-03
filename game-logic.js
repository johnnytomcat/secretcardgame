/**
 * Secret Butler - Core Game Logic Module
 *
 * This module contains all pure game logic functions that can be tested independently.
 * It is imported by both server.js and the test suite.
 */

// Role configurations based on player count
const roleConfigurations = {
    4: { guests: 2, staff: 1, butler: 1 },
    5: { guests: 3, staff: 1, butler: 1 },
    6: { guests: 4, staff: 1, butler: 1 }
};

// Player Avatars - emojis with Victorian mansion names
const PLAYER_AVATARS = [
    { emoji: '🦁', name: 'Reginald', color: '#f4a460' },
    { emoji: '🐺', name: 'Percival', color: '#708090' },
    { emoji: '🦊', name: 'Theodore', color: '#ff6b35' },
    { emoji: '🐻', name: 'Bartholomew', color: '#8b4513' },
    { emoji: '🦅', name: 'Edmund', color: '#4a90d9' },
    { emoji: '🐍', name: 'Archibald', color: '#228b22' }
];

// AI Player names (legacy, now use avatars)
const AI_NAMES = [
    'Reginald', 'Percival', 'Theodore', 'Bartholomew', 'Edmund',
    'Archibald', 'Winston', 'Cornelius', 'Montgomery', 'Sebastian'
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

// Get the next available avatar for a room
function getNextAvatar(room) {
    const usedIndices = room ? room.players.map(p => p.avatarIndex).filter(i => i !== undefined) : [];
    for (let i = 0; i < PLAYER_AVATARS.length; i++) {
        if (!usedIndices.includes(i)) {
            return { index: i, ...PLAYER_AVATARS[i] };
        }
    }
    // Fallback if all avatars used
    return { index: 0, ...PLAYER_AVATARS[0] };
}

function createRoom(hostId, hostName, sessionId = null) {
    const code = generateRoomCode();
    const firstAvatar = PLAYER_AVATARS[0];

    return {
        code,
        hostId,
        players: [{
            id: hostId,
            name: hostName || firstAvatar.name,
            avatar: firstAvatar.emoji,
            avatarColor: firstAvatar.color,
            avatarIndex: 0,
            sessionId: sessionId,
            role: null,
            isAlive: true,
            hasVoted: false,
            vote: null
        }],
        gameState: {
            phase: 'lobby',
            currentPresidentIndex: 0,
            chancellorCandidateId: null,
            currentChancellorId: null,
            previousPresidentId: null,
            previousChancellorId: null,
            guestPolicies: 0,
            staffPolicies: 0,
            electionTracker: 0,
            policyDeck: [],
            discardPile: [],
            currentPolicies: [],
            specialElectionNextIndex: null,
            votes: [],
            executivePower: null,
            executedPlayer: null,
            winner: null,
            winReason: null
        }
    };
}

function getPlayerInRoom(room, playerId) {
    return room.players.find(p => p.id === playerId);
}

function assignRoles(room) {
    const playerCount = room.players.length;
    const config = roleConfigurations[playerCount];
    if (!config) return false;

    const roles = [];
    for (let i = 0; i < config.guests; i++) roles.push('guest');
    for (let i = 0; i < config.staff; i++) roles.push('staff');
    roles.push('butler');

    const shuffledRoles = shuffleArray(roles);
    room.players.forEach((player, index) => {
        player.role = shuffledRoles[index];
    });
    return true;
}

function initializeDeck(room) {
    room.gameState.policyDeck = [];
    for (let i = 0; i < 6; i++) room.gameState.policyDeck.push('guest');
    for (let i = 0; i < 11; i++) room.gameState.policyDeck.push('staff');
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

function getExecutivePower(staffCount, playerCount) {
    const powers = {
        4: { 3: 'examine', 4: 'execute', 5: 'execute' },
        5: { 3: 'examine', 4: 'execute', 5: 'execute' },
        6: { 3: 'investigate', 4: 'special-election', 5: 'execute' }
    };
    return powers[playerCount]?.[staffCount] || null;
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
        guestPolicies: room.gameState.guestPolicies,
        staffPolicies: room.gameState.staffPolicies,
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
            avatar: p.avatar,
            avatarColor: p.avatarColor,
            isAlive: p.isAlive,
            hasVoted: p.hasVoted,
            isAI: p.isAI || false,
            role: room.gameState.phase === 'gameover' ? p.role : undefined
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

    if (room.gameState.phase === 'legislative-president' && state.isPresident) {
        state.policies = room.gameState.currentPolicies;
    }
    if (room.gameState.phase === 'legislative-chancellor' && state.isChancellor) {
        state.policies = room.gameState.currentPolicies;
    }

    if (player.role === 'staff' || player.role === 'butler') {
        const teammates = room.players.filter(p =>
            p.id !== playerId && (p.role === 'staff' || p.role === 'butler')
        );
        state.teammates = teammates.map(t => ({
            id: t.id,
            name: t.name,
            role: t.role
        }));
    }

    return state;
}

function advancePresidency(room) {
    room.gameState.previousPresidentId = room.players[room.gameState.currentPresidentIndex]?.id;
    room.gameState.previousChancellorId = room.gameState.currentChancellorId;

    if (room.gameState.specialElectionNextIndex !== null) {
        room.gameState.currentPresidentIndex = room.gameState.specialElectionNextIndex;
        room.gameState.specialElectionNextIndex = null;
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
    if (room.gameState.guestPolicies >= 5) {
        room.gameState.winner = 'guest';
        room.gameState.winReason = '5 Guest policies enacted!';
        room.gameState.phase = 'gameover';
        return true;
    }

    if (room.gameState.staffPolicies >= 6) {
        room.gameState.winner = 'staff';
        room.gameState.winReason = '6 Staff policies enacted!';
        room.gameState.phase = 'gameover';
        return true;
    }

    const butler = room.players.find(p => p.role === 'butler');
    if (butler && !butler.isAlive) {
        room.gameState.winner = 'guest';
        room.gameState.winReason = 'The Butler was exposed and dismissed!';
        room.gameState.phase = 'gameover';
        return true;
    }

    return false;
}

function isValidChancellorCandidate(room, candidateId) {
    const president = room.players[room.gameState.currentPresidentIndex];
    const candidate = room.players.find(p => p.id === candidateId);

    if (!candidate || !candidate.isAlive) return false;
    if (candidateId === president.id) return false;
    if (candidateId === room.gameState.previousChancellorId) return false;
    if (room.players.length > 5 && candidateId === room.gameState.previousPresidentId) return false;

    return true;
}

function handleVotingComplete(room) {
    const alivePlayers = room.players.filter(p => p.isAlive);
    const yesVotes = alivePlayers.filter(p => p.vote === true).length;
    const noVotes = alivePlayers.filter(p => p.vote === false).length;
    const passed = yesVotes > noVotes;

    room.gameState.votes = alivePlayers.map(p => ({
        playerId: p.id,
        playerName: p.name,
        avatar: p.avatar,
        avatarColor: p.avatarColor,
        vote: p.vote
    }));

    if (passed) {
        room.gameState.electionTracker = 0;
        room.gameState.currentChancellorId = room.gameState.chancellorCandidateId;

        const chancellor = room.players.find(p => p.id === room.gameState.currentChancellorId);
        if (chancellor.role === 'butler' && room.gameState.staffPolicies >= 3) {
            room.gameState.winner = 'staff';
            room.gameState.winReason = 'The Butler was appointed Head of Household!';
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

    return passed;
}

function generateAIPlayerId() {
    return 'AI_' + Math.random().toString(36).substr(2, 9);
}

function addAIPlayers(room, targetCount) {
    while (room.players.length < targetCount) {
        const avatar = getNextAvatar(room);
        room.players.push({
            id: generateAIPlayerId(),
            name: avatar.name,
            avatar: avatar.emoji,
            avatarColor: avatar.color,
            avatarIndex: avatar.index,
            role: null,
            isAlive: true,
            hasVoted: false,
            vote: null,
            isAI: true
        });
    }
}

function isAIPlayer(player) {
    return !!(player && player.isAI === true);
}

function getAIPlayers(room) {
    return room.players.filter(p => p.isAI && p.isAlive);
}

function resetGameToLobby(room) {
    // Remove AI players
    room.players = room.players.filter(p => !p.isAI);

    // Reset all players
    room.players.forEach(p => {
        p.role = null;
        p.isAlive = true;
        p.hasVoted = false;
        p.vote = null;
    });

    // Reset game state
    room.gameState = {
        phase: 'lobby',
        currentPresidentIndex: 0,
        chancellorCandidateId: null,
        currentChancellorId: null,
        previousPresidentId: null,
        previousChancellorId: null,
        guestPolicies: 0,
        staffPolicies: 0,
        electionTracker: 0,
        policyDeck: [],
        discardPile: [],
        currentPolicies: [],
        specialElectionNextIndex: null,
        votes: [],
        executivePower: null,
        executedPlayer: null,
        winner: null,
        winReason: null
    };
}

function getInvestigationResult(player) {
    return player.role === 'guest' ? 'guest' : 'staff';
}

function executePlayer(room, targetId) {
    const target = room.players.find(p => p.id === targetId);
    if (!target || !target.isAlive) return null;

    target.isAlive = false;
    room.gameState.executedPlayer = {
        name: target.name,
        role: target.role,
        avatar: target.avatar,
        avatarColor: target.avatarColor
    };
    room.gameState.executivePower = null;

    return target;
}

function handleChaos(room) {
    room.gameState.electionTracker = 0;
    room.gameState.previousPresidentId = null;
    room.gameState.previousChancellorId = null;

    const policies = drawPolicies(room, 1);
    const policy = policies[0];

    if (policy === 'guest') {
        room.gameState.guestPolicies++;
    } else if (policy === 'staff') {
        room.gameState.staffPolicies++;
    }

    room.gameState.chaosPolicy = policy;
    return policy;
}

// AI Decision Making Logic
class AIBrain {
    constructor(room, player) {
        this.room = room;
        this.player = player;
        this.role = player.role;
        this.isStaff = this.role === 'staff' || this.role === 'butler';
        this.suspicionScores = this.buildSuspicionScores();
    }

    getTeammates() {
        if (!this.isStaff) return [];
        return this.room.players.filter(p =>
            p.id !== this.player.id &&
            (p.role === 'staff' || p.role === 'butler')
        );
    }

    buildSuspicionScores() {
        const scores = {};
        this.room.players.forEach(p => {
            scores[p.id] = 0;
        });

        this.room.players.forEach(p => {
            if (p.id !== this.player.id && p.isAlive) {
                scores[p.id] = Math.random() * 0.3;
            }
        });

        return scores;
    }

    getMostSuspicious(candidates) {
        if (candidates.length === 0) return null;

        const weights = candidates.map(c => 1 - (this.suspicionScores[c.id] || 0));
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        let random = Math.random() * totalWeight;
        for (let i = 0; i < candidates.length; i++) {
            random -= weights[i];
            if (random <= 0) return candidates[i];
        }
        return candidates[candidates.length - 1];
    }

    decideVote() {
        const presidentId = this.room.players[this.room.gameState.currentPresidentIndex]?.id;
        const chancellorId = this.room.gameState.chancellorCandidateId;

        const president = this.room.players.find(p => p.id === presidentId);
        const chancellor = this.room.players.find(p => p.id === chancellorId);

        if (this.isStaff) {
            const teammates = this.getTeammates();
            const teammateIds = teammates.map(t => t.id);

            if (teammateIds.includes(presidentId) && teammateIds.includes(chancellorId)) {
                return Math.random() > 0.1;
            }

            if (chancellor?.role === 'butler' && this.room.gameState.staffPolicies >= 3) {
                return Math.random() > 0.15;
            }

            if (teammateIds.includes(presidentId) || teammateIds.includes(chancellorId)) {
                return Math.random() > 0.35;
            }

            return Math.random() > 0.45;
        } else {
            if (this.room.gameState.electionTracker >= 2) {
                return Math.random() > 0.25;
            }

            if (this.room.gameState.staffPolicies >= 4) {
                return Math.random() > 0.55;
            }

            if (this.room.gameState.staffPolicies >= 3) {
                return Math.random() > 0.5;
            }

            return Math.random() > 0.4;
        }
    }

    chooseChancellor() {
        const alivePlayers = this.room.players.filter(p => p.isAlive);
        const validCandidates = this.room.players.filter(p =>
            p.isAlive &&
            p.id !== this.player.id &&
            p.id !== this.room.gameState.previousChancellorId &&
            (alivePlayers.length <= 5 || p.id !== this.room.gameState.previousPresidentId)
        );

        if (validCandidates.length === 0) return null;

        if (this.isStaff) {
            const teammates = this.getTeammates().filter(t =>
                validCandidates.some(c => c.id === t.id)
            );

            if (teammates.length > 0 && this.room.gameState.staffPolicies >= 3) {
                const butler = teammates.find(t => t.role === 'butler');
                if (butler && Math.random() > 0.2) {
                    return butler.id;
                }
            }

            if (teammates.length > 0 && Math.random() > 0.3) {
                return teammates[Math.floor(Math.random() * teammates.length)].id;
            }

            const nonTeammates = validCandidates.filter(c =>
                !teammates.some(t => t.id === c.id)
            );
            if (nonTeammates.length > 0 && Math.random() > 0.5) {
                return nonTeammates[Math.floor(Math.random() * nonTeammates.length)].id;
            }
        } else {
            return this.getMostSuspicious(validCandidates)?.id ||
                   validCandidates[Math.floor(Math.random() * validCandidates.length)].id;
        }

        return validCandidates[Math.floor(Math.random() * validCandidates.length)].id;
    }

    choosePresidentPolicies(policies) {
        const allIndices = [0, 1, 2];

        if (this.isStaff) {
            const staffIndices = policies.map((p, i) => p === 'staff' ? i : -1).filter(i => i !== -1);
            const guestIndices = policies.map((p, i) => p === 'guest' ? i : -1).filter(i => i !== -1);

            if (staffIndices.length >= 2) {
                if (Math.random() > 0.15) {
                    return staffIndices.slice(0, 2);
                } else if (guestIndices.length > 0) {
                    return [staffIndices[0], guestIndices[0]];
                }
            }

            if (staffIndices.length === 1 && guestIndices.length === 2) {
                if (Math.random() > 0.2) {
                    return [staffIndices[0], guestIndices[0]];
                }
            }

            return [0, 1];
        } else {
            const guestIndices = policies.map((p, i) => p === 'guest' ? i : -1).filter(i => i !== -1);
            const staffIndices = policies.map((p, i) => p === 'staff' ? i : -1).filter(i => i !== -1);

            if (guestIndices.length >= 2) {
                return guestIndices.slice(0, 2);
            }

            if (guestIndices.length === 1) {
                return [guestIndices[0], staffIndices[0]];
            }

            return [0, 1];
        }
    }

    choosePresidentDiscard(policies) {
        const selectedIndices = this.choosePresidentPolicies(policies);
        return [0, 1, 2].find(i => !selectedIndices.includes(i));
    }

    chooseChancellorEnact(policies) {
        const guestIndex = policies.indexOf('guest');
        const staffIndex = policies.indexOf('staff');

        if (this.isStaff) {
            if (staffIndex !== -1 && guestIndex !== -1) {
                const staffPolicies = this.room.gameState.staffPolicies;

                if (staffPolicies >= 4) {
                    return Math.random() > 0.1 ? staffIndex : guestIndex;
                }

                if (staffPolicies <= 1) {
                    return Math.random() > 0.4 ? staffIndex : guestIndex;
                }

                return Math.random() > 0.3 ? staffIndex : guestIndex;
            }
            return staffIndex !== -1 ? staffIndex : guestIndex !== -1 ? guestIndex : 0;
        } else {
            if (guestIndex !== -1) {
                return guestIndex;
            }
            return 0;
        }
    }

    chooseInvestigateTarget() {
        const targets = this.room.players.filter(p =>
            p.isAlive && p.id !== this.player.id
        );

        if (targets.length === 0) return null;

        if (this.isStaff) {
            const guests = targets.filter(t => t.role === 'guest');
            const teammates = this.getTeammates().filter(t =>
                targets.some(ta => ta.id === t.id)
            );

            if (teammates.length > 0 && Math.random() > 0.6) {
                return teammates[Math.floor(Math.random() * teammates.length)].id;
            }

            if (guests.length > 0) {
                return guests[Math.floor(Math.random() * guests.length)].id;
            }
        }

        return targets[Math.floor(Math.random() * targets.length)]?.id;
    }

    chooseSpecialElectionTarget() {
        const targets = this.room.players.filter(p =>
            p.isAlive && p.id !== this.player.id
        );

        if (targets.length === 0) return null;

        if (this.isStaff) {
            const teammates = this.getTeammates().filter(t => targets.some(ta => ta.id === t.id));
            if (teammates.length > 0 && Math.random() > 0.25) {
                return teammates[Math.floor(Math.random() * teammates.length)].id;
            }
        }

        return targets[Math.floor(Math.random() * targets.length)]?.id;
    }

    chooseExecutionTarget() {
        const targets = this.room.players.filter(p =>
            p.isAlive && p.id !== this.player.id
        );

        if (targets.length === 0) return null;

        if (this.isStaff) {
            const butler = targets.find(t => t.role === 'butler');
            const nonButlerTargets = targets.filter(t => t.role !== 'butler');

            const guests = nonButlerTargets.filter(t => t.role === 'guest');
            const teammates = this.getTeammates().filter(t =>
                nonButlerTargets.some(nt => nt.id === t.id)
            );

            if (guests.length > 0) {
                if (Math.random() > 0.1) {
                    return guests[Math.floor(Math.random() * guests.length)].id;
                }
            }

            const safeTargets = nonButlerTargets.filter(t =>
                !teammates.some(tm => tm.id === t.id)
            );
            if (safeTargets.length > 0) {
                return safeTargets[Math.floor(Math.random() * safeTargets.length)].id;
            }

            if (nonButlerTargets.length > 0) {
                return nonButlerTargets[Math.floor(Math.random() * nonButlerTargets.length)].id;
            }
        } else {
            return targets[Math.floor(Math.random() * targets.length)]?.id;
        }

        return targets[Math.floor(Math.random() * targets.length)]?.id;
    }
}

// Export all functions and classes
module.exports = {
    // Constants
    roleConfigurations,
    PLAYER_AVATARS,
    AI_NAMES,
    AI_DELAY_MIN,
    AI_DELAY_MAX,

    // Utility functions
    getAIDelay,
    shuffleArray,
    generateRoomCode,
    getNextAvatar,

    // Room management
    createRoom,
    getPlayerInRoom,
    resetGameToLobby,

    // Game logic
    assignRoles,
    initializeDeck,
    drawPolicies,
    getExecutivePower,
    getPublicGameState,
    getPrivatePlayerState,
    advancePresidency,
    checkWinCondition,
    isValidChancellorCandidate,
    handleVotingComplete,
    getInvestigationResult,
    executePlayer,
    handleChaos,

    // AI functions
    generateAIPlayerId,
    addAIPlayers,
    isAIPlayer,
    getAIPlayers,
    AIBrain
};
