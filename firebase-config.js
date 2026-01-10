// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAOIvnH9_2X75StDWX4Rnh9tRfD9lSIv3E",
  authDomain: "petpro-19db3.firebaseapp.com",
  projectId: "petpro-19db3",
  storageBucket: "petpro-19db3.firebasestorage.app",
  messagingSenderId: "384847276656",
  appId: "1:384847276656:web:ed6a128e5e09ce2e52a2b5"
};


// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar servicios
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Configurar persistencia
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Configurar Firestore
db.settings({
    timestampsInSnapshots: true
});

// Función para verificar si el usuario está autenticado
function checkAuth() {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged(user => {
            if (user) {
                resolve(user);
            } else {
                reject(new Error('No autenticado'));
            }
        });
    });
}

// Exportar para uso global
window.auth = auth;
window.db = db;
window.firebase = firebase;
