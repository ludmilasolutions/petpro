// Sistema de turnos
class TurnoManager {
    constructor() {
        this.currentUser = null;
    }
    
    async init() {
        this.currentUser = auth.currentUser;
    }
    
    // Crear nuevo turno
    async crearTurno(turnoData) {
        try {
            const turnoRef = db.collection('turnos').doc();
            
            const turno = {
                ...turnoData,
                id: turnoRef.id,
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
                estado: 'programado',
                recordatoriosEnviados: []
            };
            
            await turnoRef.set(turno);
            
            // Crear notificación
            await this.crearNotificacionTurno(turno);
            
            return turno;
        } catch (error) {
            handleError(error, 'Error al crear turno');
            throw error;
        }
    }
    
    // Obtener turnos por usuario
    async obtenerTurnosUsuario() {
        try {
            // Para dueños: turnos de sus mascotas
            // Para veterinarias: turnos asignados a ellas
            
            let query;
            
            // Verificar si es dueño
            const esDueño = await this.esDueño();
            
            if (esDueño) {
                // Obtener IDs de mascotas del dueño
                const mascotasSnapshot = await db.collection('mascotas')
                    .where('dueñoId', '==', this.currentUser.uid)
                    .get();
                
                const mascotaIds = mascotasSnapshot.docs.map(doc => doc.id);
                
                if (mascotaIds.length === 0) return [];
                
                query = db.collection('turnos')
                    .where('mascotaId', 'in', mascotaIds)
                    .orderBy('fechaHora', 'asc');
            } else {
                // Es veterinaria
                query = db.collection('turnos')
                    .where('veterinariaId', '==', this.currentUser.uid)
                    .orderBy('fechaHora', 'asc');
            }
            
            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            handleError(error, 'Error al cargar turnos');
            return [];
        }
    }
    
    // Actualizar estado de turno
    async actualizarEstado(turnoId, nuevoEstado) {
        try {
            await db.collection('turnos').doc(turnoId).update({
                estado: nuevoEstado,
                fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Si se cancela, enviar notificación
            if (nuevoEstado === 'cancelado') {
                await this.enviarNotificacionCancelacion(turnoId);
            }
            
            return true;
        } catch (error) {
            handleError(error, 'Error al actualizar turno');
            return false;
        }
    }
    
    // Enviar recordatorios
    async enviarRecordatorios() {
        try {
            const ahora = new Date();
            const mañana = new Date(ahora);
            mañana.setDate(mañana.getDate() + 1);
            
            // Buscar turnos para mañana que no tengan recordatorio enviado
            const snapshot = await db.collection('turnos')
                .where('fechaHora', '>=', ahora)
                .where('fechaHora', '<=', mañana)
                .where('estado', '==', 'confirmado')
                .get();
            
            const turnos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            for (const turno of turnos) {
                if (!turno.recordatoriosEnviados || turno.recordatoriosEnviados.length === 0) {
                    await this.enviarRecordatorioIndividual(turno);
                }
            }
            
            return turnos.length;
        } catch (error) {
            console.error('Error al enviar recordatorios:', error);
            return 0;
        }
    }
    
    async enviarRecordatorioIndividual(turno) {
        // Enviar por app y WhatsApp
        // Para MVP, solo registramos en la base de datos
        
        await db.collection('turnos').doc(turno.id).update({
            recordatoriosEnviados: firebase.firestore.FieldValue.arrayUnion({
                tipo: 'recordatorio',
                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                medio: 'app'
            })
        });
    }
    
    // Verificar si usuario es dueño
    async esDueño() {
        const vetDoc = await db.collection('veterinarias').doc(this.currentUser.uid).get();
        return !vetDoc.exists;
    }
    
    async crearNotificacionTurno(turno) {
        // Implementar según tipo de usuario
    }
    
    async enviarNotificacionCancelacion(turnoId) {
        // Implementar notificación de cancelación
    }
}

// Inicializar manager
let turnoManager = null;

auth.onAuthStateChanged(user => {
    if (user) {
        turnoManager = new TurnoManager();
        turnoManager.init();
    }
});

// Funciones globales
async function cargarTurnos() {
    if (!turnoManager) return;
    
    const turnos = await turnoManager.obtenerTurnosUsuario();
    const container = document.getElementById('listaTurnos');
    
    if (!container) return;
    
    if (turnos.length === 0) {
        container.innerHTML = `
            <div class="card">
                <p>No tienes turnos programados.</p>
                <button onclick="nuevoTurno()" class="btn btn-primary">
                    Agendar nuevo turno
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Mascota</th>
                    <th>Veterinaria</th>
                    <th>Motivo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${turnos.map(turno => `
                    <tr>
                        <td>${formatDate(turno.fechaHora)}</td>
                        <td>${turno.nombreMascota || 'Cargando...'}</td>
                        <td>${turno.nombreVeterinaria || 'Cargando...'}</td>
                        <td>${turno.motivo}</td>
                        <td><span class="status-badge status-${turno.estado}">${turno.estado}</span></td>
                        <td>
                            ${turno.estado === 'programado' ? `
                                <button onclick="confirmarTurno('${turno.id}')" class="btn btn-small btn-success">Confirmar</button>
                                <button onclick="cancelarTurno('${turno.id}')" class="btn btn-small btn-danger">Cancelar</button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Exportar
window.cargarTurnos = cargarTurnos;
window.turnoManager = turnoManager;
