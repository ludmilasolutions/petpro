// App principal - Lógica compartida

// Inicializar PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registrado:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker falló:', error);
            });
    });
}

// Navegación dinámica
function navigateTo(section) {
    const content = document.getElementById('dynamicContent');
    
    switch(section) {
        case '#mascotas':
            content.innerHTML = `
                <div class="card">
                    <h3>Mis Mascotas</h3>
                    <div id="listaMascotas"></div>
                </div>
            `;
            loadMascotas();
            break;
        case '#turnos':
            content.innerHTML = `
                <div class="card">
                    <h3>Turnos</h3>
                    <div id="listaTurnos"></div>
                </div>
            `;
            loadTurnos();
            break;
        // ... otros casos
    }
}

// Formatear fechas
function formatDate(date) {
    return new Date(date).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Formatear moneda
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(amount);
}

// Manejar errores
function handleError(error, userMessage = 'Ocurrió un error') {
    console.error(error);
    alert(`${userMessage}: ${error.message}`);
    return null;
}

// Exportar funciones útiles
window.navigateTo = navigateTo;
window.formatDate = formatDate;
window.formatCurrency = formatCurrency;
window.handleError = handleError;

// Inicializar app
document.addEventListener('DOMContentLoaded', function() {
    // Actualizar menú activo
    const currentHash = window.location.hash || '#dashboard';
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentHash) {
            link.classList.add('active');
        }
    });
    
    // Navegar al hash actual
    navigateTo(currentHash);
});

// Manejar cambios en el hash
window.addEventListener('hashchange', () => {
    navigateTo(window.location.hash);
});
