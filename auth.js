// Autenticación con Google
function initGoogleAuth() {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    // Configurar proveedor
    provider.addScope('email');
    provider.addScope('profile');
    
    // Personalizar flujo
    provider.setCustomParameters({
        prompt: 'select_account'
    });
    
    return provider;
}

// Iniciar sesión con Google
async function signInWithGoogle() {
    try {
        const provider = initGoogleAuth();
        const result = await auth.signInWithPopup(provider);
        
        // Verificar si el email es temporal
        const email = result.user.email;
        if (isTemporaryEmail(email)) {
            await auth.signOut();
            throw new Error('No se permiten emails temporales');
        }
        
        return result.user;
    } catch (error) {
        console.error('Error en autenticación:', error);
        throw error;
    }
}

// Verificar email temporal
function isTemporaryEmail(email) {
    const tempDomains = [
        'tempmail.com',
        'mailinator.com',
        'guerrillamail.com',
        '10minutemail.com'
    ];
    
    const domain = email.split('@')[1];
    return tempDomains.some(temp => domain.includes(temp));
}

// Cerrar sesión
function signOut() {
    return auth.signOut();
}

// Verificar estado de autenticación
auth.onAuthStateChanged(user => {
    if (user) {
        console.log('Usuario autenticado:', user.email);
        
        // Verificar tipo de usuario y redirigir si es necesario
        if (window.location.pathname.includes('index.html')) {
            checkUserTypeAndRedirect(user.uid);
        }
    } else {
        console.log('Usuario no autenticado');
        if (!window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
        }
    }
});

// Verificar tipo de usuario
async function checkUserTypeAndRedirect(uid) {
    try {
        // Verificar si es veterinaria
        const vetDoc = await db.collection('veterinarias').doc(uid).get();
        
        if (vetDoc.exists) {
            window.location.href = 'vet.html';
        } else {
            // Verificar si es dueño
            const ownerDoc = await db.collection('dueños').doc(uid).get();
            
            if (ownerDoc.exists) {
                window.location.href = 'owner.html';
            } else {
                // Nuevo usuario - determinar por dominio de email
                const user = auth.currentUser;
                if (user.email.includes('vet') || user.email.includes('clinic')) {
                    window.location.href = 'setup.html';
                } else {
                    window.location.href = 'owner.html';
                }
            }
        }
    } catch (error) {
        console.error('Error al verificar tipo de usuario:', error);
    }
}

// Exportar funciones
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;

// Inicializar botón de login
document.addEventListener('DOMContentLoaded', function() {
    const loginBtn = document.getElementById('googleLoginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            try {
                await signInWithGoogle();
            } catch (error) {
                alert('Error: ' + error.message);
            }
        });
    }
});
