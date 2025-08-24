document.addEventListener('DOMContentLoaded', () => {
    // --- Configurazione di Firebase fornita dall'utente ---
    const firebaseConfig = {
        apiKey: "AIzaSyAiSlXO-A1mT0s5rXaqyc_1U0D-zBJyp20",
        authDomain: "fantacalcio-7360e.firebaseapp.com",
        projectId: "fantacalcio-7360e",
        storageBucket: "fantacalcio-7360e.appspot.com",
        messagingSenderId: "935081714164",
        appId: "1:935081714164:web:82cc69e1e71185d8bc99a1",
        measurementId: "G-2F7L7GQBZT"
    };

    // --- Inizializzazione di Firebase ---
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- Riferimenti agli elementi del DOM ---
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const loginBtn = document.getElementById('login-btn');

    // --- Logica di accesso ---
    loginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch((error) => {
            console.error("Errore durante il login:", error);
            alert("Si è verificato un errore durante il login. Controlla la console per i dettagli.");
        });
    });

    // --- Gestione dello stato di autenticazione ---
    auth.onAuthStateChanged((user) => {
        if (user) {
            loginContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            document.getElementById('user-info').classList.remove('hidden');
            document.getElementById('user-name').textContent = user.displayName;
            setupAppUI(user);
        } else {
            loginContainer.classList.remove('hidden');
            appContainer.classList.add('hidden');
            document.getElementById('user-info').classList.add('hidden');
        }
    });

    // --- Stato Globale e Costanti ---
    let allPlayers = [];
    let userTopList = [];
    let userLineup = { formation: '4-3-3', starting11: {} };
    let currentUser = null;
    let hideLostSlots = false;
    const roleMap = { 'P': 'Portiere', 'D': 'Difensore', 'C': 'Centrocampista', 'A': 'Attaccante' };
    const roleOrder = ['P', 'D', 'C', 'A'];
    const DEFAULT_STRATEGY_SLOTS = [
        { role: 'P', budget: 38 }, { role: 'P', budget: 1 }, { role: 'P', budget: 1 },
        { role: 'D', budget: 20 }, { role: 'D', budget: 20 }, { role: 'D', budget: 15 }, { role: 'D', budget: 10 }, { role: 'D', budget: 7 }, { role: 'D', budget: 6 }, { role: 'D', budget: 1 }, { role: 'D', budget: 1 },
        { role: 'C', budget: 30 }, { role: 'C', budget: 30 }, { role: 'C', budget: 15 }, { role: 'C', budget: 15 }, { role: 'C', budget: 14 }, { role: 'C', budget: 14 }, { role: 'C', budget: 1 }, { role: 'C', budget: 1 },
        { role: 'A', budget: 135 }, { role: 'A', budget: 65 }, { role: 'A', budget: 30 }, { role: 'A', budget: 15 }, { role: 'A', budget: 14 }, { role: 'A', budget: 1 }
    ];

    // Impostazioni di default
    let totalCredits = 500;
    let roleLimits = { 'P': 3, 'D': 8, 'C': 8, 'A': 6 };

    // --- Setup Iniziale ---
    function setupAppUI(user) {
        currentUser = user;
        document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
        document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', (e) => switchView(e.target.dataset.view)));
        setupModalListeners();
        loadUserData().then(() => switchView('dashboard-view'));
    }

    function setupModalListeners() {
        document.querySelector('#add-player-modal .close-btn').addEventListener('click', closeAddPlayerModal);
        document.getElementById('add-player-form').addEventListener('submit', handleAddPlayerFormSubmit);
        document.querySelector('#final-squad-modal .close-btn').addEventListener('click', () => document.getElementById('final-squad-modal').classList.add('hidden'));
        document.querySelector('#manage-player-modal .close-btn').addEventListener('click', () => document.getElementById('manage-player-modal').classList.add('hidden'));
        document.getElementById('manage-player-form').addEventListener('submit', async (e) => { e.preventDefault(); const id = document.getElementById('player-id-input').value; const player = { id: id ? parseInt(id, 10) : Date.now(), nome: document.getElementById('player-name').value, squadra: document.getElementById('player-team').value, ruolo: document.getElementById('player-role').value }; if (id) { allPlayers = allPlayers.map(p => p.id == id ? player : p); } else { allPlayers.push(player); } await saveUserData(); document.getElementById('manage-player-modal').classList.add('hidden'); switchView('player-management-view'); });
        document.querySelector('#set-lineup-modal .close-btn').addEventListener('click', () => document.getElementById('set-lineup-modal').classList.add('hidden'));
        document.getElementById('formation-select').addEventListener('change', generatePlayerSelectionSlots);
        document.getElementById('set-lineup-form').addEventListener('submit', async (e) => { e.preventDefault(); userLineup.formation = document.getElementById('formation-select').value; userLineup.starting11 = {}; document.querySelectorAll('#player-selection-slots select').forEach(select => { if (select.value) { userLineup.starting11[select.dataset.key] = select.value; } }); await saveUserData(); document.getElementById('set-lineup-modal').classList.add('hidden'); switchView('dashboard-view'); });
    }

    // --- Logica di Navigazione e Rendering Viste ---
    function switchView(viewId) {
        document.querySelector('.nav-btn.active').classList.remove('active');
        document.querySelector(`.nav-btn[data-view='${viewId}']`).classList.add('active');
        const viewContainer = document.getElementById('view-container');
        switch (viewId) {
            case 'dashboard-view': viewContainer.innerHTML = getDashboardHTML(); attachDashboardListeners(); break;
            case 'squad-builder-view': viewContainer.innerHTML = getSquadBuilderHTML(); attachSquadBuilderListeners(); break;
            case 'auction-view': viewContainer.innerHTML = getAuctionViewHTML(); attachAuctionViewListeners(); initializeAuctionState(); renderAuctionView(); break;
            case 'settings-view': viewContainer.innerHTML = getSettingsHTML(); attachSettingsListeners(); break;
            case 'player-management-view': viewContainer.innerHTML = getPlayerManagementHTML(); attachPlayerManagementListeners(); break;
        }
    }

    function getDashboardHTML() { const formation = userLineup.formation; const formationCoords = { '4-3-3': { P: [{top: '92%', left: '50%'}], D: [{top: '75%', left: '15%'}, {top: '70%', left: '35%'}, {top: '70%', left: '65%'}, {top: '75%', left: '85%'}], C: [{top: '50%', left: '25%'}, {top: '45%', left: '50%'}, {top: '50%', left: '75%'}], A: [{top: '25%', left: '20%'}, {top: '20%', left: '50%'}, {top: '25%', left: '80%'}] }, '4-4-2': { P: [{top: '92%', left: '50%'}], D: [{top: '75%', left: '15%'}, {top: '70%', left: '35%'}, {top: '70%', left: '65%'}, {top: '75%', left: '85%'}], C: [{top: '50%', left: '15%'}, {top: '45%', left: '35%'}, {top: '45%', left: '65%'}, {top: '50%', left: '85%'}], A: [{top: '25%', left: '35%'}, {top: '25%', left: '65%'}] }, '3-5-2': { P: [{top: '92%', left: '50%'}], D: [{top: '75%', left: '25%'}, {top: '70%', left: '50%'}, {top: '75%', left: '75%'}], C: [{top: '55%', left: '15%'}, {top: '50%', left: '35%'}, {top: '40%', left: '50%'}, {top: '50%', left: '65%'}, {top: '55%', left: '85%'}], A: [{top: '25%', left: '35%'}, {top: '25%', left: '65%'}] } }; let playerMarkers = ''; const coords = formationCoords[formation]; if (coords) { for (const role in coords) { coords[role].forEach((pos, i) => { const slotKey = `${role}_${i}`; const playerId = userLineup.starting11[slotKey]; const player = playerId ? allPlayers.find(p => String(p.id) === playerId) : null; if (player) { playerMarkers += `<div class="player-marker role-${player.ruolo}" style="top: ${pos.top}; left: ${pos.left};"><div class="player-shirt"></div><span>${player.nome}</span></div>`; } }); } } return `<div id="dashboard-content"><div class="view-header"><h2>La mia Top 11 (${formation || 'N/A'})</h2><button id="set-lineup-btn">Schiera Formazione</button></div><div class="football-pitch"><div class="pitch-line center-line"></div><div class="pitch-line center-circle"></div>${playerMarkers}</div></div>`; }
    function getSquadBuilderHTML() { return `<div id="squad-builder-content"></div>`; }
    function getAuctionViewHTML() { return `<div id="auction-content"><div class="view-header"><h3>Modalità Asta</h3><div><input type="checkbox" id="hide-lost-slots-chk" ${hideLostSlots ? 'checked' : ''}><label for="hide-lost-slots-chk">Nascondi slot persi</label><button id="show-final-squad-btn">Mostra Rosa Finale</button></div></div><div id="auction-list-container"></div></div>`; }
    function getPlayerManagementHTML() { let rows = allPlayers.map(p => `<tr class="role-${p.ruolo}"><td>${p.nome}</td><td>${p.squadra}</td><td class="role-cell">${roleMap[p.ruolo]}</td><td><button class="edit-player-btn" data-id="${p.id}">Modifica</button><button class="delete-player-btn" data-id="${p.id}">Elimina</button></td></tr>`).join(''); return `<div id="player-management-content"><div class="view-header"><h2>Gestione Giocatori</h2><button id="add-new-player-btn">Aggiungi Nuovo Giocatore</button></div><table class="player-table"><thead><tr><th>Nome</th><th>Squadra</th><th>Ruolo</th><th>Azioni</th></tr></thead><tbody>${rows}</tbody></table></div>`; }
    function getSettingsHTML() { return `<div id="settings-content"><h2>Impostazioni Lega</h2><form id="settings-form"><div class="form-group"><label for="total-credits">Crediti totali</label><input type="number" id="total-credits" value="${totalCredits}" required></div><h4>Numero giocatori per ruolo</h4><div class="form-group"><label for="limit-p">Portieri (P)</label><input type="number" id="limit-p" value="${roleLimits.P}" required></div><div class="form-group"><label for="limit-d">Difensori (D)</label><input type="number" id="limit-d" value="${roleLimits.D}" required></div><div class="form-group"><label for="limit-c">Centrocampisti (C)</label><input type="number" id="limit-c" value="${roleLimits.C}" required></div><div class="form-group"><label for="limit-a">Attaccanti (A)</label><input type="number" id="limit-a" value="${roleLimits.A}" required></div><button type="submit">Salva Impostazioni</button></form><hr><div class="form-group"><label>Strategia Budget</label><button id="reset-strategy-btn">Applica Strategia Default</button></div><hr><div class="form-group"><label>Azioni Pericolose</label><button id="reset-auction-btn" class="lost-btn">Resetta Asta</button></div></div>`; }

    // --- Listeners per ogni Vista ---
    function attachDashboardListeners() { document.getElementById('set-lineup-btn').addEventListener('click', openSetLineupModal); }
    function attachSquadBuilderListeners() { renderSquadBuilderView(); }
    function attachAuctionViewListeners() { document.getElementById('show-final-squad-btn').addEventListener('click', renderAndShowFinalSquad); document.getElementById('hide-lost-slots-chk').addEventListener('change', (e) => { hideLostSlots = e.target.checked; renderAuctionView(); }); document.getElementById('auction-list-container').addEventListener('click', (e) => { const action = e.target.dataset.action; const index = e.target.dataset.index; if (action && index !== undefined) { if (action === 'won') { handlePlayerWon(index); } else if (action === 'lost') { handlePlayerLost(index); } } }); }
    function attachSettingsListeners() { document.getElementById('settings-form').addEventListener('submit', async (e) => { e.preventDefault(); totalCredits = parseInt(document.getElementById('total-credits').value, 10); roleLimits = { P: parseInt(document.getElementById('limit-p').value, 10), D: parseInt(document.getElementById('limit-d').value, 10), C: parseInt(document.getElementById('limit-c').value, 10), A: parseInt(document.getElementById('limit-a').value, 10) }; await saveUserData(); alert('Impostazioni salvate!'); }); document.getElementById('reset-auction-btn').addEventListener('click', async () => { if (confirm('Sei sicuro di voler resettare lo stato dell\'asta?')) { userTopList.forEach(item => { item.auctionStatus = undefined; item.activePlan = 'A'; item.finalCost = 0; }); await saveUserData(); alert('Stato dell\'asta resettato!'); } }); document.getElementById('reset-strategy-btn').addEventListener('click', async () => { if (confirm('Sei sicuro di voler applicare la strategia di default? Le assegnazioni e i budget attuali verranno sovrascritti.')) { initializeTopListWithDefaultStrategy(); await saveUserData(); alert('Strategia di default applicata!'); switchView('squad-builder-view'); } }); }
    function attachPlayerManagementListeners() { document.getElementById('add-new-player-btn').addEventListener('click', () => { document.getElementById('manage-player-form').reset(); document.getElementById('player-id-input').value = ''; document.getElementById('manage-player-modal-title').textContent = 'Aggiungi Giocatore'; document.getElementById('manage-player-modal').classList.remove('hidden'); }); document.querySelectorAll('.edit-player-btn').forEach(btn => { btn.addEventListener('click', (e) => { const player = allPlayers.find(p => p.id == e.target.dataset.id); document.getElementById('player-id-input').value = player.id; document.getElementById('player-name').value = player.nome; document.getElementById('player-team').value = player.squadra; document.getElementById('player-role').value = player.ruolo; document.getElementById('manage-player-modal-title').textContent = 'Modifica Giocatore'; document.getElementById('manage-player-modal').classList.remove('hidden'); }); }); document.querySelectorAll('.delete-player-btn').forEach(btn => { btn.addEventListener('click', async (e) => { if (confirm('Sei sicuro di voler eliminare questo giocatore?')) { allPlayers = allPlayers.filter(p => p.id != e.target.dataset.id); await saveUserData(); switchView('player-management-view'); } }); }); }

    // --- Logica Squad Builder (Sistema a Slot) ---
    function renderSquadBuilderView() { const container = document.getElementById('squad-builder-content'); if (!container) return; let summaryHTML = `<h4>Budget Rimanente (pre-asta): ${getRemainingCredits()}/${totalCredits} cr</h4>`; container.innerHTML = summaryHTML + roleOrder.map(role => `<div class="role-summary role-${role}"><h5>${roleMap[role]}</h5><div class="slot-container">${userTopList.filter(slot => slot.role === role).map((slot) => renderSlot(slot)).join('')}</div></div>`).join(''); document.querySelectorAll('.assign-player-btn').forEach(btn => btn.addEventListener('click', (e) => openAssignPlayerModal(e.target.dataset.slotId))); document.querySelectorAll('.remove-player-btn').forEach(btn => btn.addEventListener('click', async (e) => { const slotId = e.target.dataset.slotId; const slot = userTopList.find(s => s.slotId == slotId); if(slot) { slot.planA = null; slot.planB = null; slot.planC = null; } await saveUserData(); renderSquadBuilderView(); })); }
    function renderSlot(slot) { if (slot.planA) { return `<div class="slot filled"><span>${slot.planA.nome} (${slot.planA_max_budget} cr)</span><button class="remove-player-btn" data-slot-id="${slot.slotId}">X</button></div>`; } return `<div class="slot empty"><button class="assign-player-btn" data-slot-id="${slot.slotId}">Assegna (Budget: ${slot.planA_max_budget})</button></div>`; }
    function openAssignPlayerModal(slotId) { const slot = userTopList.find(s => s.slotId == slotId); if (!slot) return; const form = document.getElementById('add-player-form'); form.dataset.slotId = slotId; document.getElementById('modal-player-name-a-label').textContent = `Piano A (Slot ${roleMap[slot.role]})`; document.getElementById('max-budget').value = slot.planA_max_budget; const sameRolePlayers = allPlayers.filter(p => p.ruolo === slot.role); const planASelect = document.getElementById('plan-a-select'); const planBSelect = document.getElementById('plan-b-select'); const planCSelect = document.getElementById('plan-c-select'); planASelect.innerHTML = '<option value="">-- Seleziona --</option>' + sameRolePlayers.map(p => `<option value="${p.id}">${p.nome}</option>`).join(''); planBSelect.innerHTML = '<option value="">-- Seleziona --</option>' + sameRolePlayers.map(p => `<option value="${p.id}">${p.nome}</option>`).join(''); planCSelect.innerHTML = '<option value="">-- Seleziona --</option>' + sameRolePlayers.map(p => `<option value="${p.id}">${p.nome}</option>`).join(''); if (slot.planA) { planASelect.value = slot.planA.id; } if (slot.planB) { planBSelect.value = slot.planB.id; } if (slot.planC) { planCSelect.value = slot.planC.id; } document.getElementById('add-player-modal').classList.remove('hidden'); }
    function closeAddPlayerModal() { document.getElementById('add-player-modal').classList.add('hidden'); }
    async function handleAddPlayerFormSubmit(e) { e.preventDefault(); const slotId = e.target.dataset.slotId; const slot = userTopList.find(s => s.slotId == slotId); if (!slot) return; const playerAId = document.getElementById('plan-a-select').value; if (!playerAId) { alert('Seleziona almeno un giocatore per il Piano A.'); return; } slot.planA = allPlayers.find(p => p.id == playerAId); slot.planB = allPlayers.find(p => p.id == document.getElementById('plan-b-select').value) || null; slot.planC = allPlayers.find(p => p.id == document.getElementById('plan-c-select').value) || null; slot.planA_max_budget = document.getElementById('max-budget').value || slot.planA_max_budget; await saveUserData(); closeAddPlayerModal(); renderSquadBuilderView(); }
    function getRemainingCredits() { const hypotheticalSpent = userTopList.reduce((acc, curr) => acc + (curr.planA ? parseInt(curr.planA_max_budget, 10) : 0), 0); return totalCredits - hypotheticalSpent; }

    // --- Logica Asta e Altro ---
    function initializeAuctionState() { userTopList.forEach(item => { if (item.auctionStatus === undefined) { item.auctionStatus = 'pending'; item.activePlan = 'A'; item.finalCost = 0; } }); }
    function renderAuctionView() { const container = document.getElementById('auction-list-container'); if(!container) return; let listToRender = hideLostSlots ? userTopList.filter(item => item.auctionStatus !== 'lost') : userTopList; container.innerHTML = listToRender.map(item => { const originalIndex = userTopList.indexOf(item); const playerA = item.planA; const playerB = item.planB; const playerC = item.planC; if (!playerA) return ''; const isWon = item.auctionStatus === 'won'; const isLost = item.auctionStatus === 'lost'; let activePlanHTML = ''; if (!isWon && !isLost) { if (item.activePlan === 'A' && playerA) { activePlanHTML = renderPlayerPlan(playerA, 'A', item.planA_max_budget, originalIndex); } else if (item.activePlan === 'B' && playerB) { activePlanHTML = renderPlayerPlan(playerB, 'B', null, originalIndex); } else if (item.activePlan === 'C' && playerC) { activePlanHTML = renderPlayerPlan(playerC, 'C', null, originalIndex); } } return `<div class="auction-item role-${playerA.ruolo} ${isWon ? 'status-won' : ''} ${isLost ? 'status-lost' : ''}"><h5>Slot ${originalIndex + 1} (${roleMap[playerA.ruolo]})</h5><div class="player-plan ${item.activePlan !== 'A' && !isWon ? 'lost' : ''}"><b>A:</b> ${playerA.nome} (${item.planA_max_budget} cr)${isWon && item.activePlan === 'A' ? `<strong> - ACQUISTATO a ${item.finalCost}</strong>` : ''}</div>${playerB ? `<div class="player-plan plan-b ${item.activePlan === 'A' || (item.activePlan === 'C' && !isWon) ? 'inactive' : ''} ${item.activePlan !== 'B' && !isWon ? 'lost' : ''}"><b>B:</b> ${playerB.nome}${isWon && item.activePlan === 'B' ? `<strong> - ACQUISTATO a ${item.finalCost}</strong>` : ''}</div>` : ''}${playerC ? `<div class="player-plan plan-c ${item.activePlan !== 'C' || isWon ? 'inactive' : ''} ${item.activePlan !== 'C' && !isWon ? 'lost' : ''}"><b>C:</b> ${playerC.nome}${isWon && item.activePlan === 'C' ? `<strong> - ACQUISTATO a ${item.finalCost}</strong>` : ''}</div>` : ''}<div class="auction-actions">${activePlanHTML}</div></div>`; }).join(''); }
    function renderPlayerPlan(player, plan, budget, index) { if (!player) return ''; return `<div><p><strong>Attuale: ${player.nome}</strong> ${budget ? `(Budget: ${budget})` : ''}</p><input type="number" class="cost-input" data-index="${index}" placeholder="Costo finale" min="1"><button class="won-btn" data-action="won" data-index="${index}">Acquistato</button><button class="lost-btn" data-action="lost" data-index="${index}">Sfumato</button></div>`; }
    async function handlePlayerWon(index) { const item = userTopList[index]; const costInput = document.querySelector(`.cost-input[data-index='${index}']`); const cost = costInput.value; if (!cost || cost < 1) { alert("Inserisci un costo valido."); return; } item.auctionStatus = 'won'; item.finalCost = cost; renderAuctionView(); await saveUserData(); }
    async function handlePlayerLost(index) { const item = userTopList[index]; if (item.activePlan === 'A') { item.activePlan = 'B'; } else if (item.activePlan === 'B') { item.activePlan = 'C'; } else { item.auctionStatus = 'lost'; } if ((item.activePlan === 'B' && !item.planB) || (item.activePlan === 'C' && !item.planC)) { item.auctionStatus = 'lost'; } renderAuctionView(); await saveUserData(); }
    function openSetLineupModal() { document.getElementById('set-lineup-modal').classList.remove('hidden'); generatePlayerSelectionSlots(); }
    function generatePlayerSelectionSlots() { const formation = document.getElementById('formation-select').value; userLineup.formation = formation; const slotsContainer = document.getElementById('player-selection-slots'); const formationSlots = { '4-3-3': { P: 1, D: 4, C: 3, A: 3 }, '4-4-2': { P: 1, D: 4, C: 4, A: 2 }, '3-5-2': { P: 1, D: 3, C: 5, A: 2 } }; const slots = formationSlots[formation]; const acquiredPlayers = userTopList.filter(item => item.auctionStatus === 'won').map(item => { const player = item.activePlan === 'A' ? item.planA : (item.activePlan === 'B' ? item.planB : item.planC); return player; }).filter(Boolean); slotsContainer.innerHTML = ''; let tempSelectedIds = {}; document.querySelectorAll('#player-selection-slots select').forEach(s => { if(s.value) { tempSelectedIds[s.dataset.key] = s.value; } }); for (const role in slots) { for (let i = 0; i < slots[role]; i++) { const slotKey = `${role}_${i}`; const currentPlayerInSlot = tempSelectedIds[slotKey]; const options = acquiredPlayers.filter(p => p.ruolo === role).filter(p => !Object.values(tempSelectedIds).includes(String(p.id)) || String(p.id) === currentPlayerInSlot).map(p => `<option value="${p.id}" ${currentPlayerInSlot == p.id ? 'selected' : ''}>${p.nome}</option>`).join(''); slotsContainer.innerHTML += `<div class="form-group"><label>${roleMap[role]} ${i + 1}</label><select data-key="${slotKey}" class="lineup-player-select"><option value="">-- Seleziona --</option>${options}</select></div>`; } } document.querySelectorAll('.lineup-player-select').forEach(select => { select.addEventListener('change', generatePlayerSelectionSlots); }); }
    function renderAndShowFinalSquad() { const container = document.getElementById('final-squad-content'); const summary = document.getElementById('total-spent-summary'); const finalSquad = userTopList.filter(item => item.auctionStatus === 'won'); if (finalSquad.length === 0) { container.innerHTML = "<p>Non hai ancora acquistato nessun giocatore.</p>"; summary.textContent = ""; document.getElementById('final-squad-modal').classList.remove('hidden'); return; } let totalSpent = 0; const squadByRole = { P: [], D: [], C: [], A: [] }; finalSquad.forEach(item => { const player = item.activePlan === 'A' ? item.planA : (item.activePlan === 'B' ? item.planB : item.planC); if (player) { squadByRole[player.ruolo].push({ ...player, finalCost: item.finalCost }); totalSpent += parseInt(item.finalCost, 10); } }); container.innerHTML = roleOrder.map(role => { if (!squadByRole[role] || squadByRole[role].length === 0) return ''; return `<div class="role-summary"><h5>${roleMap[role]}</h5><ul>${squadByRole[role].map(p => `<li>${p.nome} (${p.squadra}) - <strong>${p.finalCost} cr</strong></li>`).join('')}</ul></div>` }).join(''); summary.textContent = `Spesa Totale: ${totalSpent} crediti`; document.getElementById('final-squad-modal').classList.remove('hidden'); }

    // --- Logica Firestore ---
    function initializeTopListWithDefaultStrategy() { userTopList = DEFAULT_STRATEGY_SLOTS.map((slot, index) => ({ slotId: index, role: slot.role, planA_max_budget: slot.budget, planA: null, planB: null, planC: null })); }
    async function saveUserData() { if (!currentUser) return; const userData = { top_list: userTopList, settings: { totalCredits: totalCredits, roleLimits: roleLimits }, player_database: allPlayers, lineup: userLineup }; try { await db.collection('user_data').doc(currentUser.uid).set(userData, { merge: true }); } catch (error) { console.error("Errore nel salvataggio dei dati utente:", error); } }
    async function loadUserData() { if (!currentUser) return; try { const doc = await db.collection('user_data').doc(currentUser.uid).get(); if (doc.exists) { const data = doc.data(); userTopList = data.top_list && data.top_list.length > 0 ? data.top_list : []; if(userTopList.length === 0) initializeTopListWithDefaultStrategy(); userLineup = data.lineup || { formation: '4-3-3', starting11: {} }; if (data.settings) { totalCredits = data.settings.totalCredits || 500; roleLimits = data.settings.roleLimits || { 'P': 3, 'D': 8, 'C': 8, 'A': 6 }; } if (data.player_database && data.player_database.length > 0) { allPlayers = data.player_database; } else { const response = await fetch('giocatori.json'); const jsonData = await response.json(); allPlayers = jsonData.giocatori; } } else { initializeTopListWithDefaultStrategy(); const response = await fetch('giocatori.json'); const jsonData = await response.json(); allPlayers = jsonData.giocatori; } } catch (error) { console.error("Errore nel caricamento dei dati utente:", error); } }
});
