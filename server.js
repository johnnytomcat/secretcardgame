const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import shared game logic
const {
    PLAYER_AVATARS,
    getAIDelay,
    generateRoomCode,
    getNextAvatar,
    getPlayerInRoom,
    assignRoles,
    initializeDeck,
    drawPolicies,
    reshuffleDeckIfNeeded,
    getExecutivePower,
    getPublicGameState,
    getPrivatePlayerState,
    advancePresidency,
    checkWinCondition,
    addAIPlayers,
    isAIPlayer,
    AIBrain
} = require('./game-logic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game rooms storage
const rooms = new Map();

function createRoom(hostId, hostName, sessionId = null) {
    let code;
    do {
        code = generateRoomCode();
    } while (rooms.has(code));

    const firstAvatar = PLAYER_AVATARS[0];

    const room = {
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
            investigatedPlayers: [],  // Track who has been investigated (per rules: no player may be investigated twice)
            vetoRequested: false,  // Track if Chancellor has requested a veto (available after 5 fascist policies)
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


function broadcastGameState(room) {
    const publicState = getPublicGameState(room);
    room.players.forEach(player => {
        const privateState = getPrivatePlayerState(room, player.id);
        io.to(player.id).emit('gameState', { public: publicState, private: privateState });
    });
}


// ==================== AI PLAYER SYSTEM ====================

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
            }, 5000);
            break;
        case 'legislative-president':
            processAIPresidentLegislative(room);
            break;
        case 'legislative-chancellor':
            // Handle veto response if veto was requested, otherwise let chancellor act
            if (room.gameState.vetoRequested) {
                processAIVetoResponse(room);
            } else {
                processAIChancellorLegislative(room);
            }
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
        const selectedIndices = ai.choosePresidentPolicies(room.gameState.currentPolicies);

        // Find the index that wasn't selected (the one to discard)
        const discardIndex = [0, 1, 2].find(i => !selectedIndices.includes(i));
        const discarded = room.gameState.currentPolicies[discardIndex];
        room.gameState.discardPile.push(discarded);

        // Keep only the selected policies
        room.gameState.currentPolicies = selectedIndices.map(i => room.gameState.currentPolicies[i]);
        room.gameState.phase = 'legislative-chancellor';

        broadcastGameState(room);
        processAIActions(room);
    }, getAIDelay());
}

function processAIChancellorLegislative(room) {
    const chancellor = room.players.find(p => p.id === room.gameState.currentChancellorId);
    if (!isAIPlayer(chancellor)) return;

    // If veto was requested and we're waiting for president response, don't act
    if (room.gameState.vetoRequested) return;

    setTimeout(() => {
        if (room.gameState.phase !== 'legislative-chancellor') return;
        if (room.gameState.vetoRequested) return;  // Double-check

        const ai = new AIBrain(room, chancellor);

        // Consider requesting veto (only available after 5 staff policies)
        if (ai.shouldRequestVeto(room.gameState.currentPolicies)) {
            room.gameState.vetoRequested = true;
            broadcastGameState(room);
            processAIActions(room);  // This will trigger AI president to respond
            return;
        }

        const enactIndex = ai.chooseChancellorEnact(room.gameState.currentPolicies);

        const enacted = room.gameState.currentPolicies[enactIndex];
        const discardIndex = enactIndex === 0 ? 1 : 0;
        room.gameState.discardPile.push(room.gameState.currentPolicies[discardIndex]);
        room.gameState.currentPolicies = [];

        if (enacted === 'guest') {
            room.gameState.guestPolicies++;
        } else {
            room.gameState.staffPolicies++;
        }

        // Per official rules: reshuffle when fewer than 3 cards remain at end of legislative session
        reshuffleDeckIfNeeded(room);

        room.gameState.enactedPolicy = enacted;
        room.gameState.phase = 'policy-result';

        broadcastGameState(room);
        processAIActions(room);
    }, getAIDelay());
}

function processAIVetoResponse(room) {
    const president = room.players[room.gameState.currentPresidentIndex];
    if (!isAIPlayer(president)) return;

    setTimeout(() => {
        if (room.gameState.phase !== 'legislative-chancellor' || !room.gameState.vetoRequested) return;

        const ai = new AIBrain(room, president);
        const acceptVeto = ai.shouldAcceptVeto();

        if (acceptVeto) {
            // President accepts veto - discard both policies and increment election tracker
            room.gameState.discardPile.push(...room.gameState.currentPolicies);
            room.gameState.currentPolicies = [];
            room.gameState.electionTracker++;
            room.gameState.vetoRequested = false;

            // Per official rules: reshuffle when fewer than 3 cards remain
            reshuffleDeckIfNeeded(room);

            // Check for chaos (3 failed elections/vetoes in a row)
            if (room.gameState.electionTracker >= 3) {
                const [policy] = drawPolicies(room, 1);
                if (policy === 'guest') {
                    room.gameState.guestPolicies++;
                } else {
                    room.gameState.staffPolicies++;
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
        } else {
            // President rejects veto - Chancellor must enact a policy
            room.gameState.vetoRequested = false;
        }

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
                    // Track that this player has been investigated (per official rules: no player may be investigated twice)
                    room.gameState.investigatedPlayers.push(investigateTarget);
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
                        room.gameState.executedPlayer = {
                            name: target.name,
                            role: target.role,
                            avatar: target.avatar,
                            avatarColor: target.avatarColor
                        };
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
            if (policy === 'guest') {
                room.gameState.guestPolicies++;
            } else {
                room.gameState.staffPolicies++;
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

    if (room.gameState.enactedPolicy === 'staff') {
        const power = getExecutivePower(room.gameState.staffPolicies, room.players.length);
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
        // Clear term limits after chaos (per official rules: "All players become eligible")
        room.gameState.previousPresidentId = null;
        room.gameState.previousChancellorId = null;
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

    broadcastGameState(room);
    processAIActions(room);
}

// ==================== END AI PLAYER SYSTEM ====================

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Create a new room
    socket.on('createRoom', (data) => {
        // Support both old format (string) and new format (object)
        const playerName = typeof data === 'string' ? data : data.playerName;
        const sessionId = typeof data === 'object' ? data.sessionId : null;

        const room = createRoom(socket.id, playerName, sessionId);
        socket.join(room.code);
        socket.emit('roomCreated', { code: room.code, playerId: socket.id });
        broadcastGameState(room);
    });

    // Join an existing room
    socket.on('joinRoom', ({ code, playerName, sessionId }) => {
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

        const avatar = getNextAvatar(room);
        room.players.push({
            id: socket.id,
            name: playerName || avatar.name,
            avatar: avatar.emoji,
            avatarColor: avatar.color,
            avatarIndex: avatar.index,
            sessionId: sessionId,
            role: null,
            isAlive: true,
            hasVoted: false,
            vote: null
        });

        socket.join(code.toUpperCase());
        socket.emit('roomJoined', { code: room.code, playerId: socket.id });
        broadcastGameState(room);
    });

    // Reconnect to an existing game
    socket.on('reconnectToGame', ({ sessionId, roomCode, playerName }) => {
        const room = getRoom(roomCode);

        if (!room) {
            socket.emit('reconnectFailed', { message: 'Room not found' });
            return;
        }

        // Find the player by their avatar name (which is their display name)
        const player = room.players.find(p => p.name === playerName || p.sessionId === sessionId);

        if (!player) {
            socket.emit('reconnectFailed', { message: 'Player not found in room' });
            return;
        }

        // Check if player is AI (can't reconnect as AI)
        if (player.isAI) {
            socket.emit('reconnectFailed', { message: 'Cannot reconnect as AI player' });
            return;
        }

        // Update the player's socket ID and mark as connected
        const oldSocketId = player.id;
        player.id = socket.id;
        player.sessionId = sessionId;
        player.disconnected = false;

        // Update host ID if this was the host
        if (room.hostId === oldSocketId) {
            room.hostId = socket.id;
        }

        // Join the socket room
        socket.join(roomCode.toUpperCase());

        // Send success response
        socket.emit('reconnectSuccess', {
            code: room.code,
            playerId: socket.id,
            isHost: room.hostId === socket.id
        });

        console.log(`Player ${playerName} reconnected to room ${roomCode}`);
        broadcastGameState(room);
    });

    // Start the game
    socket.on('startGame', (data) => {
        // Support both old format (string) and new format (object)
        const code = typeof data === 'string' ? data : data.code;
        const cpuCount = typeof data === 'object' ? (data.cpuCount || 0) : 0;

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

        // Calculate target player count based on host's CPU selection
        const humanPlayers = room.players.length;
        const minCpus = Math.max(0, 4 - humanPlayers);
        const maxCpus = 6 - humanPlayers;
        const validCpuCount = Math.max(minCpus, Math.min(maxCpus, cpuCount));
        const targetPlayerCount = humanPlayers + validCpuCount;

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
        // Per official rules: previous president only ineligible if MORE than 5 players ALIVE
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

    // President selects 2 policies to pass to chancellor
    socket.on('presidentSelectPolicies', ({ code, selectedIndices }) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'legislative-president') return;

        const currentPresident = room.players[room.gameState.currentPresidentIndex];
        if (socket.id !== currentPresident.id) return;

        // Validate: must select exactly 2 policies
        if (!selectedIndices || selectedIndices.length !== 2) return;

        // Find the index that wasn't selected (the one to discard)
        const discardIndex = [0, 1, 2].find(i => !selectedIndices.includes(i));
        const discarded = room.gameState.currentPolicies[discardIndex];
        room.gameState.discardPile.push(discarded);

        // Keep only the selected policies
        room.gameState.currentPolicies = selectedIndices.map(i => room.gameState.currentPolicies[i]);
        room.gameState.phase = 'legislative-chancellor';

        broadcastGameState(room);
        // Trigger AI chancellor if needed
        processAIActions(room);
    });

    // Legacy support: President discards policy (single index)
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

        if (enacted === 'guest') {
            room.gameState.guestPolicies++;
        } else {
            room.gameState.staffPolicies++;
        }

        // Per official rules: reshuffle when fewer than 3 cards remain at end of legislative session
        reshuffleDeckIfNeeded(room);

        room.gameState.enactedPolicy = enacted;
        room.gameState.phase = 'policy-result';

        broadcastGameState(room);
        // Trigger auto-continue for policy result
        processAIActions(room);
    });

    // Chancellor requests veto (only available after 5 fascist policies enacted)
    socket.on('requestVeto', (code) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'legislative-chancellor') return;

        // Only Chancellor can request veto
        if (socket.id !== room.gameState.currentChancellorId) return;

        // Veto only available after 5 fascist policies (per official rules)
        if (room.gameState.staffPolicies < 5) {
            socket.emit('error', { message: 'Veto power is only available after 5 Staff policies are enacted' });
            return;
        }

        // Mark veto as requested - President must now respond
        room.gameState.vetoRequested = true;
        broadcastGameState(room);
        processAIActions(room);
    });

    // President responds to veto request
    socket.on('respondToVeto', ({ code, accept }) => {
        const room = getRoom(code);
        if (!room || room.gameState.phase !== 'legislative-chancellor' || !room.gameState.vetoRequested) return;

        const currentPresident = room.players[room.gameState.currentPresidentIndex];
        if (socket.id !== currentPresident.id) return;

        if (accept) {
            // President accepts veto - discard both policies and increment election tracker
            room.gameState.discardPile.push(...room.gameState.currentPolicies);
            room.gameState.currentPolicies = [];
            room.gameState.electionTracker++;
            room.gameState.vetoRequested = false;

            // Per official rules: reshuffle when fewer than 3 cards remain
            reshuffleDeckIfNeeded(room);

            // Check for chaos (3 failed elections/vetoes in a row)
            if (room.gameState.electionTracker >= 3) {
                const [policy] = drawPolicies(room, 1);
                if (policy === 'guest') {
                    room.gameState.guestPolicies++;
                } else {
                    room.gameState.staffPolicies++;
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
        } else {
            // President rejects veto - Chancellor must enact a policy
            room.gameState.vetoRequested = false;
        }

        broadcastGameState(room);
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

        // Per official rules: No player may be investigated twice in the same game
        if (room.gameState.investigatedPlayers.includes(targetId)) {
            socket.emit('error', { message: 'This player has already been investigated' });
            return;
        }

        // Track that this player has been investigated
        room.gameState.investigatedPlayers.push(targetId);

        // Send investigation result only to president
        socket.emit('investigationResult', {
            targetName: target.name,
            party: target.role === 'guest' ? 'guest' : 'staff'
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
        room.gameState.executedPlayer = {
            name: target.name,
            role: target.role,
            avatar: target.avatar,
            avatarColor: target.avatarColor
        };
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

    // End game (host only) - return to lobby
    socket.on('endGame', (code) => {
        const room = getRoom(code);
        if (!room) return;

        // Only host can end the game
        if (socket.id !== room.hostId) {
            socket.emit('error', { message: 'Only the host can end the game' });
            return;
        }

        // Reset game state to lobby
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
            investigatedPlayers: [],
            vetoRequested: false,
            winner: null,
            winReason: null
        };

        // Reset player states but keep them in the room
        room.players = room.players.filter(p => !p.isAI).map(p => ({
            ...p,
            role: null,
            isAlive: true,
            hasVoted: false,
            vote: null
        }));

        console.log(`Game ended by host in room ${code}`);
        broadcastGameState(room);
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
