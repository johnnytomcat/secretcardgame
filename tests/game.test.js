/**
 * Secret Card Game - Unit Tests
 *
 * Run with: npm test
 * Run with coverage: npm run test:coverage
 */

const {
    roleConfigurations,
    PLAYER_AVATARS,
    shuffleArray,
    generateRoomCode,
    getNextAvatar,
    createRoom,
    getPlayerInRoom,
    resetGameToLobby,
    assignRoles,
    initializeDeck,
    drawPolicies,
    reshuffleDeckIfNeeded,
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
    generateAIPlayerId,
    addAIPlayers,
    isAIPlayer,
    getAIPlayers,
    AIBrain
} = require('../game-logic');

// Helper function to create mock rooms
function createMockRoom(playerCount) {
    const players = [];
    for (let i = 0; i < playerCount; i++) {
        players.push({
            id: `player_${i}`,
            name: `Player ${i}`,
            avatar: PLAYER_AVATARS[i % PLAYER_AVATARS.length].emoji,
            avatarColor: PLAYER_AVATARS[i % PLAYER_AVATARS.length].color,
            avatarIndex: i,
            role: null,
            isAlive: true,
            hasVoted: false,
            vote: null
        });
    }

    return {
        code: 'TEST',
        hostId: 'player_0',
        players,
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
            investigatedPlayers: [],
            vetoRequested: false,
            winner: null,
            winReason: null
        }
    };
}

describe('Room Creation and Joining', () => {
    test('Room code should be 4 characters', () => {
        const code = generateRoomCode();
        expect(code).toHaveLength(4);
    });

    test('Room code should only contain valid characters', () => {
        const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for (let i = 0; i < 100; i++) {
            const code = generateRoomCode();
            for (const char of code) {
                expect(validChars).toContain(char);
            }
        }
    });

    test('Room code should not contain ambiguous characters (0, O, 1, I)', () => {
        const ambiguous = '0OI1';
        for (let i = 0; i < 100; i++) {
            const code = generateRoomCode();
            for (const char of code) {
                expect(ambiguous).not.toContain(char);
            }
        }
    });

    test('createRoom should create room with correct structure', () => {
        const room = createRoom('host123', 'TestHost', 'session123');
        expect(room.hostId).toBe('host123');
        expect(room.players).toHaveLength(1);
        expect(room.players[0].name).toBe('TestHost');
        expect(room.gameState.phase).toBe('lobby');
    });

    test('Mock room should initialize with correct structure', () => {
        const room = createMockRoom(4);
        expect(room.players).toHaveLength(4);
        expect(room.gameState.phase).toBe('lobby');
        expect(room.gameState.guestPolicies).toBe(0);
        expect(room.gameState.staffPolicies).toBe(0);
    });
});

describe('Role Assignment', () => {
    test('4-player game should have correct role distribution', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        const roles = room.players.map(p => p.role);
        expect(roles.filter(r => r === 'guest')).toHaveLength(2);
        expect(roles.filter(r => r === 'staff')).toHaveLength(1);
        expect(roles.filter(r => r === 'butler')).toHaveLength(1);
    });

    test('5-player game should have correct role distribution', () => {
        const room = createMockRoom(5);
        assignRoles(room);

        const roles = room.players.map(p => p.role);
        expect(roles.filter(r => r === 'guest')).toHaveLength(3);
        expect(roles.filter(r => r === 'staff')).toHaveLength(1);
        expect(roles.filter(r => r === 'butler')).toHaveLength(1);
    });

    test('6-player game should have correct role distribution', () => {
        const room = createMockRoom(6);
        assignRoles(room);

        const roles = room.players.map(p => p.role);
        expect(roles.filter(r => r === 'guest')).toHaveLength(4);
        expect(roles.filter(r => r === 'staff')).toHaveLength(1);
        expect(roles.filter(r => r === 'butler')).toHaveLength(1);
    });

    test('Role assignment should be randomized', () => {
        const results = [];
        for (let i = 0; i < 20; i++) {
            const room = createMockRoom(4);
            assignRoles(room);
            results.push(room.players[0].role);
        }
        const uniqueRoles = [...new Set(results)];
        expect(uniqueRoles.length).toBeGreaterThan(1);
    });

    test('assignRoles should return false for invalid player count', () => {
        const room = createMockRoom(3);
        const result = assignRoles(room);
        expect(result).toBe(false);
    });
});

describe('Avatar Management', () => {
    test('getNextAvatar should return first avatar for empty room', () => {
        const room = { players: [] };
        const avatar = getNextAvatar(room);
        expect(avatar.index).toBe(0);
        expect(avatar.emoji).toBe('🦁');
    });

    test('getNextAvatar should skip used avatars', () => {
        const room = { players: [{ avatarIndex: 0 }, { avatarIndex: 1 }] };
        const avatar = getNextAvatar(room);
        expect(avatar.index).toBe(2);
    });

    test('getNextAvatar should fallback when all used', () => {
        const room = { players: [
            { avatarIndex: 0 }, { avatarIndex: 1 }, { avatarIndex: 2 },
            { avatarIndex: 3 }, { avatarIndex: 4 }, { avatarIndex: 5 }
        ]};
        const avatar = getNextAvatar(room);
        expect(avatar.index).toBe(0);
    });
});

describe('Presidential Rotation', () => {
    test('Presidency should advance to next player', () => {
        const room = createMockRoom(4);
        room.gameState.currentPresidentIndex = 0;

        advancePresidency(room);
        expect(room.gameState.currentPresidentIndex).toBe(1);
    });

    test('Presidency should wrap around to first player', () => {
        const room = createMockRoom(4);
        room.gameState.currentPresidentIndex = 3;

        advancePresidency(room);
        expect(room.gameState.currentPresidentIndex).toBe(0);
    });

    test('Presidency should skip dead players', () => {
        const room = createMockRoom(4);
        room.gameState.currentPresidentIndex = 0;
        room.players[1].isAlive = false;

        advancePresidency(room);
        expect(room.gameState.currentPresidentIndex).toBe(2);
    });

    test('Presidency should skip multiple consecutive dead players', () => {
        const room = createMockRoom(5);
        room.gameState.currentPresidentIndex = 0;
        room.players[1].isAlive = false;
        room.players[2].isAlive = false;

        advancePresidency(room);
        expect(room.gameState.currentPresidentIndex).toBe(3);
    });

    test('Previous president/chancellor should be tracked', () => {
        const room = createMockRoom(4);
        room.gameState.currentPresidentIndex = 0;
        room.gameState.currentChancellorId = 'player_1';

        advancePresidency(room);

        expect(room.gameState.previousPresidentId).toBe('player_0');
        expect(room.gameState.previousChancellorId).toBe('player_1');
    });

    test('Special election should restore normal rotation', () => {
        const room = createMockRoom(4);
        room.gameState.currentPresidentIndex = 2;
        room.gameState.specialElectionNextIndex = 1;

        advancePresidency(room);

        expect(room.gameState.currentPresidentIndex).toBe(1);
        expect(room.gameState.specialElectionNextIndex).toBeNull();
    });
});

describe('Chancellor Nomination Restrictions', () => {
    test('President cannot nominate themselves', () => {
        const room = createMockRoom(4);
        room.gameState.currentPresidentIndex = 0;

        expect(isValidChancellorCandidate(room, 'player_0')).toBe(false);
    });

    test('Previous chancellor cannot be nominated', () => {
        const room = createMockRoom(4);
        room.gameState.currentPresidentIndex = 0;
        room.gameState.previousChancellorId = 'player_1';

        expect(isValidChancellorCandidate(room, 'player_1')).toBe(false);
    });

    test('Previous president CAN be nominated in 5-player games', () => {
        const room = createMockRoom(5);
        room.gameState.currentPresidentIndex = 1;
        room.gameState.previousPresidentId = 'player_0';

        expect(isValidChancellorCandidate(room, 'player_0')).toBe(true);
    });

    test('Previous president CANNOT be nominated in 6-player games', () => {
        const room = createMockRoom(6);
        room.gameState.currentPresidentIndex = 1;
        room.gameState.previousPresidentId = 'player_0';

        expect(isValidChancellorCandidate(room, 'player_0')).toBe(false);
    });

    test('Dead players cannot be nominated', () => {
        const room = createMockRoom(4);
        room.gameState.currentPresidentIndex = 0;
        room.players[1].isAlive = false;

        expect(isValidChancellorCandidate(room, 'player_1')).toBe(false);
    });

    test('Valid candidate should be accepted', () => {
        const room = createMockRoom(4);
        room.gameState.currentPresidentIndex = 0;

        expect(isValidChancellorCandidate(room, 'player_2')).toBe(true);
    });
});

describe('Voting Mechanics', () => {
    test('Majority yes votes should pass', () => {
        const room = createMockRoom(4);
        room.gameState.chancellorCandidateId = 'player_1';
        room.players[0].vote = true;
        room.players[1].vote = true;
        room.players[2].vote = true;
        room.players[3].vote = false;

        expect(handleVotingComplete(room)).toBe(true);
    });

    test('Majority no votes should fail', () => {
        const room = createMockRoom(4);
        room.gameState.chancellorCandidateId = 'player_1';
        room.players[0].vote = false;
        room.players[1].vote = false;
        room.players[2].vote = false;
        room.players[3].vote = true;

        expect(handleVotingComplete(room)).toBe(false);
    });

    test('Tie votes should fail (requires strict majority)', () => {
        const room = createMockRoom(4);
        room.gameState.chancellorCandidateId = 'player_1';
        room.players[0].vote = true;
        room.players[1].vote = true;
        room.players[2].vote = false;
        room.players[3].vote = false;

        expect(handleVotingComplete(room)).toBe(false);
    });

    test('Election tracker should increment on failed vote', () => {
        const room = createMockRoom(4);
        room.gameState.chancellorCandidateId = 'player_1';
        room.gameState.electionTracker = 0;
        room.players.forEach(p => p.vote = false);

        handleVotingComplete(room);
        expect(room.gameState.electionTracker).toBe(1);
    });

    test('Election tracker should reset on passed vote', () => {
        const room = createMockRoom(4);
        room.gameState.chancellorCandidateId = 'player_1';
        assignRoles(room);
        room.players.find(p => p.id === 'player_1').role = 'guest';
        room.gameState.electionTracker = 2;
        room.players[0].vote = true;
        room.players[1].vote = true;
        room.players[2].vote = true;
        room.players[3].vote = false;

        handleVotingComplete(room);
        expect(room.gameState.electionTracker).toBe(0);
    });

    test('Only alive players votes should count', () => {
        const room = createMockRoom(4);
        room.gameState.chancellorCandidateId = 'player_1';
        assignRoles(room);
        room.players.find(p => p.id === 'player_1').role = 'guest';

        room.players[0].isAlive = false;
        room.players[0].vote = false;
        room.players[1].vote = true;
        room.players[2].vote = true;
        room.players[3].vote = false;

        expect(handleVotingComplete(room)).toBe(true);
    });
});

describe('Legislative Session', () => {
    test('Initial deck should have 17 cards (6 guest, 11 staff)', () => {
        const room = createMockRoom(4);
        initializeDeck(room);

        expect(room.gameState.policyDeck).toHaveLength(17);
        expect(room.gameState.policyDeck.filter(p => p === 'guest')).toHaveLength(6);
        expect(room.gameState.policyDeck.filter(p => p === 'staff')).toHaveLength(11);
    });

    test('Drawing 3 cards should reduce deck by 3', () => {
        const room = createMockRoom(4);
        initializeDeck(room);

        const policies = drawPolicies(room, 3);

        expect(policies).toHaveLength(3);
        expect(room.gameState.policyDeck).toHaveLength(14);
    });

    test('Drawing cards when deck is empty should reshuffle discard pile', () => {
        const room = createMockRoom(4);
        room.gameState.policyDeck = [];
        room.gameState.discardPile = ['guest', 'staff', 'staff', 'guest', 'staff'];

        const policies = drawPolicies(room, 3);

        expect(policies).toHaveLength(3);
        expect(room.gameState.discardPile).toHaveLength(0);
        expect(room.gameState.policyDeck).toHaveLength(2);
    });

    test('Policy cards should only be guest or staff', () => {
        const room = createMockRoom(4);
        initializeDeck(room);

        room.gameState.policyDeck.forEach(policy => {
            expect(['guest', 'staff']).toContain(policy);
        });
    });
});

describe('Policy Enactment and Win Conditions', () => {
    test('5 guest policies should trigger guest win', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.guestPolicies = 5;

        expect(checkWinCondition(room)).toBe(true);
        expect(room.gameState.winner).toBe('guest');
        expect(room.gameState.phase).toBe('gameover');
    });

    test('6 staff policies should trigger staff win', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.staffPolicies = 6;

        expect(checkWinCondition(room)).toBe(true);
        expect(room.gameState.winner).toBe('staff');
        expect(room.gameState.phase).toBe('gameover');
    });

    test('4 guest policies should not trigger win', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.guestPolicies = 4;

        expect(checkWinCondition(room)).toBe(false);
    });

    test('5 staff policies should not trigger win', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.staffPolicies = 5;

        expect(checkWinCondition(room)).toBe(false);
    });
});

describe('Executive Powers', () => {
    test('4-player: 3rd staff policy triggers examine', () => {
        expect(getExecutivePower(3, 4)).toBe('examine');
    });

    test('4-player: 4th staff policy triggers execute', () => {
        expect(getExecutivePower(4, 4)).toBe('execute');
    });

    test('4-player: 5th staff policy triggers execute', () => {
        expect(getExecutivePower(5, 4)).toBe('execute');
    });

    test('5-player: 3rd staff policy triggers examine', () => {
        expect(getExecutivePower(3, 5)).toBe('examine');
    });

    test('6-player: 3rd staff policy triggers investigate', () => {
        expect(getExecutivePower(3, 6)).toBe('investigate');
    });

    test('6-player: 4th staff policy triggers special-election', () => {
        expect(getExecutivePower(4, 6)).toBe('special-election');
    });

    test('1st and 2nd staff policies should not trigger powers', () => {
        expect(getExecutivePower(1, 4)).toBeNull();
        expect(getExecutivePower(2, 4)).toBeNull();
    });
});

describe('Butler Win Conditions', () => {
    test('Butler elected as chancellor with 3+ staff policies = staff win', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        const butler = room.players.find(p => p.role === 'butler');
        room.gameState.chancellorCandidateId = butler.id;
        room.gameState.staffPolicies = 3;
        room.players.forEach(p => p.vote = true);

        handleVotingComplete(room);

        expect(room.gameState.winner).toBe('staff');
        expect(room.gameState.phase).toBe('gameover');
    });

    test('Butler elected with < 3 staff policies = no win', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        const butler = room.players.find(p => p.role === 'butler');
        room.gameState.chancellorCandidateId = butler.id;
        room.gameState.staffPolicies = 2;
        room.players.forEach(p => p.vote = true);

        handleVotingComplete(room);

        expect(room.gameState.winner).toBeNull();
    });

    test('Dismissing Butler should trigger guest win', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        const butler = room.players.find(p => p.role === 'butler');
        butler.isAlive = false;

        expect(checkWinCondition(room)).toBe(true);
        expect(room.gameState.winner).toBe('guest');
    });
});

describe('Execution Mechanics', () => {
    test('executePlayer should mark player as dead', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        const target = executePlayer(room, 'player_1');

        expect(target.isAlive).toBe(false);
        expect(room.gameState.executedPlayer).not.toBeNull();
        expect(room.gameState.executedPlayer.name).toBe('Player 1');
    });

    test('executePlayer should include avatar info', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        executePlayer(room, 'player_1');

        expect(room.gameState.executedPlayer.avatar).toBeDefined();
        expect(room.gameState.executedPlayer.avatarColor).toBeDefined();
        expect(room.gameState.executedPlayer.role).toBeDefined();
    });

    test('executePlayer should return null for dead player', () => {
        const room = createMockRoom(4);
        room.players[1].isAlive = false;

        expect(executePlayer(room, 'player_1')).toBeNull();
    });

    test('executePlayer should return null for invalid player', () => {
        const room = createMockRoom(4);

        expect(executePlayer(room, 'invalid_player')).toBeNull();
    });
});

describe('Investigation Mechanics', () => {
    test('Guest should show guest party', () => {
        expect(getInvestigationResult({ role: 'guest' })).toBe('guest');
    });

    test('Staff should show staff party', () => {
        expect(getInvestigationResult({ role: 'staff' })).toBe('staff');
    });

    test('Butler should show staff party', () => {
        expect(getInvestigationResult({ role: 'butler' })).toBe('staff');
    });
});

describe('Chaos Mechanics', () => {
    test('handleChaos should reset election tracker', () => {
        const room = createMockRoom(4);
        initializeDeck(room);
        room.gameState.electionTracker = 3;

        handleChaos(room);

        expect(room.gameState.electionTracker).toBe(0);
    });

    test('handleChaos should clear term limits', () => {
        const room = createMockRoom(4);
        initializeDeck(room);
        room.gameState.previousPresidentId = 'player_0';
        room.gameState.previousChancellorId = 'player_1';

        handleChaos(room);

        expect(room.gameState.previousPresidentId).toBeNull();
        expect(room.gameState.previousChancellorId).toBeNull();
    });

    test('handleChaos should enact a policy', () => {
        const room = createMockRoom(4);
        initializeDeck(room);
        const initialTotal = room.gameState.guestPolicies + room.gameState.staffPolicies;

        handleChaos(room);

        const newTotal = room.gameState.guestPolicies + room.gameState.staffPolicies;
        expect(newTotal).toBe(initialTotal + 1);
        expect(room.gameState.chaosPolicy).toBeDefined();
    });
});

describe('AI Player Functions', () => {
    test('generateAIPlayerId should create unique IDs', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
            ids.add(generateAIPlayerId());
        }
        expect(ids.size).toBe(100);
    });

    test('generateAIPlayerId should start with AI_', () => {
        expect(generateAIPlayerId()).toMatch(/^AI_/);
    });

    test('addAIPlayers should add correct number of AIs', () => {
        const room = createMockRoom(2);
        addAIPlayers(room, 4);

        expect(room.players).toHaveLength(4);
        expect(room.players.filter(p => p.isAI)).toHaveLength(2);
    });

    test('addAIPlayers should give AIs proper avatars', () => {
        const room = createMockRoom(1);
        addAIPlayers(room, 3);

        const aiPlayers = room.players.filter(p => p.isAI);
        aiPlayers.forEach(ai => {
            expect(ai.avatar).toBeDefined();
            expect(ai.avatarColor).toBeDefined();
            expect(ai.name).toBeDefined();
        });
    });

    test('isAIPlayer should identify AI players', () => {
        expect(isAIPlayer({ isAI: true })).toBe(true);
        expect(isAIPlayer({ isAI: false })).toBe(false);
        expect(isAIPlayer(null)).toBe(false);
    });

    test('getAIPlayers should filter correctly', () => {
        const room = createMockRoom(2);
        addAIPlayers(room, 4);
        room.players[2].isAlive = false;

        expect(getAIPlayers(room)).toHaveLength(1);
    });
});

describe('AIBrain Decision Making', () => {
    test('AIBrain should initialize correctly', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        const player = room.players[0];

        const brain = new AIBrain(room, player);

        expect(brain.player.id).toBe(player.id);
        expect(brain.role).toBe(player.role);
    });

    test('AIBrain.getTeammates should return teammates for staff', () => {
        const room = createMockRoom(5);
        assignRoles(room);
        const staff = room.players.find(p => p.role === 'staff');

        const brain = new AIBrain(room, staff);
        const teammates = brain.getTeammates();

        expect(teammates.length).toBeGreaterThanOrEqual(1);
        expect(teammates.some(t => t.role === 'butler')).toBe(true);
    });

    test('AIBrain.getTeammates should return empty for guest', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        const guest = room.players.find(p => p.role === 'guest');

        const brain = new AIBrain(room, guest);

        expect(brain.getTeammates()).toHaveLength(0);
    });

    test('AIBrain.decideVote should return boolean', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.chancellorCandidateId = 'player_1';

        const brain = new AIBrain(room, room.players[0]);

        expect(typeof brain.decideVote()).toBe('boolean');
    });

    test('AIBrain.chooseChancellor should return valid candidate', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.currentPresidentIndex = 0;

        const brain = new AIBrain(room, room.players[0]);
        const choice = brain.chooseChancellor();

        expect(choice).not.toBeNull();
        expect(choice).not.toBe(room.players[0].id);
    });

    test('AIBrain.choosePresidentPolicies should return 2 indices', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        const brain = new AIBrain(room, room.players[0]);
        const indices = brain.choosePresidentPolicies(['guest', 'staff', 'staff']);

        expect(indices).toHaveLength(2);
        expect(indices[0]).toBeGreaterThanOrEqual(0);
        expect(indices[0]).toBeLessThanOrEqual(2);
        expect(indices[1]).toBeGreaterThanOrEqual(0);
        expect(indices[1]).toBeLessThanOrEqual(2);
    });

    test('AIBrain.chooseChancellorEnact should return valid index', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        const brain = new AIBrain(room, room.players[0]);
        const index = brain.chooseChancellorEnact(['guest', 'staff']);

        expect([0, 1]).toContain(index);
    });

    test('AIBrain.chooseInvestigateTarget should return valid target', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        const brain = new AIBrain(room, room.players[0]);
        const target = brain.chooseInvestigateTarget();

        expect(target).not.toBeNull();
        expect(target).not.toBe(room.players[0].id);
    });

    test('AIBrain.chooseExecutionTarget should return valid target', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        const brain = new AIBrain(room, room.players[0]);
        const target = brain.chooseExecutionTarget();

        expect(target).not.toBeNull();
        expect(target).not.toBe(room.players[0].id);
    });

    test('AIBrain.chooseSpecialElectionTarget should return valid target', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        const brain = new AIBrain(room, room.players[0]);
        const target = brain.chooseSpecialElectionTarget();

        expect(target).not.toBeNull();
        expect(target).not.toBe(room.players[0].id);
    });
});

describe('Public/Private Game State', () => {
    test('getPublicGameState should hide roles during game', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.phase = 'election';

        const publicState = getPublicGameState(room);

        publicState.players.forEach(p => {
            expect(p.role).toBeUndefined();
        });
    });

    test('getPublicGameState should reveal roles on gameover', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.phase = 'gameover';

        const publicState = getPublicGameState(room);

        publicState.players.forEach(p => {
            expect(p.role).toBeDefined();
        });
    });

    test('getPrivatePlayerState should show role to player', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.phase = 'election';

        const privateState = getPrivatePlayerState(room, 'player_0');

        expect(privateState.role).toBeDefined();
    });

    test('getPrivatePlayerState should show teammates to staff', () => {
        const room = createMockRoom(5);
        assignRoles(room);
        const staff = room.players.find(p => p.role === 'staff');

        const privateState = getPrivatePlayerState(room, staff.id);

        expect(privateState.teammates).not.toBeNull();
        expect(privateState.teammates.length).toBeGreaterThanOrEqual(1);
    });

    test('getPrivatePlayerState should not show teammates to guest', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        const guest = room.players.find(p => p.role === 'guest');

        const privateState = getPrivatePlayerState(room, guest.id);

        expect(privateState.teammates).toBeNull();
    });

    test('getPrivatePlayerState should return null for invalid player', () => {
        const room = createMockRoom(4);

        expect(getPrivatePlayerState(room, 'invalid_id')).toBeNull();
    });
});

describe('Game Reset', () => {
    test('resetGameToLobby should clear game state', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.phase = 'gameover';
        room.gameState.winner = 'guest';
        room.gameState.staffPolicies = 3;
        room.gameState.guestPolicies = 5;

        resetGameToLobby(room);

        expect(room.gameState.phase).toBe('lobby');
        expect(room.gameState.winner).toBeNull();
        expect(room.gameState.guestPolicies).toBe(0);
        expect(room.gameState.staffPolicies).toBe(0);
    });

    test('resetGameToLobby should remove AI players', () => {
        const room = createMockRoom(2);
        addAIPlayers(room, 4);

        resetGameToLobby(room);

        expect(room.players.filter(p => p.isAI)).toHaveLength(0);
    });

    test('resetGameToLobby should revive players', () => {
        const room = createMockRoom(4);
        room.players[0].isAlive = false;
        room.players[1].isAlive = false;

        resetGameToLobby(room);

        room.players.forEach(p => {
            expect(p.isAlive).toBe(true);
        });
    });

    test('resetGameToLobby should clear roles', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        resetGameToLobby(room);

        room.players.forEach(p => {
            expect(p.role).toBeNull();
        });
    });
});

describe('Shuffle Function', () => {
    test('Shuffle should preserve all elements', () => {
        const original = [1, 2, 3, 4, 5];
        const shuffled = shuffleArray(original);

        expect(shuffled).toHaveLength(original.length);
        original.forEach(item => {
            expect(shuffled).toContain(item);
        });
    });

    test('Shuffle should not modify original array', () => {
        const original = [1, 2, 3, 4, 5];
        const originalCopy = [...original];
        shuffleArray(original);

        expect(original).toEqual(originalCopy);
    });

    test('Shuffle should produce randomized results', () => {
        const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const results = [];

        for (let i = 0; i < 20; i++) {
            results.push(shuffleArray(original).join(','));
        }

        const uniqueResults = [...new Set(results)];
        expect(uniqueResults.length).toBeGreaterThan(1);
    });
});

describe('getPlayerInRoom', () => {
    test('Should find player by ID', () => {
        const room = createMockRoom(4);
        const player = getPlayerInRoom(room, 'player_2');

        expect(player.id).toBe('player_2');
    });

    test('Should return undefined for invalid ID', () => {
        const room = createMockRoom(4);

        expect(getPlayerInRoom(room, 'invalid')).toBeUndefined();
    });
});

describe('Player Status Bar Data', () => {
    test('getPublicGameState should include currentPresidentId', () => {
        const room = createMockRoom(4);
        room.gameState.phase = 'election';
        room.gameState.currentPresidentIndex = 2;

        const publicState = getPublicGameState(room);

        expect(publicState.currentPresidentId).toBe('player_2');
        expect(publicState.currentPresidentIndex).toBe(2);
    });

    test('getPublicGameState should include currentChancellorId when set', () => {
        const room = createMockRoom(4);
        room.gameState.phase = 'legislative-president';
        room.gameState.currentChancellorId = 'player_1';

        const publicState = getPublicGameState(room);

        expect(publicState.currentChancellorId).toBe('player_1');
    });

    test('getPublicGameState should have null chancellorId before election', () => {
        const room = createMockRoom(4);
        room.gameState.phase = 'election';
        room.gameState.currentChancellorId = null;

        const publicState = getPublicGameState(room);

        expect(publicState.currentChancellorId).toBeNull();
    });

    test('getPublicGameState should include chancellorCandidateId during voting', () => {
        const room = createMockRoom(4);
        room.gameState.phase = 'voting';
        room.gameState.chancellorCandidateId = 'player_3';

        const publicState = getPublicGameState(room);

        expect(publicState.chancellorCandidateId).toBe('player_3');
    });

    test('getPublicGameState should expose player isAlive status', () => {
        const room = createMockRoom(4);
        room.players[1].isAlive = false;
        room.players[2].isAlive = true;

        const publicState = getPublicGameState(room);

        expect(publicState.players[1].isAlive).toBe(false);
        expect(publicState.players[2].isAlive).toBe(true);
    });

    test('getPublicGameState should expose player isAI status', () => {
        const room = createMockRoom(2);
        addAIPlayers(room, 4);

        const publicState = getPublicGameState(room);

        expect(publicState.players[0].isAI).toBe(false);
        expect(publicState.players[2].isAI).toBe(true);
        expect(publicState.players[3].isAI).toBe(true);
    });

    test('getPublicGameState should include player avatar and avatarColor', () => {
        const room = createMockRoom(4);

        const publicState = getPublicGameState(room);

        publicState.players.forEach(p => {
            expect(p.avatar).toBeDefined();
            expect(p.avatarColor).toBeDefined();
        });
    });

    test('getPublicGameState should include hasVoted status', () => {
        const room = createMockRoom(4);
        room.gameState.phase = 'voting';
        room.players[0].hasVoted = true;
        room.players[1].hasVoted = false;

        const publicState = getPublicGameState(room);

        expect(publicState.players[0].hasVoted).toBe(true);
        expect(publicState.players[1].hasVoted).toBe(false);
    });

    test('getPublicGameState should include previous president and chancellor IDs', () => {
        const room = createMockRoom(4);
        room.gameState.previousPresidentId = 'player_0';
        room.gameState.previousChancellorId = 'player_1';

        const publicState = getPublicGameState(room);

        expect(publicState.previousPresidentId).toBe('player_0');
        expect(publicState.previousChancellorId).toBe('player_1');
    });

    test('President should change after advancePresidency', () => {
        const room = createMockRoom(4);
        room.gameState.currentPresidentIndex = 0;

        const initialState = getPublicGameState(room);
        expect(initialState.currentPresidentId).toBe('player_0');

        advancePresidency(room);

        const newState = getPublicGameState(room);
        expect(newState.currentPresidentId).toBe('player_1');
    });

    test('Chancellor should be set after successful vote', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.currentPresidentIndex = 0;
        room.gameState.chancellorCandidateId = 'player_2';
        room.gameState.staffPolicies = 0;

        // Make player_2 a guest to avoid Butler win
        room.players[2].role = 'guest';
        room.players.forEach(p => p.vote = true);

        handleVotingComplete(room);

        expect(room.gameState.currentChancellorId).toBe('player_2');
    });

    test('Dead players should be marked in public state', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        executePlayer(room, 'player_1');

        const publicState = getPublicGameState(room);
        expect(publicState.players[1].isAlive).toBe(false);
        expect(publicState.executedPlayer).not.toBeNull();
        expect(publicState.executedPlayer.name).toBe('Player 1');
    });

    test('getPublicGameState should include election tracker', () => {
        const room = createMockRoom(4);
        room.gameState.electionTracker = 2;

        const publicState = getPublicGameState(room);

        expect(publicState.electionTracker).toBe(2);
    });

    test('getPublicGameState should include policy counts', () => {
        const room = createMockRoom(4);
        room.gameState.guestPolicies = 3;
        room.gameState.staffPolicies = 2;

        const publicState = getPublicGameState(room);

        expect(publicState.guestPolicies).toBe(3);
        expect(publicState.staffPolicies).toBe(2);
    });

    test('getPublicGameState should include deck count', () => {
        const room = createMockRoom(4);
        initializeDeck(room);

        const publicState = getPublicGameState(room);

        expect(publicState.deckCount).toBe(17);
    });
});

// ============================================================
// NEW TESTS FOR RULE FIXES
// ============================================================

describe('Term Limits - Alive Players Check (Bug Fix)', () => {
    test('Previous president CAN be nominated when 6 players but only 5 alive', () => {
        const room = createMockRoom(6);
        room.gameState.currentPresidentIndex = 1;
        room.gameState.previousPresidentId = 'player_0';
        // Kill one player so only 5 are alive
        room.players[5].isAlive = false;

        // With only 5 alive players, previous president should be valid
        expect(isValidChancellorCandidate(room, 'player_0')).toBe(true);
    });

    test('Previous president CANNOT be nominated when 6 players and all alive', () => {
        const room = createMockRoom(6);
        room.gameState.currentPresidentIndex = 1;
        room.gameState.previousPresidentId = 'player_0';

        // With 6 alive players, previous president should be invalid
        expect(isValidChancellorCandidate(room, 'player_0')).toBe(false);
    });

    test('Previous president CAN be nominated when started with 6 but 2 dead', () => {
        const room = createMockRoom(6);
        room.gameState.currentPresidentIndex = 2;
        room.gameState.previousPresidentId = 'player_0';
        // Kill two players so only 4 are alive
        room.players[4].isAlive = false;
        room.players[5].isAlive = false;

        // With only 4 alive players, previous president should be valid
        expect(isValidChancellorCandidate(room, 'player_0')).toBe(true);
    });

    test('AI chooseChancellor respects alive player term limits', () => {
        const room = createMockRoom(6);
        assignRoles(room);
        room.gameState.currentPresidentIndex = 2;
        room.gameState.previousPresidentId = 'player_0';
        room.gameState.previousChancellorId = 'player_1';
        // Kill one player so only 5 are alive
        room.players[5].isAlive = false;

        const brain = new AIBrain(room, room.players[2]);

        // Run multiple times to ensure it never picks invalid candidates
        for (let i = 0; i < 20; i++) {
            const choice = brain.chooseChancellor();
            expect(choice).not.toBe('player_1'); // Previous chancellor always invalid
            expect(choice).not.toBe('player_2'); // Self always invalid
            // player_0 (previous president) should now be valid since only 5 alive
        }
    });
});

describe('Deck Reshuffle When < 3 Cards (Bug Fix)', () => {
    test('reshuffleDeckIfNeeded should reshuffle when deck has < 3 cards', () => {
        const room = createMockRoom(4);
        room.gameState.policyDeck = ['guest', 'staff'];
        room.gameState.discardPile = ['staff', 'staff', 'guest', 'staff', 'guest'];

        reshuffleDeckIfNeeded(room);

        expect(room.gameState.policyDeck.length).toBe(7); // 2 + 5
        expect(room.gameState.discardPile.length).toBe(0);
    });

    test('reshuffleDeckIfNeeded should not reshuffle when deck has >= 3 cards', () => {
        const room = createMockRoom(4);
        room.gameState.policyDeck = ['guest', 'staff', 'staff'];
        room.gameState.discardPile = ['staff', 'guest'];

        reshuffleDeckIfNeeded(room);

        expect(room.gameState.policyDeck.length).toBe(3);
        expect(room.gameState.discardPile.length).toBe(2);
    });

    test('reshuffleDeckIfNeeded should reshuffle when deck is empty', () => {
        const room = createMockRoom(4);
        room.gameState.policyDeck = [];
        room.gameState.discardPile = ['staff', 'staff', 'guest', 'staff'];

        reshuffleDeckIfNeeded(room);

        expect(room.gameState.policyDeck.length).toBe(4);
        expect(room.gameState.discardPile.length).toBe(0);
    });

    test('reshuffleDeckIfNeeded should reshuffle when deck has 1 card', () => {
        const room = createMockRoom(4);
        room.gameState.policyDeck = ['guest'];
        room.gameState.discardPile = ['staff', 'staff', 'staff'];

        reshuffleDeckIfNeeded(room);

        expect(room.gameState.policyDeck.length).toBe(4);
        expect(room.gameState.discardPile.length).toBe(0);
    });

    test('reshuffleDeckIfNeeded preserves all cards', () => {
        const room = createMockRoom(4);
        room.gameState.policyDeck = ['guest', 'staff'];
        room.gameState.discardPile = ['staff', 'guest', 'staff'];

        const totalBefore = room.gameState.policyDeck.length + room.gameState.discardPile.length;
        const guestsBefore = [...room.gameState.policyDeck, ...room.gameState.discardPile].filter(p => p === 'guest').length;
        const staffBefore = [...room.gameState.policyDeck, ...room.gameState.discardPile].filter(p => p === 'staff').length;

        reshuffleDeckIfNeeded(room);

        const totalAfter = room.gameState.policyDeck.length;
        const guestsAfter = room.gameState.policyDeck.filter(p => p === 'guest').length;
        const staffAfter = room.gameState.policyDeck.filter(p => p === 'staff').length;

        expect(totalAfter).toBe(totalBefore);
        expect(guestsAfter).toBe(guestsBefore);
        expect(staffAfter).toBe(staffBefore);
    });
});

describe('Investigation Tracking - No Duplicate Investigations (Bug Fix)', () => {
    test('investigatedPlayers should be included in public game state', () => {
        const room = createMockRoom(6);
        room.gameState.investigatedPlayers = ['player_1', 'player_2'];

        const publicState = getPublicGameState(room);

        expect(publicState.investigatedPlayers).toEqual(['player_1', 'player_2']);
    });

    test('investigatedPlayers should be empty initially', () => {
        const room = createMockRoom(6);

        const publicState = getPublicGameState(room);

        expect(publicState.investigatedPlayers).toEqual([]);
    });

    test('AI chooseInvestigateTarget should not target already-investigated players', () => {
        const room = createMockRoom(6);
        assignRoles(room);
        room.gameState.investigatedPlayers = ['player_1', 'player_2', 'player_3'];

        const brain = new AIBrain(room, room.players[0]);

        // Run multiple times to ensure it never picks investigated players
        for (let i = 0; i < 20; i++) {
            const target = brain.chooseInvestigateTarget();
            expect(target).not.toBe('player_0'); // Self
            expect(target).not.toBe('player_1'); // Already investigated
            expect(target).not.toBe('player_2'); // Already investigated
            expect(target).not.toBe('player_3'); // Already investigated
            // Should only pick player_4 or player_5
            expect(['player_4', 'player_5']).toContain(target);
        }
    });

    test('AI chooseInvestigateTarget returns null when all eligible players investigated', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        // Investigate all other players
        room.gameState.investigatedPlayers = ['player_1', 'player_2', 'player_3'];

        const brain = new AIBrain(room, room.players[0]);
        const target = brain.chooseInvestigateTarget();

        expect(target).toBeNull();
    });

    test('resetGameToLobby should clear investigatedPlayers', () => {
        const room = createMockRoom(6);
        room.gameState.investigatedPlayers = ['player_1', 'player_2'];

        resetGameToLobby(room);

        expect(room.gameState.investigatedPlayers).toEqual([]);
    });
});

describe('Veto Power Mechanics (New Feature)', () => {
    test('vetoRequested should be included in public game state', () => {
        const room = createMockRoom(4);
        room.gameState.vetoRequested = true;

        const publicState = getPublicGameState(room);

        expect(publicState.vetoRequested).toBe(true);
    });

    test('vetoRequested should be false initially', () => {
        const room = createMockRoom(4);

        const publicState = getPublicGameState(room);

        expect(publicState.vetoRequested).toBe(false);
    });

    test('AI shouldRequestVeto returns false when < 5 staff policies', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.staffPolicies = 4;

        const brain = new AIBrain(room, room.players[0]);
        const shouldVeto = brain.shouldRequestVeto(['guest', 'staff']);

        expect(shouldVeto).toBe(false);
    });

    test('AI shouldRequestVeto can return true when >= 5 staff policies and no favorable policy', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.staffPolicies = 5;
        const guest = room.players.find(p => p.role === 'guest');

        const brain = new AIBrain(room, guest);

        // Guest with only staff policies should often want to veto
        let vetoCount = 0;
        for (let i = 0; i < 50; i++) {
            if (brain.shouldRequestVeto(['staff', 'staff'])) {
                vetoCount++;
            }
        }
        // Should veto at least some of the time (80% chance per AI logic)
        expect(vetoCount).toBeGreaterThan(20);
    });

    test('AI shouldRequestVeto returns false when favorable policy available', () => {
        const room = createMockRoom(4);
        assignRoles(room);
        room.gameState.staffPolicies = 5;
        const guest = room.players.find(p => p.role === 'guest');

        const brain = new AIBrain(room, guest);

        // Guest with a guest policy available should usually not veto
        let noVetoCount = 0;
        for (let i = 0; i < 50; i++) {
            if (!brain.shouldRequestVeto(['guest', 'staff'])) {
                noVetoCount++;
            }
        }
        // Should NOT veto most of the time when they have a good policy
        expect(noVetoCount).toBe(50);
    });

    test('AI shouldAcceptVeto returns boolean', () => {
        const room = createMockRoom(4);
        assignRoles(room);

        const brain = new AIBrain(room, room.players[0]);
        const result = brain.shouldAcceptVeto();

        expect(typeof result).toBe('boolean');
    });

    test('resetGameToLobby should clear vetoRequested', () => {
        const room = createMockRoom(4);
        room.gameState.vetoRequested = true;

        resetGameToLobby(room);

        expect(room.gameState.vetoRequested).toBe(false);
    });
});

describe('Chaos Clears Term Limits (Bug Fix)', () => {
    test('handleChaos clears both previousPresidentId and previousChancellorId', () => {
        const room = createMockRoom(4);
        initializeDeck(room);
        room.gameState.previousPresidentId = 'player_0';
        room.gameState.previousChancellorId = 'player_1';
        room.gameState.electionTracker = 3;

        handleChaos(room);

        expect(room.gameState.previousPresidentId).toBeNull();
        expect(room.gameState.previousChancellorId).toBeNull();
    });

    test('After chaos, previously restricted players should be valid chancellor candidates', () => {
        const room = createMockRoom(6);
        room.gameState.currentPresidentIndex = 2;
        room.gameState.previousPresidentId = 'player_0';
        room.gameState.previousChancellorId = 'player_1';
        initializeDeck(room);

        // Before chaos, these should be invalid
        expect(isValidChancellorCandidate(room, 'player_0')).toBe(false);
        expect(isValidChancellorCandidate(room, 'player_1')).toBe(false);

        handleChaos(room);

        // After chaos, term limits are cleared - player_0 and player_1 should now be valid
        expect(isValidChancellorCandidate(room, 'player_0')).toBe(true);
        expect(isValidChancellorCandidate(room, 'player_1')).toBe(true);
    });

    test('handleChaos resets election tracker to 0', () => {
        const room = createMockRoom(4);
        initializeDeck(room);
        room.gameState.electionTracker = 3;

        handleChaos(room);

        expect(room.gameState.electionTracker).toBe(0);
    });
});
