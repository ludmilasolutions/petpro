// app.js - Código JavaScript completo para Tu Mascota Online



// ==================== VARIABLES GLOBALES ====================
let auth;
let db;
let currentUser;
let userData = {};
let pets = [];
let authorizedVets = [];
let vetAuthorizedPets = [];
let medicalRecords = [];
let appointments = [];
let vetAppointments = [];
let allVets = [];
let currentSection = 'dashboard';

// ==================== ELEMENTOS DOM ====================
let contentContainer;
let navItems;
let ownerNav;
let vetNav;
let adminNav;
let userName;
let userAvatar;
let userRole;
let logoutBtn;

// Modales
let petModal;
let authVetModal;
let medicalRecordModal;
let appointmentModal;
let vetDetailsModal;
let qrModal;

// ==================== INICIALIZACIÓN ====================

// Función para inicializar la aplicación
async function initializeApp() {
    try {
        console.log('Inicializando aplicación...');
        
        // Obtener referencias a elementos DOM
        contentContainer = document.getElementById('content-container');
        navItems = document.querySelectorAll('.nav-item');
        ownerNav = document.getElementById('owner-nav');
        vetNav = document.getElementById('vet-nav');
        adminNav = document.getElementById('admin-nav');
        userName = document.getElementById('user-name');
        userAvatar = document.getElementById('user-avatar');
        userRole = document.getElementById('user-role');
        logoutBtn = document.getElementById('logout-btn');
        
        // Obtener referencias a modales
        petModal = document.getElementById('pet-modal');
        authVetModal = document.getElementById('auth-vet-modal');
        medicalRecordModal = document.getElementById('medical-record-modal');
        appointmentModal = document.getElementById('appointment-modal');
        vetDetailsModal = document.getElementById('vet-details-modal');
        qrModal = document.getElementById('qr-modal');
        
        // Verificar que todos los elementos existan
        if (!contentContainer || !navItems || !ownerNav || !vetNav || !adminNav) {
            console.error('Error: No se encontraron elementos DOM necesarios');
            showError('Error al cargar la aplicación. Por favor, recarga la página.');
            return;
        }
        
        // Inicializar Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase inicializado');
        }
        
        auth = firebase.auth();
        db = firebase.firestore();
        
        // Escuchar cambios en autenticación
        auth.onAuthStateChanged(handleAuthStateChange);
        
        // Configurar listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        showError('Error al inicializar la aplicación. Recarga la página.');
    }
}

// Manejar cambio de estado de autenticación
async function handleAuthStateChange(user) {
    if (user) {
        // Usuario autenticado
        currentUser = user;
        console.log('Usuario autenticado:', user.email);
        
        // Obtener datos del usuario
        await loadUserData(user.uid);
        
        // Actualizar UI
        updateUserUI();
        
        // Mostrar navegación según tipo de usuario
        showNavigation();
        
        // Cargar sección actual
        loadSection(currentSection);
        
    } else {
        // Usuario no autenticado, redirigir a login
        console.log('Usuario no autenticado, redirigiendo a login...');
        window.location.href = '/index.html';
    }
}

// Cargar datos del usuario
async function loadUserData(uid) {
    try {
        console.log('Cargando datos del usuario:', uid);
        const userDoc = await db.collection('users').doc(uid).get();
        
        if (userDoc.exists) {
            userData = userDoc.data();
            console.log('Datos del usuario cargados:', userData);
            
            // Verificar si es super admin
            if (userData.super_admin === true) {
                userData.userType = 'super_admin';
            }
            
            // Cargar datos adicionales según tipo de usuario
            if (userData.userType === 'owner') {
                await loadOwnerData(uid);
            } else if (userData.userType === 'vet') {
                await loadVetData(uid);
            }
            
        } else {
            // Si no existe el documento, crear uno básico
            console.log('Usuario no encontrado en Firestore, creando documento...');
            userData = {
                uid: uid,
                email: currentUser.email,
                displayName: currentUser.displayName || currentUser.email.split('@')[0],
                photoURL: currentUser.photoURL,
                userType: 'owner',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('users').doc(uid).set(userData);
            console.log('Documento de usuario creado');
        }
        
    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
    }
}

// Cargar datos del dueño
async function loadOwnerData(uid) {
    try {
        console.log('Cargando datos del dueño...');
        
        // Cargar mascotas del usuario
        const petsSnapshot = await db.collection('pets')
            .where('ownerId', '==', uid)
            .get();
        
        pets = [];
        petsSnapshot.forEach(doc => {
            pets.push({
                id: doc.id,
                ...doc.data()
            });
        });
        console.log(`${pets.length} mascotas cargadas`);
        
        // Cargar veterinarias autorizadas
        const authSnapshot = await db.collection('authorizations')
            .where('ownerId', '==', uid)
            .where('status', '==', 'authorized')
            .get();
        
        authorizedVets = [];
        for (const doc of authSnapshot.docs) {
            const authData = doc.data();
            const vetDoc = await db.collection('users').doc(authData.vetId).get();
            
            if (vetDoc.exists) {
                authorizedVets.push({
                    authId: doc.id,
                    uid: authData.vetId,
                    ...vetDoc.data()
                });
            }
        }
        console.log(`${authorizedVets.length} veterinarias autorizadas cargadas`);
        
        // Cargar historial médico de mascotas del usuario
        await loadMedicalRecordsForOwner(uid);
        
        // Cargar turnos del usuario
        await loadAppointmentsForOwner(uid);
        
    } catch (error) {
        console.error('Error al cargar datos del dueño:', error);
    }
}

// Cargar datos de veterinaria
async function loadVetData(uid) {
    try {
        console.log('Cargando datos de veterinaria...');
        
        // Cargar información de la veterinaria
        const vetInfoDoc = await db.collection('vet_info').doc(uid).get();
        
        if (vetInfoDoc.exists) {
            userData.vetInfo = vetInfoDoc.data();
        }
        
        // Cargar configuraciones
        const vetConfigDoc = await db.collection('vet_config').doc(uid).get();
        
        if (vetConfigDoc.exists) {
            userData.vetConfig = vetConfigDoc.data();
        } else {
            // Crear configuración por defecto
            userData.vetConfig = {
                appointmentsEnabled: false,
                notificationsEnabled: true,
                appointmentDuration: 30,
                workDays: [1, 2, 3, 4, 5],
                workStart: '09:00',
                workEnd: '18:00'
            };
        }
        
        // Cargar mascotas autorizadas para esta veterinaria
        await loadAuthorizedPetsForVet(uid);
        
        // Cargar turnos de la veterinaria
        await loadAppointmentsForVet(uid);
        
    } catch (error) {
        console.error('Error al cargar datos de veterinaria:', error);
    }
}

// Cargar mascotas autorizadas para veterinaria
async function loadAuthorizedPetsForVet(vetId) {
    try {
        console.log('Cargando mascotas autorizadas para veterinaria...');
        const authSnapshot = await db.collection('authorizations')
            .where('vetId', '==', vetId)
            .where('status', '==', 'authorized')
            .get();
        
        vetAuthorizedPets = [];
        for (const doc of authSnapshot.docs) {
            const authData = doc.data();
            const petDoc = await db.collection('pets').doc(authData.petId).get();
            
            if (petDoc.exists) {
                const petData = petDoc.data();
                const ownerDoc = await db.collection('users').doc(petData.ownerId).get();
                
                vetAuthorizedPets.push({
                    authId: doc.id,
                    petId: petDoc.id,
                    ...petData,
                    owner: ownerDoc.exists ? ownerDoc.data() : null
                });
            }
        }
        console.log(`${vetAuthorizedPets.length} mascotas autorizadas cargadas`);
        
    } catch (error) {
        console.error('Error al cargar mascotas autorizadas:', error);
    }
}

// Cargar historial médico para dueño
async function loadMedicalRecordsForOwner(ownerId) {
    try {
        console.log('Cargando historial médico para dueño...');
        // Obtener IDs de mascotas del dueño
        const petIds = pets.map(pet => pet.id);
        
        if (petIds.length === 0) {
            medicalRecords = [];
            return;
        }
        
        // Cargar registros médicos de todas las mascotas del dueño
        const recordsSnapshot = await db.collection('medical_records')
            .where('petId', 'in', petIds)
            .orderBy('date', 'desc')
            .get();
        
        medicalRecords = [];
        for (const doc of recordsSnapshot.docs) {
            const recordData = doc.data();
            const vetDoc = await db.collection('users').doc(recordData.vetId).get();
            
            medicalRecords.push({
                id: doc.id,
                ...recordData,
                vet: vetDoc.exists ? vetDoc.data() : null
            });
        }
        console.log(`${medicalRecords.length} registros médicos cargados`);
        
    } catch (error) {
        console.error('Error al cargar historial médico:', error);
        medicalRecords = [];
    }
}

// Cargar turnos para dueño
async function loadAppointmentsForOwner(ownerId) {
    try {
        console.log('Cargando turnos para dueño...');
        const appointmentsSnapshot = await db.collection('appointments')
            .where('ownerId', '==', ownerId)
            .orderBy('dateTime', 'desc')
            .get();
        
        appointments = [];
        for (const doc of appointmentsSnapshot.docs) {
            const appointmentData = doc.data();
            const vetDoc = await db.collection('users').doc(appointmentData.vetId).get();
            const petDoc = await db.collection('pets').doc(appointmentData.petId).get();
            
            appointments.push({
                id: doc.id,
                ...appointmentData,
                vet: vetDoc.exists ? vetDoc.data() : null,
                pet: petDoc.exists ? petDoc.data() : null
            });
        }
        console.log(`${appointments.length} turnos cargados`);
        
    } catch (error) {
        console.error('Error al cargar turnos:', error);
        appointments = [];
    }
}

// Cargar turnos para veterinaria
async function loadAppointmentsForVet(vetId) {
    try {
        console.log('Cargando turnos para veterinaria...');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const appointmentsSnapshot = await db.collection('appointments')
            .where('vetId', '==', vetId)
            .where('dateTime', '>=', today)
            .orderBy('dateTime', 'asc')
            .get();
        
        vetAppointments = [];
        for (const doc of appointmentsSnapshot.docs) {
            const appointmentData = doc.data();
            const ownerDoc = await db.collection('users').doc(appointmentData.ownerId).get();
            const petDoc = await db.collection('pets').doc(appointmentData.petId).get();
            
            vetAppointments.push({
                id: doc.id,
                ...appointmentData,
                owner: ownerDoc.exists ? ownerDoc.data() : null,
                pet: petDoc.exists ? petDoc.data() : null
            });
        }
        console.log(`${vetAppointments.length} turnos de veterinaria cargados`);
        
    } catch (error) {
        console.error('Error al cargar turnos de veterinaria:', error);
        vetAppointments = [];
    }
}

// Actualizar UI del usuario
function updateUserUI() {
    if (!userName || !userAvatar || !userRole) return;
    
    userName.textContent = userData.displayName || currentUser.email;
    userAvatar.src = userData.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userData.displayName || currentUser.email) + '&background=4f46e5&color=fff';
    
    // Establecer rol
    let roleText = '';
    switch (userData.userType) {
        case 'owner':
            roleText = 'Dueño de mascota';
            break;
        case 'vet':
            roleText = 'Veterinaria';
            if (userData.vetInfo && userData.vetInfo.name) {
                roleText += ` - ${userData.vetInfo.name}`;
            }
            break;
        case 'super_admin':
            roleText = 'Administrador del sistema';
            break;
        default:
            roleText = 'Usuario';
    }
    
    userRole.textContent = roleText;
    console.log('UI de usuario actualizada');
}

// Mostrar navegación según tipo de usuario
function showNavigation() {
    // Ocultar todos primero
    if (ownerNav) ownerNav.style.display = 'none';
    if (vetNav) vetNav.style.display = 'none';
    if (adminNav) adminNav.style.display = 'none';
    
    // Mostrar los correspondientes
    switch (userData.userType) {
        case 'owner':
            if (ownerNav) ownerNav.style.display = 'block';
            break;
        case 'vet':
            if (vetNav) vetNav.style.display = 'block';
            break;
        case 'super_admin':
            if (adminNav) adminNav.style.display = 'block';
            break;
    }
    console.log('Navegación actualizada para tipo:', userData.userType);
}

// ==================== CONFIGURACIÓN DE EVENT LISTENERS ====================

// Configurar event listeners
function setupEventListeners() {
    console.log('Configurando event listeners...');
    
    // Navegación
    if (navItems) {
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                setActiveNavItem(section);
                loadSection(section);
            });
        });
    }
    
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Modal de mascotas
    const petModalClose = document.getElementById('pet-modal-close');
    if (petModalClose) {
        petModalClose.addEventListener('click', () => petModal.classList.remove('active'));
    }
    
    const petModalCancel = document.getElementById('pet-modal-cancel');
    if (petModalCancel) {
        petModalCancel.addEventListener('click', () => petModal.classList.remove('active'));
    }
    
    const petModalSave = document.getElementById('pet-modal-save');
    if (petModalSave) {
        petModalSave.addEventListener('click', handleSavePet);
    }
    
    // Modal de autorización veterinaria
    const authVetModalClose = document.getElementById('auth-vet-modal-close');
    if (authVetModalClose) {
        authVetModalClose.addEventListener('click', () => authVetModal.classList.remove('active'));
    }
    
    // Modal de historial médico
    const medicalRecordModalClose = document.getElementById('medical-record-modal-close');
    if (medicalRecordModalClose) {
        medicalRecordModalClose.addEventListener('click', () => medicalRecordModal.classList.remove('active'));
    }
    
    const medicalRecordModalCancel = document.getElementById('medical-record-modal-cancel');
    if (medicalRecordModalCancel) {
        medicalRecordModalCancel.addEventListener('click', () => medicalRecordModal.classList.remove('active'));
    }
    
    const medicalRecordModalSave = document.getElementById('medical-record-modal-save');
    if (medicalRecordModalSave) {
        medicalRecordModalSave.addEventListener('click', handleSaveMedicalRecord);
    }
    
    // Modal de turnos
    const appointmentModalClose = document.getElementById('appointment-modal-close');
    if (appointmentModalClose) {
        appointmentModalClose.addEventListener('click', () => appointmentModal.classList.remove('active'));
    }
    
    const appointmentModalCancel = document.getElementById('appointment-modal-cancel');
    if (appointmentModalCancel) {
        appointmentModalCancel.addEventListener('click', () => appointmentModal.classList.remove('active'));
    }
    
    const appointmentModalSave = document.getElementById('appointment-modal-save');
    if (appointmentModalSave) {
        appointmentModalSave.addEventListener('click', handleSaveAppointment);
    }
    
    // Modal de detalles de veterinaria
    const vetDetailsModalClose = document.getElementById('vet-details-modal-close');
    if (vetDetailsModalClose) {
        vetDetailsModalClose.addEventListener('click', () => vetDetailsModal.classList.remove('active'));
    }
    
    // Modal de QR
    const qrModalClose = document.getElementById('qr-modal-close');
    if (qrModalClose) {
        qrModalClose.addEventListener('click', () => qrModal.classList.remove('active'));
    }
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (petModal && e.target === petModal) petModal.classList.remove('active');
        if (authVetModal && e.target === authVetModal) authVetModal.classList.remove('active');
        if (medicalRecordModal && e.target === medicalRecordModal) medicalRecordModal.classList.remove('active');
        if (appointmentModal && e.target === appointmentModal) appointmentModal.classList.remove('active');
        if (vetDetailsModal && e.target === vetDetailsModal) vetDetailsModal.classList.remove('active');
        if (qrModal && e.target === qrModal) qrModal.classList.remove('active');
    });
    
    console.log('Event listeners configurados');
}

// Establecer elemento de navegación activo
function setActiveNavItem(section) {
    if (!navItems) return;
    
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === section) {
            item.classList.add('active');
        }
    });
    currentSection = section;
}

// ==================== CARGA DE SECCIONES ====================

// Cargar sección
async function loadSection(section) {
    console.log('Cargando sección:', section);
    
    if (!contentContainer) {
        console.error('Error: contentContainer no encontrado');
        return;
    }
    
    // Mostrar loading
    contentContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Cargando...</p>
        </div>
    `;
    
    // Cargar contenido según sección
    try {
        switch (section) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'pets':
                await loadPets();
                break;
            case 'add-pet':
                await loadAddPet();
                break;
            case 'authorized-vets':
                await loadAuthorizedVets();
                break;
            case 'appointments':
                await loadOwnerAppointments();
                break;
            case 'medical-history':
                await loadMedicalHistory();
                break;
            case 'vet-dashboard':
                await loadVetDashboard();
                break;
            case 'vet-appointments':
                await loadVetAppointments();
                break;
            case 'search-pets':
                await loadSearchPets();
                break;
            case 'vet-pets':
                await loadVetPets();
                break;
            case 'vet-settings':
                await loadVetSettings();
                break;
            case 'vets-list':
                await loadVetsList();
                break;
            case 'social-impact':
                await loadSocialImpact();
                break;
            case 'admin-dashboard':
                await loadAdminDashboard();
                break;
            default:
                await loadDashboard();
        }
    } catch (error) {
        console.error('Error al cargar sección:', error);
        showError('Error al cargar la sección');
    }
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
    console.log('Cargando dashboard...');
    let html = `
        <div class="content-header">
            <h1 class="content-title">Dashboard</h1>
            <p class="content-subtitle">Bienvenido a Tu Mascota Online</p>
        </div>
    `;
    
    if (userData.userType === 'owner') {
        const pendingAppointments = appointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed');
        
        html += `
            <div class="cards-grid">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Mis Mascotas</h3>
                        <span class="card-icon">🐕</span>
                    </div>
                    <p>${pets.length} mascota${pets.length !== 1 ? 's' : ''} registrada${pets.length !== 1 ? 's' : ''}</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="loadSection('add-pet')">Agregar mascota</button>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Veterinarias Autorizadas</h3>
                        <span class="card-icon">🏥</span>
                    </div>
                    <p>${authorizedVets.length} veterinaria${authorizedVets.length !== 1 ? 's' : ''} autorizada${authorizedVets.length !== 1 ? 's' : ''}</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="loadSection('authorized-vets')">Gestionar</button>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Próximos Turnos</h3>
                        <span class="card-icon">📅</span>
                    </div>
                    <p>${pendingAppointments.length} turno${pendingAppointments.length !== 1 ? 's' : ''} pendiente${pendingAppointments.length !== 1 ? 's' : ''}</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="loadSection('appointments')">Ver turnos</button>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Acciones rápidas</h3>
                </div>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="loadSection('add-pet')">Agregar mascota</button>
                    <button class="btn btn-secondary" onclick="loadSection('vets-list')">Buscar veterinarias</button>
                    <button class="btn btn-secondary" onclick="showAuthVetModal()">Autorizar veterinaria</button>
                    <button class="btn btn-secondary" onclick="showNewAppointmentModal()">Solicitar turno</button>
                </div>
            </div>
            
            ${medicalRecords.length > 0 ? `
                <div class="card" style="margin-top: 2rem;">
                    <div class="card-header">
                        <h3 class="card-title">Últimos Registros Médicos</h3>
                    </div>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${medicalRecords.slice(0, 3).map(record => `
                            <div class="medical-record">
                                <div class="medical-record-header">
                                    <div>
                                        <h4 class="medical-record-title">${record.title}</h4>
                                        <p class="medical-record-vet">${record.vet?.displayName || 'Veterinaria'}</p>
                                    </div>
                                    <div class="medical-record-date">${formatDate(record.date)}</div>
                                </div>
                                <p>${record.description.substring(0, 100)}${record.description.length > 100 ? '...' : ''}</p>
                                <span class="badge badge-info">${record.type}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    } else if (userData.userType === 'vet') {
        const todayAppointments = vetAppointments.filter(a => isToday(new Date(a.dateTime)));
        
        html += `
            <div class="alert alert-info">
                <span>🏥</span>
                <div>
                    <strong>Panel de veterinaria</strong>
                    <p>Gestiona turnos, busca mascotas y carga historiales médicos.</p>
                </div>
            </div>
            
            <div class="cards-grid">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Mascotas autorizadas</h3>
                        <span class="card-icon">🐕</span>
                    </div>
                    <p>${vetAuthorizedPets.length} mascota${vetAuthorizedPets.length !== 1 ? 's' : ''} autorizada${vetAuthorizedPets.length !== 1 ? 's' : ''}</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="loadSection('vet-pets')">Ver mascotas</button>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Turnos de hoy</h3>
                        <span class="card-icon">📅</span>
                    </div>
                    <p>${todayAppointments.length} turno${todayAppointments.length !== 1 ? 's' : ''} programado${todayAppointments.length !== 1 ? 's' : ''}</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="loadSection('vet-appointments')">Ver turnos</button>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Configuración</h3>
                        <span class="card-icon">⚙️</span>
                    </div>
                    <p>${userData.vetConfig?.appointmentsEnabled ? '✅ Turnos activados' : '❌ Turnos desactivados'}</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="loadSection('vet-settings')">Configurar</button>
                </div>
            </div>
        `;
    } else if (userData.userType === 'super_admin') {
        html += `
            <div class="alert alert-warning">
                <span>🛡️</span>
                <div>
                    <strong>Panel de administración</strong>
                    <p>Acceso completo al sistema. Usa con responsabilidad.</p>
                </div>
            </div>
            
            <div class="cards-grid">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Veterinarias</h3>
                        <span class="card-icon">🏥</span>
                    </div>
                    <p>Gestiona todas las veterinarias del sistema</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.location.href='/admin.html'">Ir al panel admin</button>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Usuarios</h3>
                        <span class="card-icon">👤</span>
                    </div>
                    <p>Administra usuarios y permisos</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.location.href='/admin.html#users'">Gestionar usuarios</button>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Mascotas</h3>
                        <span class="nav-icon">🐾</span>
                    </div>
                    <p>Vista global de todas las mascotas</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.location.href='/admin.html#pets')">Ver mascotas</button>
                </div>
            </div>
        `;
    }
    
    contentContainer.innerHTML = html;
}

// ==================== MASCOTAS (OWNER) ====================
async function loadPets() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Mis Mascotas</h1>
            <p class="content-subtitle">Gestiona el historial médico de tus mascotas</p>
        </div>
    `;
    
    if (pets.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">🐕</div>
                <h3>No tienes mascotas registradas</h3>
                <p>Comienza agregando tu primera mascota para centralizar su historial médico.</p>
                <button class="btn btn-primary" onclick="loadSection('add-pet')" style="margin-top: 1rem;">Agregar mi primera mascota</button>
            </div>
        `;
    } else {
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3>${pets.length} mascota${pets.length !== 1 ? 's' : ''}</h3>
                <button class="btn btn-primary" onclick="loadSection('add-pet')">➕ Agregar mascota</button>
            </div>
        `;
        
        pets.forEach(pet => {
            const petAppointments = appointments.filter(a => a.petId === pet.id);
            const petMedicalRecords = medicalRecords.filter(r => r.petId === pet.id);
            
            html += `
                <div class="pet-profile">
                    <div class="pet-avatar">
                        ${getPetEmoji(pet.species)}
                    </div>
                    <div class="pet-info" style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <h3>${pet.name}</h3>
                                <p>${pet.species} ${pet.breed ? `- ${pet.breed}` : ''}</p>
                                <p>${pet.birthdate ? `Nacimiento: ${formatDate(pet.birthdate)}` : ''}</p>
                                ${pet.microchip ? `<p><small>Microchip: ${pet.microchip}</small></p>` : ''}
                            </div>
                            <div style="display: flex; gap: 0.3rem;">
                                <button class="btn btn-secondary" onclick="viewPetDetails('${pet.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Ver</button>
                                <button class="btn btn-secondary" onclick="editPet('${pet.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Editar</button>
                                <button class="btn btn-secondary" onclick="showPetQR('${pet.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">QR</button>
                            </div>
                        </div>
                        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                            <span><strong>${petMedicalRecords.length}</strong> registros médicos</span>
                            <span><strong>${petAppointments.length}</strong> turnos</span>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    contentContainer.innerHTML = html;
}

// ==================== AGREGAR MASCOTA ====================
async function loadAddPet() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Agregar Mascota</h1>
            <p class="content-subtitle">Registra una nueva mascota para centralizar su historial médico</p>
        </div>
        
        <div class="card">
            <form id="add-pet-form">
                <div class="form-group">
                    <label class="form-label" for="add-pet-name">Nombre *</label>
                    <input type="text" id="add-pet-name" class="form-control" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="add-pet-species">Especie *</label>
                    <select id="add-pet-species" class="form-control" required>
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
                    <input type="text" id="add-pet-breed" class="form-control">
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="add-pet-birthdate">Fecha de nacimiento (aproximada)</label>
                    <input type="date" id="add-pet-birthdate" class="form-control">
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
                    <button type="button" class="btn btn-primary" onclick="savePetFromForm()">Guardar mascota</button>
                    <button type="button" class="btn btn-secondary" onclick="loadSection('pets')">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    
    contentContainer.innerHTML = html;
}

// ==================== VETERINARIAS AUTORIZADAS ====================
async function loadAuthorizedVets() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Veterinarias Autorizadas</h1>
            <p class="content-subtitle">Controla qué veterinarias pueden acceder al historial de tus mascotas</p>
        </div>
        
        <div class="card" style="margin-bottom: 1.5rem;">
            <p><strong>¿Qué es la autorización?</strong></p>
            <p>Cuando autorizas a una veterinaria, le permites acceder al historial médico completo de tus mascotas. Puedes revocar el acceso en cualquier momento.</p>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button class="btn btn-primary" onclick="showAuthVetModal()">➕ Autorizar nueva veterinaria</button>
                <button class="btn btn-secondary" onclick="loadSection('vets-list')">Buscar veterinarias</button>
            </div>
        </div>
    `;
    
    if (authorizedVets.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">🏥</div>
                <h3>No tienes veterinarias autorizadas</h3>
                <p>Autoriza veterinarias para que puedan acceder al historial médico de tus mascotas cuando lo necesiten.</p>
            </div>
        `;
    } else {
        html += `
            <h3 style="margin-bottom: 1rem;">${authorizedVets.length} veterinaria${authorizedVets.length !== 1 ? 's' : ''} autorizada${authorizedVets.length !== 1 ? 's' : ''}</h3>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Veterinaria</th>
                            <th>Contacto</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        authorizedVets.forEach(vet => {
            html += `
                <tr>
                    <td>
                        <strong>${vet.vetInfo?.name || vet.displayName || 'Sin nombre'}</strong><br>
                        <small>${vet.vetInfo?.address || 'Sin dirección'}</small>
                    </td>
                    <td>
                        ${vet.email}<br>
                        ${vet.vetInfo?.phone || 'Sin teléfono'}
                    </td>
                    <td>
                        ${vet.vetStatus === 'trial' ? 
                            '<span class="status-badge status-trial">Prueba</span>' :
                            '<span class="status-badge status-active">Activa</span>'
                        }
                    </td>
                    <td>
                        <button class="btn btn-secondary" onclick="viewVetDetails('${vet.uid}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem; margin-right: 0.5rem;">Detalles</button>
                        <button class="btn btn-danger" onclick="revokeVetAccess('${vet.authId}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Revocar</button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
    }
    
    contentContainer.innerHTML = html;
}

// ==================== TURNOS (OWNER) ====================
async function loadOwnerAppointments() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Mis Turnos</h1>
            <p class="content-subtitle">Gestiona los turnos de tus mascotas</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3>${appointments.length} turno${appointments.length !== 1 ? 's' : ''}</h3>
            <button class="btn btn-primary" onclick="showNewAppointmentModal()">➕ Solicitar turno</button>
        </div>
    `;
    
    if (appointments.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <h3>No tienes turnos programados</h3>
                <p>Solicita un turno en una veterinaria autorizada.</p>
                <button class="btn btn-primary" onclick="showNewAppointmentModal()" style="margin-top: 1rem;">Solicitar mi primer turno</button>
            </div>
        `;
    } else {
        // Filtrar turnos futuros y pasados
        const now = new Date();
        const upcomingAppointments = appointments.filter(a => new Date(a.dateTime) > now);
        const pastAppointments = appointments.filter(a => new Date(a.dateTime) <= now);
        
        if (upcomingAppointments.length > 0) {
            html += `
                <h4 style="margin-bottom: 1rem; color: var(--dark);">Próximos turnos</h4>
                <div class="cards-grid">
            `;
            
            upcomingAppointments.forEach(appointment => {
                html += `
                    <div class="appointment-card">
                        <div class="appointment-card-header">
                            <div class="appointment-pet-info">
                                <div class="appointment-pet-avatar">
                                    ${getPetEmoji(appointment.pet?.species || '')}
                                </div>
                                <div>
                                    <h4 style="margin-bottom: 0.2rem;">${appointment.pet?.name || 'Mascota'}</h4>
                                    <p style="color: var(--gray); font-size: 0.9rem;">${appointment.vet?.vetInfo?.name || appointment.vet?.displayName || 'Veterinaria'}</p>
                                </div>
                            </div>
                            <span class="appointment-status appointment-${appointment.status}">
                                ${getAppointmentStatusText(appointment.status)}
                            </span>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <p><strong>Fecha:</strong> ${formatDateTime(appointment.dateTime)}</p>
                            <p><strong>Tipo:</strong> ${getAppointmentTypeText(appointment.type)}</p>
                            ${appointment.reason ? `<p><strong>Motivo:</strong> ${appointment.reason}</p>` : ''}
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            ${appointment.status === 'scheduled' ? `
                                <button class="btn btn-success" onclick="confirmAppointment('${appointment.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Confirmar</button>
                                <button class="btn btn-danger" onclick="cancelAppointment('${appointment.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Cancelar</button>
                            ` : ''}
                            <button class="btn btn-secondary" onclick="editAppointment('${appointment.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Editar</button>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
        }
        
        if (pastAppointments.length > 0) {
            html += `
                <h4 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--dark);">Turnos anteriores</h4>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Mascota</th>
                                <th>Veterinaria</th>
                                <th>Tipo</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            pastAppointments.forEach(appointment => {
                html += `
                    <tr>
                        <td>${formatDateTime(appointment.dateTime)}</td>
                        <td>${appointment.pet?.name || 'Mascota'}</td>
                        <td>${appointment.vet?.vetInfo?.name || appointment.vet?.displayName || 'Veterinaria'}</td>
                        <td>${getAppointmentTypeText(appointment.type)}</td>
                        <td>
                            <span class="appointment-status appointment-${appointment.status}">
                                ${getAppointmentStatusText(appointment.status)}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-secondary" onclick="viewAppointmentDetails('${appointment.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Ver</button>
                        </td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
    }
    
    contentContainer.innerHTML = html;
}

// ==================== HISTORIAL MÉDICO ====================
async function loadMedicalHistory() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Historial Médico</h1>
            <p class="content-subtitle">Registros médicos completos de todas tus mascotas</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
                <h3>${medicalRecords.length} registro${medicalRecords.length !== 1 ? 's' : ''} médico${medicalRecords.length !== 1 ? 's' : ''}</h3>
                <p>Historial completo de todas tus mascotas</p>
            </div>
            ${userData.userType === 'vet' ? `
                <button class="btn btn-primary" onclick="showNewMedicalRecordModal()">➕ Nuevo registro</button>
            ` : ''}
        </div>
    `;
    
    if (medicalRecords.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">🏥</div>
                <h3>No hay registros médicos</h3>
                <p>${userData.userType === 'owner' ? 
                    'Las veterinarias autorizadas podrán cargar registros médicos aquí.' : 
                    'Comienza cargando registros médicos para las mascotas autorizadas.'}</p>
            </div>
        `;
    } else {
        // Agrupar registros por mascota
        const recordsByPet = {};
        medicalRecords.forEach(record => {
            if (!recordsByPet[record.petId]) {
                recordsByPet[record.petId] = {
                    pet: pets.find(p => p.id === record.petId) || vetAuthorizedPets.find(p => p.petId === record.petId),
                    records: []
                };
            }
            recordsByPet[record.petId].records.push(record);
        });
        
        // Mostrar timeline para cada mascota
        Object.values(recordsByPet).forEach(petData => {
            if (!petData.pet) return;
            
            html += `
                <div class="card" style="margin-bottom: 2rem;">
                    <div class="card-header">
                        <h3 class="card-title">${petData.pet?.name || 'Mascota'}</h3>
                        <span class="status-badge status-active">${petData.records.length} registros</span>
                    </div>
                    
                    <div class="timeline">
            `;
            
            // Ordenar registros por fecha (más reciente primero)
            petData.records.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            petData.records.forEach(record => {
                html += `
                    <div class="timeline-item">
                        <div class="medical-record">
                            <div class="medical-record-header">
                                <div>
                                    <h4 class="medical-record-title">${record.title}</h4>
                                    <p class="medical-record-vet">${record.vet?.displayName || 'Veterinaria'}</p>
                                </div>
                                <div class="medical-record-date">${formatDate(record.date)}</div>
                            </div>
                            <p style="margin-bottom: 0.5rem;">${record.description}</p>
                            ${record.prescription ? `<p><strong>Prescripción:</strong> ${record.prescription}</p>` : ''}
                            ${record.nextVisit ? `<p><strong>Próxima visita:</strong> ${formatDate(record.nextVisit)}</p>` : ''}
                            <span class="badge badge-info">${getRecordTypeText(record.type)}</span>
                            ${userData.userType === 'vet' ? `
                                <div style="margin-top: 0.5rem;">
                                    <button class="btn btn-secondary" onclick="editMedicalRecord('${record.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Editar</button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
    }
    
    contentContainer.innerHTML = html;
}

// ==================== PANEL VETERINARIA ====================
async function loadVetDashboard() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Panel de Veterinaria</h1>
            <p class="content-subtitle">${userData.vetInfo?.name || 'Tu veterinaria'}</p>
        </div>
        
        <div class="cards-grid">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Estado de cuenta</h3>
                    <span class="card-icon">💰</span>
                </div>
                <p>${userData.vetStatus === 'trial' ? 'Periodo de prueba activo' : 'Cuenta activa'}</p>
                ${userData.vetStatus === 'trial' ? '<p><small>Tu prueba gratuita termina el ' + formatDate(userData.trialEnds) + '</small></p>' : ''}
                <button class="btn btn-primary" style="margin-top: 1rem;">Ver detalles de suscripción</button>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Módulo de turnos</h3>
                    <span class="card-icon">📅</span>
                </div>
                <p>${userData.vetConfig?.appointmentsEnabled ? '✅ ACTIVADO' : '❌ DESACTIVADO'}</p>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="loadSection('vet-settings')">Configurar</button>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Mascotas autorizadas</h3>
                    <span class="card-icon">🐕</span>
                </div>
                <p>${vetAuthorizedPets.length} mascota${vetAuthorizedPets.length !== 1 ? 's' : ''} autorizada${vetAuthorizedPets.length !== 1 ? 's' : ''}</p>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="loadSection('vet-pets')">Ver mascotas</button>
            </div>
        </div>
        
        <div class="card" style="margin-top: 2rem;">
            <div class="card-header">
                <h3 class="card-title">Acciones rápidas</h3>
            </div>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="loadSection('search-pets')">Buscar mascota</button>
                <button class="btn btn-primary" onclick="showNewMedicalRecordModal()">Cargar historial</button>
                <button class="btn btn-secondary" onclick="loadSection('vet-appointments')">Gestionar turnos</button>
                <button class="btn btn-secondary" onclick="loadSection('vet-settings')">Configuración</button>
            </div>
        </div>
    `;
    
    contentContainer.innerHTML = html;
}

// ==================== TURNOS (VET) ====================
async function loadVetAppointments() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Turnos</h1>
            <p class="content-subtitle">Gestiona los turnos de tu consultorio</p>
        </div>
        
        <div class="card" style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3>Módulo de turnos</h3>
                    <p>${userData.vetConfig?.appointmentsEnabled ? '✅ Los dueños pueden solicitar turnos' : '❌ Turnos desactivados'}</p>
                </div>
                <div>
                    <label class="form-label" style="display: inline-block; margin-right: 1rem;">
                        <input type="checkbox" id="toggle-appointments" ${userData.vetConfig?.appointmentsEnabled ? 'checked' : ''} onchange="toggleAppointmentsModule(this.checked)"> Activar turnos
                    </label>
                    <button class="btn btn-primary" onclick="loadSection('vet-settings')">Configurar horarios</button>
                </div>
            </div>
        </div>
    `;
    
    if (userData.vetConfig?.appointmentsEnabled) {
        const today = new Date();
        const todayAppointments = vetAppointments.filter(a => isToday(new Date(a.dateTime)));
        const upcomingAppointments = vetAppointments.filter(a => new Date(a.dateTime) > today && !isToday(new Date(a.dateTime)));
        
        html += `
            <div class="cards-grid">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Turnos de hoy</h3>
                        <span class="card-icon">📅</span>
                    </div>
                    <p>${todayAppointments.length} turno${todayAppointments.length !== 1 ? 's' : ''} programado${todayAppointments.length !== 1 ? 's' : ''}</p>
                    <div style="max-height: 200px; overflow-y: auto; margin-top: 1rem;">
                        ${todayAppointments.map(appointment => `
                            <div style="padding: 0.5rem; border-bottom: 1px solid var(--gray-light);">
                                <div style="display: flex; justify-content: space-between;">
                                    <span><strong>${formatTime(appointment.dateTime)}</strong></span>
                                    <span class="appointment-status appointment-${appointment.status}">
                                        ${getAppointmentStatusText(appointment.status)}
                                    </span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.3rem;">
                                    <span style="font-size: 1.2rem;">${getPetEmoji(appointment.pet?.species || '')}</span>
                                    <div>
                                        <p style="font-size: 0.9rem; margin-bottom: 0.2rem;"><strong>${appointment.pet?.name || 'Mascota'}</strong></p>
                                        <p style="font-size: 0.8rem; color: var(--gray);">${appointment.owner?.displayName || 'Dueño'}</p>
                                    </div>
                                </div>
                                <div style="margin-top: 0.5rem; display: flex; gap: 0.3rem;">
                                    <button class="btn btn-success" onclick="confirmAppointment('${appointment.id}')" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">✓</button>
                                    <button class="btn btn-danger" onclick="cancelAppointment('${appointment.id}')" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">✗</button>
                                    <button class="btn btn-secondary" onclick="completeAppointment('${appointment.id}')" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">✔</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Próximos turnos</h3>
                        <span class="card-icon">⏳</span>
                    </div>
                    <p>${upcomingAppointments.length} turno${upcomingAppointments.length !== 1 ? 's' : ''} programado${upcomingAppointments.length !== 1 ? 's' : ''}</p>
                    <div style="max-height: 200px; overflow-y: auto; margin-top: 1rem;">
                        ${upcomingAppointments.slice(0, 5).map(appointment => `
                            <div style="padding: 0.5rem; border-bottom: 1px solid var(--gray-light);">
                                <div style="display: flex; justify-content: space-between;">
                                    <span><strong>${formatDateTime(appointment.dateTime)}</strong></span>
                                    <span class="appointment-status appointment-${appointment.status}">
                                        ${getAppointmentStatusText(appointment.status)}
                                    </span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.3rem;">
                                    <span style="font-size: 1.2rem;">${getPetEmoji(appointment.pet?.species || '')}</span>
                                    <div>
                                        <p style="font-size: 0.9rem; margin-bottom: 0.2rem;"><strong>${appointment.pet?.name || 'Mascota'}</strong></p>
                                        <p style="font-size: 0.8rem; color: var(--gray);">${appointment.owner?.displayName || 'Dueño'}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <h3>Turnos desactivados</h3>
                <p>Activa el módulo de turnos para que los dueños puedan solicitar turnos en tu consultorio.</p>
                <button class="btn btn-primary" onclick="toggleAppointmentsModule(true)" style="margin-top: 1rem;">Activar turnos</button>
            </div>
        `;
    }
    
    contentContainer.innerHTML = html;
}

// ==================== BUSCAR MASCOTAS (VET) ====================
async function loadSearchPets() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Buscar Mascotas</h1>
            <p class="content-subtitle">Busca mascotas autorizadas o solicita acceso</p>
        </div>
        
        <div class="card" style="margin-bottom: 1.5rem;">
            <div class="form-group">
                <label class="form-label">Buscar por:</label>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <input type="text" id="search-pet-name" class="form-control" placeholder="Nombre de la mascota" style="flex: 1;">
                    <input type="text" id="search-owner-name" class="form-control" placeholder="Nombre del dueño" style="flex: 1;">
                    <input type="text" id="search-owner-phone" class="form-control" placeholder="Teléfono del dueño" style="flex: 1;">
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button class="btn btn-primary" onclick="searchPets()">🔍 Buscar</button>
                    <button class="btn btn-secondary" onclick="clearSearch()">Limpiar</button>
                </div>
            </div>
        </div>
        
        <div id="search-results">
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>Realiza una búsqueda</h3>
                <p>Busca mascotas por nombre, dueño o teléfono para ver su historial médico (si estás autorizado) o solicitar acceso.</p>
            </div>
        </div>
    `;
    
    contentContainer.innerHTML = html;
}

// ==================== MASCOTAS AUTORIZADAS (VET) ====================
async function loadVetPets() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Mascotas Autorizadas</h1>
            <p class="content-subtitle">Mascotas que han autorizado a tu veterinaria</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3>${vetAuthorizedPets.length} mascota${vetAuthorizedPets.length !== 1 ? 's' : ''} autorizada${vetAuthorizedPets.length !== 1 ? 's' : ''}</h3>
            <button class="btn btn-primary" onclick="loadSection('search-pets')">Buscar más mascotas</button>
        </div>
    `;
    
    if (vetAuthorizedPets.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">🐕</div>
                <h3>No hay mascotas autorizadas</h3>
                <p>Los dueños deben autorizar a tu veterinaria para acceder al historial de sus mascotas.</p>
                <button class="btn btn-primary" onclick="loadSection('search-pets')" style="margin-top: 1rem;">Buscar mascotas</button>
            </div>
        `;
    } else {
        vetAuthorizedPets.forEach(pet => {
            html += `
                <div class="pet-profile">
                    <div class="pet-avatar">
                        ${getPetEmoji(pet.species)}
                    </div>
                    <div class="pet-info" style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <h3>${pet.name}</h3>
                                <p>${pet.species} ${pet.breed ? `- ${pet.breed}` : ''}</p>
                                <p>Dueño: ${pet.owner?.displayName || 'No disponible'}</p>
                                ${pet.birthdate ? `<p><small>Nacimiento: ${formatDate(pet.birthdate)}</small></p>` : ''}
                            </div>
                            <div style="display: flex; gap: 0.3rem;">
                                <button class="btn btn-primary" onclick="showNewMedicalRecordModal('${pet.petId}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Cargar historial</button>
                                <button class="btn btn-secondary" onclick="viewPetMedicalHistory('${pet.petId}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Ver historial</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    contentContainer.innerHTML = html;
}

// ==================== CONFIGURACIÓN DE VETERINARIA ====================
async function loadVetSettings() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Configuración</h1>
            <p class="content-subtitle">Personaliza tu experiencia en la plataforma</p>
        </div>
        
        <div class="tabs">
            <div class="tab active" data-tab="general">General</div>
            <div class="tab" data-tab="appointments">Turnos</div>
            <div class="tab" data-tab="notifications">Notificaciones</div>
        </div>
        
        <div class="tab-content active" id="general-tab">
            <div class="card">
                <h3 style="margin-bottom: 1rem;">Información de la veterinaria</h3>
                
                <div class="form-group">
                    <label class="form-label" for="vet-name">Nombre de la veterinaria *</label>
                    <input type="text" id="vet-name" class="form-control" value="${userData.vetInfo?.name || ''}" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="vet-phone">Teléfono *</label>
                    <input type="tel" id="vet-phone" class="form-control" value="${userData.vetInfo?.phone || ''}" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="vet-address">Dirección</label>
                    <input type="text" id="vet-address" class="form-control" value="${userData.vetInfo?.address || ''}">
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="vet-city">Ciudad</label>
                    <input type="text" id="vet-city" class="form-control" value="${userData.vetInfo?.city || ''}">
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="vet-specialties">Especialidades</label>
                    <input type="text" id="vet-specialties" class="form-control" value="${userData.vetInfo?.specialties || ''}" placeholder="Ej: Cirugía, Dermatología, Odontología">
                    <small>Separa las especialidades con comas</small>
                </div>
                
                <button class="btn btn-primary" onclick="saveVetInfo()">Guardar cambios</button>
            </div>
        </div>
        
        <div class="tab-content" id="appointments-tab">
            <div class="card">
                <h3 style="margin-bottom: 1rem;">Configuración de turnos</h3>
                
                <div class="form-group">
                    <label class="form-label" style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="enable-appointments" ${userData.vetConfig?.appointmentsEnabled ? 'checked' : ''}> Activar módulo de turnos
                    </label>
                    <small>Cuando está activado, los dueños pueden solicitar turnos en tu consultorio.</small>
                </div>
                
                <div id="appointments-settings" style="${userData.vetConfig?.appointmentsEnabled ? '' : 'display: none;'}">
                    <div class="form-group">
                        <label class="form-label">Duración de turnos (minutos)</label>
                        <select id="appointment-duration" class="form-control">
                            <option value="15" ${userData.vetConfig?.appointmentDuration === 15 ? 'selected' : ''}>15 minutos</option>
                            <option value="30" ${(!userData.vetConfig?.appointmentDuration || userData.vetConfig?.appointmentDuration === 30) ? 'selected' : ''}>30 minutos</option>
                            <option value="45" ${userData.vetConfig?.appointmentDuration === 45 ? 'selected' : ''}>45 minutos</option>
                            <option value="60" ${userData.vetConfig?.appointmentDuration === 60 ? 'selected' : ''}>60 minutos</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Días laborables</label>
                        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                            ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day, i) => `
                                <label style="display: flex; align-items: center; gap: 5px;">
                                    <input type="checkbox" value="${i}" ${userData.vetConfig?.workDays?.includes(i) !== false ? 'checked' : ''}> ${day}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Horario de atención</label>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <input type="time" id="work-start" class="form-control" value="${userData.vetConfig?.workStart || '09:00'}">
                            <span>a</span>
                            <input type="time" id="work-end" class="form-control" value="${userData.vetConfig?.workEnd || '18:00'}">
                        </div>
                    </div>
                </div>
                
                <button class="btn btn-primary" onclick="saveAppointmentsConfig()">Guardar configuración</button>
            </div>
        </div>
    `;
    
    contentContainer.innerHTML = html;
    
    // Configurar pestañas
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Remover activo de todas las pestañas
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Activar pestaña clickeada
            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            const tabContent = document.getElementById(`${tabId}-tab`);
            if (tabContent) tabContent.classList.add('active');
        });
    });
    
    // Toggle configuración de turnos
    const enableAppointments = document.getElementById('enable-appointments');
    if (enableAppointments) {
        enableAppointments.addEventListener('change', function() {
            const appointmentsSettings = document.getElementById('appointments-settings');
            if (appointmentsSettings) {
                appointmentsSettings.style.display = this.checked ? 'block' : 'none';
            }
        });
    }
}

// ==================== LISTA PÚBLICA DE VETERINARIAS ====================
async function loadVetsList() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Veterinarias</h1>
            <p class="content-subtitle">Encuentra veterinarias cerca de ti y autorízalas para acceder al historial de tus mascotas</p>
        </div>
        
        <div class="card" style="margin-bottom: 1.5rem;">
            <div class="form-group">
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <input type="text" id="filter-vet-name" class="form-control" placeholder="Nombre de la veterinaria" style="flex: 1;">
                    <input type="text" id="filter-vet-city" class="form-control" placeholder="Ciudad" style="flex: 1;">
                    <input type="text" id="filter-vet-specialty" class="form-control" placeholder="Especialidad" style="flex: 1;">
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button class="btn btn-primary" onclick="filterVets()">🔍 Buscar</button>
                    <button class="btn btn-secondary" onclick="clearVetFilters()">Limpiar filtros</button>
                </div>
            </div>
        </div>
        
        <div id="vets-list-container">
            <div class="loading">
                <div class="spinner"></div>
                <p>Cargando veterinarias...</p>
            </div>
        </div>
    `;
    
    contentContainer.innerHTML = html;
    
    // Cargar veterinarias
    await loadAllVets();
}

// ==================== IMPACTO SOCIAL ====================
async function loadSocialImpact() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Impacto Social</h1>
            <p class="content-subtitle">Tu uso ayuda a financiar refugios de animales</p>
        </div>
        
        <div class="card" style="margin-bottom: 1.5rem; text-align: center;">
            <h2 style="color: var(--primary); margin-bottom: 1rem;">❤️ Cada uso ayuda a otros animales</h2>
            <p>El 20% de cada suscripción de veterinaria se destina directamente a refugios de animales asociados.</p>
        </div>
        
        <div class="cards-grid">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Financiamiento generado</h3>
                    <span class="card-icon">💰</span>
                </div>
                <h2 style="font-size: 2.5rem; color: var(--success);">$15.250</h2>
                <p>Total destinado a refugios este mes</p>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Animales ayudados</h3>
                    <span class="card-icon">🐕</span>
                </div>
                <h2 style="font-size: 2.5rem; color: var(--success);">127</h2>
                <p>Animales en refugios beneficiados</p>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Veterinarias participantes</h3>
                    <span class="card-icon">🏥</span>
                </div>
                <h2 style="font-size: 2.5rem; color: var(--success);">${allVets.length}</h2>
                <p>Veterinarias generando impacto</p>
            </div>
        </div>
        
        <div class="card" style="margin-top: 2rem;">
            <h3 style="margin-bottom: 1rem;">Refugios beneficiados</h3>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Refugio</th>
                            <th>Ubicación</th>
                            <th>Animales</th>
                            <th>Contribución mensual</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Refugio Patitas Felices</strong></td>
                            <td>Buenos Aires</td>
                            <td>45 perros, 20 gatos</td>
                            <td>$5.250</td>
                        </tr>
                        <tr>
                            <td><strong>Hogar de Mascotas</strong></td>
                            <td>Córdoba</td>
                            <td>30 perros, 15 gatos</td>
                            <td>$3.800</td>
                        </tr>
                        <tr>
                            <td><strong>Amigos de los Animales</strong></td>
                            <td>Mendoza</td>
                            <td>25 perros, 12 gatos</td>
                            <td>$2.900</td>
                        </tr>
                        <tr>
                            <td><strong>Refugio San Roque</strong></td>
                            <td>Santa Fe</td>
                            <td>35 perros, 10 gatos</td>
                            <td>$3.300</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="card" style="margin-top: 2rem; text-align: center;">
            <h3>Tu contribución</h3>
            <p>Como dueño de mascota, cada vez que usas el sistema y autorizas veterinarias, estás contribuyendo indirectamente a este impacto social.</p>
            <p><strong>¡Gracias por ser parte del cambio!</strong></p>
        </div>
    `;
    
    contentContainer.innerHTML = html;
}

// ==================== PANEL ADMIN ====================
async function loadAdminDashboard() {
    let html = `
        <div class="content-header">
            <h1 class="content-title">Panel de Administración</h1>
            <p class="content-subtitle">Acceso completo al sistema - Usa con responsabilidad</p>
        </div>
        
        <div class="alert alert-warning">
            <span>⚠️</span>
            <div>
                <strong>Acceso de super administrador</strong>
                <p>Tienes acceso completo a todos los datos del sistema. Para gestionar veterinarias, usuarios y mascotas, utiliza el panel de administración completo.</p>
            </div>
        </div>
        
        <div class="cards-grid">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Panel Admin Completo</h3>
                    <span class="card-icon">🛡️</span>
                </div>
                <p>Accede al panel de administración completo con todas las funcionalidades.</p>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.location.href='/admin.html'">Ir al panel admin</button>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Documentación</h3>
                    <span class="card-icon">📚</span>
                </div>
                <p>Consulta la documentación del sistema y guías de administración.</p>
                <button class="btn btn-secondary" style="margin-top: 1rem;">Ver documentación</button>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Auditoría</h3>
                    <span class="card-icon">📋</span>
                </div>
                <p>Revisa el log de acciones administrativas.</p>
                <button class="btn btn-secondary" style="margin-top: 1rem;">Ver logs</button>
            </div>
        </div>
    `;
    
    contentContainer.innerHTML = html;
}

// ==================== FUNCIONES AUXILIARES ====================

// Cargar todas las veterinarias (VERSIÓN CORREGIDA)
async function loadAllVets() {
    try {
        console.log('Cargando todas las veterinarias...');
        
        // Intentamos cargar de varias formas:
        // 1. Primero desde vet_info (que siempre existe para veterinarias)
        const vetInfoSnapshot = await db.collection('vet_info').get();
        
        allVets = [];
        
        for (const doc of vetInfoSnapshot.docs) {
            try {
                const vetInfo = doc.data();
                const vetId = doc.id;
                
                // Obtener datos del usuario
                const userDoc = await db.collection('users').doc(vetId).get();
                let userData = {};
                
                if (userDoc.exists) {
                    userData = userDoc.data();
                } else {
                    // Si no existe en users, crear datos básicos
                    userData = {
                        displayName: vetInfo.name || 'Veterinaria',
                        email: vetInfo.email || 'sin-email@ejemplo.com',
                        userType: 'vet'
                    };
                }
                
                // Obtener configuración
                const vetConfigDoc = await db.collection('vet_config').doc(vetId).get();
                let vetConfig = {};
                
                if (vetConfigDoc.exists) {
                    vetConfig = vetConfigDoc.data();
                } else {
                    vetConfig = {
                        appointmentsEnabled: false,
                        appointmentDuration: 30,
                        workDays: [1, 2, 3, 4, 5],
                        workStart: '09:00',
                        workEnd: '18:00'
                    };
                }
                
                // Añadir a la lista
                allVets.push({
                    uid: vetId,
                    ...userData,
                    vetInfo: vetInfo,
                    vetConfig: vetConfig,
                    vetStatus: vetInfo.status || 'active'
                });
                
            } catch (error) {
                console.error('Error procesando veterinaria:', doc.id, error);
            }
        }
        
        console.log(`${allVets.length} veterinarias cargadas desde vet_info`);
        
        // 2. También cargar desde users donde userType = 'vet' (por si acaso)
        try {
            const vetsSnapshot = await db.collection('users')
                .where('userType', '==', 'vet')
                .get();
            
            for (const doc of vetsSnapshot.docs) {
                const vetId = doc.id;
                const userData = doc.data();
                
                // Verificar si ya está en la lista
                const alreadyInList = allVets.some(vet => vet.uid === vetId);
                if (!alreadyInList) {
                    // Obtener información de veterinaria
                    let vetInfo = {};
                    const vetInfoDoc = await db.collection('vet_info').doc(vetId).get();
                    if (vetInfoDoc.exists) {
                        vetInfo = vetInfoDoc.data();
                    }
                    
                    // Obtener configuración
                    let vetConfig = {};
                    const vetConfigDoc = await db.collection('vet_config').doc(vetId).get();
                    if (vetConfigDoc.exists) {
                        vetConfig = vetConfigDoc.data();
                    }
                    
                    allVets.push({
                        uid: vetId,
                        ...userData,
                        vetInfo: vetInfo,
                        vetConfig: vetConfig,
                        vetStatus: userData.vetStatus || 'active'
                    });
                }
            }
            console.log(`${allVets.length} veterinarias en total después de combinar`);
            
        } catch (error) {
            console.error('Error cargando veterinarias desde users:', error);
        }
        
        // Renderizar la lista
        renderVetsList(allVets);
        
    } catch (error) {
        console.error('Error al cargar veterinarias:', error);
        const container = document.getElementById('vets-list-container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏥</div>
                    <h3>Error al cargar veterinarias</h3>
                    <p>${error.message}</p>
                    <button onclick="loadAllVets()" class="btn btn-primary" style="margin-top: 1rem;">Reintentar</button>
                </div>
            `;
        }
    }
}

// Renderizar lista de veterinarias (VERSIÓN CORREGIDA)
function renderVetsList(vets) {
    const container = document.getElementById('vets-list-container');
    if (!container) {
        console.error('No se encontró el contenedor vets-list-container');
        return;
    }
    
    if (vets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏥</div>
                <h3>No se encontraron veterinarias</h3>
                <p>No hay veterinarias registradas en el sistema o no se pudieron cargar.</p>
                <button onclick="loadAllVets()" class="btn btn-primary" style="margin-top: 1rem;">Reintentar carga</button>
            </div>
        `;
        return;
    }
    
    let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem;">
    `;
    
    vets.forEach(vet => {
        const isAuthorized = authorizedVets.some(authVet => authVet.uid === vet.uid);
        const vetName = vet.vetInfo?.name || vet.displayName || 'Veterinaria';
        const vetAddress = vet.vetInfo?.address || 'Sin dirección';
        const vetPhone = vet.vetInfo?.phone || 'Sin teléfono';
        const vetCity = vet.vetInfo?.city || '';
        const vetSpecialties = vet.vetInfo?.specialties || '';
        const appointmentsEnabled = vet.vetConfig?.appointmentsEnabled;
        const vetStatus = vet.vetStatus || 'active';
        
        html += `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">${vetName}</h3>
                    <span class="status-badge ${vetStatus === 'trial' ? 'status-trial' : 'status-active'}">
                        ${vetStatus === 'trial' ? 'Prueba' : 'Activa'}
                    </span>
                </div>
                
                <p><strong>📞 ${vetPhone}</strong></p>
                <p>${vetAddress}</p>
                ${vetCity ? `<p>${vetCity}</p>` : ''}
                
                ${vetSpecialties ? `
                    <div style="margin-top: 0.5rem;">
                        <strong>Especialidades:</strong>
                        <p>${vetSpecialties}</p>
                    </div>
                ` : ''}
                
                <div style="margin-top: 1rem;">
                    <p><strong>Turnos:</strong> ${appointmentsEnabled ? '✅ Disponibles' : '❌ No disponibles'}</p>
                </div>
                
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    ${isAuthorized ? 
                        `<button class="btn btn-success" style="flex: 1;" disabled>✅ Autorizada</button>` :
                        `<button class="btn btn-primary" style="flex: 1;" onclick="authorizeVet('${vet.uid}')">Autorizar acceso</button>`
                    }
                    <button class="btn btn-secondary" onclick="viewVetDetails('${vet.uid}')">Ver detalles</button>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

// Mostrar modal de autorización veterinaria (VERSIÓN CORREGIDA)
async function showAuthVetModal() {
    try {
        // Cargar veterinarias si no están cargadas
        if (allVets.length === 0) {
            await loadAllVets();
        }
        
        // Verificar que hay veterinarias
        if (allVets.length === 0) {
            const vetSearchResults = document.getElementById('vet-search-results');
            if (vetSearchResults) {
                vetSearchResults.innerHTML = `
                    <div class="empty-state" style="padding: 2rem;">
                        <div class="empty-icon">🏥</div>
                        <h3>No hay veterinarias registradas</h3>
                        <p>Actualmente no hay veterinarias disponibles para autorizar.</p>
                        <button onclick="loadAllVets()" class="btn btn-primary" style="margin-top: 1rem;">Buscar veterinarias</button>
                    </div>
                `;
            }
            authVetModal.classList.add('active');
            return;
        }
        
        // Filtrar veterinarias no autorizadas
        const unauthorizedVets = allVets.filter(vet => 
            !authorizedVets.some(authVet => authVet.uid === vet.uid)
        );
        
        const vetSearchResults = document.getElementById('vet-search-results');
        if (!vetSearchResults) return;
        
        let html = '';
        
        if (unauthorizedVets.length === 0) {
            html = `
                <div class="empty-state" style="padding: 2rem;">
                    <div class="empty-icon">🏥</div>
                    <h3>Todas las veterinarias ya están autorizadas</h3>
                    <p>Has autorizado acceso a todas las veterinarias disponibles.</p>
                    <button onclick="loadSection('vets-list')" class="btn btn-primary" style="margin-top: 1rem;">Ver todas las veterinarias</button>
                </div>
            `;
        } else {
            html = `
                <div style="display: grid; gap: 1rem;">
                    <div class="alert alert-info">
                        <span>ℹ️</span>
                        <div>
                            <strong>${unauthorizedVets.length} veterinaria${unauthorizedVets.length !== 1 ? 's' : ''} disponible${unauthorizedVets.length !== 1 ? 's' : ''}</strong>
                            <p>Selecciona una veterinaria para autorizar el acceso al historial de tus mascotas.</p>
                        </div>
                    </div>
            `;
            
            unauthorizedVets.forEach(vet => {
                const vetName = vet.vetInfo?.name || vet.displayName || 'Veterinaria';
                const vetAddress = vet.vetInfo?.address || 'Sin dirección';
                const vetPhone = vet.vetInfo?.phone || 'Sin teléfono';
                const vetCity = vet.vetInfo?.city || '';
                
                html += `
                    <div class="card" style="margin: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1;">
                                <h4 style="margin-bottom: 0.3rem;">${vetName}</h4>
                                <p style="margin-bottom: 0.3rem; color: var(--gray); font-size: 0.9rem;">${vetAddress}</p>
                                ${vetCity ? `<p style="margin-bottom: 0.3rem; color: var(--gray); font-size: 0.9rem;">📍 ${vetCity}</p>` : ''}
                                <p style="margin-bottom: 0.3rem; color: var(--gray); font-size: 0.9rem;">📞 ${vetPhone}</p>
                                <p style="margin-bottom: 0.3rem; color: var(--gray); font-size: 0.9rem;">
                                    ${vet.vetConfig?.appointmentsEnabled ? '✅ Turnos disponibles' : '❌ Turnos no disponibles'}
                                </p>
                            </div>
                            <button class="btn btn-primary" onclick="authorizeVet('${vet.uid}')" style="margin-left: 1rem;">Autorizar</button>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
        }
        
        vetSearchResults.innerHTML = html;
        authVetModal.classList.add('active');
        
    } catch (error) {
        console.error('Error al mostrar modal de autorización:', error);
        const vetSearchResults = document.getElementById('vet-search-results');
        if (vetSearchResults) {
            vetSearchResults.innerHTML = `
                <div class="alert alert-danger">
                    <span>❌</span>
                    <div>
                        <strong>Error al cargar veterinarias</strong>
                        <p>${error.message}</p>
                        <button onclick="showAuthVetModal()" class="btn btn-primary" style="margin-top: 1rem;">Reintentar</button>
                    </div>
                </div>
            `;
        }
        authVetModal.classList.add('active');
    }
}

// ==================== FUNCIONES DE MASCOTAS ====================

// Guardar mascota desde formulario
async function savePetFromForm() {
    const petData = {
        name: document.getElementById('add-pet-name').value,
        species: document.getElementById('add-pet-species').value,
        breed: document.getElementById('add-pet-breed').value,
        birthdate: document.getElementById('add-pet-birthdate').value || null,
        color: document.getElementById('add-pet-color').value,
        microchip: document.getElementById('add-pet-microchip').value,
        notes: document.getElementById('add-pet-notes').value,
        ownerId: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (!petData.name || !petData.species) {
        showMessage('Nombre y especie son requeridos', 'error');
        return;
    }
    
    try {
        console.log('Guardando mascota...', petData);
        await db.collection('pets').add(petData);
        
        // Recargar datos y volver a lista
        await loadOwnerData(currentUser.uid);
        loadSection('pets');
        
        showMessage('Mascota registrada correctamente', 'success');
        
    } catch (error) {
        console.error('Error al guardar mascota:', error);
        showMessage('Error al guardar mascota', 'error');
    }
}

// Editar mascota
async function editPet(petId) {
    const pet = pets.find(p => p.id === petId);
    if (!pet) return;
    
    // Rellenar formulario
    document.getElementById('pet-name').value = pet.name;
    document.getElementById('pet-species').value = pet.species;
    document.getElementById('pet-breed').value = pet.breed || '';
    document.getElementById('pet-birthdate').value = pet.birthdate || '';
    document.getElementById('pet-color').value = pet.color || '';
    document.getElementById('pet-microchip').value = pet.microchip || '';
    document.getElementById('pet-notes').value = pet.notes || '';
    document.getElementById('pet-id').value = petId;
    document.getElementById('pet-modal-title').textContent = 'Editar Mascota';
    
    petModal.classList.add('active');
}

// Guardar mascota (desde modal)
async function handleSavePet() {
    const petId = document.getElementById('pet-id').value;
    const petData = {
        name: document.getElementById('pet-name').value,
        species: document.getElementById('pet-species').value,
        breed: document.getElementById('pet-breed').value,
        birthdate: document.getElementById('pet-birthdate').value || null,
        color: document.getElementById('pet-color').value,
        microchip: document.getElementById('pet-microchip').value,
        notes: document.getElementById('pet-notes').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (!petData.name || !petData.species) {
        showMessage('Nombre y especie son requeridos', 'error');
        return;
    }
    
    try {
        if (petId) {
            // Actualizar mascota existente
            console.log('Actualizando mascota:', petId, petData);
            await db.collection('pets').doc(petId).update(petData);
            showMessage('Mascota actualizada correctamente', 'success');
        } else {
            // Crear nueva mascota
            petData.ownerId = currentUser.uid;
            petData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            console.log('Creando nueva mascota:', petData);
            await db.collection('pets').add(petData);
            showMessage('Mascota registrada correctamente', 'success');
        }
        
        // Recargar datos
        await loadOwnerData(currentUser.uid);
        petModal.classList.remove('active');
        loadSection('pets');
        
    } catch (error) {
        console.error('Error al guardar mascota:', error);
        showMessage('Error al guardar mascota', 'error');
    }
}

// Ver detalles de mascota
async function viewPetDetails(petId) {
    const pet = pets.find(p => p.id === petId);
    if (!pet) return;
    
    // Cargar historial médico de esta mascota
    const petMedicalRecords = medicalRecords.filter(r => r.petId === petId);
    const petAppointments = appointments.filter(a => a.petId === petId);
    
    let html = `
        <div class="content-header">
            <h1 class="content-title">${pet.name}</h1>
            <p class="content-subtitle">Detalles completos de la mascota</p>
        </div>
        
        <div class="cards-grid">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Información</h3>
                </div>
                <p><strong>Especie:</strong> ${pet.species}</p>
                ${pet.breed ? `<p><strong>Raza:</strong> ${pet.breed}</p>` : ''}
                ${pet.birthdate ? `<p><strong>Nacimiento:</strong> ${formatDate(pet.birthdate)}</p>` : ''}
                ${pet.color ? `<p><strong>Color:</strong> ${pet.color}</p>` : ''}
                ${pet.microchip ? `<p><strong>Microchip:</strong> ${pet.microchip}</p>` : ''}
                ${pet.notes ? `<p><strong>Notas:</strong> ${pet.notes}</p>` : ''}
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Estadísticas</h3>
                </div>
                <p><strong>Registros médicos:</strong> ${petMedicalRecords.length}</p>
                <p><strong>Turnos:</strong> ${petAppointments.length}</p>
                <p><strong>Veterinarias autorizadas:</strong> ${authorizedVets.length}</p>
            </div>
        </div>
        
        <div style="margin-top: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Registros Médicos</h3>
                ${userData.userType === 'vet' ? `
                    <button class="btn btn-primary" onclick="showNewMedicalRecordModal('${petId}')">➕ Nuevo registro</button>
                ` : ''}
            </div>
            
            ${petMedicalRecords.length > 0 ? `
                <div class="cards-grid">
                    ${petMedicalRecords.slice(0, 3).map(record => `
                        <div class="medical-record">
                            <div class="medical-record-header">
                                <div>
                                    <h4 class="medical-record-title">${record.title}</h4>
                                    <p class="medical-record-vet">${record.vet?.displayName || 'Veterinaria'}</p>
                                </div>
                                <div class="medical-record-date">${formatDate(record.date)}</div>
                            </div>
                            <p>${record.description.substring(0, 150)}${record.description.length > 150 ? '...' : ''}</p>
                            <span class="badge badge-info">${record.type}</span>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="empty-state">
                    <p>No hay registros médicos para esta mascota.</p>
                </div>
            `}
        </div>
    `;
    
    contentContainer.innerHTML = html;
}

// ==================== FUNCIONES DE VETERINARIAS ====================

// Autorizar veterinaria
async function authorizeVet(vetId) {
    try {
        console.log('Autorizando veterinaria:', vetId);
        
        // Para cada mascota del dueño, crear autorización
        const authPromises = pets.map(pet => {
            const authData = {
                ownerId: currentUser.uid,
                vetId: vetId,
                petId: pet.id,
                status: 'authorized',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                authorizedBy: currentUser.uid
            };
            
            return db.collection('authorizations').add(authData);
        });
        
        await Promise.all(authPromises);
        
        // Actualizar lista local
        const vetDoc = await db.collection('users').doc(vetId).get();
        if (vetDoc.exists) {
            const vetData = vetDoc.data();
            const vetInfoDoc = await db.collection('vet_info').doc(vetId).get();
            
            authorizedVets.push({
                authId: 'temp',
                uid: vetId,
                ...vetData,
                vetInfo: vetInfoDoc.exists ? vetInfoDoc.data() : {}
            });
        }
        
        // Cerrar modal y recargar sección
        authVetModal.classList.remove('active');
        loadSection('authorized-vets');
        
        showMessage('Veterinaria autorizada correctamente', 'success');
        
    } catch (error) {
        console.error('Error al autorizar veterinaria:', error);
        showMessage('Error al autorizar veterinaria', 'error');
    }
}

// Revocar acceso a veterinaria
async function revokeVetAccess(authId) {
    if (confirm('¿Estás seguro de que quieres revocar el acceso a esta veterinaria? No podrá ver más el historial de tus mascotas.')) {
        try {
            console.log('Revocando acceso a veterinaria:', authId);
            await db.collection('authorizations').doc(authId).delete();
            
            // Actualizar lista local
            authorizedVets = authorizedVets.filter(vet => vet.authId !== authId);
            
            // Recargar sección
            loadSection('authorized-vets');
            
            showMessage('Acceso revocado correctamente', 'success');
            
        } catch (error) {
            console.error('Error al revocar acceso:', error);
            showMessage('Error al revocar acceso', 'error');
        }
    }
}

// Ver detalles de veterinaria
async function viewVetDetails(vetId) {
    try {
        console.log('Viendo detalles de veterinaria:', vetId);
        const vetDoc = await db.collection('users').doc(vetId).get();
        if (!vetDoc.exists) return;
        
        const vetData = vetDoc.data();
        const vetInfoDoc = await db.collection('vet_info').doc(vetId).get();
        const vetInfo = vetInfoDoc.exists ? vetInfoDoc.data() : {};
        
        let html = `
            <div style="text-align: center;">
                <h2 style="margin-bottom: 1rem;">${vetInfo.name || vetData.displayName || 'Veterinaria'}</h2>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1.5rem;">
                    <div style="background-color: #f1f5f9; padding: 1rem; border-radius: 10px;">
                        <strong>📞 Teléfono</strong>
                        <p>${vetInfo.phone || 'No disponible'}</p>
                    </div>
                    
                    <div style="background-color: #f1f5f9; padding: 1rem; border-radius: 10px;">
                        <strong>📍 Dirección</strong>
                        <p>${vetInfo.address || 'No disponible'}</p>
                    </div>
                    
                    <div style="background-color: #f1f5f9; padding: 1rem; border-radius: 10px;">
                        <strong>🏙️ Ciudad</strong>
                        <p>${vetInfo.city || 'No disponible'}</p>
                    </div>
                </div>
                
                ${vetInfo.specialties ? `
                    <div style="margin-top: 1.5rem;">
                        <h4>Especialidades</h4>
                        <p>${vetInfo.specialties}</p>
                    </div>
                ` : ''}
                
                <div style="margin-top: 1.5rem;">
                    <h4>Estado</h4>
                    <span class="status-badge ${vetData.vetStatus === 'trial' ? 'status-trial' : 'status-active'}">
                        ${vetData.vetStatus === 'trial' ? 'Periodo de prueba' : 'Activa'}
                    </span>
                </div>
                
                <div style="margin-top: 1.5rem;">
                    <h4>Turnos</h4>
                    <p>${vetData.vetConfig?.appointmentsEnabled ? '✅ Turnos disponibles' : '❌ Turnos no disponibles'}</p>
                </div>
            </div>
        `;
        
        document.getElementById('vet-details-content').innerHTML = html;
        vetDetailsModal.classList.add('active');
        
    } catch (error) {
        console.error('Error al cargar detalles de veterinaria:', error);
        showMessage('Error al cargar detalles', 'error');
    }
}

// Guardar información de veterinaria
async function saveVetInfo() {
    const vetInfo = {
        name: document.getElementById('vet-name').value,
        phone: document.getElementById('vet-phone').value,
        address: document.getElementById('vet-address').value,
        city: document.getElementById('vet-city').value,
        specialties: document.getElementById('vet-specialties').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (!vetInfo.name || !vetInfo.phone) {
        showMessage('Nombre y teléfono son requeridos', 'error');
        return;
    }
    
    try {
        console.log('Guardando información de veterinaria:', vetInfo);
        await db.collection('vet_info').doc(currentUser.uid).set(vetInfo, { merge: true });
        
        // Actualizar datos locales
        userData.vetInfo = vetInfo;
        
        showMessage('Información guardada correctamente', 'success');
        
    } catch (error) {
        console.error('Error al guardar información:', error);
        showMessage('Error al guardar información', 'error');
    }
}

// Guardar configuración de turnos
async function saveAppointmentsConfig() {
    const appointmentsEnabled = document.getElementById('enable-appointments').checked;
    
    const workDays = Array.from(document.querySelectorAll('#appointments-settings input[type="checkbox"]:checked'))
        .map(cb => parseInt(cb.value));
    
    const vetConfig = {
        appointmentsEnabled: appointmentsEnabled,
        appointmentDuration: parseInt(document.getElementById('appointment-duration').value) || 30,
        workDays: workDays.length > 0 ? workDays : [1, 2, 3, 4, 5],
        workStart: document.getElementById('work-start').value || '09:00',
        workEnd: document.getElementById('work-end').value || '18:00',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        console.log('Guardando configuración de turnos:', vetConfig);
        await db.collection('vet_config').doc(currentUser.uid).set(vetConfig, { merge: true });
        
        // Actualizar datos locales
        userData.vetConfig = vetConfig;
        
        showMessage('Configuración guardada correctamente', 'success');
        
    } catch (error) {
        console.error('Error al guardar configuración:', error);
        showMessage('Error al guardar configuración', 'error');
    }
}

// Alternar módulo de turnos
async function toggleAppointmentsModule(enabled) {
    try {
        console.log('Alternando módulo de turnos:', enabled);
        await db.collection('vet_config').doc(currentUser.uid).set({
            appointmentsEnabled: enabled,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Actualizar datos locales
        userData.vetConfig.appointmentsEnabled = enabled;
        
        // Recargar sección
        loadSection('vet-appointments');
        
    } catch (error) {
        console.error('Error al alternar módulo:', error);
        showMessage('Error al cambiar configuración', 'error');
    }
}

// ==================== FUNCIONES DE TURNOS ====================

// Mostrar modal para nuevo turno
async function showNewAppointmentModal() {
    // Resetear formulario
    document.getElementById('appointment-form').reset();
    document.getElementById('appointment-id').value = '';
    document.getElementById('appointment-modal-title').textContent = 'Nuevo Turno';
    
    // Cargar mascotas del dueño
    const petSelect = document.getElementById('appointment-pet');
    if (petSelect) {
        petSelect.innerHTML = '<option value="">Seleccionar mascota</option>';
        pets.forEach(pet => {
            petSelect.innerHTML += `<option value="${pet.id}">${pet.name} (${pet.species})</option>`;
        });
    }
    
    // Cargar veterinarias autorizadas
    const vetSelect = document.getElementById('appointment-vet');
    if (vetSelect) {
        vetSelect.innerHTML = '<option value="">Seleccionar veterinaria</option>';
        authorizedVets.forEach(vet => {
            if (vet.vetConfig?.appointmentsEnabled !== false) {
                vetSelect.innerHTML += `<option value="${vet.uid}">${vet.vetInfo?.name || vet.displayName}</option>`;
            }
        });
    }
    
    // Establecer fecha mínima (hoy)
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('appointment-date');
    if (dateInput) dateInput.min = today;
    
    appointmentModal.classList.add('active');
}

// Guardar turno
async function handleSaveAppointment() {
    const appointmentId = document.getElementById('appointment-id').value;
    const petId = document.getElementById('appointment-pet').value;
    const vetId = document.getElementById('appointment-vet').value;
    const date = document.getElementById('appointment-date').value;
    const time = document.getElementById('appointment-time').value;
    const dateTime = new Date(`${date}T${time}`);
    
    if (!petId || !vetId || !date || !time) {
        showMessage('Todos los campos son requeridos', 'error');
        return;
    }
    
    const appointmentData = {
        petId: petId,
        vetId: vetId,
        ownerId: currentUser.uid,
        dateTime: dateTime,
        type: document.getElementById('appointment-type').value,
        reason: document.getElementById('appointment-reason').value,
        notes: document.getElementById('appointment-notes').value,
        status: 'scheduled',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (appointmentId) {
            // Actualizar turno existente
            console.log('Actualizando turno:', appointmentId, appointmentData);
            await db.collection('appointments').doc(appointmentId).update(appointmentData);
            showMessage('Turno actualizado correctamente', 'success');
        } else {
            // Crear nuevo turno
            console.log('Creando nuevo turno:', appointmentData);
            await db.collection('appointments').add(appointmentData);
            showMessage('Turno solicitado correctamente', 'success');
        }
        
        // Recargar datos
        if (userData.userType === 'owner') {
            await loadAppointmentsForOwner(currentUser.uid);
            loadSection('appointments');
        } else {
            await loadAppointmentsForVet(currentUser.uid);
            loadSection('vet-appointments');
        }
        
        appointmentModal.classList.remove('active');
        
    } catch (error) {
        console.error('Error al guardar turno:', error);
        showMessage('Error al guardar turno', 'error');
    }
}

// Editar turno
async function editAppointment(appointmentId) {
    const appointment = userData.userType === 'owner' 
        ? appointments.find(a => a.id === appointmentId)
        : vetAppointments.find(a => a.id === appointmentId);
    
    if (!appointment) return;
    
    // Rellenar formulario
    const dateTime = new Date(appointment.dateTime);
    const date = dateTime.toISOString().split('T')[0];
    const time = dateTime.toTimeString().slice(0, 5);
    
    document.getElementById('appointment-pet').value = appointment.petId;
    document.getElementById('appointment-vet').value = appointment.vetId;
    document.getElementById('appointment-date').value = date;
    document.getElementById('appointment-time').value = time;
    document.getElementById('appointment-type').value = appointment.type;
    document.getElementById('appointment-reason').value = appointment.reason || '';
    document.getElementById('appointment-notes').value = appointment.notes || '';
    document.getElementById('appointment-id').value = appointmentId;
    document.getElementById('appointment-modal-title').textContent = 'Editar Turno';
    
    // Cargar opciones
    if (userData.userType === 'owner') {
        const petSelect = document.getElementById('appointment-pet');
        petSelect.innerHTML = '<option value="">Seleccionar mascota</option>';
        pets.forEach(pet => {
            petSelect.innerHTML += `<option value="${pet.id}" ${pet.id === appointment.petId ? 'selected' : ''}>${pet.name} (${pet.species})</option>`;
        });
        
        const vetSelect = document.getElementById('appointment-vet');
        vetSelect.innerHTML = '<option value="">Seleccionar veterinaria</option>';
        authorizedVets.forEach(vet => {
            vetSelect.innerHTML += `<option value="${vet.uid}" ${vet.uid === appointment.vetId ? 'selected' : ''}>${vet.vetInfo?.name || vet.displayName}</option>`;
        });
    }
    
    appointmentModal.classList.add('active');
}

// Confirmar turno
async function confirmAppointment(appointmentId) {
    try {
        console.log('Confirmando turno:', appointmentId);
        await db.collection('appointments').doc(appointmentId).update({
            status: 'confirmed',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Recargar datos
        if (userData.userType === 'owner') {
            await loadAppointmentsForOwner(currentUser.uid);
            loadSection('appointments');
        } else {
            await loadAppointmentsForVet(currentUser.uid);
            loadSection('vet-appointments');
        }
        
        showMessage('Turno confirmado', 'success');
        
    } catch (error) {
        console.error('Error al confirmar turno:', error);
        showMessage('Error al confirmar turno', 'error');
    }
}

// Cancelar turno
async function cancelAppointment(appointmentId) {
    if (!confirm('¿Estás seguro de que quieres cancelar este turno?')) return;
    
    try {
        console.log('Cancelando turno:', appointmentId);
        await db.collection('appointments').doc(appointmentId).update({
            status: 'cancelled',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Recargar datos
        if (userData.userType === 'owner') {
            await loadAppointmentsForOwner(currentUser.uid);
            loadSection('appointments');
        } else {
            await loadAppointmentsForVet(currentUser.uid);
            loadSection('vet-appointments');
        }
        
        showMessage('Turno cancelado', 'success');
        
    } catch (error) {
        console.error('Error al cancelar turno:', error);
        showMessage('Error al cancelar turno', 'error');
    }
}

// Completar turno (veterinaria)
async function completeAppointment(appointmentId) {
    try {
        console.log('Completando turno:', appointmentId);
        await db.collection('appointments').doc(appointmentId).update({
            status: 'completed',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Recargar datos
        await loadAppointmentsForVet(currentUser.uid);
        loadSection('vet-appointments');
        
        showMessage('Turno marcado como completado', 'success');
        
    } catch (error) {
        console.error('Error al completar turno:', error);
        showMessage('Error al completar turno', 'error');
    }
}

// Ver detalles de turno
async function viewAppointmentDetails(appointmentId) {
    const appointment = userData.userType === 'owner' 
        ? appointments.find(a => a.id === appointmentId)
        : vetAppointments.find(a => a.id === appointmentId);
    
    if (!appointment) return;
    
    let html = `
        <div class="content-header">
            <h1 class="content-title">Detalles del Turno</h1>
            <p class="content-subtitle">${formatDateTime(appointment.dateTime)}</p>
        </div>
        
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                <div>
                    <h3>${appointment.pet?.name || 'Mascota'}</h3>
                    <p>${appointment.vet?.vetInfo?.name || appointment.vet?.displayName || 'Veterinaria'}</p>
                </div>
                <span class="appointment-status appointment-${appointment.status}">
                    ${getAppointmentStatusText(appointment.status)}
                </span>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
                <div>
                    <h4>Información del Turno</h4>
                    <p><strong>Fecha:</strong> ${formatDateTime(appointment.dateTime)}</p>
                    <p><strong>Tipo:</strong> ${getAppointmentTypeText(appointment.type)}</p>
                    ${appointment.reason ? `<p><strong>Motivo:</strong> ${appointment.reason}</p>` : ''}
                    ${appointment.notes ? `<p><strong>Notas:</strong> ${appointment.notes}</p>` : ''}
                </div>
                
                <div>
                    <h4>Información de la Mascota</h4>
                    <p><strong>Nombre:</strong> ${appointment.pet?.name || 'No disponible'}</p>
                    <p><strong>Especie:</strong> ${appointment.pet?.species || 'No disponible'}</p>
                    <p><strong>Raza:</strong> ${appointment.pet?.breed || 'No disponible'}</p>
                </div>
                
                <div>
                    <h4>Información del Veterinario</h4>
                    <p><strong>Nombre:</strong> ${appointment.vet?.vetInfo?.name || appointment.vet?.displayName || 'No disponible'}</p>
                    <p><strong>Teléfono:</strong> ${appointment.vet?.vetInfo?.phone || 'No disponible'}</p>
                    <p><strong>Dirección:</strong> ${appointment.vet?.vetInfo?.address || 'No disponible'}</p>
                </div>
            </div>
        </div>
    `;
    
    contentContainer.innerHTML = html;
}

// ==================== FUNCIONES DE HISTORIAL MÉDICO ====================

// Mostrar modal para nuevo registro médico
async function showNewMedicalRecordModal(petId = null) {
    // Resetear formulario
    document.getElementById('medical-record-form').reset();
    document.getElementById('medical-record-id').value = '';
    document.getElementById('medical-record-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('medical-record-modal-title').textContent = 'Nuevo Registro Médico';
    
    // Cargar mascotas
    const petSelect = document.getElementById('medical-record-pet');
    if (!petSelect) return;
    
    petSelect.innerHTML = '<option value="">Seleccionar mascota</option>';
    
    if (userData.userType === 'vet') {
        // Para veterinaria: mostrar solo mascotas autorizadas
        vetAuthorizedPets.forEach(pet => {
            petSelect.innerHTML += `<option value="${pet.petId}" ${petId === pet.petId ? 'selected' : ''}>${pet.name} (${pet.species}) - Dueño: ${pet.owner?.displayName || 'No disponible'}</option>`;
        });
    } else {
        // Para dueño: mostrar todas sus mascotas (pero dueños no pueden crear registros)
        pets.forEach(pet => {
            petSelect.innerHTML += `<option value="${pet.id}" ${petId === pet.id ? 'selected' : ''}>${pet.name} (${pet.species})</option>`;
        });
        showMessage('Solo las veterinarias pueden crear registros médicos', 'error');
        return;
    }
    
    medicalRecordModal.classList.add('active');
}

// Guardar registro médico
async function handleSaveMedicalRecord() {
    const recordId = document.getElementById('medical-record-id').value;
    const petId = document.getElementById('medical-record-pet').value;
    const title = document.getElementById('medical-record-title').value;
    const description = document.getElementById('medical-record-description').value;
    
    if (!petId || !title || !description) {
        showMessage('Mascota, título y descripción son requeridos', 'error');
        return;
    }
    
    const recordData = {
        petId: petId,
        vetId: currentUser.uid,
        title: title,
        date: document.getElementById('medical-record-date').value,
        type: document.getElementById('medical-record-type').value,
        description: description,
        prescription: document.getElementById('medical-record-prescription').value || null,
        nextVisit: document.getElementById('medical-record-next-visit').value || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (recordId) {
            // Actualizar registro existente
            console.log('Actualizando registro médico:', recordId, recordData);
            await db.collection('medical_records').doc(recordId).update(recordData);
            showMessage('Registro actualizado correctamente', 'success');
        } else {
            // Crear nuevo registro
            recordData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            console.log('Creando nuevo registro médico:', recordData);
            await db.collection('medical_records').add(recordData);
            showMessage('Registro médico guardado correctamente', 'success');
        }
        
        // Recargar datos
        if (userData.userType === 'owner') {
            await loadMedicalRecordsForOwner(currentUser.uid);
        } else {
            // Para veterinarios, recargar datos de veterinaria
            await loadAuthorizedPetsForVet(currentUser.uid);
        }
        
        medicalRecordModal.classList.remove('active');
        loadSection('medical-history');
        
    } catch (error) {
        console.error('Error al guardar registro médico:', error);
        showMessage('Error al guardar registro médico', 'error');
    }
}

// Editar registro médico
async function editMedicalRecord(recordId) {
    const record = medicalRecords.find(r => r.id === recordId);
    if (!record) return;
    
    // Rellenar formulario
    document.getElementById('medical-record-pet').value = record.petId;
    document.getElementById('medical-record-title').value = record.title;
    document.getElementById('medical-record-date').value = record.date;
    document.getElementById('medical-record-type').value = record.type;
    document.getElementById('medical-record-description').value = record.description;
    document.getElementById('medical-record-prescription').value = record.prescription || '';
    document.getElementById('medical-record-next-visit').value = record.nextVisit || '';
    document.getElementById('medical-record-id').value = recordId;
    document.getElementById('medical-record-modal-title').textContent = 'Editar Registro Médico';
    
    medicalRecordModal.classList.add('active');
}

// Ver historial médico de mascota (veterinaria)
async function viewPetMedicalHistory(petId) {
    // Cargar registros médicos de esta mascota
    const recordsSnapshot = await db.collection('medical_records')
        .where('petId', '==', petId)
        .orderBy('date', 'desc')
        .get();
    
    const petRecords = [];
    for (const doc of recordsSnapshot.docs) {
        const recordData = doc.data();
        const vetDoc = await db.collection('users').doc(recordData.vetId).get();
        
        petRecords.push({
            id: doc.id,
            ...recordData,
            vet: vetDoc.exists ? vetDoc.data() : null
        });
    }
    
    const pet = vetAuthorizedPets.find(p => p.petId === petId);
    
    let html = `
        <div class="content-header">
            <h1 class="content-title">Historial Médico</h1>
            <p class="content-subtitle">${pet?.name || 'Mascota'}</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
                <h3>${petRecords.length} registro${petRecords.length !== 1 ? 's' : ''} médico${petRecords.length !== 1 ? 's' : ''}</h3>
                <p>Dueño: ${pet?.owner?.displayName || 'No disponible'}</p>
            </div>
            <button class="btn btn-primary" onclick="showNewMedicalRecordModal('${petId}')">➕ Nuevo registro</button>
        </div>
    `;
    
    if (petRecords.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">🏥</div>
                <h3>No hay registros médicos</h3>
                <p>Comienza cargando el primer registro médico para esta mascota.</p>
            </div>
        `;
    } else {
        html += `
            <div class="timeline">
        `;
        
        petRecords.forEach(record => {
            html += `
                <div class="timeline-item">
                    <div class="medical-record">
                        <div class="medical-record-header">
                            <div>
                                <h4 class="medical-record-title">${record.title}</h4>
                                <p class="medical-record-vet">${record.vet?.displayName || 'Veterinaria'}</p>
                            </div>
                            <div class="medical-record-date">${formatDate(record.date)}</div>
                        </div>
                        <p style="margin-bottom: 0.5rem;">${record.description}</p>
                        ${record.prescription ? `<p><strong>Prescripción:</strong> ${record.prescription}</p>` : ''}
                        ${record.nextVisit ? `<p><strong>Próxima visita:</strong> ${formatDate(record.nextVisit)}</p>` : ''}
                        <span class="badge badge-info">${getRecordTypeText(record.type)}</span>
                        <div style="margin-top: 0.5rem;">
                            <button class="btn btn-secondary" onclick="editMedicalRecord('${record.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Editar</button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    contentContainer.innerHTML = html;
}

// ==================== FUNCIONES DE BÚSQUEDA ====================

// Buscar mascotas (para veterinaria)
async function searchPets() {
    const petName = document.getElementById('search-pet-name').value.toLowerCase();
    const ownerName = document.getElementById('search-owner-name').value.toLowerCase();
    const ownerPhone = document.getElementById('search-owner-phone').value.toLowerCase();
    
    if (!petName && !ownerName && !ownerPhone) {
        const searchResults = document.getElementById('search-results');
        if (searchResults) {
            searchResults.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>Ingresa criterios de búsqueda</h3>
                    <p>Busca por nombre de mascota, dueño o teléfono.</p>
                </div>
            `;
        }
        return;
    }
    
    try {
        // Por ahora buscamos en mascotas autorizadas
        const results = vetAuthorizedPets.filter(pet => {
            const matchesName = !petName || pet.name.toLowerCase().includes(petName);
            const matchesOwner = !ownerName || (pet.owner?.displayName && pet.owner.displayName.toLowerCase().includes(ownerName));
            const matchesPhone = !ownerPhone || (pet.owner?.phone && pet.owner.phone.includes(ownerPhone));
            
            return matchesName || matchesOwner || matchesPhone;
        });
        
        const searchResults = document.getElementById('search-results');
        if (!searchResults) return;
        
        let html = '';
        
        if (results.length === 0) {
            html = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>No se encontraron mascotas</h3>
                    <p>Intenta con otros términos de búsqueda.</p>
                </div>
            `;
        } else {
            html = `
                <h3 style="margin-bottom: 1rem;">${results.length} mascota${results.length !== 1 ? 's' : ''} encontrada${results.length !== 1 ? 's' : ''}</h3>
                <div style="display: grid; gap: 1rem;">
            `;
            
            results.forEach(pet => {
                html += `
                    <div class="pet-profile">
                        <div class="pet-avatar">
                            ${getPetEmoji(pet.species)}
                        </div>
                        <div class="pet-info" style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <h3>${pet.name}</h3>
                                    <p>${pet.species} ${pet.breed ? `- ${pet.breed}` : ''}</p>
                                    <p>Dueño: ${pet.owner?.displayName || 'No disponible'}</p>
                                    <p>Teléfono: ${pet.owner?.phone || 'No disponible'}</p>
                                </div>
                                <div style="display: flex; gap: 0.3rem;">
                                    <button class="btn btn-primary" onclick="showNewMedicalRecordModal('${pet.petId}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Cargar historial</button>
                                    <button class="btn btn-secondary" onclick="viewPetMedicalHistory('${pet.petId}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">Ver historial</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
        }
        
        searchResults.innerHTML = html;
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        const searchResults = document.getElementById('search-results');
        if (searchResults) {
            searchResults.innerHTML = `
                <div class="alert alert-danger">
                    <span>❌</span>
                    <div>
                        <strong>Error en la búsqueda</strong>
                        <p>${error.message}</p>
                    </div>
                </div>
            `;
        }
    }
}

// Limpiar búsqueda
function clearSearch() {
    document.getElementById('search-pet-name').value = '';
    document.getElementById('search-owner-name').value = '';
    document.getElementById('search-owner-phone').value = '';
    const searchResults = document.getElementById('search-results');
    if (searchResults) {
        searchResults.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>Realiza una búsqueda</h3>
                <p>Busca mascotas por nombre, dueño o teléfono para ver su historial médico (si estás autorizado) o solicitar acceso.</p>
            </div>
        `;
    }
}

// Filtrar veterinarias
function filterVets() {
    const nameFilter = document.getElementById('filter-vet-name').value.toLowerCase();
    const cityFilter = document.getElementById('filter-vet-city').value.toLowerCase();
    const specialtyFilter = document.getElementById('filter-vet-specialty').value.toLowerCase();
    
    const filteredVets = allVets.filter(vet => {
        const vetName = (vet.vetInfo?.name || vet.displayName || '').toLowerCase();
        const vetCity = (vet.vetInfo?.city || '').toLowerCase();
        const vetSpecialties = (vet.vetInfo?.specialties || '').toLowerCase();
        
        return (!nameFilter || vetName.includes(nameFilter)) &&
               (!cityFilter || vetCity.includes(cityFilter)) &&
               (!specialtyFilter || vetSpecialties.includes(specialtyFilter));
    });
    
    renderVetsList(filteredVets);
}

// Limpiar filtros de veterinarias
function clearVetFilters() {
    document.getElementById('filter-vet-name').value = '';
    document.getElementById('filter-vet-city').value = '';
    document.getElementById('filter-vet-specialty').value = '';
    renderVetsList(allVets);
}

// ==================== FUNCIONES DE QR ====================

// Mostrar QR de mascota
async function showPetQR(petId) {
    const pet = pets.find(p => p.id === petId);
    if (!pet) return;
    
    const qrUrl = `${window.location.origin}/pet/${petId}`;
    
    let html = `
        <div style="text-align: center; padding: 2rem;">
            <h3 style="margin-bottom: 1rem;">${pet.name}</h3>
            <p style="color: var(--gray); margin-bottom: 2rem;">Escanea este código para acceder al perfil de la mascota</p>
            
            <div id="qrcode-container" style="margin: 0 auto 2rem; width: 256px; height: 256px;"></div>
            <p><small>ID: ${petId}</small></p>
            
            <div style="margin-top: 2rem;">
                <button class="btn btn-primary" onclick="downloadQR('${petId}')">Descargar QR</button>
                <button class="btn btn-secondary" onclick="sharePet('${petId}')">Compartir</button>
            </div>
        </div>
    `;
    
    document.getElementById('qr-content').innerHTML = html;
    qrModal.classList.add('active');
    
    // Generar QR usando QRCode.js
    new QRCode(document.getElementById("qrcode-container"), {
        text: qrUrl,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

// Descargar QR
function downloadQR(petId) {
    const canvas = document.querySelector('#qrcode-container canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = `qr-mascota-${petId}.png`;
        link.href = canvas.toDataURL();
        link.click();
        showMessage('QR descargado correctamente', 'success');
    } else {
        showMessage('No se pudo generar el código QR', 'error');
    }
}

// Compartir mascota
async function sharePet(petId) {
    const pet = pets.find(p => p.id === petId);
    if (!pet) return;
    
    const shareUrl = `${window.location.origin}/pet/${petId}`;
    const shareText = `Perfil de ${pet.name} en Tu Mascota Online`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: pet.name,
                text: shareText,
                url: shareUrl,
            });
            showMessage('Compartido correctamente', 'success');
        } catch (error) {
            console.error('Error al compartir:', error);
            copyToClipboard(shareUrl);
        }
    } else {
        copyToClipboard(shareUrl);
    }
}

// Copiar al portapapeles
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showMessage('Enlace copiado al portapapeles', 'success');
    }).catch(err => {
        console.error('Error al copiar:', err);
        showMessage('Error al copiar el enlace', 'error');
    });
}

// ==================== FUNCIONES DE UTILIDAD ====================

// Mostrar mensaje
function showMessage(message, type = 'info') {
    // Crear elemento de mensaje
    const messageEl = document.createElement('div');
    messageEl.className = `alert alert-${type}`;
    messageEl.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <div>${message}</div>
    `;
    
    // Insertar al inicio del contenido
    const contentHeader = document.querySelector('.content-header');
    if (contentHeader) {
        contentHeader.parentNode.insertBefore(messageEl, contentHeader.nextSibling);
    } else {
        contentContainer.insertBefore(messageEl, contentContainer.firstChild);
    }
    
    // Eliminar después de 5 segundos
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 5000);
}

// Mostrar error
function showError(message) {
    contentContainer.innerHTML = `
        <div class="content-header">
            <h1 class="content-title">Error</h1>
            <p class="content-subtitle">Ha ocurrido un problema</p>
        </div>
        
        <div class="alert alert-danger">
            <span>❌</span>
            <div>
                <strong>Error:</strong>
                <p>${message}</p>
            </div>
        </div>
        
        <button class="btn btn-primary" onclick="loadSection('dashboard')">Volver al dashboard</button>
    `;
}

// Cerrar sesión
async function handleLogout() {
    try {
        console.log('Cerrando sesión...');
        await auth.signOut();
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showMessage('Error al cerrar sesión', 'error');
    }
}

// Funciones auxiliares
function getPetEmoji(species) {
    const emojis = {
        'perro': '🐕',
        'gato': '🐈',
        'conejo': '🐇',
        'ave': '🐦',
        'roedor': '🐁',
        'reptil': '🐊',
        'otro': '🐾'
    };
    return emojis[species] || '🐾';
}

function formatDate(dateString) {
    if (!dateString) return 'Desconocida';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return 'Desconocida';
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(dateTimeString) {
    if (!dateTimeString) return 'Desconocida';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

function getAppointmentStatusText(status) {
    const statuses = {
        'scheduled': 'Programado',
        'confirmed': 'Confirmado',
        'cancelled': 'Cancelado',
        'completed': 'Completado'
    };
    return statuses[status] || status;
}

function getAppointmentTypeText(type) {
    const types = {
        'consulta_general': 'Consulta General',
        'vacunacion': 'Vacunación',
        'urgencia': 'Urgencia',
        'control': 'Control',
        'cirugia': 'Cirugía',
        'estetica': 'Estética'
    };
    return types[type] || type;
}

function getRecordTypeText(type) {
    const types = {
        'consulta': 'Consulta',
        'vacuna': 'Vacunación',
        'cirugia': 'Cirugía',
        'examen': 'Examen',
        'tratamiento': 'Tratamiento',
        'control': 'Control'
    };
    return types[type] || type;
}

// ==================== FUNCIONES GLOBALES ====================

// Hacer funciones disponibles globalmente
window.loadSection = loadSection;
window.showAuthVetModal = showAuthVetModal;
window.authorizeVet = authorizeVet;
window.revokeVetAccess = revokeVetAccess;
window.savePetFromForm = savePetFromForm;
window.saveVetInfo = saveVetInfo;
window.saveAppointmentsConfig = saveAppointmentsConfig;
window.toggleAppointmentsModule = toggleAppointmentsModule;
window.filterVets = filterVets;
window.clearVetFilters = clearVetFilters;
window.searchPets = searchPets;
window.clearSearch = clearSearch;
window.showNewAppointmentModal = showNewAppointmentModal;
window.showNewMedicalRecordModal = showNewMedicalRecordModal;
window.editPet = editPet;
window.viewPetDetails = viewPetDetails;
window.showPetQR = showPetQR;
window.viewVetDetails = viewVetDetails;
window.editAppointment = editAppointment;
window.confirmAppointment = confirmAppointment;
window.cancelAppointment = cancelAppointment;
window.completeAppointment = completeAppointment;
window.editMedicalRecord = editMedicalRecord;
window.viewPetMedicalHistory = viewPetMedicalHistory;
window.viewAppointmentDetails = viewAppointmentDetails;
window.downloadQR = downloadQR;
window.sharePet = sharePet;

// Inicializar aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', initializeApp);

console.log('app.js cargado correctamente');
