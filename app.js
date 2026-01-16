// ==================== CONFIGURACIÓN FIREBASE ====================
const firebaseConfig = {
    apiKey: "AIzaSyAOIvnH9_2X75StDWX4Rnh9tRfD9lSIv3E",
    authDomain: "petpro-19db3.firebaseapp.com",
    projectId: "petpro-19db3",
    storageBucket: "petpro-19db3.firebasestorage.app",
    messagingSenderId: "384847276656",
    appId: "1:384847276656:web:ed6a128e5e09ce2e52a2b5"
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Variables globales
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
let currentUser = null;
let userData = {};
let pets = [];
let medicalRecords = [];
let reminders = [];
let weightHistory = [];
let currentPetId = null;
let weightChart = null;

// Templates para historial médico
const MEDICAL_TEMPLATES = {
    consulta: {
        title: "Consulta General",
        type: "consulta",
        description: "Consulta general de rutina. El paciente se presenta en buen estado general.",
        diagnosis: "",
        prescription: ""
    },
    vacuna: {
        title: "Vacunación Anual",
        type: "vacuna",
        description: "Aplicación de vacuna anual. Se verificó el estado de salud previo a la aplicación.",
        diagnosis: "Vacunación realizada correctamente",
        prescription: "Vacuna aplicada según protocolo. No bañar por 48 horas."
    },
    cirugia: {
        title: "Cirugía Programada",
        type: "cirugia",
        description: "Cirugía programada realizada según protocolo. El paciente toleró bien el procedimiento.",
        diagnosis: "Cirugía realizada exitosamente",
        prescription: "Medicamentos indicados para el post-operatorio. Reposo y cuidado de la herida."
    },
    desparasitacion: {
        title: "Desparasitación",
        type: "desparasitacion",
        description: "Aplicación de desparasitante interno y/o externo.",
        diagnosis: "Desparasitación realizada",
        prescription: "Desparasitante aplicado. Repetir en 3 meses."
    },
    control: {
        title: "Control de Rutina",
        type: "control",
        description: "Control de rutina para verificar estado de salud general.",
        diagnosis: "Paciente en buen estado de salud",
        prescription: "Continuar con cuidados habituales."
    }
};

// Razas por especie
const BREEDS = {
    perro: [
        "Labrador Retriever", "Golden Retriever", "Pastor Alemán", "Bulldog Francés",
        "Bulldog Inglés", "Poodle", "Beagle", "Rottweiler", "Yorkshire Terrier",
        "Boxer", "Dachshund", "Siberian Husky", "Doberman", "Gran Danés",
        "Chihuahua", "Border Collie", "Pug", "Shih Tzu", "Mestizo", "Otra"
    ],
    gato: [
        "Siamés", "Persa", "Maine Coon", "Bengalí", "Esfinge", "Ragdoll",
        "Británico de Pelo Corto", "Abisinio", "Scottish Fold", "Azul Ruso",
        "Birmano", "Norwegian Forest", "Mestizo", "Otra"
    ],
    conejo: ["Holandés", "Angora", "Cabeza de León", "Rex", "Enano", "Otra"],
    ave: ["Canario", "Periquito", "Loro", "Cacatúa", "Agapornis", "Otra"],
    roedor: ["Hámster", "Cobaya", "Ratón", "Rata", "Chinchilla", "Otra"],
    reptil: ["Iguana", "Gecko", "Tortuga", "Serpiente", "Camaleón", "Otra"],
    otro: ["Otro"]
};

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        console.log("🚀 Iniciando aplicación FASE 1...");
        
        // Verificar autenticación
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                await loadUserData();
                setupEventListeners();
                loadDashboard();
            } else {
                window.location.href = 'index.html';
            }
        });
        
    } catch (error) {
        console.error("Error inicializando aplicación:", error);
        showError("Error al iniciar la aplicación");
    }
}

// ==================== CARGA DE DATOS ====================
async function loadUserData() {
    try {
        // Obtener datos del usuario
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
        } else {
            // Crear perfil si no existe
            userData = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || currentUser.email.split('@')[0],
                userType: 'owner',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('users').doc(currentUser.uid).set(userData);
        }
        
        // Actualizar UI del usuario
        updateUserUI();
        
        // Cargar datos según tipo de usuario
        if (userData.userType === 'owner') {
            await loadOwnerData();
        } else if (userData.userType === 'vet') {
            await loadVetData();
        }
        
    } catch (error) {
        console.error("Error cargando datos del usuario:", error);
    }
}

async function loadOwnerData() {
    try {
        // Cargar mascotas
        const petsSnapshot = await db.collection('pets')
            .where('ownerId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        pets = [];
        petsSnapshot.forEach(doc => {
            pets.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Cargar historial médico
        await loadMedicalRecords();
        
        // Cargar recordatorios
        await loadReminders();
        
        // Cargar historial de peso
        await loadWeightHistory();
        
    } catch (error) {
        console.error("Error cargando datos del dueño:", error);
    }
}

async function loadVetData() {
    try {
        // Mostrar navegación de veterinaria
        document.getElementById('owner-nav').style.display = 'none';
        document.getElementById('vet-nav').style.display = 'block';
        
        // Cargar mascotas autorizadas
        const authSnapshot = await db.collection('authorizations')
            .where('vetId', '==', currentUser.uid)
            .where('status', '==', 'authorized')
            .get();
        
        const authorizedPetIds = [];
        authSnapshot.forEach(doc => {
            authorizedPetIds.push(doc.data().petId);
        });
        
        // Cargar mascotas autorizadas
        if (authorizedPetIds.length > 0) {
            const petsSnapshot = await db.collection('pets')
                .where('id', 'in', authorizedPetIds.slice(0, 10))
                .get();
            
            pets = [];
            petsSnapshot.forEach(doc => {
                pets.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        }
        
        // Cargar historial médico para mascotas autorizadas
        await loadMedicalRecords();
        
        // Cargar recordatorios creados por el veterinario
        await loadReminders();
        
    } catch (error) {
        console.error("Error cargando datos de veterinaria:", error);
    }
}

async function loadMedicalRecords() {
    try {
        if (pets.length === 0) {
            medicalRecords = [];
            return;
        }
        
        const petIds = pets.map(pet => pet.id);
        
        // Para veterinarios, cargar solo registros que ellos crearon
        if (userData.userType === 'vet') {
            const recordsSnapshot = await db.collection('medical_records')
                .where('vetId', '==', currentUser.uid)
                .where('petId', 'in', petIds.slice(0, 10))
                .orderBy('date', 'desc')
                .get();
            
            medicalRecords = [];
            recordsSnapshot.forEach(doc => {
                medicalRecords.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        } else {
            // Para dueños, cargar todos los registros de sus mascotas
            const recordsSnapshot = await db.collection('medical_records')
                .where('petId', 'in', petIds.slice(0, 10))
                .orderBy('date', 'desc')
                .get();
            
            medicalRecords = [];
            recordsSnapshot.forEach(doc => {
                medicalRecords.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        }
        
    } catch (error) {
        console.error("Error cargando historial médico:", error);
        medicalRecords = [];
    }
}

async function loadReminders() {
    try {
        if (pets.length === 0) {
            reminders = [];
            return;
        }
        
        const petIds = pets.map(pet => pet.id);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (userData.userType === 'vet') {
            const remindersSnapshot = await db.collection('reminders')
                .where('createdBy', '==', currentUser.uid)
                .where('petId', 'in', petIds.slice(0, 10))
                .where('date', '>=', today)
                .orderBy('date', 'asc')
                .get();
            
            reminders = [];
            remindersSnapshot.forEach(doc => {
                reminders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        } else {
            const remindersSnapshot = await db.collection('reminders')
                .where('petId', 'in', petIds.slice(0, 10))
                .where('date', '>=', today)
                .orderBy('date', 'asc')
                .get();
            
            reminders = [];
            remindersSnapshot.forEach(doc => {
                reminders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        }
        
    } catch (error) {
        console.error("Error cargando recordatorios:", error);
        reminders = [];
    }
}

async function loadWeightHistory(petId = null) {
    try {
        weightHistory = [];
        
        if (!petId && pets.length > 0) {
            petId = pets[0].id;
        }
        
        if (!petId) return;
        
        currentPetId = petId;
        
        const weightSnapshot = await db.collection('weight_history')
            .where('petId', '==', petId)
            .orderBy('date', 'asc')
            .get();
        
        weightSnapshot.forEach(doc => {
            weightHistory.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
    } catch (error) {
        console.error("Error cargando historial de peso:", error);
        weightHistory = [];
    }
}

// ==================== INTERFAZ DE USUARIO ====================
function updateUserUI() {
    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');
    const userAvatar = document.getElementById('user-avatar');
    
    if (userName) {
        userName.textContent = userData.displayName || currentUser.email;
    }
    
    if (userRole) {
        userRole.textContent = userData.userType === 'vet' ? 'Veterinario' : 'Dueño de Mascota';
    }
    
    if (userAvatar) {
        const avatarUrl = userData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.displayName || currentUser.email)}&background=4f46e5&color=fff`;
        userAvatar.src = avatarUrl;
    }
}

function setupEventListeners() {
    // Navegación
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const section = this.dataset.section;
            loadSection(section);
            
            // Actualizar navegación activa
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Botón de logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Modal de mascotas
    document.getElementById('pet-modal-close').addEventListener('click', () => closeModal('pet-modal'));
    document.getElementById('pet-modal-cancel').addEventListener('click', () => closeModal('pet-modal'));
    document.getElementById('pet-modal-save').addEventListener('click', savePet);
    
    // Modal de historial médico
    document.getElementById('medical-record-modal-close').addEventListener('click', () => closeModal('medical-record-modal'));
    document.getElementById('medical-record-modal-cancel').addEventListener('click', () => closeModal('medical-record-modal'));
    document.getElementById('medical-record-modal-save').addEventListener('click', saveMedicalRecord);
    
    // Modal de recordatorios
    document.getElementById('reminder-modal-close').addEventListener('click', () => closeModal('reminder-modal'));
    document.getElementById('reminder-modal-cancel').addEventListener('click', () => closeModal('reminder-modal'));
    document.getElementById('reminder-modal-save').addEventListener('click', saveReminder);
    
    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

// ==================== CARGA DE SECCIONES ====================
async function loadSection(section) {
    const container = document.getElementById('content-container');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
    
    try {
        switch(section) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'health-dashboard':
                await loadHealthDashboard();
                break;
            case 'pets':
                await loadPetsSection();
                break;
            case 'add-pet':
                await loadAddPetSection();
                break;
            case 'medical-records':
                await loadMedicalRecordsSection();
                break;
            case 'reminders':
                await loadRemindersSection();
                break;
            case 'vet-dashboard':
                await loadVetDashboard();
                break;
            case 'vet-medical-records':
                await loadVetMedicalRecords();
                break;
            case 'vet-reminders':
                await loadVetReminders();
                break;
            default:
                await loadDashboard();
        }
    } catch (error) {
        console.error(`Error cargando sección ${section}:`, error);
        showError(`Error al cargar la sección ${section}`);
    }
}

// ==================== DASHBOARD PRINCIPAL ====================
async function loadDashboard() {
    const container = document.getElementById('content-container');
    
    let html = `
        <div class="content-header">
            <h1 class="content-title">Dashboard</h1>
            <p class="content-subtitle">Vista general de tu cuenta</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${pets.length}</div>
                <div class="stat-label">Mascotas</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${medicalRecords.length}</div>
                <div class="stat-label">Registros Médicos</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${reminders.filter(r => {
                    const reminderDate = new Date(r.date);
                    const today = new Date();
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return reminderDate.toDateString() === today.toDateString() || 
                           reminderDate.toDateString() === tomorrow.toDateString();
                }).length}</div>
                <div class="stat-label">Recordatorios Hoy/mañana</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${medicalRecords.filter(r => {
                    const recordDate = new Date(r.date);
                    const today = new Date();
                    const thirtyDaysAgo = new Date(today);
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return recordDate >= thirtyDaysAgo;
                }).length}</div>
                <div class="stat-label">Visitas últimos 30 días</div>
            </div>
        </div>
    `;
    
    // Recordatorios próximos
    const upcomingReminders = reminders.slice(0, 5);
    if (upcomingReminders.length > 0) {
        html += `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Próximos Recordatorios</h3>
                    <button class="btn btn-primary" onclick="openReminderModal()">➕ Nuevo</button>
                </div>
                <div>
        `;
        
        upcomingReminders.forEach(reminder => {
            const pet = pets.find(p => p.id === reminder.petId);
            const reminderDate = new Date(reminder.date);
            const today = new Date();
            const daysDiff = Math.ceil((reminderDate - today) / (1000 * 60 * 60 * 24));
            
            let urgencyClass = 'normal';
            if (daysDiff < 0) urgencyClass = 'danger';
            else if (daysDiff <= 3) urgencyClass = 'urgent';
            else if (daysDiff <= 7) urgencyClass = 'upcoming';
            
            html += `
                <div class="reminder-card ${urgencyClass}">
                    <div class="reminder-header">
                        <div class="reminder-title">${reminder.title}</div>
                        <div class="reminder-date">${formatDate(reminder.date)}</div>
                    </div>
                    <div class="reminder-pet">
                        <span>🐾</span>
                        <span>${pet ? pet.name : 'Mascota'}</span>
                    </div>
                    <p>${reminder.description || ''}</p>
                    <div class="reminder-actions">
                        <button class="btn btn-success" onclick="markReminderCompleted('${reminder.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Completado</button>
                        <button class="btn btn-secondary" onclick="editReminder('${reminder.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Editar</button>
                    </div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    // Registros médicos recientes
    const recentRecords = medicalRecords.slice(0, 3);
    if (recentRecords.length > 0) {
        html += `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Registros Médicos Recientes</h3>
                    <button class="btn btn-primary" onclick="openMedicalRecordModal()">➕ Nuevo</button>
                </div>
                <div>
        `;
        
        recentRecords.forEach(record => {
            const pet = pets.find(p => p.id === record.petId);
            html += `
                <div class="medical-record-enhanced">
                    <div class="record-header">
                        <div class="record-title">${record.title}</div>
                        <span class="badge ${getRecordTypeBadge(record.type)}">${getRecordTypeText(record.type)}</span>
                    </div>
                    <div class="record-meta">
                        <span>🐾 ${pet ? pet.name : 'Mascota'}</span>
                        <span>📅 ${formatDate(record.date)}</span>
                        ${record.weight ? `<span>⚖️ ${record.weight} kg</span>` : ''}
                    </div>
                    <div class="record-content">
                        <p>${record.description.substring(0, 150)}${record.description.length > 150 ? '...' : ''}</p>
                    </div>
                    <button class="btn btn-secondary" onclick="viewRecordDetails('${record.id}')" style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.9rem;">Ver Detalles</button>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    container.innerHTML = html;
}

// ==================== DASHBOARD DE SALUD INTELIGENTE ====================
async function loadHealthDashboard() {
    const container = document.getElementById('content-container');
    
    let html = `
        <div class="content-header">
            <h1 class="content-title">Dashboard de Salud Inteligente</h1>
            <p class="content-subtitle">Monitorea la salud de tus mascotas</p>
        </div>
    `;
    
    if (pets.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">🐕</div>
                <h3>No tienes mascotas registradas</h3>
                <p>Comienza agregando tu primera mascota para ver su información de salud.</p>
                <button class="btn btn-primary" onclick="loadSection('add-pet')" style="margin-top: 1rem;">Agregar Mascota</button>
            </div>
        `;
    } else {
        // Selector de mascota
        html += `
            <div class="card" style="margin-bottom: 1.5rem;">
                <div class="form-group">
                    <label class="form-label">Seleccionar Mascota</label>
                    <select id="health-pet-selector" class="form-control" onchange="loadPetHealthData(this.value)">
                        ${pets.map(pet => `
                            <option value="${pet.id}" ${currentPetId === pet.id ? 'selected' : ''}>${pet.name} (${pet.species})</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
        
        const selectedPet = pets.find(p => p.id === currentPetId) || pets[0];
        await loadWeightHistory(selectedPet.id);
        
        // Gráfico de evolución de peso
        if (weightHistory.length > 0) {
            html += `
                <div class="health-chart-container">
                    <h3 style="margin-bottom: 1rem;">Evolución de Peso</h3>
                    <canvas id="weightChart"></canvas>
                </div>
            `;
        } else {
            html += `
                <div class="card">
                    <div class="empty-state">
                        <div class="empty-icon">⚖️</div>
                        <h3>No hay datos de peso registrados</h3>
                        <p>Registra el peso de ${selectedPet.name} en el historial médico para ver la evolución.</p>
                    </div>
                </div>
            `;
        }
        
        // Recordatorios inteligentes
        html += `
            <div class="card" style="margin-top: 1.5rem;">
                <div class="card-header">
                    <h3 class="card-title">Recordatorios Inteligentes</h3>
                    <button class="btn btn-primary" onclick="generateSmartReminders('${selectedPet.id}')">Generar</button>
                </div>
                <div id="smart-reminders-container">
                    <div class="loading">
                        <div class="spinner"></div>
                        <p>Generando recordatorios inteligentes...</p>
                    </div>
                </div>
            </div>
        `;
        
        // Reporte de salud anual
        html += `
            <div class="card" style="margin-top: 1.5rem;">
                <div class="card-header">
                    <h3 class="card-title">Reporte de Salud Anual</h3>
                    <button class="btn btn-primary" onclick="generateAnnualReport('${selectedPet.id}')">Generar Reporte</button>
                </div>
                <div id="annual-report-container">
                    <p>Genera un reporte anual de salud para ${selectedPet.name}.</p>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Inicializar gráfico si hay datos
    if (weightHistory.length > 0) {
        setTimeout(() => initializeWeightChart(), 100);
    }
    
    // Generar recordatorios inteligentes
    if (selectedPet) {
        generateSmartReminders(selectedPet.id);
    }
}

function initializeWeightChart() {
    const ctx = document.getElementById('weightChart');
    if (!ctx) return;
    
    // Destruir gráfico anterior si existe
    if (weightChart) {
        weightChart.destroy();
    }
    
    const labels = weightHistory.map(item => formatShortDate(item.date));
    const weights = weightHistory.map(item => item.weight);
    
    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Peso (kg)',
                data: weights,
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Fecha'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Peso (kg)'
                    },
                    beginAtZero: false
                }
            }
        }
    });
}

async function loadPetHealthData(petId) {
    currentPetId = petId;
    await loadWeightHistory(petId);
    loadHealthDashboard();
}

function generateSmartReminders(petId) {
    const pet = pets.find(p => p.id === petId);
    if (!pet) return;
    
    const container = document.getElementById('smart-reminders-container');
    if (!container) return;
    
    const species = pet.species;
    const birthDate = new Date(pet.birthdate);
    const ageInMonths = Math.floor((new Date() - birthDate) / (1000 * 60 * 60 * 24 * 30));
    
    let smartReminders = [];
    
    // Recordatorios basados en especie y edad
    if (species === 'perro' || species === 'gato') {
        if (ageInMonths < 6) {
            smartReminders.push({
                title: 'Vacuna de refuerzo para cachorro',
                description: 'Recordatorio para vacuna de refuerzo según calendario de vacunación',
                suggestedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
            });
        }
        
        if (ageInMonths >= 6) {
            smartReminders.push({
                title: 'Desparasitación trimestral',
                description: 'Desparasitación interna y externa recomendada cada 3 meses',
                suggestedDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 días
            });
        }
        
        smartReminders.push({
            title: 'Control anual de salud',
            description: 'Chequeo general anual recomendado',
            suggestedDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 año
        });
        
        if (pet.weight) {
            const lastWeight = weightHistory[weightHistory.length - 1]?.weight || pet.weight;
            if (lastWeight > 20) {
                smartReminders.push({
                    title: 'Control articular para mascota grande',
                    description: 'Revisión articular recomendada para mascotas de más de 20kg',
                    suggestedDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // 6 meses
                });
            }
        }
    }
    
    let html = '';
    if (smartReminders.length > 0) {
        html = `
            <p style="margin-bottom: 1rem;">Basado en ${pet.name} (${species}, ${ageInMonths} meses):</p>
            <div style="display: grid; gap: 0.5rem;">
        `;
        
        smartReminders.forEach((reminder, index) => {
            html += `
                <div class="reminder-card">
                    <div class="reminder-header">
                        <div class="reminder-title">${reminder.title}</div>
                        <div class="reminder-date">${formatDate(reminder.suggestedDate.toISOString())}</div>
                    </div>
                    <p>${reminder.description}</p>
                    <div class="reminder-actions">
                        <button class="btn btn-primary" onclick="createSmartReminder('${petId}', ${index})" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Crear Recordatorio</button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    } else {
        html = `<p>No hay recordatorios inteligentes disponibles para esta mascota.</p>`;
    }
    
    container.innerHTML = html;
}

async function createSmartReminder(petId, reminderIndex) {
    const pet = pets.find(p => p.id === petId);
    if (!pet) return;
    
    const species = pet.species;
    const birthDate = new Date(pet.birthdate);
    const ageInMonths = Math.floor((new Date() - birthDate) / (1000 * 60 * 60 * 24 * 30));
    
    let smartReminders = [];
    
    // Misma lógica que generateSmartReminders
    if (species === 'perro' || species === 'gato') {
        if (ageInMonths < 6) {
            smartReminders.push({
                title: 'Vacuna de refuerzo para cachorro',
                type: 'vacuna',
                description: 'Recordatorio para vacuna de refuerzo según calendario de vacunación',
                date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        }
        
        if (ageInMonths >= 6) {
            smartReminders.push({
                title: 'Desparasitación trimestral',
                type: 'desparasitacion',
                description: 'Desparasitación interna y externa recomendada cada 3 meses',
                date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
            });
        }
        
        smartReminders.push({
            title: 'Control anual de salud',
            type: 'control',
            description: 'Chequeo general anual recomendado',
            date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        });
        
        if (pet.weight && pet.weight > 20) {
            smartReminders.push({
                title: 'Control articular para mascota grande',
                type: 'control',
                description: 'Revisión articular recomendada para mascotas de más de 20kg',
                date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
            });
        }
    }
    
    if (reminderIndex >= 0 && reminderIndex < smartReminders.length) {
        const reminder = smartReminders[reminderIndex];
        
        const reminderData = {
            petId: petId,
            title: reminder.title,
            type: reminder.type,
            description: reminder.description,
            date: reminder.date,
            createdBy: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        try {
            await db.collection('reminders').add(reminderData);
            await loadReminders();
            showSuccess('Recordatorio creado exitosamente');
            generateSmartReminders(petId); // Actualizar la vista
        } catch (error) {
            console.error('Error creando recordatorio:', error);
            showError('Error al crear recordatorio');
        }
    }
}

async function generateAnnualReport(petId) {
    const pet = pets.find(p => p.id === petId);
    if (!pet) return;
    
    const container = document.getElementById('annual-report-container');
    if (!container) return;
    
    // Obtener registros del último año
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const annualRecords = medicalRecords.filter(record => 
        record.petId === petId && new Date(record.date) >= oneYearAgo
    );
    
    // Calcular estadísticas
    const totalVisits = annualRecords.length;
    const vaccineCount = annualRecords.filter(r => r.type === 'vacuna').length;
    const weightRecords = annualRecords.filter(r => r.weight).map(r => ({
        date: r.date,
        weight: r.weight
    }));
    
    let html = `
        <h4 style="margin-bottom: 1rem;">Reporte Anual para ${pet.name}</h4>
        <div class="stats-grid" style="margin-bottom: 1rem;">
            <div class="stat-card">
                <div class="stat-value">${totalVisits}</div>
                <div class="stat-label">Visitas en el año</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${vaccineCount}</div>
                <div class="stat-label">Vacunas aplicadas</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${weightRecords.length}</div>
                <div class="stat-label">Controles de peso</div>
            </div>
        </div>
    `;
    
    if (weightRecords.length > 1) {
        const firstWeight = weightRecords[0].weight;
        const lastWeight = weightRecords[weightRecords.length - 1].weight;
        const weightChange = lastWeight - firstWeight;
        const percentageChange = ((weightChange / firstWeight) * 100).toFixed(1);
        
        html += `
            <div class="card" style="margin-bottom: 1rem;">
                <h5 style="margin-bottom: 0.5rem;">Evolución de Peso</h5>
                <p><strong>Peso inicial:</strong> ${firstWeight} kg</p>
                <p><strong>Peso final:</strong> ${lastWeight} kg</p>
                <p><strong>Cambio:</strong> ${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg (${percentageChange}%)</p>
            </div>
        `;
    }
    
    // Recomendaciones basadas en estadísticas
    html += `<div class="card"><h5 style="margin-bottom: 0.5rem;">Recomendaciones</h5>`;
    
    if (vaccineCount === 0 && pet.species !== 'otro') {
        html += `<p>⚠️ No se registraron vacunas en el último año. Considera revisar el calendario de vacunación.</p>`;
    }
    
    if (totalVisits < 2) {
        html += `<p>📅 Se recomienda al menos 2 visitas anuales para controles de rutina.</p>`;
    }
    
    if (weightRecords.length < 2) {
        html += `<p>⚖️ Considera registrar el peso de ${pet.name} en cada visita para monitorear su salud.</p>`;
    }
    
    html += `</div>`;
    
    container.innerHTML = html;
}

// ==================== SECCIÓN DE MASCOTAS ====================
async function loadPetsSection() {
    const container = document.getElementById('content-container');
    
    let html = `
        <div class="content-header">
            <h1 class="content-title">Mis Mascotas</h1>
            <p class="content-subtitle">Gestiona el perfil de tus mascotas</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3>${pets.length} Mascota${pets.length !== 1 ? 's' : ''}</h3>
            <button class="btn btn-primary" onclick="openPetModal()">➕ Agregar Mascota</button>
        </div>
    `;
    
    if (pets.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">🐕</div>
                <h3>No tienes mascotas registradas</h3>
                <p>Comienza agregando tu primera mascota para centralizar su historial médico.</p>
                <button class="btn btn-primary" onclick="openPetModal()" style="margin-top: 1rem;">Agregar Mi Primera Mascota</button>
            </div>
        `;
    } else {
        pets.forEach(pet => {
            const petMedicalRecords = medicalRecords.filter(r => r.petId === pet.id);
            const petReminders = reminders.filter(r => r.petId === pet.id);
            const lastWeight = petMedicalRecords.filter(r => r.weight).pop()?.weight || pet.weight || 'No registrado';
            
            html += `
                <div class="pet-profile">
                    <div class="pet-avatar">
                        ${getPetEmoji(pet.species)}
                    </div>
                    <div class="pet-info" style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <h3 style="margin-bottom: 0.25rem;">${pet.name}</h3>
                                <p style="margin-bottom: 0.25rem; color: var(--gray);">${getSpeciesText(pet.species)} ${pet.breed ? `- ${pet.breed}` : ''}</p>
                                <p style="margin-bottom: 0.25rem;">📅 ${formatDate(pet.birthdate)}</p>
                                <p>⚖️ Peso actual: ${lastWeight} kg</p>
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-secondary" onclick="editPet('${pet.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Editar</button>
                                <button class="btn btn-primary" onclick="openMedicalRecordModal('${pet.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">+ Registro</button>
                            </div>
                        </div>
                        <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.9rem;">
                            <span>📋 ${petMedicalRecords.length} registros</span>
                            <span>⏰ ${petReminders.length} recordatorios</span>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
}

async function loadAddPetSection() {
    const container = document.getElementById('content-container');
    
    let html = `
        <div class="content-header">
            <h1 class="content-title">Agregar Mascota</h1>
            <p class="content-subtitle">Completa el perfil de tu mascota</p>
        </div>
        
        <div class="card">
            <form id="add-pet-form">
                <div class="form-group">
                    <label class="form-label" for="add-pet-name">Nombre *</label>
                    <input type="text" id="add-pet-name" class="form-control" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="add-pet-species">Especie *</label>
                    <select id="add-pet-species" class="form-control" required onchange="updateAddPetBreedOptions()">
                        <option value="">Seleccionar especie</option>
                        <option value="perro">Perro</option>
                        <option value="gato">Gato</option>
                        <option value="conejo">Conejo</option>
                        <option value="ave">Ave</option>
                        <option value="roedor">Roedor</option>
                        <option value="reptil">Reptil</option>
                        <option value="otro">Otro</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="add-pet-breed">Raza</label>
                    <select id="add-pet-breed" class="form-control">
                        <option value="">Seleccionar raza</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="add-pet-birthdate">Fecha de nacimiento (aproximada) *</label>
                    <input type="date" id="add-pet-birthdate" class="form-control" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="add-pet-weight">Peso actual (kg) *</label>
                    <input type="number" id="add-pet-weight" class="form-control" step="0.1" min="0" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="add-pet-color">Color</label>
                    <input type="text" id="add-pet-color" class="form-control">
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="add-pet-microchip">Número de microchip</label>
                    <input type="text" id="add-pet-microchip" class="form-control">
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="add-pet-notes">Notas adicionales</label>
                    <textarea id="add-pet-notes" class="form-control" rows="3"></textarea>
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button type="button" class="btn btn-primary" onclick="savePetFromForm()">Guardar Mascota</button>
                    <button type="button" class="btn btn-secondary" onclick="loadSection('pets')">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Establecer fecha por defecto
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('add-pet-birthdate').value = today;
}

// ==================== SECCIÓN DE HISTORIAL MÉDICO ====================
async function loadMedicalRecordsSection() {
    const container = document.getElementById('content-container');
    
    let html = `
        <div class="content-header">
            <h1 class="content-title">Historial Médico</h1>
            <p class="content-subtitle">Registros médicos completos de tus mascotas</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3>${medicalRecords.length} Registro${medicalRecords.length !== 1 ? 's' : ''}</h3>
            <button class="btn btn-primary" onclick="openMedicalRecordModal()">➕ Nuevo Registro</button>
        </div>
    `;
    
    if (medicalRecords.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">🏥</div>
                <h3>No hay registros médicos</h3>
                <p>Comienza agregando el primer registro médico para tu mascota.</p>
            </div>
        `;
    } else {
        // Agrupar registros por mascota
        const recordsByPet = {};
        medicalRecords.forEach(record => {
            if (!recordsByPet[record.petId]) {
                recordsByPet[record.petId] = [];
            }
            recordsByPet[record.petId].push(record);
        });
        
        Object.keys(recordsByPet).forEach(petId => {
            const pet = pets.find(p => p.id === petId);
            if (!pet) return;
            
            const petRecords = recordsByPet[petId];
            petRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            html += `
                <div class="card" style="margin-bottom: 1.5rem;">
                    <div class="card-header">
                        <h3 class="card-title">${pet.name}</h3>
                        <span class="badge badge-primary">${petRecords.length} registros</span>
                    </div>
            `;
            
            petRecords.forEach(record => {
                html += `
                    <div class="medical-record-enhanced">
                        <div class="record-header">
                            <div class="record-title">${record.title}</div>
                            <span class="badge ${getRecordTypeBadge(record.type)}">${getRecordTypeText(record.type)}</span>
                        </div>
                        <div class="record-meta">
                            <span>📅 ${formatDate(record.date)}</span>
                            ${record.weight ? `<span>⚖️ ${record.weight} kg</span>` : ''}
                            ${record.temperature ? `<span>🌡️ ${record.temperature} °C</span>` : ''}
                        </div>
                        <div class="record-content">
                            <p><strong>Descripción:</strong> ${record.description.substring(0, 200)}${record.description.length > 200 ? '...' : ''}</p>
                            ${record.diagnosis ? `<p><strong>Diagnóstico:</strong> ${record.diagnosis}</p>` : ''}
                            ${record.prescription ? `<p><strong>Prescripción:</strong> ${record.prescription}</p>` : ''}
                        </div>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                            <button class="btn btn-secondary" onclick="editMedicalRecord('${record.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Editar</button>
                            <button class="btn btn-primary" onclick="viewRecordDetails('${record.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Ver Detalles</button>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
        });
    }
    
    container.innerHTML = html;
}

// ==================== SECCIÓN DE RECORDATORIOS ====================
async function loadRemindersSection() {
    const container = document.getElementById('content-container');
    
    let html = `
        <div class="content-header">
            <h1 class="content-title">Recordatorios</h1>
            <p class="content-subtitle">Gestiona recordatorios para tus mascotas</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3>${reminders.length} Recordatorio${reminders.length !== 1 ? 's' : ''}</h3>
            <button class="btn btn-primary" onclick="openReminderModal()">➕ Nuevo Recordatorio</button>
        </div>
    `;
    
    if (reminders.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">⏰</div>
                <h3>No hay recordatorios</h3>
                <p>Crea recordatorios para vacunas, controles y otras actividades importantes.</p>
            </div>
        `;
    } else {
        // Separar recordatorios por estado
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const pastReminders = reminders.filter(r => new Date(r.date) < today);
        const todayReminders = reminders.filter(r => {
            const reminderDate = new Date(r.date);
            return reminderDate.toDateString() === today.toDateString();
        });
        const upcomingReminders = reminders.filter(r => new Date(r.date) > today);
        
        if (todayReminders.length > 0) {
            html += `
                <div class="card" style="margin-bottom: 1.5rem;">
                    <div class="card-header">
                        <h3 class="card-title">Hoy</h3>
                        <span class="badge badge-warning">${todayReminders.length}</span>
                    </div>
                    <div>
            `;
            
            todayReminders.forEach(reminder => {
                const pet = pets.find(p => p.id === reminder.petId);
                html += createReminderCard(reminder, pet, 'urgent');
            });
            
            html += `</div></div>`;
        }
        
        if (upcomingReminders.length > 0) {
            html += `
                <div class="card" style="margin-bottom: 1.5rem;">
                    <div class="card-header">
                        <h3 class="card-title">Próximos</h3>
                        <span class="badge badge-info">${upcomingReminders.length}</span>
                    </div>
                    <div>
            `;
            
            upcomingReminders.forEach(reminder => {
                const pet = pets.find(p => p.id === reminder.petId);
                const reminderDate = new Date(reminder.date);
                const daysDiff = Math.ceil((reminderDate - today) / (1000 * 60 * 60 * 24));
                const urgencyClass = daysDiff <= 3 ? 'upcoming' : 'normal';
                
                html += createReminderCard(reminder, pet, urgencyClass);
            });
            
            html += `</div></div>`;
        }
        
        if (pastReminders.length > 0) {
            html += `
                <div class="card" style="margin-bottom: 1.5rem;">
                    <div class="card-header">
                        <h3 class="card-title">Pasados</h3>
                        <span class="badge badge-secondary">${pastReminders.length}</span>
                    </div>
                    <div>
            `;
            
            pastReminders.forEach(reminder => {
                const pet = pets.find(p => p.id === reminder.petId);
                html += createReminderCard(reminder, pet, 'danger');
            });
            
            html += `</div></div>`;
        }
    }
    
    container.innerHTML = html;
}

function createReminderCard(reminder, pet, urgencyClass) {
    return `
        <div class="reminder-card ${urgencyClass}">
            <div class="reminder-header">
                <div class="reminder-title">${reminder.title}</div>
                <div class="reminder-date">${formatDate(reminder.date)}</div>
            </div>
            <div class="reminder-pet">
                <span>🐾</span>
                <span>${pet ? pet.name : 'Mascota'}</span>
                <span class="badge ${getReminderTypeBadge(reminder.type)}" style="margin-left: 0.5rem;">${getReminderTypeText(reminder.type)}</span>
            </div>
            <p>${reminder.description || ''}</p>
            <div class="reminder-actions">
                <button class="btn btn-success" onclick="markReminderCompleted('${reminder.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Completado</button>
                <button class="btn btn-secondary" onclick="editReminder('${reminder.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">Editar</button>
            </div>
        </div>
    `;
}

// ==================== PANEL VETERINARIA ====================
async function loadVetDashboard() {
    const container = document.getElementById('content-container');
    
    let html = `
        <div class="content-header">
            <h1 class="content-title">Panel Veterinario</h1>
            <p class="content-subtitle">Gestiona pacientes y registros médicos</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${pets.length}</div>
                <div class="stat-label">Pacientes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${medicalRecords.length}</div>
                <div class="stat-label">Registros Creados</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${reminders.length}</div>
                <div class="stat-label">Recordatorios Activos</div>
            </div>
        </div>
        
        <div class="cards-grid" style="margin-top: 1.5rem;">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Acciones Rápidas</h3>
                </div>
                <div style="display: grid; gap: 0.5rem;">
                    <button class="btn btn-primary" onclick="openMedicalRecordModal()">➕ Nuevo Registro</button>
                    <button class="btn btn-primary" onclick="openReminderModal()">➕ Nuevo Recordatorio</button>
                    <button class="btn btn-secondary" onclick="loadSection('vet-medical-records')">Ver Historial Médico</button>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Pacientes Recientes</h3>
                </div>
                <div>
    `;
    
    if (pets.length === 0) {
        html += `<p>No hay pacientes registrados.</p>`;
    } else {
        pets.slice(0, 3).forEach(pet => {
            html += `
                <div style="padding: 0.5rem; border-bottom: 1px solid var(--gray-light);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${pet.name}</strong>
                            <div style="font-size: 0.9rem; color: var(--gray);">${getSpeciesText(pet.species)}</div>
                        </div>
                        <button class="btn btn-secondary" onclick="openMedicalRecordModal('${pet.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.9rem;">+ Registro</button>
                    </div>
                </div>
            `;
        });
    }
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

async function loadVetMedicalRecords() {
    await loadMedicalRecordsSection();
}

async function loadVetReminders() {
    await loadRemindersSection();
}

// ==================== FUNCIONES DE MASCOTAS ====================
function openPetModal(petId = null) {
    const modal = document.getElementById('pet-modal');
    const form = document.getElementById('pet-form');
    const title = document.getElementById('pet-modal-title');
    
    form.reset();
    
    if (petId) {
        // Modo edición
        const pet = pets.find(p => p.id === petId);
        if (pet) {
            document.getElementById('pet-name').value = pet.name;
            document.getElementById('pet-species').value = pet.species;
            document.getElementById('pet-birthdate').value = pet.birthdate;
            document.getElementById('pet-weight').value = pet.weight || '';
            document.getElementById('pet-color').value = pet.color || '';
            document.getElementById('pet-microchip').value = pet.microchip || '';
            document.getElementById('pet-notes').value = pet.notes || '';
            document.getElementById('pet-id').value = petId;
            
            // Actualizar opciones de raza
            updateBreedOptions();
            document.getElementById('pet-breed').value = pet.breed || '';
            
            title.textContent = 'Editar Mascota';
        }
    } else {
        // Modo creación
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('pet-birthdate').value = today;
        document.getElementById('pet-id').value = '';
        title.textContent = 'Nueva Mascota';
    }
    
    modal.classList.add('active');
}

function updateBreedOptions() {
    const species = document.getElementById('pet-species').value;
    const breedSelect = document.getElementById('pet-breed');
    
    breedSelect.innerHTML = '<option value="">Seleccionar raza</option>';
    
    if (species && BREEDS[species]) {
        BREEDS[species].forEach(breed => {
            breedSelect.innerHTML += `<option value="${breed}">${breed}</option>`;
        });
    }
}

function updateAddPetBreedOptions() {
    const species = document.getElementById('add-pet-species').value;
    const breedSelect = document.getElementById('add-pet-breed');
    
    breedSelect.innerHTML = '<option value="">Seleccionar raza</option>';
    
    if (species && BREEDS[species]) {
        BREEDS[species].forEach(breed => {
            breedSelect.innerHTML += `<option value="${breed}">${breed}</option>`;
        });
    }
}

async function savePet() {
    const form = document.getElementById('pet-form');
    const petId = document.getElementById('pet-id').value;
    
    if (!form.checkValidity()) {
        alert('Por favor completa todos los campos requeridos');
        return;
    }
    
    const petData = {
        name: document.getElementById('pet-name').value,
        species: document.getElementById('pet-species').value,
        breed: document.getElementById('pet-breed').value,
        birthdate: document.getElementById('pet-birthdate').value,
        weight: parseFloat(document.getElementById('pet-weight').value),
        color: document.getElementById('pet-color').value || null,
        microchip: document.getElementById('pet-microchip').value || null,
        notes: document.getElementById('pet-notes').value || null,
        ownerId: currentUser.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (petId) {
            // Actualizar mascota existente
            await db.collection('pets').doc(petId).update(petData);
            showSuccess('Mascota actualizada exitosamente');
        } else {
            // Crear nueva mascota
            petData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('pets').add(petData);
            
            // También guardar el peso inicial en el historial de peso
            const weightData = {
                petId: petData.id,
                weight: petData.weight,
                date: new Date().toISOString(),
                notes: 'Peso inicial',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Nota: Necesitaríamos el ID del documento creado, pero en este caso
            // no lo tenemos. En una implementación real, necesitaríamos manejar esto diferente.
            
            showSuccess('Mascota creada exitosamente');
        }
        
        // Recargar datos
        await loadOwnerData();
        closeModal('pet-modal');
        
        // Recargar sección actual
        const activeSection = document.querySelector('.nav-item.active')?.dataset.section || 'dashboard';
        loadSection(activeSection);
        
    } catch (error) {
        console.error('Error guardando mascota:', error);
        showError('Error al guardar la mascota');
    }
}

async function savePetFromForm() {
    const form = document.getElementById('add-pet-form');
    
    if (!form.checkValidity()) {
        alert('Por favor completa todos los campos requeridos');
        return;
    }
    
    const petData = {
        name: document.getElementById('add-pet-name').value,
        species: document.getElementById('add-pet-species').value,
        breed: document.getElementById('add-pet-breed').value,
        birthdate: document.getElementById('add-pet-birthdate').value,
        weight: parseFloat(document.getElementById('add-pet-weight').value),
        color: document.getElementById('add-pet-color').value || null,
        microchip: document.getElementById('add-pet-microchip').value || null,
        notes: document.getElementById('add-pet-notes').value || null,
        ownerId: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const petRef = await db.collection('pets').add(petData);
        
        // Guardar peso inicial en historial
        const weightData = {
            petId: petRef.id,
            weight: petData.weight,
            date: new Date().toISOString(),
            notes: 'Peso inicial',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('weight_history').add(weightData);
        
        showSuccess('Mascota creada exitosamente');
        
        // Recargar datos
        await loadOwnerData();
        loadSection('pets');
        
    } catch (error) {
        console.error('Error guardando mascota:', error);
        showError('Error al guardar la mascota');
    }
}

function editPet(petId) {
    openPetModal(petId);
}

// ==================== FUNCIONES DE HISTORIAL MÉDICO ====================
function openMedicalRecordModal(petId = null) {
    const modal = document.getElementById('medical-record-modal');
    const form = document.getElementById('medical-record-form');
    const petSelect = document.getElementById('medical-record-pet');
    
    form.reset();
    
    // Llenar selector de mascotas
    petSelect.innerHTML = '<option value="">Seleccionar mascota</option>';
    pets.forEach(pet => {
        petSelect.innerHTML += `<option value="${pet.id}" ${petId === pet.id ? 'selected' : ''}>${pet.name} (${getSpeciesText(pet.species)})</option>`;
    });
    
    // Establecer fecha por defecto
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('medical-record-date').value = today;
    
    // Limpiar ID
    document.getElementById('medical-record-id').value = '';
    
    modal.classList.add('active');
}

function loadTemplate(templateName) {
    const template = MEDICAL_TEMPLATES[templateName];
    if (!template) return;
    
    // Actualizar campos del formulario
    document.getElementById('medical-record-title').value = template.title;
    document.getElementById('medical-record-type').value = template.type;
    document.getElementById('medical-record-description').value = template.description;
    document.getElementById('medical-record-diagnosis').value = template.diagnosis || '';
    document.getElementById('medical-record-prescription').value = template.prescription || '';
    
    // Actualizar clases de botones de template
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.template === templateName) {
            btn.classList.add('active');
        }
    });
}

async function saveMedicalRecord() {
    const form = document.getElementById('medical-record-form');
    const recordId = document.getElementById('medical-record-id').value;
    
    if (!form.checkValidity()) {
        alert('Por favor completa todos los campos requeridos');
        return;
    }
    
    const petId = document.getElementById('medical-record-pet').value;
    const weight = document.getElementById('medical-record-weight').value;
    const reminderWeeks = document.getElementById('medical-record-reminder').value;
    
    const recordData = {
        petId: petId,
        title: document.getElementById('medical-record-title').value,
        date: document.getElementById('medical-record-date').value,
        type: document.getElementById('medical-record-type').value,
        weight: weight ? parseFloat(weight) : null,
        temperature: document.getElementById('medical-record-temperature').value ? parseFloat(document.getElementById('medical-record-temperature').value) : null,
        description: document.getElementById('medical-record-description').value,
        diagnosis: document.getElementById('medical-record-diagnosis').value || null,
        prescription: document.getElementById('medical-record-prescription').value || null,
        instructions: document.getElementById('medical-record-instructions').value || null,
        nextVisit: document.getElementById('medical-record-next-visit').value || null,
        vetId: userData.userType === 'vet' ? currentUser.uid : null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (recordId) {
            // Actualizar registro existente
            await db.collection('medical_records').doc(recordId).update(recordData);
            showSuccess('Registro actualizado exitosamente');
        } else {
            // Crear nuevo registro
            recordData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const recordRef = await db.collection('medical_records').add(recordData);
            
            // Guardar peso en historial si está presente
            if (weight) {
                const weightData = {
                    petId: petId,
                    weight: parseFloat(weight),
                    date: recordData.date,
                    notes: `Registro médico: ${recordData.title}`,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('weight_history').add(weightData);
            }
            
            // Crear recordatorio si se solicitó
            if (reminderWeeks && reminderWeeks !== '') {
                const reminderDate = new Date(recordData.date);
                reminderDate.setDate(reminderDate.getDate() + (parseInt(reminderWeeks) * 7));
                
                const reminderData = {
                    petId: petId,
                    title: `Recordatorio: ${recordData.title}`,
                    type: 'control',
                    description: recordData.nextVisit ? `Próxima visita programada para el ${formatDate(recordData.nextVisit)}` : 'Recordatorio de seguimiento',
                    date: reminderDate.toISOString(),
                    createdBy: currentUser.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('reminders').add(reminderData);
            }
            
            showSuccess('Registro médico creado exitosamente');
        }
        
        // Recargar datos
        await loadMedicalRecords();
        await loadWeightHistory();
        closeModal('medical-record-modal');
        
        // Recargar sección actual
        const activeSection = document.querySelector('.nav-item.active')?.dataset.section || 'dashboard';
        loadSection(activeSection);
        
    } catch (error) {
        console.error('Error guardando registro médico:', error);
        showError('Error al guardar el registro médico');
    }
}

async function editMedicalRecord(recordId) {
    const record = medicalRecords.find(r => r.id === recordId);
    if (!record) return;
    
    const modal = document.getElementById('medical-record-modal');
    const form = document.getElementById('medical-record-form');
    const petSelect = document.getElementById('medical-record-pet');
    
    // Llenar selector de mascotas
    petSelect.innerHTML = '<option value="">Seleccionar mascota</option>';
    pets.forEach(pet => {
        petSelect.innerHTML += `<option value="${pet.id}" ${record.petId === pet.id ? 'selected' : ''}>${pet.name} (${getSpeciesText(pet.species)})</option>`;
    });
    
    // Llenar campos del formulario
    document.getElementById('medical-record-id').value = record.id;
    document.getElementById('medical-record-title').value = record.title;
    document.getElementById('medical-record-date').value = record.date;
    document.getElementById('medical-record-type').value = record.type;
    document.getElementById('medical-record-weight').value = record.weight || '';
    document.getElementById('medical-record-temperature').value = record.temperature || '';
    document.getElementById('medical-record-description').value = record.description;
    document.getElementById('medical-record-diagnosis').value = record.diagnosis || '';
    document.getElementById('medical-record-prescription').value = record.prescription || '';
    document.getElementById('medical-record-instructions').value = record.instructions || '';
    document.getElementById('medical-record-next-visit').value = record.nextVisit || '';
    
    modal.classList.add('active');
}

async function viewRecordDetails(recordId) {
    const record = medicalRecords.find(r => r.id === recordId);
    if (!record) return;
    
    const pet = pets.find(p => p.id === record.petId);
    
    let html = `
        <div class="content-header">
            <h1 class="content-title">Detalles del Registro Médico</h1>
            <p class="content-subtitle">Información completa del registro</p>
        </div>
        
        <div class="card">
            <div class="record-header">
                <div class="record-title">${record.title}</div>
                <span class="badge ${getRecordTypeBadge(record.type)}">${getRecordTypeText(record.type)}</span>
            </div>
            
            <div class="record-meta">
                <span>🐾 ${pet ? pet.name : 'Mascota'}</span>
                <span>📅 ${formatDate(record.date)}</span>
                ${record.weight ? `<span>⚖️ ${record.weight} kg</span>` : ''}
                ${record.temperature ? `<span>🌡️ ${record.temperature} °C</span>` : ''}
            </div>
            
            <div class="record-content">
                <h4 style="margin-bottom: 0.5rem;">Descripción</h4>
                <p>${record.description}</p>
                
                ${record.diagnosis ? `
                    <h4 style="margin-top: 1rem; margin-bottom: 0.5rem;">Diagnóstico</h4>
                    <p>${record.diagnosis}</p>
                ` : ''}
                
                ${record.prescription ? `
                    <h4 style="margin-top: 1rem; margin-bottom: 0.5rem;">Prescripción</h4>
                    <p>${record.prescription}</p>
                ` : ''}
                
                ${record.instructions ? `
                    <h4 style="margin-top: 1rem; margin-bottom: 0.5rem;">Instrucciones</h4>
                    <p>${record.instructions}</p>
                ` : ''}
                
                ${record.nextVisit ? `
                    <h4 style="margin-top: 1rem; margin-bottom: 0.5rem;">Próxima Visita</h4>
                    <p>${formatDate(record.nextVisit)}</p>
                ` : ''}
            </div>
            
            <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary" onclick="editMedicalRecord('${record.id}')">Editar</button>
                <button class="btn btn-primary" onclick="loadSection('medical-records')">Volver al Historial</button>
            </div>
        </div>
    `;
    
    document.getElementById('content-container').innerHTML = html;
}

// ==================== FUNCIONES DE RECORDATORIOS ====================
function openReminderModal(petId = null) {
    const modal = document.getElementById('reminder-modal');
    const form = document.getElementById('reminder-form');
    const petSelect = document.getElementById('reminder-pet');
    
    form.reset();
    
    // Llenar selector de mascotas
    petSelect.innerHTML = '<option value="">Seleccionar mascota</option>';
    pets.forEach(pet => {
        petSelect.innerHTML += `<option value="${pet.id}" ${petId === pet.id ? 'selected' : ''}>${pet.name} (${getSpeciesText(pet.species)})</option>`;
    });
    
    // Establecer fecha por defecto (mañana)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('reminder-date').value = tomorrow.toISOString().split('T')[0];
    
    // Limpiar ID
    document.getElementById('reminder-id').value = '';
    
    modal.classList.add('active');
}

async function saveReminder() {
    const form = document.getElementById('reminder-form');
    const reminderId = document.getElementById('reminder-id').value;
    
    if (!form.checkValidity()) {
        alert('Por favor completa todos los campos requeridos');
        return;
    }
    
    const reminderData = {
        petId: document.getElementById('reminder-pet').value,
        title: document.getElementById('reminder-title').value,
        type: document.getElementById('reminder-type').value,
        date: document.getElementById('reminder-date').value,
        time: document.getElementById('reminder-time').value || null,
        frequency: document.getElementById('reminder-frequency').value || null,
        description: document.getElementById('reminder-description').value || null,
        notificationDays: parseInt(document.getElementById('reminder-notification').value) || 1,
        createdBy: currentUser.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (reminderId) {
            // Actualizar recordatorio existente
            await db.collection('reminders').doc(reminderId).update(reminderData);
            showSuccess('Recordatorio actualizado exitosamente');
        } else {
            // Crear nuevo recordatorio
            reminderData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('reminders').add(reminderData);
            showSuccess('Recordatorio creado exitosamente');
        }
        
        // Recargar datos
        await loadReminders();
        closeModal('reminder-modal');
        
        // Recargar sección actual
        const activeSection = document.querySelector('.nav-item.active')?.dataset.section || 'dashboard';
        loadSection(activeSection);
        
    } catch (error) {
        console.error('Error guardando recordatorio:', error);
        showError('Error al guardar el recordatorio');
    }
}

async function editReminder(reminderId) {
    const reminder = reminders.find(r => r.id === reminderId);
    if (!reminder) return;
    
    const modal = document.getElementById('reminder-modal');
    const form = document.getElementById('reminder-form');
    const petSelect = document.getElementById('reminder-pet');
    
    // Llenar selector de mascotas
    petSelect.innerHTML = '<option value="">Seleccionar mascota</option>';
    pets.forEach(pet => {
        petSelect.innerHTML += `<option value="${pet.id}" ${reminder.petId === pet.id ? 'selected' : ''}>${pet.name} (${getSpeciesText(pet.species)})</option>`;
    });
    
    // Llenar campos del formulario
    document.getElementById('reminder-id').value = reminder.id;
    document.getElementById('reminder-title').value = reminder.title;
    document.getElementById('reminder-type').value = reminder.type;
    document.getElementById('reminder-date').value = reminder.date;
    document.getElementById('reminder-time').value = reminder.time || '';
    document.getElementById('reminder-frequency').value = reminder.frequency || '';
    document.getElementById('reminder-description').value = reminder.description || '';
    document.getElementById('reminder-notification').value = reminder.notificationDays || '1';
    
    modal.classList.add('active');
}

async function markReminderCompleted(reminderId) {
    if (!confirm('¿Marcar este recordatorio como completado?')) return;
    
    try {
        await db.collection('reminders').doc(reminderId).update({
            completed: true,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await loadReminders();
        
        // Recargar sección actual
        const activeSection = document.querySelector('.nav-item.active')?.dataset.section || 'dashboard';
        loadSection(activeSection);
        
        showSuccess('Recordatorio marcado como completado');
        
    } catch (error) {
        console.error('Error completando recordatorio:', error);
        showError('Error al completar el recordatorio');
    }
}

// ==================== FUNCIONES UTILITARIAS ====================
function formatDate(dateString) {
    if (!dateString) return 'Sin fecha';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatShortDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        month: 'short',
        day: 'numeric'
    });
}

function getPetEmoji(species) {
    const emojis = {
        'perro': '🐕',
        'gato': '🐈',
        'conejo': '🐇',
        'ave': '🐦',
        'roedor': '🐭',
        'reptil': '🦎',
        'otro': '🐾'
    };
    return emojis[species] || '🐾';
}

function getSpeciesText(species) {
    const speciesText = {
        'perro': 'Perro',
        'gato': 'Gato',
        'conejo': 'Conejo',
        'ave': 'Ave',
        'roedor': 'Roedor',
        'reptil': 'Reptil',
        'otro': 'Otro'
    };
    return speciesText[species] || 'Mascota';
}

function getRecordTypeText(type) {
    const types = {
        'consulta': 'Consulta',
        'vacuna': 'Vacunación',
        'cirugia': 'Cirugía',
        'examen': 'Examen',
        'tratamiento': 'Tratamiento',
        'control': 'Control',
        'desparasitacion': 'Desparasitación',
        'estetica': 'Estética',
        'urgencia': 'Urgencia'
    };
    return types[type] || type;
}

function getRecordTypeBadge(type) {
    const badges = {
        'consulta': 'badge-info',
        'vacuna': 'badge-success',
        'cirugia': 'badge-danger',
        'examen': 'badge-warning',
        'tratamiento': 'badge-primary',
        'control': 'badge-secondary',
        'desparasitacion': 'badge-success',
        'estetica': 'badge-secondary',
        'urgencia': 'badge-danger'
    };
    return badges[type] || 'badge-secondary';
}

function getReminderTypeText(type) {
    const types = {
        'vacuna': 'Vacuna',
        'desparasitacion': 'Desparasitación',
        'control': 'Control',
        'cirugia': 'Cirugía',
        'tratamiento': 'Tratamiento',
        'peluqueria': 'Peluquería',
        'otro': 'Otro'
    };
    return types[type] || type;
}

function getReminderTypeBadge(type) {
    const badges = {
        'vacuna': 'badge-success',
        'desparasitacion': 'badge-info',
        'control': 'badge-warning',
        'cirugia': 'badge-danger',
        'tratamiento': 'badge-primary',
        'peluqueria': 'badge-secondary',
        'otro': 'badge-secondary'
    };
    return badges[type] || 'badge-secondary';
}

function showSuccess(message) {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #10b981;
        color: white;
        padding: 1rem;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span>✅</span>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function showError(message) {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #ef4444;
        color: white;
        padding: 1rem;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span>❌</span>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

async function handleLogout() {
    try {
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error cerrando sesión:', error);
        showError('Error al cerrar sesión');
    }
}

// Agregar estilos CSS para animaciones de notificaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

console.log("✅ Aplicación FASE 1 cargada exitosamente");
