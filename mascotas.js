// Manejo de mascotas
class MascotaManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }
    
    async init() {
        this.currentUser = auth.currentUser;
        if (!this.currentUser) {
            throw new Error('Usuario no autenticado');
        }
    }
    
    // Crear nueva mascota
    async crearMascota(mascotaData) {
        try {
            const mascotaRef = db.collection('mascotas').doc();
            
            const mascota = {
                ...mascotaData,
                id: mascotaRef.id,
                dueñoId: this.currentUser.uid,
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
                fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp(),
                veterinariasAutorizadas: [], // Array de IDs de veterinarias
                qrCode: this.generateQRCode(mascotaRef.id),
                activa: true
            };
            
            await mascotaRef.set(mascota);
            
            // Actualizar dueño
            await db.collection('dueños').doc(this.currentUser.uid).update({
                mascotas: firebase.firestore.FieldValue.arrayUnion(mascotaRef.id)
            });
            
            return mascota;
        } catch (error) {
            handleError(error, 'Error al crear mascota');
            throw error;
        }
    }
    
    // Obtener mascotas del dueño
    async obtenerMascotas() {
        try {
            const snapshot = await db.collection('mascotas')
                .where('dueñoId', '==', this.currentUser.uid)
                .where('activa', '==', true)
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            handleError(error, 'Error al cargar mascotas');
            return [];
        }
    }
    
    // Autorizar veterinaria
    async autorizarVeterinaria(mascotaId, veterinariaId) {
        try {
            await db.collection('mascotas').doc(mascotaId).update({
                veterinariasAutorizadas: firebase.firestore.FieldValue.arrayUnion(veterinariaId)
            });
            
            // Crear notificación para el dueño
            await this.crearNotificacion(
                this.currentUser.uid,
                'autorizacion',
                `Autorizaste el acceso de ${veterinariaId} a tu mascota`
            );
            
            return true;
        } catch (error) {
            handleError(error, 'Error al autorizar veterinaria');
            return false;
        }
    }
    
    // Revocar acceso
    async revocarAcceso(mascotaId, veterinariaId) {
        try {
            await db.collection('mascotas').doc(mascotaId).update({
                veterinariasAutorizadas: firebase.firestore.FieldValue.arrayRemove(veterinariaId)
            });
            
            // Crear notificación
            await this.crearNotificacion(
                this.currentUser.uid,
                'revocacion',
                `Revocaste el acceso de ${veterinariaId} a tu mascota`
            );
            
            return true;
        } catch (error) {
            handleError(error, 'Error al revocar acceso');
            return false;
        }
    }
    
    // Generar QR code (simulado)
    generateQRCode(mascotaId) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${mascotaId}`;
    }
    
    // Crear notificación
    async crearNotificacion(userId, tipo, mensaje) {
        try {
            await db.collection('notificaciones').add({
                userId,
                tipo,
                mensaje,
                leida: false,
                fecha: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error al crear notificación:', error);
        }
    }
}

// Inicializar cuando esté listo
let mascotaManager = null;

auth.onAuthStateChanged(user => {
    if (user) {
        mascotaManager = new MascotaManager();
    }
});

// Funciones globales
async function cargarMascotas() {
    if (!mascotaManager) return;
    
    const mascotas = await mascotaManager.obtenerMascotas();
    const container = document.getElementById('listaMascotas');
    
    if (!container) return;
    
    if (mascotas.length === 0) {
        container.innerHTML = `
            <div class="card">
                <p>No tienes mascotas registradas aún.</p>
                <button onclick="mostrarFormularioMascota()" class="btn btn-primary">
                    Registrar mi primera mascota
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = mascotas.map(mascota => `
        <div class="card mascota-card">
            <h4>${mascota.nombre}</h4>
            <p><strong>Especie:</strong> ${mascota.especie}</p>
            <p><strong>Raza:</strong> ${mascota.raza || 'No especificada'}</p>
            <p><strong>Edad:</strong> ${calcularEdad(mascota.fechaNacimiento)}</p>
            
            <div class="grid-2">
                <button onclick="verHistorial('${mascota.id}')" class="btn btn-secondary">
                    Ver historial
                </button>
                <button onclick="gestionarAutorizaciones('${mascota.id}')" class="btn btn-primary">
                    Veterinarias
                </button>
            </div>
            
            <div class="qr-code">
                <img src="${mascota.qrCode}" alt="QR de ${mascota.nombre}">
                <p>Escanear para acceso rápido</p>
            </div>
        </div>
    `).join('');
}

function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return 'No especificada';
    
    const nacimiento = fechaNacimiento.toDate();
    const hoy = new Date();
    const años = hoy.getFullYear() - nacimiento.getFullYear();
    const meses = hoy.getMonth() - nacimiento.getMonth();
    
    if (años > 0) {
        return `${años} año${años > 1 ? 's' : ''}`;
    } else {
        return `${meses} mes${meses > 1 ? 'es' : ''}`;
    }
}

// Exportar para uso global
window.cargarMascotas = cargarMascotas;
window.mascotaManager = mascotaManager;
