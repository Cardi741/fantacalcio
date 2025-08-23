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
        auth.signInWithPopup(provider)
            .then((result) => {
                console.log("Login effettuato con successo:", result.user);
            })
            .catch((error) => {
                console.error("Errore durante il login:", error);
                alert("Si è verificato un errore durante il login. Controlla la console per i dettagli.");
            });
    });

    // --- Gestione dello stato di autenticazione ---
    auth.onAuthStateChanged((user) => {
        if (user) {
            // L'utente è loggato
            loginContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');

            // L'utente è loggato: setup dell'interfaccia principale
            setupAppUI(user);

        } else {
            // L'utente non è loggato
            loginContainer.classList.remove('hidden');
            appContainer.classList.add('hidden');
            appContainer.innerHTML = '<p>Caricamento...</p>'; // Resetta il container dell'app
        }
    });

    let allPlayers = [];
    let userTopList = [];
    let currentUser = null;
    const roleMap = { 'P': 'Portiere', 'D': 'Difensore', 'C': 'Centrocampista', 'A': 'Attaccante' };
    const roleLimits = { 'P': 3, 'D': 8, 'C': 8, 'A': 6 };

    function setupAppUI(user) {
        currentUser = user;
        appContainer.innerHTML = `
            <div class="app-header">
                <h2>Ciao, ${user.displayName}!</h2>
                <button id="logout-btn">Logout</button>
            </div>
            <p>Sei pronto a dominare l'asta? Costruisci la tua Top 25 e preparati a non avere rivali.</p>

            <div id="main-content">
                <div id="list-builder-view">
                    <div id="my-top-list-container">
                        <div class="view-header">
                            <h3>La mia Top 25</h3>
                            <button id="start-auction-btn">Avvia Modalità Asta</button>
                        </div>
                        <div id="my-top-list-summary"></div>
                    </div>
                    <hr>
                    <div id="all-players-container">
                        <h3>Lista giocatori Serie A</h3>
                        <div class="filter-controls">
                            <span>Filtra per ruolo:</span>
                            <button class="filter-btn active" data-role="All">Tutti</button>
                            <button class="filter-btn" data-role="P">Portieri</button>
                            <button class="filter-btn" data-role="D">Difensori</button>
                            <button class="filter-btn" data-role="C">Centrocampisti</button>
                            <button class="filter-btn" data-role="A">Attaccanti</button>
                        </div>
                        <div id="player-list-container"></div>
                    </div>
                </div>

                <div id="auction-view" class="hidden">
                    <div class="view-header">
                        <h3>Modalità Asta</h3>
                        <div>
                            <button id="show-final-squad-btn">Mostra Rosa Finale</button>
                            <button id="exit-auction-btn">Torna alla modifica</button>
                        </div>
                    </div>
                    <div id="auction-list-container"></div>
                </div>
            </div>

            <!-- Modale per la Rosa Finale -->
            <div id="final-squad-modal" class="modal hidden">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <h4>La Tua Rosa Ufficiale</h4>
                    <div id="final-squad-content"></div>
                    <h5 id="total-spent-summary"></h5>
                </div>
            </div>

            <!-- Modale per aggiungere giocatori alla lista -->
            <div id="add-player-modal" class="modal hidden">
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <h4>Aggiungi alla tua lista</h4>
                    <form id="add-player-form">
                        <div class="form-group">
                            <label>Piano A (Titolare):</label>
                            <p id="modal-player-name-a"></p>
                        </div>
                        <div class="form-group">
                            <label for="max-budget">Budget Massimo per Piano A:</label>
                            <input type="number" id="max-budget" min="1" required>
                        </div>
                        <div class="form-group">
                            <label for="plan-b-select">Piano B (Alternativa):</label>
                            <select id="plan-b-select"><option value="">Nessuno</option></select>
                        </div>
                        <div class="form-group">
                            <label for="plan-c-select">Piano C (Riserva):</label>
                            <select id="plan-c-select"><option value="">Nessuno</option></select>
                        </div>
                        <button type="submit">Salva Scelta</button>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                renderPlayers(e.target.dataset.role);
            });
        });

        // Event listeners per il modale
        document.querySelector('.close-btn').addEventListener('click', closeAddPlayerModal);
        document.getElementById('add-player-form').addEventListener('submit', handleAddPlayerFormSubmit);

        // Event listeners per il cambio di vista
        document.getElementById('start-auction-btn').addEventListener('click', () => {
            initializeAuctionState();
            document.getElementById('list-builder-view').classList.add('hidden');
            document.getElementById('auction-view').classList.remove('hidden');
            renderAuctionView();
        });
        document.getElementById('exit-auction-btn').addEventListener('click', () => {
            document.getElementById('auction-view').classList.add('hidden');
            document.getElementById('list-builder-view').classList.remove('hidden');
            renderTopListSummary(); // Ricarica il sommario
        });

        // Listener per il modale della rosa finale
        document.getElementById('show-final-squad-btn').addEventListener('click', renderAndShowFinalSquad);
        document.querySelector('#final-squad-modal .close-btn').addEventListener('click', () => {
            document.getElementById('final-squad-modal').classList.add('hidden');
        });

        // Listener delegato per le azioni dell'asta
        document.getElementById('auction-list-container').addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const index = e.target.dataset.index;

            if (action && index) {
                if (action === 'won') {
                    handlePlayerWon(index);
                } else if (action === 'lost') {
                    handlePlayerLost(index);
                }
            }
        });


        loadAndDisplayPlayers();
        loadUserListFromFirestore();
    }

    async function loadAndDisplayPlayers() {
        if (allPlayers.length === 0) {
            try {
                const response = await fetch('giocatori.json');
                const data = await response.json();
                allPlayers = data.giocatori;
            } catch (error) {
                console.error("Errore nel caricamento dei giocatori:", error);
                document.getElementById('player-list-container').innerHTML = `<p>Errore nel caricamento della lista giocatori.</p>`;
                return;
            }
        }
        renderPlayers('All'); // Mostra tutti i giocatori all'inizio
    }

    function renderPlayers(roleFilter = 'All') {
        const container = document.getElementById('player-list-container');
        const filteredPlayers = roleFilter === 'All'
            ? allPlayers
            : allPlayers.filter(p => p.ruolo === roleFilter);

        if (filteredPlayers.length === 0) {
            container.innerHTML = '<p>Nessun giocatore trovato per questo ruolo.</p>';
            return;
        }

        container.innerHTML = `
            <table class="player-table">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Squadra</th>
                        <th>Ruolo</th>
                        <th>Azione</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredPlayers.map(player => `
                        <tr>
                            <td>${player.nome}</td>
                            <td>${player.squadra}</td>
                            <td>${roleMap[player.ruolo]}</td>
                            <td><button class="add-player-btn" data-id="${player.id}">Aggiungi</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Aggiungi event listener ai pulsanti "Aggiungi"
        document.querySelectorAll('.add-player-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openAddPlayerModal(e.target.dataset.id));
        });
    }

    // --- Logica per la Top List ---

    function renderTopListSummary() {
        const container = document.getElementById('my-top-list-summary');
        const counts = userTopList.reduce((acc, curr) => {
            acc[curr.planA.ruolo] = (acc[curr.planA.ruolo] || 0) + 1;
            return acc;
        }, {});

        container.innerHTML = Object.keys(roleLimits).map(role => `
            <div class="role-summary">
                <h5>${roleMap[role]} (${counts[role] || 0}/${roleLimits[role]})</h5>
                <ul>
                    ${userTopList.filter(item => item.planA.ruolo === role).map(item => `
                        <li>${item.planA.nome} (${item.planA_max_budget} cr)</li>
                    `).join('')}
                </ul>
            </div>
        `).join('');
    }

    function openAddPlayerModal(playerId) {
        const player = allPlayers.find(p => p.id == playerId);
        if (!player) return;

        const form = document.getElementById('add-player-form');
        form.dataset.playerId = playerId;
        document.getElementById('modal-player-name-a').textContent = `${player.nome} (${player.squadra})`;

        // Popola select per Piano B e C
        const sameRolePlayers = allPlayers.filter(p => p.ruolo === player.ruolo && p.id !== player.id);
        const planBSelect = document.getElementById('plan-b-select');
        const planCSelect = document.getElementById('plan-c-select');
        planBSelect.innerHTML = '<option value="">Nessuno</option>' + sameRolePlayers.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
        planCSelect.innerHTML = '<option value="">Nessuno</option>' + sameRolePlayers.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');

        document.getElementById('add-player-modal').classList.remove('hidden');
    }

    function closeAddPlayerModal() {
        document.getElementById('add-player-modal').classList.add('hidden');
        document.getElementById('add-player-form').reset();
    }

    async function handleAddPlayerFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const playerId = form.dataset.playerId;
        const playerA = allPlayers.find(p => p.id == playerId);

        const roleCount = userTopList.filter(item => item.planA.ruolo === playerA.ruolo).length;
        if (roleCount >= roleLimits[playerA.ruolo]) {
            alert(`Hai già raggiunto il limite di ${roleLimits[playerA.ruolo]} giocatori per il ruolo ${roleMap[playerA.ruolo]}.`);
            return;
        }

        const newEntry = {
            planA: playerA,
            planA_max_budget: document.getElementById('max-budget').value,
            planB: allPlayers.find(p => p.id == document.getElementById('plan-b-select').value) || null,
            planC: allPlayers.find(p => p.id == document.getElementById('plan-c-select').value) || null,
            slotId: Date.now() // ID unico per la voce
        };

        userTopList.push(newEntry);
        renderTopListSummary();
        await saveUserListToFirestore();
        closeAddPlayerModal();
    }

    // --- Logica Firestore ---

    async function saveUserListToFirestore() {
        if (!currentUser) return;
        try {
            const userListRef = db.collection('user_lists').doc(currentUser.uid);
            await userListRef.set({ top_list: userTopList });
        } catch (error) {
            console.error("Errore nel salvataggio della lista:", error);
        }
    }

    async function loadUserListFromFirestore() {
        if (!currentUser) return;
        try {
            const userListRef = db.collection('user_lists').doc(currentUser.uid);
            const doc = await userListRef.get();
            if (doc.exists) {
                userTopList = doc.data().top_list || [];
                renderTopListSummary();
            }
        } catch (error) {
            console.error("Errore nel caricamento della lista:", error);
        }
    }

    // --- Logica per la Modalità Asta ---

    function initializeAuctionState() {
        userTopList.forEach(item => {
            if (item.auctionStatus === undefined) {
                item.auctionStatus = 'pending'; // 'pending', 'won', 'lost'
                item.activePlan = 'A'; // 'A', 'B', 'C'
                item.finalCost = 0;
            }
        });
    }

    function renderAuctionView() {
        const container = document.getElementById('auction-list-container');
        container.innerHTML = userTopList.map((item, index) => {
            const playerA = item.planA;
            const playerB = item.planB;
            const playerC = item.planC;

            const isWon = item.auctionStatus === 'won';
            const isLost = item.auctionStatus === 'lost';

            let activePlanHTML = '';
            if (!isWon && !isLost) {
                if (item.activePlan === 'A' && playerA) {
                    activePlanHTML = renderPlayerPlan(playerA, 'A', item.planA_max_budget, index);
                } else if (item.activePlan === 'B' && playerB) {
                    activePlanHTML = renderPlayerPlan(playerB, 'B', null, index);
                } else if (item.activePlan === 'C' && playerC) {
                    activePlanHTML = renderPlayerPlan(playerC, 'C', null, index);
                }
            }

            return `
                <div class="auction-item ${isWon ? 'status-won' : ''} ${isLost ? 'status-lost' : ''}">
                    <h5>Slot ${index + 1} (${roleMap[playerA.ruolo]})</h5>
                    <div class="player-plan ${item.activePlan !== 'A' && !isWon ? 'lost' : ''}">
                        <b>A:</b> ${playerA.nome} (${item.planA_max_budget} cr)
                        ${isWon && item.activePlan === 'A' ? `<strong> - ACQUISTATO a ${item.finalCost}</strong>` : ''}
                    </div>
                    ${playerB ? `<div class="player-plan plan-b ${item.activePlan === 'A' || (item.activePlan === 'C' && !isWon) ? 'inactive' : ''} ${item.activePlan !== 'B' && !isWon ? 'lost' : ''}">
                        <b>B:</b> ${playerB.nome}
                        ${isWon && item.activePlan === 'B' ? `<strong> - ACQUISTATO a ${item.finalCost}</strong>` : ''}
                    </div>` : ''}
                    ${playerC ? `<div class="player-plan plan-c ${item.activePlan !== 'C' || isWon ? 'inactive' : ''} ${item.activePlan !== 'C' && !isWon ? 'lost' : ''}">
                        <b>C:</b> ${playerC.nome}
                        ${isWon && item.activePlan === 'C' ? `<strong> - ACQUISTATO a ${item.finalCost}</strong>` : ''}
                    </div>` : ''}

                    <div class="auction-actions">
                        ${activePlanHTML}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderPlayerPlan(player, plan, budget, index) {
        if (!player) return '';
        return `
            <div>
                <p><strong>Attuale: ${player.nome}</strong> ${budget ? `(Budget: ${budget})` : ''}</p>
                <input type="number" class="cost-input" data-index="${index}" placeholder="Costo finale" min="1">
                <button class="won-btn" data-action="won" data-index="${index}">Acquistato</button>
                <button class="lost-btn" data-action="lost" data-index="${index}">Sfumato</button>
            </div>
        `;
    }

    async function handlePlayerWon(index) {
        const item = userTopList[index];
        const costInput = document.querySelector(`.cost-input[data-index='${index}']`);
        const cost = costInput.value;
        if (!cost || cost < 1) {
            alert("Inserisci un costo valido.");
            return;
        }
        item.auctionStatus = 'won';
        item.finalCost = cost;
        renderAuctionView();
        await saveUserListToFirestore();
    }

    async function handlePlayerLost(index) {
        const item = userTopList[index];
        if (item.activePlan === 'A') {
            item.activePlan = 'B';
        } else if (item.activePlan === 'B') {
            item.activePlan = 'C';
        } else {
            item.auctionStatus = 'lost';
        }

        // Se il piano successivo non esiste, l'asta per questo slot è persa
        if ((item.activePlan === 'B' && !item.planB) || (item.activePlan === 'C' && !item.planC)) {
            item.auctionStatus = 'lost';
        }

        renderAuctionView();
        await saveUserListToFirestore();
    }

    // --- Logica per la Rosa Finale ---

    function renderAndShowFinalSquad() {
        const container = document.getElementById('final-squad-content');
        const summary = document.getElementById('total-spent-summary');

        const finalSquad = userTopList.filter(item => item.auctionStatus === 'won');

        if (finalSquad.length === 0) {
            container.innerHTML = "<p>Non hai ancora acquistato nessun giocatore.</p>";
            summary.textContent = "";
            document.getElementById('final-squad-modal').classList.remove('hidden');
            return;
        }

        let totalSpent = 0;
        const squadByRole = { P: [], D: [], C: [], A: [] };

        finalSquad.forEach(item => {
            const player = item.activePlan === 'A' ? item.planA : (item.activePlan === 'B' ? item.planB : item.planC);
            if (player) {
                squadByRole[player.ruolo].push({ ...player, finalCost: item.finalCost });
                totalSpent += parseInt(item.finalCost, 10);
            }
        });

        container.innerHTML = Object.keys(squadByRole).map(role => `
            <div class="role-summary">
                <h5>${roleMap[role]}</h5>
                <ul>
                    ${squadByRole[role].map(p => `<li>${p.nome} (${p.squadra}) - <strong>${p.finalCost} cr</strong></li>`).join('')}
                </ul>
            </div>
        `).join('');

        summary.textContent = `Spesa Totale: ${totalSpent} crediti`;
        document.getElementById('final-squad-modal').classList.remove('hidden');
    }
});
