// Player Avatars - emojis with Victorian mansion names
const PLAYER_AVATARS = [
    { emoji: '🦁', name: 'Reginald', color: '#f4a460' },
    { emoji: '🐺', name: 'Percival', color: '#708090' },
    { emoji: '🦊', name: 'Theodore', color: '#ff6b35' },
    { emoji: '🐻', name: 'Bartholomew', color: '#8b4513' },
    { emoji: '🦅', name: 'Edmund', color: '#4a90d9' },
    { emoji: '🐍', name: 'Archibald', color: '#228b22' }
];

// Helper function to render player avatar HTML
function renderPlayerAvatar(player, size = 'medium') {
    const sizeClass = `avatar-${size}`;
    return `<span class="player-avatar ${sizeClass}" style="background-color: ${player.avatarColor}">${player.avatar}</span>`;
}

// Helper function to render player name with avatar
function renderPlayerName(player, showAvatar = true) {
    if (showAvatar) {
        return `${renderPlayerAvatar(player)} <span class="player-name-text">${player.name}</span>`;
    }
    return player.name;
}

// Game State
const gameState = {
    playerCount: 0,
    players: [],
    currentPresidentIndex: 0,
    currentChancellor: null,
    previousPresident: null,
    previousChancellor: null,
    guestPolicies: 0,
    staffPolicies: 0,
    electionTracker: 0,
    policyDeck: [],
    discardPile: [],
    currentPolicies: [],
    votes: [],
    currentVoterIndex: 0,
    gamePhase: 'setup',
    governmentFailed: false,
    butler: null,
    staff: [],
    guests: [],
    selectableOptions: [],
    keyboardHandler: null
};

// Role configurations based on player count
const roleConfigurations = {
    4: { guests: 2, staff: 1, butler: 1 },
    5: { guests: 3, staff: 1, butler: 1 },
    6: { guests: 4, staff: 1, butler: 1 }
};

// Initialize game
function initGame() {
    document.getElementById('start-game').addEventListener('click', startGame);
    document.getElementById('reveal-role').addEventListener('click', revealRole);
    document.getElementById('confirm-role').addEventListener('click', confirmRole);
    document.getElementById('continue-btn').addEventListener('click', continueGame);
    document.getElementById('new-game').addEventListener('click', () => location.reload());

    // Setup global keyboard handler
    document.addEventListener('keydown', handleKeyPress);

    // Setup help modal
    setupHelpModal();
}

// Help Modal
function setupHelpModal() {
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const closeBtn = document.getElementById('close-modal');

    helpBtn.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => {
        helpModal.classList.add('hidden');
    });

    // Close modal when clicking outside content
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.classList.add('hidden');
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !helpModal.classList.contains('hidden')) {
            helpModal.classList.add('hidden');
        }
    });
}

// Keyboard handler
function handleKeyPress(e) {
    if (gameState.keyboardHandler) {
        gameState.keyboardHandler(e);
    }
}

// Setup keyboard selection
function setupKeyboardSelection(options, callback) {
    gameState.selectableOptions = options;

    gameState.keyboardHandler = (e) => {
        const key = e.key;
        const numKey = parseInt(key);

        // Check if it's a valid number key for the options
        if (!isNaN(numKey) && numKey >= 1 && numKey <= options.length) {
            e.preventDefault();
            callback(options[numKey - 1], numKey - 1);
            gameState.keyboardHandler = null;
        }
    };
}

// Clear keyboard handler
function clearKeyboardHandler() {
    gameState.keyboardHandler = null;
    gameState.selectableOptions = [];
}

// Start game setup
function startGame() {
    gameState.playerCount = parseInt(document.getElementById('player-count').value);
    gameState.players = [];

    // Create players with avatars
    for (let i = 0; i < gameState.playerCount; i++) {
        const avatar = PLAYER_AVATARS[i];
        gameState.players.push({
            id: i,
            name: avatar.name,
            avatar: avatar.emoji,
            avatarColor: avatar.color,
            role: null,
            isAlive: true,
            votes: []
        });
    }

    // Assign roles
    assignRoles();

    // Initialize deck
    initializeDeck();

    // Show role assignment screen
    showScreen('role-screen');
    gameState.currentRoleReveal = 0;
    updateRoleInstruction();
}

// Assign roles to players
function assignRoles() {
    const config = roleConfigurations[gameState.playerCount];
    const roles = [];

    // Add guest roles
    for (let i = 0; i < config.guests; i++) {
        roles.push('guest');
    }

    // Add staff roles
    for (let i = 0; i < config.staff; i++) {
        roles.push('staff');
    }

    // Add Butler
    roles.push('butler');

    // Shuffle roles
    shuffleArray(roles);

    // Assign to players
    gameState.players.forEach((player, index) => {
        player.role = roles[index];

        if (player.role === 'butler') {
            gameState.butler = player;
        } else if (player.role === 'staff') {
            gameState.staff.push(player);
        } else {
            gameState.guests.push(player);
        }
    });
}

// Initialize policy deck
function initializeDeck() {
    gameState.policyDeck = [];

    // Add 6 guest and 11 staff policies
    for (let i = 0; i < 6; i++) {
        gameState.policyDeck.push('guest');
    }
    for (let i = 0; i < 11; i++) {
        gameState.policyDeck.push('staff');
    }

    shuffleArray(gameState.policyDeck);
    updateDeckCount();
}

// Role reveal sequence
function updateRoleInstruction() {
    const currentPlayer = gameState.players[gameState.currentRoleReveal];
    document.getElementById('role-instruction').innerHTML =
        `Pass the device to ${renderPlayerName(currentPlayer)}`;
    document.getElementById('role-display').classList.add('hidden');
    document.getElementById('reveal-role').classList.remove('hidden');
}

function revealRole() {
    const currentPlayer = gameState.players[gameState.currentRoleReveal];
    const roleDisplay = document.getElementById('role-display');
    const roleName = document.getElementById('role-name');
    const roleDescription = document.getElementById('role-description');
    const teamInfo = document.getElementById('team-info');
    const roleCard = document.querySelector('.role-card');

    // Remove previous classes
    roleCard.classList.remove('guest', 'staff', 'butler');

    // Set role information
    if (currentPlayer.role === 'guest') {
        roleName.textContent = 'House Guest';
        roleDescription.textContent = 'You are a House Guest at the mansion. Enact 5 Guest policies or expose the Butler to win!';
        teamInfo.innerHTML = '<p>You do not know who your fellow guests are. Trust no one!</p>';
        roleCard.classList.add('guest');
    } else if (currentPlayer.role === 'staff') {
        roleName.textContent = 'Home Staff';
        roleDescription.textContent = 'You are a disgruntled member of the Home Staff. Enact 6 Staff policies or get the Butler appointed as Head of Household after 3 Staff policies to win!';

        let teamHtml = '<p><strong>Your team:</strong></p>';
        teamHtml += `<p>The Butler: ${gameState.butler.name}</p>`;
        if (gameState.staff.length > 0) {
            teamHtml += '<p>Fellow Staff: ';
            teamHtml += gameState.staff.filter(f => f.id !== currentPlayer.id).map(f => f.name).join(', ') || 'None';
            teamHtml += '</p>';
        }
        teamInfo.innerHTML = teamHtml;
        roleCard.classList.add('staff');
    } else if (currentPlayer.role === 'butler') {
        roleName.textContent = 'The Butler';
        roleDescription.textContent = 'You are the Butler! Enact 6 Staff policies, or get appointed as Head of Household after 3 Staff policies to win! But if you are exposed, the Guests win!';

        let teamHtml = '<p><strong>Your team:</strong></p>';
        if (gameState.playerCount <= 6) {
            teamHtml += '<p>Staff members: ';
            teamHtml += gameState.staff.map(f => f.name).join(', ');
            teamHtml += '</p>';
        } else {
            teamHtml += '<p>You do not know who the staff members are!</p>';
        }
        teamInfo.innerHTML = teamHtml;
        roleCard.classList.add('butler');
    }

    // Show role
    document.getElementById('reveal-role').classList.add('hidden');
    roleDisplay.classList.remove('hidden');
}

function confirmRole() {
    gameState.currentRoleReveal++;

    if (gameState.currentRoleReveal < gameState.playerCount) {
        updateRoleInstruction();
    } else {
        // All roles revealed, start game
        startMainGame();
    }
}

// Main game
function startMainGame() {
    showScreen('game-screen');
    gameState.gamePhase = 'election';
    startElectionPhase();
}

function startElectionPhase() {
    showPhase('election-phase');

    const president = gameState.players[gameState.currentPresidentIndex];
    document.getElementById('election-info').innerHTML =
        `${renderPlayerName(president)} is the President. Select a Chancellor candidate.`;

    renderPlayerSelection(president);
}

function renderPlayerSelection(president) {
    const container = document.getElementById('player-selection');
    container.innerHTML = '';

    const eligiblePlayers = [];
    let keyNumber = 1;

    gameState.players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';

        // Disable selection for president, previous president, previous chancellor
        const isDisabled =
            player.id === president.id ||
            player.id === gameState.previousChancellor?.id ||
            (gameState.playerCount > 5 && player.id === gameState.previousPresident?.id);

        if (isDisabled) {
            card.classList.add('disabled');
        }

        // Mark current roles
        if (player.id === president.id) {
            card.classList.add('president');
        }

        let keyIndicator = '';
        if (!isDisabled) {
            keyIndicator = `<div class="key-indicator">[${keyNumber}]</div>`;
            eligiblePlayers.push(player);
            keyNumber++;
        }

        card.innerHTML = `
            ${keyIndicator}
            ${renderPlayerAvatar(player, 'large')}
            <h3>${player.name}</h3>
            ${player.id === president.id ? '<span class="player-badge">President</span>' : ''}
            ${player.id === gameState.previousChancellor?.id ? '<span class="player-badge">Prev. Chancellor</span>' : ''}
            ${player.id === gameState.previousPresident?.id ? '<span class="player-badge">Prev. President</span>' : ''}
        `;

        container.appendChild(card);
    });

    // Setup keyboard selection
    setupKeyboardSelection(eligiblePlayers, (player) => {
        selectChancellor(player);
    });
}

function selectChancellor(player) {
    clearKeyboardHandler();
    gameState.currentChancellor = player;
    startVotingPhase();
}

// Voting phase
function startVotingPhase() {
    showPhase('voting-phase');

    const president = gameState.players[gameState.currentPresidentIndex];
    document.getElementById('vote-info').innerHTML =
        `President: ${renderPlayerName(president)} | Chancellor: ${renderPlayerName(gameState.currentChancellor)}`;

    gameState.votes = [];
    gameState.currentVoterIndex = 0;

    setupVoteButtons();

    // Small delay to ensure DOM is ready and previous handlers are cleared
    setTimeout(() => {
        updateVoterDisplay();
    }, 100);
}

function updateVoterDisplay() {
    const currentVoter = gameState.players[gameState.currentVoterIndex];

    // Key mapping for each player (works for 6 players max)
    const keyMap = [
        { yes: '1', no: '2' },  // Player 1
        { yes: '3', no: '4' },  // Player 2
        { yes: '5', no: '6' },  // Player 3
        { yes: '7', no: '8' },  // Player 4
        { yes: 'q', no: 'w' },  // Player 5
        { yes: 'a', no: 's' }   // Player 6
    ];

    const keys = keyMap[gameState.currentVoterIndex];

    document.getElementById('current-voter').innerHTML =
        `${renderPlayerName(currentVoter)} - Press ${keys.yes.toUpperCase()} for YES or ${keys.no.toUpperCase()} for NO`;

    // Reset keyboard handler for this voter
    setupVoteKeyboardHandler(keys.yes, keys.no);
}

function setupVoteButtons() {
    // Hide the button UI elements
    const voteButtons = document.querySelector('.vote-buttons');
    voteButtons.style.display = 'none';

    // Setup initial keyboard handler (will be set in updateVoterDisplay)
}

function setupVoteKeyboardHandler(yesKey, noKey) {
    // Setup keyboard handler for specific keys
    gameState.keyboardHandler = (e) => {
        const key = e.key.toLowerCase();

        if (key === yesKey.toLowerCase()) {
            e.preventDefault();
            // Temporarily clear handler to prevent double voting
            gameState.keyboardHandler = null;
            castVote(true);
        } else if (key === noKey.toLowerCase()) {
            e.preventDefault();
            // Temporarily clear handler to prevent double voting
            gameState.keyboardHandler = null;
            castVote(false);
        }
    };
}

function castVote(vote) {
    const currentVoter = gameState.players[gameState.currentVoterIndex];
    gameState.votes.push({
        player: currentVoter,
        vote: vote
    });

    gameState.currentVoterIndex++;

    if (gameState.currentVoterIndex < gameState.playerCount) {
        updateVoterDisplay();
    } else {
        clearKeyboardHandler();
        resolveVote();
    }
}

function resolveVote() {
    const yesVotes = gameState.votes.filter(v => v.vote).length;
    const noVotes = gameState.votes.filter(v => !v.vote).length;
    const passed = yesVotes > noVotes;

    showPhase('results-phase');
    document.getElementById('results-title').textContent =
        passed ? 'Government Elected!' : 'Government Rejected!';

    let resultsHtml = '<div class="vote-results-grid">';
    gameState.votes.forEach(v => {
        resultsHtml += `
            <div class="vote-result ${v.vote ? 'vote-yes' : 'vote-no'}">
                <span class="voter-info">${renderPlayerName(v.player)}</span>
                <span class="vote-choice">${v.vote ? 'Aye!' : 'Nay!'}</span>
            </div>
        `;
    });
    resultsHtml += `</div><p style="margin-top: 20px; font-size: 1.3em;">
        <strong>Yes: ${yesVotes} | No: ${noVotes}</strong></p>`;

    document.getElementById('results-content').innerHTML = resultsHtml;

    gameState.governmentPassed = passed;

    if (passed) {
        gameState.electionTracker = 0;

        // Check if Butler was elected as Chancellor after 3 staff policies
        if (gameState.currentChancellor.role === 'butler' && gameState.staffPolicies >= 3) {
            endGame('staff', 'The Butler was appointed Head of Household!');
            return;
        }
    } else {
        gameState.electionTracker++;
        updateElectionTracker();

        if (gameState.electionTracker >= 3) {
            // Chaos - enact top policy
            enactChaosPolicy();
            return;
        }
    }
}

function continueGame() {
    clearKeyboardHandler();
    if (gameState.governmentPassed) {
        startLegislativePhase();
    } else {
        // Move to next presidential candidate
        advancePresidency();
        startElectionPhase();
    }
}

// Legislative phase
function startLegislativePhase() {
    showPhase('legislative-phase');

    // Draw 3 policies
    gameState.currentPolicies = drawPolicies(3);

    document.getElementById('legislative-instruction').innerHTML =
        `${renderPlayerName(gameState.players[gameState.currentPresidentIndex])} (President): Select 2 policies to pass to the Chancellor`;

    renderPolicyCards(gameState.currentPolicies, selectPresidentPolicies, true);
}

function drawPolicies(count) {
    const policies = [];

    for (let i = 0; i < count; i++) {
        if (gameState.policyDeck.length === 0) {
            // Reshuffle discard pile
            gameState.policyDeck = [...gameState.discardPile];
            gameState.discardPile = [];
            shuffleArray(gameState.policyDeck);
        }
        policies.push(gameState.policyDeck.pop());
    }

    updateDeckCount();
    return policies;
}

function renderPolicyCards(policies, callback, multiSelect = false) {
    const container = document.getElementById('policy-cards');
    container.innerHTML = '';

    const selectedIndices = [];

    policies.forEach((policy, index) => {
        const card = document.createElement('div');
        card.className = `policy-card hidden-card`;
        card.dataset.index = index;
        const keyNum = index + 1;
        card.innerHTML = `<div class="key-indicator large-key">[${keyNum}]</div>`;
        container.appendChild(card);
    });

    if (multiSelect) {
        // Multi-select mode: select 2 cards to pass
        gameState.keyboardHandler = (e) => {
            const key = e.key;
            const numKey = parseInt(key);

            if (!isNaN(numKey) && numKey >= 1 && numKey <= policies.length) {
                e.preventDefault();
                const index = numKey - 1;
                const cards = container.querySelectorAll('.policy-card');

                if (selectedIndices.includes(index)) {
                    // Deselect
                    selectedIndices.splice(selectedIndices.indexOf(index), 1);
                    cards[index].classList.remove('selected');
                } else if (selectedIndices.length < 2) {
                    // Select
                    selectedIndices.push(index);
                    cards[index].classList.add('selected');

                    if (selectedIndices.length === 2) {
                        clearKeyboardHandler();
                        callback(selectedIndices);
                    }
                }
            }
        };
    } else {
        // Single select mode
        setupKeyboardSelection(policies, (policy, index) => {
            clearKeyboardHandler();
            callback(index);
        });
    }
}

function selectPresidentPolicies(selectedIndices) {
    // Find the index that wasn't selected (the one to discard)
    const discardIndex = [0, 1, 2].find(i => !selectedIndices.includes(i));
    const discardedPolicy = gameState.currentPolicies[discardIndex];
    gameState.discardPile.push(discardedPolicy);

    // Keep only the selected policies
    gameState.currentPolicies = selectedIndices.map(i => gameState.currentPolicies[i]);

    // Chancellor's turn
    document.getElementById('legislative-instruction').innerHTML =
        `${renderPlayerName(gameState.currentChancellor)} (Chancellor): Choose 1 policy to enact`;

    renderPolicyCards(gameState.currentPolicies, selectChancellorPolicy);
}

function selectChancellorPolicy(enactIndex) {
    const discardIndex = enactIndex === 0 ? 1 : 0;
    const enactedPolicy = gameState.currentPolicies[enactIndex];
    const discardedPolicy = gameState.currentPolicies[discardIndex];

    gameState.discardPile.push(discardedPolicy);

    enactPolicy(enactedPolicy);
}

function enactPolicy(policy) {
    if (policy === 'guest') {
        gameState.guestPolicies++;
        updatePolicyTrack('guest', gameState.guestPolicies);

        if (gameState.guestPolicies >= 5) {
            endGame('guest', '5 Guest policies enacted!');
            return;
        }
    } else {
        gameState.staffPolicies++;
        updatePolicyTrack('staff', gameState.staffPolicies);

        if (gameState.staffPolicies >= 6) {
            endGame('staff', '6 Staff policies enacted!');
            return;
        }

        // Check for executive action
        const power = getExecutivePower(gameState.staffPolicies, gameState.playerCount);
        if (power) {
            executePresidentialPower(power);
            return;
        }
    }

    // Show policy enacted result
    showPhase('results-phase');
    document.getElementById('results-title').textContent = `${policy === 'guest' ? 'Guest' : 'Staff'} Policy Enacted!`;
    document.getElementById('results-content').innerHTML = `
        <p>The government has enacted a ${policy} policy.</p>
        <p>Guest Policies: ${gameState.guestPolicies}/5</p>
        <p>Staff Policies: ${gameState.staffPolicies}/6</p>
    `;

    gameState.nextAction = 'advance';
}

function enactChaosPolicy() {
    const policy = gameState.policyDeck.pop();
    updateDeckCount();

    gameState.electionTracker = 0;
    updateElectionTracker();

    showPhase('results-phase');
    document.getElementById('results-title').textContent = 'Chaos!';
    document.getElementById('results-content').innerHTML = `
        <p>Three governments have failed in a row!</p>
        <p>The top policy is automatically enacted: <strong>${policy === 'guest' ? 'Guest' : 'Staff'}</strong></p>
    `;

    if (policy === 'guest') {
        gameState.guestPolicies++;
        updatePolicyTrack('guest', gameState.guestPolicies);

        if (gameState.guestPolicies >= 5) {
            endGame('guest', '5 Guest policies enacted!');
            return;
        }
    } else {
        gameState.staffPolicies++;
        updatePolicyTrack('staff', gameState.staffPolicies);

        if (gameState.staffPolicies >= 6) {
            endGame('staff', '6 Staff policies enacted!');
            return;
        }
    }

    gameState.nextAction = 'advance';
}

// Executive powers
function getExecutivePower(staffCount, playerCount) {
    const powers = {
        4: { 3: 'examine', 4: 'execute', 5: 'execute' },
        5: { 3: 'examine', 4: 'execute', 5: 'execute' },
        6: { 3: 'investigate', 4: 'special-election', 5: 'execute' }
    };

    return powers[playerCount]?.[staffCount] || null;
}

function executePresidentialPower(power) {
    showPhase('executive-phase');
    const president = gameState.players[gameState.currentPresidentIndex];

    switch(power) {
        case 'investigate':
            document.getElementById('power-description').innerHTML =
                `${renderPlayerName(president)}: Investigate a player's loyalty`;
            renderInvestigatePower();
            break;
        case 'examine':
            document.getElementById('power-description').innerHTML =
                `${renderPlayerName(president)}: Examine the top 3 cards of the policy deck`;
            renderExaminePower();
            break;
        case 'execute':
            document.getElementById('power-description').innerHTML = `
                <div class="execution-warning">
                    <div class="execution-icon">💀</div>
                    <div class="execution-title">EXECUTION ORDER</div>
                    <div class="execution-subtitle">${renderPlayerName(president)} must choose a player to execute.<br>This decision is permanent.</div>
                </div>
            `;
            renderExecutePower();
            break;
        case 'special-election':
            document.getElementById('power-description').innerHTML =
                `${renderPlayerName(president)}: Call a special election`;
            renderSpecialElectionPower();
            break;
    }
}

function renderInvestigatePower() {
    const container = document.getElementById('power-action');
    container.innerHTML = '<div class="player-grid" id="investigate-players"></div>';
    const grid = document.getElementById('investigate-players');

    const eligiblePlayers = [];
    let keyNumber = 1;

    gameState.players.forEach(player => {
        if (player.id !== gameState.currentPresidentIndex) {
            const card = document.createElement('div');
            card.className = 'player-card';
            card.innerHTML = `
                <div class="key-indicator">[${keyNumber}]</div>
                ${renderPlayerAvatar(player, 'large')}
                <h3>${player.name}</h3>
            `;
            eligiblePlayers.push(player);
            keyNumber++;
            grid.appendChild(card);
        }
    });

    setupKeyboardSelection(eligiblePlayers, (player) => {
        clearKeyboardHandler();
        showPhase('results-phase');
        document.getElementById('results-title').textContent = 'Investigation Result';
        document.getElementById('results-content').innerHTML = `
            <p>${renderPlayerName(player)}'s allegiance is:</p>
            <h2>${player.role === 'guest' ? 'House Guest' : 'Home Staff'}</h2>
            <p style="margin-top: 20px; font-size: 0.9em;">Note: The Butler shows as Home Staff</p>
        `;
        gameState.nextAction = 'advance';
    });
}

function renderExaminePower() {
    const container = document.getElementById('power-action');
    const topThree = gameState.policyDeck.slice(-3).reverse();

    container.innerHTML = '<p>Top 3 cards (in order):</p><div class="card-selection" id="examine-cards"></div>';
    const cardsDiv = document.getElementById('examine-cards');

    topThree.forEach(policy => {
        const card = document.createElement('div');
        card.className = `policy-card ${policy}`;
        card.textContent = policy === 'guest' ? 'Guest' : 'Staff';
        card.style.cursor = 'default';
        cardsDiv.appendChild(card);
    });

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Continue';
    btn.style.marginTop = '20px';
    btn.addEventListener('click', () => {
        advancePresidency();
        startElectionPhase();
    });
    container.appendChild(btn);
}

function renderExecutePower() {
    const container = document.getElementById('power-action');
    container.innerHTML = '<div class="execution-targets" id="execute-players"></div>';
    const grid = document.getElementById('execute-players');

    const eligiblePlayers = [];
    let keyNumber = 1;

    gameState.players.forEach(player => {
        if (player.id !== gameState.currentPresidentIndex && player.isAlive) {
            const card = document.createElement('div');
            card.className = 'player-card execute-target';
            card.innerHTML = `
                <div class="key-indicator">[${keyNumber}]</div>
                ${renderPlayerAvatar(player, 'large')}
                <h3>${player.name}</h3>
                <span class="execute-label">☠️ EXECUTE</span>
            `;
            eligiblePlayers.push(player);
            keyNumber++;
            grid.appendChild(card);
        }
    });

    setupKeyboardSelection(eligiblePlayers, (player) => {
        clearKeyboardHandler();
        player.isAlive = false;

        const roleClass = player.role;
        const roleName = player.role === 'guest' ? 'HOUSE GUEST' : player.role === 'staff' ? 'HOME STAFF' : 'THE BUTLER';
        const wasButler = player.role === 'butler';

        showPhase('results-phase');
        document.getElementById('results-title').textContent = '';
        document.getElementById('results-content').innerHTML = `
            <div class="execution-result-display">
                <div class="execution-skull">💀</div>
                <div class="execution-result-title">DISMISSED</div>
                <div class="execution-victim">
                    ${renderPlayerAvatar(player, 'large')}
                    <div class="execution-victim-name">${player.name}</div>
                </div>
                <div class="execution-role-reveal">
                    <span class="role-was">Their role was</span>
                    <span class="revealed-role ${roleClass}">${roleName}</span>
                </div>
                ${wasButler ? `
                    <div class="butler-exposed">
                        THE BUTLER HAS BEEN EXPOSED!
                        <div class="guests-win-soon">House Guests Win!</div>
                    </div>
                ` : ''}
            </div>
        `;

        if (wasButler) {
            endGame('guest', 'The Butler was exposed and dismissed!');
        } else {
            gameState.nextAction = 'advance';
        }
    });
}

function renderSpecialElectionPower() {
    const container = document.getElementById('power-action');
    container.innerHTML = '<p>Choose the next Presidential candidate:</p><div class="player-grid" id="special-election-players"></div>';
    const grid = document.getElementById('special-election-players');

    const eligiblePlayers = [];
    let keyNumber = 1;

    gameState.players.forEach(player => {
        if (player.id !== gameState.currentPresidentIndex) {
            const card = document.createElement('div');
            card.className = 'player-card';
            card.innerHTML = `
                <div class="key-indicator">[${keyNumber}]</div>
                ${renderPlayerAvatar(player, 'large')}
                <h3>${player.name}</h3>
            `;
            eligiblePlayers.push(player);
            keyNumber++;
            grid.appendChild(card);
        }
    });

    setupKeyboardSelection(eligiblePlayers, (player) => {
        clearKeyboardHandler();
        gameState.currentPresidentIndex = player.id;
        startElectionPhase();
    });
}

// Game flow helpers
function advancePresidency() {
    gameState.previousPresident = gameState.players[gameState.currentPresidentIndex];
    gameState.previousChancellor = gameState.currentChancellor;

    do {
        gameState.currentPresidentIndex = (gameState.currentPresidentIndex + 1) % gameState.playerCount;
    } while (!gameState.players[gameState.currentPresidentIndex].isAlive);

    gameState.currentChancellor = null;
}

function updatePolicyTrack(type, count) {
    const track = document.querySelector(`.${type}-track .policy-slots`);
    const slots = track.querySelectorAll('.policy-slot');

    slots.forEach((slot, index) => {
        if (index < count) {
            slot.classList.add('enacted');
        }
    });
}

function updateDeckCount() {
    document.getElementById('deck-count').textContent = gameState.policyDeck.length;
}

function updateElectionTracker() {
    document.getElementById('election-tracker').textContent = gameState.electionTracker;
}

// End game
function endGame(winner, reason) {
    showScreen('gameover-screen');

    document.getElementById('winner-announcement').textContent =
        `${winner === 'guest' ? 'House Guests' : 'Home Staff'} Win!`;

    const rolesDiv = document.getElementById('final-roles');
    rolesDiv.innerHTML = `<p style="margin-bottom: 20px;">${reason}</p>`;

    const roleDisplayNames = {
        'guest': 'House Guest',
        'staff': 'Home Staff',
        'butler': 'The Butler'
    };

    gameState.players.forEach((player, index) => {
        const card = document.createElement('div');
        card.className = `final-role-card ${player.role}`;
        card.style.animationDelay = `${index * 0.1}s`;
        card.innerHTML = `
            ${renderPlayerAvatar(player, 'large')}
            <h3>${player.name}</h3>
            <p>${roleDisplayNames[player.role] || player.role}</p>
        `;
        rolesDiv.appendChild(card);
    });

    // Trigger confetti celebration
    setTimeout(() => createConfetti(winner), 300);
}

// UI helpers
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showPhase(phaseId) {
    document.querySelectorAll('.phase').forEach(phase => {
        phase.classList.add('hidden');
    });
    document.getElementById(phaseId).classList.remove('hidden');
}

// Utility functions
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Bubble Animation
function createBubbles() {
    const bubblesContainer = document.getElementById('bubbles');
    const bubbleCount = 15;

    for (let i = 0; i < bubbleCount; i++) {
        createBubble(bubblesContainer);
    }

    // Continuously create new bubbles
    setInterval(() => {
        if (document.querySelectorAll('.bubble').length < 20) {
            createBubble(bubblesContainer);
        }
    }, 2000);
}

function createBubble(container) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    // Random properties
    const size = Math.random() * 60 + 20;
    const left = Math.random() * 100;
    const duration = Math.random() * 10 + 8;
    const delay = Math.random() * 5;

    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${left}%`;
    bubble.style.animationDuration = `${duration}s`;
    bubble.style.animationDelay = `${delay}s`;

    container.appendChild(bubble);

    // Remove bubble after animation
    setTimeout(() => {
        bubble.remove();
    }, (duration + delay) * 1000);
}

// Confetti for game end
function createConfetti(winner) {
    const colors = winner === 'guest'
        ? ['#1e3a5f', '#2d4a6f', '#d4c5a9', '#b5a642', '#c9a227']
        : ['#8b4513', '#654321', '#c9a227', '#d4af37', '#2f2f2f'];

    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            document.body.appendChild(confetti);

            setTimeout(() => confetti.remove(), 4000);
        }, i * 30);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initGame();
    createBubbles();
});
