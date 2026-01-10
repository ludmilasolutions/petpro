// Historial médico
class HistorialManager {
    constructor() {
        this.currentUser = null;
    }
    
    async init() {
        this.currentUser = auth.currentUser;
    }
    
    // Obtener historial de mascota
    async obtenerHistorial(mascotaId) {
        try {
            // Verificar autorización
            const autorizado = await this.verificarAutorizacion(mascotaId);
            if (!autorizado) {
                throw new Error('No autorizado para ver este historial');
            }
            
            const snapshot = await db.collection('historial')
                .where('mascotaId', '==', mascotaId)
                .orderBy('fecha', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            handleError(error, 'Error al cargar historial');
            return [];
        }
    }
    
    // Agregar entrada al historial
    async agregarEntrada(mascotaId, entradaData) {
        try {
            // Verificar autorización para escribir
            const puedeEscribir = await this.verificarPermisoEscritura(mascotaId);
            if (!puedeEscribir) {
                throw new Error('No autorizado para modificar este historial');
            }
            
            const entradaRef = db.collection('historial').doc();
            
            const entrada = {
                ...entradaData,
                id: entradaRef.id,
                mascotaId,
                usuarioId: this.currentUser.uid,
                usuarioNombre: this.currentUser.displayName || this.currentUser.email,
                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                tipo: entradaData.tipo || 'consulta',
                auditable: true
            };
            
            await entradaRef.set(entrada);
            
            // Actualizar resumen de mascota
            await this.actualizarResumenMascota(mascotaId, entrada);
            
            return entrada;
        } catch (error) {
            handleError(error, 'Error al agregar entrada');
            throw error;
        }
    }
    
    // Verificar autorización de lectura
    async verificarAutorizacion(mascotaId) {
        try {
            const mascotaDoc = await db.collection('mascotas').doc(mascotaId).get();
            
            if (!mascotaDoc.exists) return false;
            
            const mascota = mascotaDoc.data();
            
            // El dueño siempre puede ver
            if (mascota.dueñoId === this.currentUser.uid) return true;
            
            // Veterinarias autorizadas pueden ver
            if (mascota.veterinariasAutorizadas && 
                mascota.veterinariasAutorizadas.includes(this.currentUser.uid)) {
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error verificando autorización:', error);
            return false;
        }
    }
    
    // Verificar permiso de escritura
    async verificarPermisoEscritura(mascotaId) {
        // Solo veterinarias autorizadas pueden escribir
        const vetDoc = await db.collection('veterinarias').doc(this.currentUser.uid).get();
        return vetDoc.exists;
    }
    
    // Actualizar resumen de mascota
    async actualizarResumenMascota(mascotaId, ultimaEntrada) {
        try {
            const mascotaRef = db.collection('mascotas').doc(mascotaId);
            
            const updateData = {
                ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Si es vacuna, actualizar última vacuna
            if (ultimaEntrada.tipo === 'vacuna') {
                updateData.ultimaVacuna = ultimaEntrada.fecha;
                updateData.proximaVacuna = this.calcularProximaVacuna(ultimaEntrada);
            }
            
            await mascotaRef.update(updateData);
        } catch (error) {
            console.error('Error actualizando resumen:', error);
        }
    }
    
    calcularProximaVacuna(entradaVacuna) {
        const fechaVacuna = entradaVacuna.fecha.toDate();
        const proxima = new Date(fechaVacuna);
        
        switch (entradaVacuna.vacunaTipo) {
            case 'anual':
                proxima.setFullYear(proxima.getFullYear() + 1);
                break;
            case 'triple':
                proxima.setMonth(proxima.getMonth() + 3);
                break;
            default:
                proxima.setMonth(proxima.getMonth() + 1);
        }
        
        return proxima;
    }
    
    // Generar resumen
    async generarResumen(mascotaId) {
        const historial = await this.obtenerHistorial(mascotaId);
        
        const resumen = {
            totalEntradas: historial.length,
            ultimaConsulta: null,
            ultimaVacuna: null,
            proximaVacuna: null,
            tratamientosActivos: 0,
            alertas: []
        };
        
        historial.forEach(entrada => {
            if (entrada.tipo === 'consulta' && !resumen.ultimaConsulta) {
                resumen.ultimaConsulta = entrada.fecha;
            }
            
            if (entrada.tipo === 'vacuna' && !resumen.ultimaVacuna) {
                resumen.ultimaVacuna = entrada.fecha;
                resumen.proximaVacuna = this.calcularProximaVacuna(entrada);
            }
            
            if (entrada.tipo === 'tratamiento' && entrada.activo) {
                resumen.tratamientosActivos++;
            }
        });
        
        return resumen;
    }
}

// Inicializar
let historialManager = null;

auth.onAuthStateChanged(user => {
    if (user) {
        historialManager = new HistorialManager();
        historialManager.init();
    }
});

// Funciones globales
async function cargarHistorial(mascotaId) {
    if (!historialManager) return;
    
    const [historial, resumen] = await Promise.all([
        historialManager.obtenerHistorial(mascotaId),
        historialManager.generarResumen(mascotaId)
    ]);
    
    return { historial, resumen };
}

async function mostrarHistorial(mascotaId) {
    const container = document.getElementById('historialContainer');
    if (!container) return;
    
    try {
        const { historial, resumen } = await cargarHistorial(mascotaId);
        
        container.innerHTML = `
            <div class="card">
                <h3>📋 Resumen médico</h3>
                <div class="grid-4">
                    <div class="card">
                        <h4>Última consulta</h4>
                        <p>${resumen.ultimaConsulta ? formatDate(resumen.ultimaConsulta) : 'Sin datos'}</p>
                    </div>
                    <div class="card">
                        <h4>Última vacuna</h4>
                        <p>${resumen.ultimaVacuna ? formatDate(resumen.ultimaVacuna) : 'Sin datos'}</p>
                    </div>
                    <div class="card">
                        <h4>Próxima vacuna</h4>
                        <p>${resumen.proximaVacuna ? formatDate(resumen.proximaVacuna) : 'Sin datos'}</p>
                    </div>
                    <div class="card">
                        <h4>Tratamientos activos</h4>
                        <p>${resumen.tratamientosActivos}</p>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h3>📅 Timeline del historial</h3>
                <div class="timeline">
                    ${historial.map(entrada => `
                        <div class="timeline-item">
                            <div class="timeline-date">${formatDate(entrada.fecha)}</div>
                            <div class="timeline-content">
                                <h4>${entrada.tipo.toUpperCase()} - ${entrada.titulo || 'Sin título'}</h4>
                                <p>${entrada.descripcion || ''}</p>
                                <small>Registrado por: ${entrada.usuarioNombre}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `
            <div class="card">
                <p class="error">Error al cargar historial: ${error.message}</p>
            </div>
        `;
    }
}

// Exportar
window.cargarHistorial = cargarHistorial;
window.mostrarHistorial = mostrarHistorial;
window.historialManager = historialManager;
