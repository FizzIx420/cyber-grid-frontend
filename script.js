// ============================================
// CYBER‑GRID – FULL STACK FRONTEND (FINAL)
// ============================================

// Global error logger
window.addEventListener('error', (e) => {
    console.log('Current pathname:', location.pathname);
    console.error('Global error:', e.error);
});

// ============================================
// 1. CONFIGURATION & INITIALIZATION
// ============================================
const API_BASE = 'https://cyber-grid-backend.vercel.app/api'; // Change to your deployed URL
let currentUser = null; // Will hold { id, username, email, is_admin }
let authToken = localStorage.getItem('token');

// Firebase config – only initialize if valid keys are provided
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let firebaseDb = null;
// Check if config contains actual values (not placeholders)
const hasValidFirebase = Object.values(firebaseConfig).every(v => v && !v.includes('YOUR_'));
if (hasValidFirebase) {
    try {
        firebase.initializeApp(firebaseConfig);
        firebaseDb = firebase.database();
        console.log('[FIREBASE] Initialized');
    } catch (e) {
        console.warn('[FIREBASE] Initialization failed, using localStorage only', e);
    }
} else {
    console.log('[FIREBASE] Skipped – using localStorage only');
}

// ============================================
// 2. LOADOUT MANAGER (with optional Firebase sync)
// ============================================
class LoadoutManager {
    constructor() {
        this.loadout = [];
        this.counterEl = document.getElementById('loadout-count');
        this.modalEl = document.getElementById('loadout-modal');
        this.containerEl = document.getElementById('loadout-items-container');
        this.init();
    }

    async init() {
        // Load from localStorage first
        const saved = localStorage.getItem('cyberGrid_Loadout');
        if (saved) this.loadout = JSON.parse(saved);
        else this.loadout = [];

        // If user is logged in and Firebase is available, sync
        if (currentUser && firebaseDb) {
            const loadoutRef = firebaseDb.ref(`loadouts/${currentUser.id}`);
            const snapshot = await loadoutRef.once('value');
            const fbLoadout = snapshot.val();
            if (fbLoadout) {
                this.loadout = fbLoadout;
                localStorage.setItem('cyberGrid_Loadout', JSON.stringify(this.loadout));
            } else {
                loadoutRef.set(this.loadout);
            }

            // Listen for remote changes
            loadoutRef.on('value', (snap) => {
                const remote = snap.val();
                if (remote && JSON.stringify(remote) !== JSON.stringify(this.loadout)) {
                    this.loadout = remote;
                    localStorage.setItem('cyberGrid_Loadout', JSON.stringify(this.loadout));
                    this.updateUI();
                    this.showToast('// Loadout synced from another device');
                }
            });
        }

        this.updateUI();
        this.setupListeners();
    }

    setupListeners() {
        document.getElementById('loadout-toggle')?.addEventListener('click', () => this.toggleModal());
        document.getElementById('close-loadout')?.addEventListener('click', () => this.toggleModal());
        document.getElementById('purge-loadout')?.addEventListener('click', () => this.purgeAll());
        document.getElementById('deploy-loadout')?.addEventListener('click', () => this.checkout());
    }

    saveState() {
        localStorage.setItem('cyberGrid_Loadout', JSON.stringify(this.loadout));
        this.updateUI();

        if (currentUser && firebaseDb) {
            firebaseDb.ref(`loadouts/${currentUser.id}`).set(this.loadout);
        }
    }

    addItem(itemObj) {
        if (!this.loadout.find(i => i.id === itemObj.id)) {
            this.loadout.push(itemObj);
            this.saveState();
            this.showToast(`// ${itemObj.name} stored in memory`);
        }
    }

    removeItem(itemId) {
        this.loadout = this.loadout.filter(item => String(item.id) !== String(itemId));
        this.saveState();
    }

    purgeAll() {
        this.loadout = [];
        this.saveState();
        this.showToast('// Loadout purged');
    }

    async checkout() {
        if (this.loadout.length === 0) {
            this.showToast('// Loadout is empty');
            return;
        }
        if (!currentUser) {
            this.showToast('// Please login to deploy');
            document.getElementById('login-modal').classList.add('active');
            return;
        }

        const productIds = this.loadout.map(i => i.id);
        const res = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ productIds })
        });
        if (res.ok) {
            this.showToast('// Order placed! Check your email.');
            this.purgeAll();
        } else {
            const err = await res.json();
            this.showToast(`// Error: ${err.error}`);
        }
    }

    toggleModal() {
        this.modalEl.classList.toggle('hidden');
    }

    updateUI() {
        this.counterEl.innerText = this.loadout.length;
        if (this.loadout.length === 0) {
            this.containerEl.innerHTML = `<p style="font-size:0.8rem; color: #8a9bb2;">// No assets detected in local memory buffer.</p>`;
            return;
        }
        this.containerEl.innerHTML = this.loadout.map(item => `
            <div class="loadout-item">
                <div>
                    <span style="font-size: 0.7rem; color: #b829ea;">${item.type}</span><br>
                    <span style="font-size: 0.9rem;">${item.name}</span>
                </div>
                <button class="remove-btn" data-remove-id="${item.id}">X</button>
            </div>
        `).join('');
    }

    showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// ============================================
// 3. DATA MODELS (with fallback)
// ============================================
let projects = [];
let aiProjects = [];
let modules = [];

async function loadData() {
    try {
        console.log('[SYSTEM] Attempting to fetch data from API...');
        const [projRes, aiRes, modRes] = await Promise.all([
            fetch(`${API_BASE}/products`),
            fetch(`${API_BASE}/ai-projects`),
            fetch(`${API_BASE}/modules`)
        ]);
        
        if (!projRes.ok || !aiRes.ok || !modRes.ok) {
            throw new Error('API response not ok');
        }
        
        projects = await projRes.json();
        aiProjects = await aiRes.json();
        modules = await modRes.json();
        console.log('[SYSTEM] Data loaded from API successfully');
    } catch (err) {
        console.warn('[SYSTEM] API fetch failed, using fallback data', err);
        // Fallback data for offline development
        projects = [
            { id: 1, title: "Tic Cat Toe ^4", category: "ue5 cpp", tag: "UE5 / C++", img: "https://via.placeholder.com/300x200/b829ea/fff?text=Project+1", desc: "A cyberpunk-themed tic-tac-toe game built with UE5 and C++" },
            { id: 2, title: "Neural Networks Visualizer", category: "ai python", tag: "AI / Python", img: "https://via.placeholder.com/300x200/00f0ff/000?text=Project+2", desc: "Interactive visualization of neural network training processes" },
            { id: 3, title: "Procedural World Generator", category: "ue5 cpp", tag: "UE5 / C++", img: "https://via.placeholder.com/300x200/b829ea/fff?text=Project+3", desc: "Infinite procedurally generated cyberpunk worlds" },
            { id: 4, title: "AI Chat System", category: "ai python", tag: "AI / Python", img: "https://via.placeholder.com/300x200/00f0ff/000?text=Project+4", desc: "Machine learning-powered conversational AI" },
            { id: 5, title: "Physics Engine", category: "cpp", tag: "C++", img: "https://via.placeholder.com/300x200/fcee0a/000?text=Project+5", desc: "High-performance physics simulation engine" },
            { id: 6, title: "Game Optimization Tool", category: "ue5 cpp", tag: "UE5 / C++", img: "https://via.placeholder.com/300x200/b829ea/fff?text=Project+6", desc: "Performance profiling and optimization suite" },
            { id: 7, title: "Computer Vision Module", category: "ai python", tag: "AI / Python", img: "https://via.placeholder.com/300x200/00ff66/000?text=Project+7", desc: "Real-time object detection and tracking system" },
            { id: 8, title: "Shader Library", category: "cpp", tag: "C++", img: "https://via.placeholder.com/300x200/fcee0a/000?text=Project+8", desc: "Collection of advanced rendering shaders" },
            { id: 9, title: "Data Mining Suite", category: "ai python", tag: "AI / Python", img: "https://via.placeholder.com/300x200/00f0ff/000?text=Project+9", desc: "Advanced data extraction and analysis tools" }
        ];
        
        aiProjects = [
            { id: 101, title: "GPT Fine-tuning Framework", category: "models", tag: "Models", img: "https://via.placeholder.com/300x200/00f0ff/000?text=AI+Project+1", desc: "Framework for fine-tuning language models" },
            { id: 102, title: "ImageNet Classifier", category: "models", tag: "Models", img: "https://via.placeholder.com/300x200/00f0ff/000?text=AI+Project+2", desc: "Deep learning image classification system" },
            { id: 103, title: "Anomaly Detection System", category: "tools", tag: "Tools", img: "https://via.placeholder.com/300x200/fcee0a/000?text=AI+Project+3", desc: "Real-time anomaly detection pipeline" },
            { id: 104, title: "Reinforcement Learning Agents", category: "models", tag: "Models", img: "https://via.placeholder.com/300x200/00f0ff/000?text=AI+Project+4", desc: "RL agents for game playing and optimization" },
            { id: 105, title: "Time Series Forecasting", category: "datasets", tag: "Datasets", img: "https://via.placeholder.com/300x200/00ff66/000?text=AI+Project+5", desc: "LSTM-based time series prediction models" }
        ];
        
        modules = [
            { id: 201, title: "Scene Management", desc: "Handle dynamic scene loading and unloading for seamless gameplay", img: "https://via.placeholder.com/300x200/b829ea/fff?text=Module+1" },
            { id: 202, title: "Character Animation System", desc: "Advanced skeletal animation with IK and procedural blending", img: "https://via.placeholder.com/300x200/b829ea/fff?text=Module+2" },
            { id: 203, title: "Audio Processing Pipeline", desc: "Spatial audio, voice processing, and dynamic music system", img: "https://via.placeholder.com/300x200/00f0ff/000?text=Module+3" },
            { id: 204, title: "Network Replication", desc: "Multiplayer state synchronization and prediction framework", img: "https://via.placeholder.com/300x200/fcee0a/000?text=Module+4" },
            { id: 205, title: "UI/UX Framework", desc: "Responsive HUD system with real-time data binding", img: "https://via.placeholder.com/300x200/00ff66/000?text=Module+5" },
            { id: 206, title: "AI Behavior Trees", desc: "Modular behavior system for NPC intelligence", img: "https://via.placeholder.com/300x200/b829ea/fff?text=Module+6" }
        ];
        
        console.log('[SYSTEM] Fallback data loaded');
    }
}

// ============================================
// 4. VIEW TEMPLATES
// ============================================
const viewHome = () => `
    <div class="page-view">
        <!-- Hero Section -->
        <header class="hero-section" id="hero-container">
            <div class="hero-content" id="hero-card">
                <div class="floating-image">
                    <img src="images/hero.jpg" alt="Cyberpunk Setup">
                </div>
                <div class="hero-text">
                    <h1 class="glitch" data-text="ARCHITECTING REALITIES">ARCHITECTING REALITIES</h1>
                    <p>ENGINEERING VIRTUAL WORLDS & NEURAL SYSTEMS</p>
                </div>
            </div>
        </header>

        <!-- About Section -->
        <section class="cyber-section" id="about-system">
            <div class="section-container">
                <div class="section-header">
                    <h2 class="glitch" data-text="> SYSTEM_ARCHITECT">> SYSTEM_ARCHITECT</h2>
                    <div class="scanline-divider"></div>
                </div>
                <div class="about-grid">
                    <div class="about-text-terminal">
                        <div class="terminal-header">
                            <span class="dot red"></span>
                            <span class="dot yellow"></span>
                            <span class="dot green"></span>
                            <span class="terminal-title">root@sys.dev:~# cat bio.txt</span>
                        </div>
                        <div class="terminal-body">
                            <p><span class="prompt">$</span> Bridging the gap between structural IT management and cutting-edge virtual experiences...</p>
                            <br>
                            <p><span class="prompt">$</span> Whether plotting the spatial mathematics of a grid-based puzzle game or utilizing neural models...</p>
                            <span class="blinking-cursor">_</span>
                        </div>
                    </div>
                    <div class="about-visuals">
                        <div class="stat-box">
                            <span class="stat-num glitch-cyan" data-text="UE5">UE5</span>
                            <span class="stat-label">ENVIRONMENT & LOGIC</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-num glitch-purple" data-text="C++">C++</span>
                            <span class="stat-label">CORE SYSTEMS</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-num glitch-cyan" data-text="A.I.">A.I.</span>
                            <span class="stat-label">ASSISTED PIPELINE</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Modules Section -->
        <section class="cyber-section alt-bg" id="core-modules">
            <div class="section-container">
                <div class="section-header text-right">
                    <h2 class="glitch" data-text="> ACTIVE_MODULES">> ACTIVE_MODULES</h2>
                    <div class="scanline-divider right"></div>
                </div>
                <div class="modules-grid">
                    ${modules.map((m, idx) => `
                    <div class="module-card" data-module-id="${m.id}">
                        <div class="module-icon">[ ${String(idx+1).padStart(2,'0')} ]</div>
                        <h3>${m.title}</h3>
                        <p>${m.desc}</p>
                    </div>
                    `).join('')}
                </div>
            </div>
        </section>

        <!-- Featured Projects -->
        <section class="cyber-section">
            <div class="section-header">
                <h2 class="glitch" data-text="> FEATURED_DEPLOYMENTS">> FEATURED_DEPLOYMENTS</h2>
                <div class="scanline-divider"></div>
            </div>
            <div class="featured-grid">
                ${projects.slice(0, 4).map(p => `
                    <div class="featured-card" data-project-id="${p.id}">
                        <img src="${p.img}" alt="${p.title}" class="featured-img">
                        <h3>${p.title}</h3>
                        <span class="neon-tag">${p.tag}</span>
                    </div>
                `).join('')}
            </div>
        </section>

        <!-- Skills Matrix -->
        <section class="cyber-section alt-bg">
            <div class="section-header text-right">
                <h2 class="glitch" data-text="> SKILL_MATRIX">> SKILL_MATRIX</h2>
                <div class="scanline-divider right"></div>
            </div>
            <div class="skills-grid">
                <div class="skill-item"><span class="skill-name">Unreal Engine 5</span><div class="skill-bar" style="width:90%"></div></div>
                <div class="skill-item"><span class="skill-name">C++</span><div class="skill-bar" style="width:85%"></div></div>
                <div class="skill-item"><span class="skill-name">AI/ML</span><div class="skill-bar" style="width:75%"></div></div>
                <div class="skill-item"><span class="skill-name">Python</span><div class="skill-bar" style="width:70%"></div></div>
                <div class="skill-item"><span class="skill-name">Blueprints</span><div class="skill-bar" style="width:95%"></div></div>
            </div>
        </section>

        <!-- Outro Section -->
        <section class="cyber-section outro-section">
            <div class="section-container text-center">
                <h2 class="glitch" data-text="> END_OF_TRANSMISSION">> END_OF_TRANSMISSION</h2>
                <p class="outro-text">The system is always evolving. Stay tuned for updates, or initiate a direct uplink.</p>
                <div class="outro-actions">
                    <a href="/contact" class="cyber-btn" data-link>ESTABLISH UPLINK</a>
                    <button id="scroll-top" class="cyber-btn-outline">RETURN TO ROOT</button>
                </div>
            </div>
        </section>
    </div>
`;

const viewAssetStore = () => `
    <div class="page-view asset-store">
        <div class="store-header">
            <h2>> ASSET_STORE</h2>
            <div class="filters">
                <button class="filter-btn active" data-filter="all">ALL</button>
                <button class="filter-btn" data-filter="ue5">UE5</button>
                <button class="filter-btn" data-filter="cpp">C++</button>
                <button class="filter-btn" data-filter="ai">A.I.</button>
            </div>
        </div>
        <div id="project-grid" class="grid-container"></div>
        <div class="load-more-container">
            <button id="load-more-btn" class="cyber-btn">LOAD MORE</button>
        </div>
    </div>
`;

const viewAiProjects = () => `
    <div class="page-view asset-store">
        <div class="store-header">
            <h2>> AI_EXPERIMENTS</h2>
            <div class="filters">
                <button class="filter-btn active" data-filter="all">ALL</button>
                <button class="filter-btn" data-filter="models">MODELS</button>
                <button class="filter-btn" data-filter="datasets">DATASETS</button>
                <button class="filter-btn" data-filter="tools">TOOLS</button>
            </div>
        </div>
        <div id="ai-grid" class="grid-container"></div>
        <div class="load-more-container">
            <button id="load-more-ai-btn" class="cyber-btn">LOAD MORE</button>
        </div>
    </div>
`;

const viewContact = () => `
    <div class="page-view">
        <section class="cyber-section" id="comm-link">
            <div class="section-container">
                <div class="comm-grid">
                    <div class="comm-info">
                        <h2 class="glitch" data-text="> ESTABLISH_UPLINK">> ESTABLISH_UPLINK</h2>
                        <p>Ready to collaborate on the next digital construct? Encrypt your message and transmit it through the secure channel.</p>
                        <div class="status-indicator">
                            <span class="ping"></span>
                            <span>SYSTEM STATUS: ONLINE & READY</span>
                        </div>
                    </div>
                    <form id="cyber-contact-form" class="cyber-form">
                        <div class="input-group">
                            <input type="text" id="sender-name" required placeholder=" ">
                            <label for="sender-name">ALIAS / IDENTIFIER</label>
                            <div class="input-line"></div>
                        </div>
                        <div class="input-group">
                            <input type="email" id="sender-email" required placeholder=" ">
                            <label for="sender-email">TRANSMISSION FREQUENCY (EMAIL)</label>
                            <div class="input-line"></div>
                        </div>
                        <div class="input-group">
                            <textarea id="sender-msg" required placeholder=" " rows="4"></textarea>
                            <label for="sender-msg">ENCRYPTED PAYLOAD</label>
                            <div class="input-line"></div>
                        </div>
                        <button type="submit" class="cyber-btn submit-btn">TRANSMIT DATA_</button>
                    </form>
                </div>
            </div>
        </section>
    </div>
`;

const viewAdmin = () => `
    <div class="page-view">
        <h2>> ADMIN_CONTROL</h2>
        <form id="add-product-form" class="admin-form">
            <h3>ADD NEW PRODUCT</h3>
            <div class="input-group">
                <input type="text" id="product-title" required placeholder=" ">
                <label for="product-title">TITLE</label>
                <div class="input-line"></div>
            </div>
            <div class="input-group">
                <input type="text" id="product-category" required placeholder=" ">
                <label for="product-category">CATEGORY</label>
                <div class="input-line"></div>
            </div>
            <div class="input-group">
                <input type="text" id="product-tag" required placeholder=" ">
                <label for="product-tag">TAG</label>
                <div class="input-line"></div>
            </div>
            <div class="input-group">
                <input type="text" id="product-img" required placeholder=" ">
                <label for="product-img">IMAGE PATH</label>
                <div class="input-line"></div>
            </div>
            <div class="input-group">
                <textarea id="product-desc" required placeholder=" " rows="3"></textarea>
                <label for="product-desc">DESCRIPTION</label>
                <div class="input-line"></div>
            </div>
            <div class="input-group">
                <input type="number" step="0.01" id="product-price" required placeholder=" ">
                <label for="product-price">PRICE</label>
                <div class="input-line"></div>
            </div>
            <button type="submit" class="cyber-btn">ADD PRODUCT</button>
        </form>
        <div id="admin-product-list" class="admin-product-list"></div>
    </div>
`;

// ============================================
// 5. RENDER FUNCTIONS (with pagination & filtering)
// ============================================
let currentPage = 1;
let currentFilter = 'all';
let currentAiPage = 1;
let currentAiFilter = 'all';

function renderProjectGrid(containerId, filter = 'all', page = 1) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const itemsPerPage = 9;
    let filtered = filter === 'all' ? projects : projects.filter(p => p.category.includes(filter));
    const paginated = filtered.slice(0, page * itemsPerPage);
    
    container.innerHTML = paginated.map(proj => `
        <div class="card" data-project-id="${proj.id}">
            <img src="${proj.img}" alt="${proj.title}" class="card-img">
            <div class="card-content">
                <h3 class="card-title">${proj.title}</h3>
                <span class="neon-tag">${proj.tag}</span>
                <button class="quick-view" data-quick-id="${proj.id}">⧩</button>
            </div>
        </div>
    `).join('');

    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = filtered.length <= page * itemsPerPage ? 'none' : 'inline-block';
    }
    
    observeReveal();
}

function renderAiGrid(containerId, filter = 'all', page = 1) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const itemsPerPage = 9;
    let filtered = filter === 'all' ? aiProjects : aiProjects.filter(p => p.category === filter);
    const paginated = filtered.slice(0, page * itemsPerPage);
    
    container.innerHTML = paginated.map(proj => `
        <div class="card ai-card" data-ai-id="${proj.id}">
            <img src="${proj.img}" alt="${proj.title}" class="card-img">
            <div class="card-content">
                <h3 class="card-title">${proj.title}</h3>
                <span class="neon-tag">${proj.tag}</span>
                <button class="quick-view" data-quick-ai-id="${proj.id}">⧩</button>
            </div>
        </div>
    `).join('');

    const loadMoreBtn = document.getElementById('load-more-ai-btn');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = filtered.length <= page * itemsPerPage ? 'none' : 'inline-block';
    }
    
    observeReveal();
}

// ============================================
// 6. MODAL LOGIC (projects, AI, modules)
// ============================================
let currentProject = null;
let currentAiProject = null;

function openProjectModal(projectId) {
    const project = projects.find(p => p.id == projectId);
    if (!project) return;
    currentProject = project;
    currentAiProject = null;
    document.getElementById('modal-img').src = project.img;
    const titleEl = document.getElementById('modal-title');
    titleEl.textContent = project.title;
    titleEl.dataset.text = project.title;
    document.getElementById('modal-category').textContent = project.tag;
    document.getElementById('modal-desc').textContent = project.desc;
    document.getElementById('item-modal').classList.add('active');
}

function openAiModal(aiId) {
    const project = aiProjects.find(p => p.id === aiId);
    if (!project) return;
    currentAiProject = project;
    currentProject = null;
    document.getElementById('modal-img').src = project.img;
    const titleEl = document.getElementById('modal-title');
    titleEl.textContent = project.title;
    titleEl.dataset.text = project.title;
    document.getElementById('modal-category').textContent = project.tag;
    document.getElementById('modal-desc').textContent = project.desc;
    document.getElementById('item-modal').classList.add('active');
}

function openModuleModal(moduleId) {
    const mod = modules.find(m => String(m.id) === String(moduleId));
    if (!mod) return;
    document.getElementById('module-modal-img').src = mod.img;
    const titleEl = document.getElementById('module-modal-title');
    titleEl.textContent = mod.title;
    titleEl.dataset.text = mod.title;
    document.getElementById('module-modal-desc').textContent = mod.desc;
    document.getElementById('module-modal').classList.add('active');
}

// ============================================
// 7. AUTHENTICATION
// ============================================
function initAuth() {
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loginModal = document.getElementById('login-modal');
    const signupModal = document.getElementById('signup-modal');
    const closeLogin = document.getElementById('close-login-modal');
    const closeSignup = document.getElementById('close-signup-modal');
    const switchToSignup = document.getElementById('switch-to-signup');
    const switchToLogin = document.getElementById('switch-to-login');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    loginBtn.addEventListener('click', () => loginModal.classList.add('active'));
    signupBtn.addEventListener('click', () => signupModal.classList.add('active'));
    closeLogin.addEventListener('click', () => loginModal.classList.remove('active'));
    closeSignup.addEventListener('click', () => signupModal.classList.remove('active'));
    switchToSignup.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.classList.remove('active');
        signupModal.classList.add('active');
    });
    switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        signupModal.classList.remove('active');
        loginModal.classList.add('active');
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (res.ok) {
            const data = await res.json();
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateAuthUI();
            loginModal.classList.remove('active');
            window.AppLoadout.init(); // re‑sync loadout
            initChatbot(); // show chatbot
            showToast('// Authentication successful');
        } else {
            const err = await res.json();
            showToast(`// Error: ${err.error}`);
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const res = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        if (res.ok) {
            const data = await res.json();
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateAuthUI();
            signupModal.classList.remove('active');
            window.AppLoadout.init();
            initChatbot();
            showToast('// Registration successful');
        } else {
            const err = await res.json();
            showToast(`// Error: ${err.error}`);
        }
    });

    logoutBtn.addEventListener('click', () => {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        updateAuthUI();
        if (window.chatbot) window.chatbot.hide();
        document.getElementById('chatbot-container').style.display = 'none';
        window.AppLoadout.init(); // clear Firebase listener? We'll re‑init without user
        showToast('// Disconnected');
    });

    // Check for existing session
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateAuthUI();
        // Validate token with backend (optional)
    }
}

function updateAuthUI() {
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const adminLink = document.getElementById('admin-link');
    const footerUser = document.getElementById('footer-username');

    if (currentUser) {
        loginBtn.style.display = 'none';
        signupBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        footerUser.textContent = currentUser.username.toUpperCase();
        if (currentUser.is_admin) {
            adminLink.style.display = 'inline-block';
        } else {
            adminLink.style.display = 'none';
        }
    } else {
        loginBtn.style.display = 'inline-block';
        signupBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        adminLink.style.display = 'none';
        footerUser.textContent = 'GUEST';
    }
}

// ============================================
// 8. CHATBOT CLASS
// ============================================
class HolographicCat {
    constructor(userId, username) {
        this.userId = userId;
        this.username = username;
        this.messages = [];
        this.initLottie();
        this.loadHistory();
        this.setupListeners();
        this.animationPlaying = 'idle';
    }

    initLottie() {
        this.animation = lottie.loadAnimation({
            container: document.getElementById('cat-avatar'),
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: 'animations/cat.json' // Download a free cat Lottie and place here
        });
        // Store for later control
        this.animation.addEventListener('complete', () => {
            if (this.animationPlaying === 'speak') {
                this.playIdle();
            }
        });
    }

    playIdle() {
        this.animationPlaying = 'idle';
        this.animation.playSegments([0, 60], true); // adjust segments
    }

    playSpeak() {
        this.animationPlaying = 'speak';
        this.animation.playSegments([61, 120], true);
    }

    setupListeners() {
        document.getElementById('toggle-chat').addEventListener('click', () => this.toggleWindow());
        document.getElementById('close-chat').addEventListener('click', () => this.hideWindow());
        document.getElementById('send-chat').addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        // Click on avatar toggles window too
        document.getElementById('cat-avatar').addEventListener('click', () => this.toggleWindow());
    }

    toggleWindow() {
        const win = document.getElementById('chat-window');
        win.classList.toggle('hidden');
        if (!win.classList.contains('hidden')) {
            document.getElementById('chat-input').focus();
        }
    }

    hideWindow() {
        document.getElementById('chat-window').classList.add('hidden');
    }

    async loadHistory() {
        const res = await fetch(`${API_BASE}/chat?userId=${this.userId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const messages = await res.json();
            messages.forEach(msg => this.displayMessage(msg));
        }
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        // User message
        this.displayMessage({ sender: 'user', message: text });
        await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ sender: 'user', message: text })
        });

        input.value = '';
        this.playSpeak();

        // Bot reply
        const reply = await this.generateReply(text);
        setTimeout(async () => {
            this.displayMessage({ sender: 'bot', message: reply });
            await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ sender: 'bot', message: reply })
            });
            this.playIdle();
        }, 500);
    }

    async generateReply(userInput) {
        const lower = userInput.toLowerCase();
        // Simple rule‑based; could call an external API
        if (lower.includes('hello') || lower.includes('hi')) {
            return `Meow, ${this.username}! How can I assist your cyber‑operations today?`;
        }
        if (lower.includes('product') || lower.includes('asset')) {
            return 'We have many digital assets. You can browse them in the Database section.';
        }
        if (lower.includes('price') || lower.includes('cost')) {
            return 'Prices vary. Check the product details in the store.';
        }
        if (lower.includes('who are you')) {
            return 'I am your holographic cat assistant, embedded in the Cyber‑Grid.';
        }
        if (lower.includes('easter egg') || lower.includes('secret')) {
            this.playEasterEgg();
            return 'You found me! Try the Konami code for a surprise.';
        }
        return `I'm not sure about that. But I'm just a cat, not a supercomputer! 😸`;
    }

    playEasterEgg() {
        // Trigger special animation
        this.animation.playSegments([120, 180], true);
        // Play sound if available
        const sound = document.getElementById('easter-sound');
        if (sound) sound.play().catch(() => {});
    }

    displayMessage({ sender, message }) {
        const container = document.getElementById('chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-message', sender);
        msgDiv.textContent = message;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }
}

let chatbotInstance = null;
function initChatbot() {
    if (!currentUser) return;
    document.getElementById('chatbot-container').style.display = 'flex';
    if (!chatbotInstance) {
        chatbotInstance = new HolographicCat(currentUser.id, currentUser.username);
    } else {
        // Update user if changed
        chatbotInstance.userId = currentUser.id;
        chatbotInstance.username = currentUser.username;
        chatbotInstance.loadHistory();
    }
}

// ============================================
// 9. ADMIN PANEL FUNCTIONS
// ============================================
async function renderAdminProducts() {
    const container = document.getElementById('admin-product-list');
    if (!container) return;
    const res = await fetch(`${API_BASE}/products`);
    const products = await res.json();
    container.innerHTML = products.map(p => `
        <div class="admin-product-card">
            <h4>${p.title}</h4>
            <p>${p.price} credits</p>
            <button class="cyber-btn-outline" onclick="editProduct(${p.id})">EDIT</button>
            <button class="cyber-btn-outline" onclick="deleteProduct(${p.id})">DELETE</button>
        </div>
    `).join('');
}

async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
        showToast('// Product deleted');
        renderAdminProducts(); // Refresh the list instantly
    } else {
        showToast('// Delete failed');
    }
}

// 1. Expose delete to the global window so HTML onclick can find it
window.deleteProduct = deleteProduct;

// 2. Create the missing Edit function and expose it
window.editProduct = async function(id) {
    // Fetch the specific product's data
    const res = await fetch(`${API_BASE}/products/${id}`);
    const product = await res.json();

    // Populate the admin form with the existing data
    document.getElementById('product-title').value = product.title;
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-tag').value = product.tag;
    document.getElementById('product-img').value = product.img;
    document.getElementById('product-desc').value = product.description;
    document.getElementById('product-price').value = product.price;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('// Asset loaded into form. (For now, add the updated version and delete the old one!)');
};

// ============================================
// 10. ROUTER (IMPROVED)
// ============================================
const navigateTo = url => {
    history.pushState(null, null, url);
    router();
};

const router = async () => {
    console.log('[ROUTER] Navigating to', location.pathname);
    const routes = [
        { path: "/", view: viewHome },
        { path: "/asset-store", view: viewAssetStore },
        { path: "/ai-projects", view: viewAiProjects },
        { path: "/contact", view: viewContact },
        { path: "/admin", view: viewAdmin, protected: true, admin: true }
    ];

    let currentPath = location.pathname;

    // Handle file:// protocol (local file open)
    if (location.protocol === 'file:') {
        const parts = currentPath.split('/');
        const last = parts.pop() || 'index.html';
        currentPath = last === 'index.html' ? '/' : '/' + last.replace('.html', '');
    }

    // Normalize trailing slash
    if (currentPath.endsWith('/') && currentPath !== '/') {
        currentPath = currentPath.slice(0, -1);
    }

    const match = routes.find(r => r.path === currentPath) || routes[0];

    // Check protected routes
    if (match.protected) {
        if (!currentUser) {
            navigateTo('/');
            showToast('// Please login first');
            return;
        }
        if (match.admin && !currentUser.is_admin) {
            navigateTo('/');
            showToast('// Admin access only');
            return;
        }
    }

    const viewFunc = (match && typeof match.view === 'function') ? match.view : viewHome;
    const viewHtml = viewFunc();

    const appRoot = document.querySelector("#app-root");
    if (!appRoot) {
        console.error('[ROUTER] #app-root not found');
        return;
    }

    // Inject HTML
    appRoot.innerHTML = viewHtml;

    // Ensure the page becomes visible
    const pageView = appRoot.querySelector('.page-view');
    if (pageView) {
        // Force reflow to restart animations
        pageView.classList.remove('visible');
        void pageView.offsetWidth;
        pageView.classList.add('visible');
        console.log('[ROUTER] Page view made visible');
    } else {
        console.warn('[ROUTER] No .page-view element in view – adding fallback');
        // If no .page-view, create one to avoid blank page
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'page-view visible';
        fallbackDiv.innerHTML = viewHtml; // wrap existing content
        appRoot.innerHTML = '';
        appRoot.appendChild(fallbackDiv);
    }

    // Initialize view-specific behaviors after a tiny delay to ensure DOM is ready
    setTimeout(() => {
        if (match.path === "/") {
            initHero3D();
            bindModuleClicks();
            bindFeaturedClicks();
            initOutro();
        } else if (match.path === "/asset-store") {
            currentPage = 1;
            currentFilter = 'all';
            renderProjectGrid('project-grid');
            initFilterButtons('project-grid', renderProjectGrid);
            document.getElementById('load-more-btn')?.addEventListener('click', () => {
                currentPage++;
                renderProjectGrid('project-grid', currentFilter, currentPage);
            });
        } else if (match.path === "/ai-projects") {
            currentAiPage = 1;
            currentAiFilter = 'all';
            renderAiGrid('ai-grid');
            initFilterButtons('ai-grid', renderAiGrid, true);
            document.getElementById('load-more-ai-btn')?.addEventListener('click', () => {
                currentAiPage++;
                renderAiGrid('ai-grid', currentAiFilter, currentAiPage);
            });
        } else if (match.path === "/contact") {
            initContactForm();
        } else if (match.path === "/admin") {
            renderAdminProducts();
            document.getElementById('add-product-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = {
                    title: document.getElementById('product-title').value,
                    category: document.getElementById('product-category').value,
                    tag: document.getElementById('product-tag').value,
                    img: document.getElementById('product-img').value,
                    description: document.getElementById('product-desc').value,
                    price: parseFloat(document.getElementById('product-price').value)
                };
                const res = await fetch(`${API_BASE}/products`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(formData)
                });
                if (res.ok) {
                    showToast('// Product added');
                    e.target.reset();
                    renderAdminProducts();
                } else {
                    showToast('// Failed to add product');
                }
            });
        }
        updateFooter(match.path);
        bindCardClicks();
        bindCursorInteractives();
    }, 10);
};

// ============================================
// 11. VIEW‑SPECIFIC FUNCTIONS
// ============================================
function initHero3D() {
    const heroCard = document.getElementById('hero-card');
    const heroContainer = document.getElementById('hero-container');
    if (!heroCard || !heroContainer) return;
    heroContainer.addEventListener('mousemove', (e) => {
        const xAxis = (window.innerWidth / 2 - e.pageX) / 40;
        const yAxis = (window.innerHeight / 2 - e.pageY) / 40;
        heroCard.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    });
    heroContainer.addEventListener('mouseleave', () => {
        heroCard.style.transform = `rotateY(0deg) rotateX(0deg)`;
        heroCard.style.transition = `transform 0.5s ease`;
    });
    heroContainer.addEventListener('mouseenter', () => {
        heroCard.style.transition = `none`;
    });
}

function bindModuleClicks() {
    document.querySelectorAll('.module-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-module-id');
            openModuleModal(id);
        });
    });
}

function bindFeaturedClicks() {
    document.querySelectorAll('.featured-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-project-id');
            openProjectModal(id);
        });
    });
}

function initFilterButtons(gridId, renderFunc, isAi = false) {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const filter = e.target.dataset.filter;
            if (isAi) {
                currentAiFilter = filter;
                currentAiPage = 1;
                renderFunc(gridId, filter, 1);
            } else {
                currentFilter = filter;
                currentPage = 1;
                renderFunc(gridId, filter, 1);
            }
        });
    });
}

function bindCardClicks() {
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-view')) return;
            const projectId = card.dataset.projectId;
            const aiId = card.dataset.aiId;
            if (projectId) openProjectModal(projectId);
            else if (aiId) openAiModal(aiId);
        });
    });
    document.querySelectorAll('.quick-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.quickId || btn.dataset.quickAiId;
            if (btn.dataset.quickId) openProjectModal(id);
            else if (btn.dataset.quickAiId) openAiModal(id);
        });
    });
}

function initContactForm() {
    const form = document.getElementById('cyber-contact-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('sender-name').value;
        const email = document.getElementById('sender-email').value;
        const message = document.getElementById('sender-msg').value;
        const res = await fetch(`${API_BASE}/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, message })
        });
        if (res.ok) {
            showToast('// Message transmitted');
            form.reset();
        } else {
            showToast('// Transmission failed');
        }
    });
}

function initOutro() {
    const scrollBtn = document.getElementById('scroll-top');
    if (scrollBtn) {
        scrollBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function bindCursorInteractives() {
    const cursor = document.getElementById('custom-cursor');
    document.querySelectorAll('button, a, .card, .module-card, .featured-card, input, textarea, .social-icon').forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('active'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('active'));
    });
}

// ============================================
// 12. GLOBAL EFFECTS (Cursor, Exit Modal, Three.js)
// ============================================
function initCursor() {
    const cursor = document.getElementById('custom-cursor');
    const trailContainer = document.getElementById('cursor-trail-container');
    if (!cursor || !trailContainer) {
        console.error('[CURSOR] Cursor elements not found!');
        return;
    }
    
    console.log('[CURSOR] Initializing custom cursor system');
    
    // Force cursor visibility
    cursor.style.display = 'block';
    cursor.style.visibility = 'visible';
    cursor.style.opacity = '1';
    cursor.style.zIndex = '99999';
    cursor.style.pointerEvents = 'none';
    
    // Hide native cursor
    document.body.style.cursor = 'none';
    
    // Set initial position
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    cursor.style.left = `${centerX}px`;
    cursor.style.top = `${centerY}px`;
    
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
        
        // Add trail particles sparingly
        if (Math.random() > 0.7) {
            const particle = document.createElement('div');
            particle.classList.add('trail-particle');
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            trailContainer.appendChild(particle);
            
            setTimeout(() => {
                if (particle.parentNode) particle.remove();
            }, 550);
        }
    });
    
    document.addEventListener('mouseleave', () => {
        cursor.style.opacity = '0.3';
    });
    
    document.addEventListener('mouseenter', () => {
        cursor.style.opacity = '1';
    });
}

function initExitIntent() {
    const exitModal = document.getElementById('exit-modal');
    const closeBtn = document.getElementById('close-exit-modal');
    const returnBtn = document.getElementById('return-btn');
    let exitTriggered = false;
    document.addEventListener('mouseleave', (e) => {
        if (e.clientY <= 0 && !exitTriggered && exitModal) {
            exitModal.classList.add('active');
            exitTriggered = true;
        }
    });
    [closeBtn, returnBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', () => exitModal.classList.remove('active'));
    });
    window.addEventListener('click', (e) => {
        if (e.target === exitModal) exitModal.classList.remove('active');
    });
}

function initThreeBackground() {
    import('https://unpkg.com/three@0.128.0/build/three.module.js').then((THREE) => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x05050a, 1);
        document.body.appendChild(renderer.domElement);
        renderer.domElement.style.position = 'fixed';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.zIndex = '-1';

        const gridHelper = new THREE.GridHelper(30, 20, 0x00f0ff, 0xb829ea);
        gridHelper.position.y = -2;
        scene.add(gridHelper);

        const particlesGeo = new THREE.BufferGeometry();
        const count = 800;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 40;
            positions[i+1] = (Math.random() - 0.5) * 20;
            positions[i+2] = (Math.random() - 0.5) * 40;
        }
        particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particlesMat = new THREE.PointsMaterial({ size: 0.1, color: 0xb829ea, transparent: true, opacity: 0.6 });
        const particles = new THREE.Points(particlesGeo, particlesMat);
        scene.add(particles);

        camera.position.z = 15;
        camera.position.y = 2;

        let mouseX = 0, mouseY = 0;
        document.addEventListener('mousemove', (e) => {
            mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
            mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
        });

        function animate() {
            requestAnimationFrame(animate);
            gridHelper.rotation.y += 0.0005;
            particles.rotation.y += 0.0002;
            camera.position.x += (mouseX * 5 - camera.position.x) * 0.02;
            camera.position.y += (-mouseY * 3 + 2 - camera.position.y) * 0.02;
            camera.lookAt(scene.position);
            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    });
}

function observeReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('.card, .module-card, .featured-card').forEach(el => {
        el.classList.remove('in-view');
        observer.observe(el);
    });
}

// ============================================
// 13. SYSTEM STATS (realistic via API or simulation)
// ============================================
async function updateSystemStats() {
    // In production, you could fetch from /api/stats
    const cpu = Math.floor(Math.random() * 30 + 20);
    const mem = Math.floor(Math.random() * 40 + 30);
    document.getElementById('footer-stats').innerHTML = `CPU:${cpu}% MEM:${mem}%`;
}
setInterval(updateSystemStats, 2000);

function updateClock() {
    const el = document.getElementById('footer-clock');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);

function updateFooter(routePath) {
    const map = { '/': 'HOME', '/asset-store': 'ASSET_STORE', '/ai-projects': 'AI_PROJECTS', '/contact': 'CONTACT', '/admin': 'ADMIN' };
    const label = map[routePath] || routePath;
    const el = document.getElementById('footer-route');
    if (el) el.textContent = label;
}

// ============================================
// 14. EASTER EGGS
// ============================================
let konamiIndex = 0;
const konamiCode = [38,38,40,40,37,39,37,39,66,65]; // up,up,down,down,left,right,left,right,B,A

document.addEventListener('keydown', (e) => {
    if (e.keyCode === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            // Activate easter egg
            document.body.style.filter = 'hue-rotate(180deg)';
            setTimeout(() => document.body.style.filter = '', 3000);
            const sound = document.getElementById('easter-sound');
            if (sound) sound.play().catch(() => {});
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

// Hover sound (optional)
document.querySelectorAll('button, a, .card').forEach(el => {
    el.addEventListener('mouseenter', () => {
        const sound = document.getElementById('hover-sound');
        if (sound && Math.random() > 0.8) sound.play().catch(() => {}); // 20% chance
    });
});

// ============================================
// 15. BOOTSTRAP – ENSURE ROUTER RUNS
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('[SYSTEM] Starting cyber-grid initialization...');
        
        await loadData();
        console.log('[SYSTEM] Data loaded');
        
        initAuth();
        console.log('[SYSTEM] Auth initialized');
        
        window.AppLoadout = new LoadoutManager();
        console.log('[SYSTEM] Loadout manager initialized');
        
        initCursor();
        console.log('[SYSTEM] Cursor initialized');
        
        initExitIntent();
        console.log('[SYSTEM] Exit intent initialized');
        
        initThreeBackground();
        console.log('[SYSTEM] Three.js background initialized');

        // Global click delegation
        document.body.addEventListener('click', e => {
            // Router navigation
            const link = e.target.closest('[data-link]');
            if (link) {
                e.preventDefault();
                navigateTo(link.getAttribute('href'));
                return;
            }

            // Remove from loadout
            if (e.target.matches('.remove-btn')) {
                const id = e.target.getAttribute('data-remove-id');
                window.AppLoadout.removeItem(id);
            }

            // Add to loadout from modal
            if (e.target.matches('#add-to-loadout-btn') && (currentProject || currentAiProject)) {
                const item = currentProject || currentAiProject;
                window.AppLoadout.addItem({
                    id: item.id,
                    name: item.title,
                    type: item.tag
                });
                e.target.textContent = "STORED IN MEMORY";
                e.target.style.background = "rgba(189,0,255,0.2)";
                setTimeout(() => {
                    document.getElementById('item-modal').classList.remove('active');
                    e.target.textContent = "ACQUIRE ASSET";
                    e.target.style.background = "rgba(0,240,255,0.1)";
                }, 800);
            }
        });

        // Modal close buttons
        document.getElementById('close-item-modal')?.addEventListener('click', () => {
            document.getElementById('item-modal').classList.remove('active');
        });
        const closeModuleBtn = document.getElementById('close-module-modal');
        if (closeModuleBtn) {
            closeModuleBtn.addEventListener('click', () => {
                document.getElementById('module-modal').classList.remove('active');
            });
        }

        // Setup router for navigation
        window.addEventListener('popstate', router);
        
        // Initial route – no setTimeout needed
        console.log('[SYSTEM] Initializing router...');
        router();
        console.log('[SYSTEM] Cyber-grid fully operational');
    } catch (error) {
        console.error('[SYSTEM] Critical initialization error:', error);
        const appRoot = document.querySelector('#app-root');
        if (appRoot) {
            appRoot.innerHTML = `<div class="page-view visible" style="color: var(--neon-red); padding: 2rem; font-size: 1.2rem;">
                <p>⚠ SYSTEM INITIALIZATION FAILED</p>
                <p style="color: var(--text-muted); font-size: 1rem; margin-top: 1rem;">${error.message}</p>
            </div>`;
        }
    }
});

// Helper function for toasts (if not already defined)
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}