/**
 * Coordinador Principal de la Aplicación (Frontend)
 */

// Estado Global
let ticketsData = [];          // Lista de tickets del sorteo
let selectedNumbers = [];      // Números seleccionados para edición múltiple (Admin)
let sorteosDisponibles = [];   // Lista de nombres de sorteos visibles para el selector
let sorteosDetalle = [];       // Lista de objetos {nombre, visible, estado} (solo Admin)
let currentSorteo = null;      // Nombre del sorteo actualmente seleccionado
let TICKET_PRICE = 5000;       // Precio del sorteo abierto, leído desde _Sorteos
const CURRENT_SORTEO_KEY = 'rifa_current_sorteo';

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

/**
 * Inicializa la aplicación cargando estados y renderizando elementos
 */
async function initApp() {
  // 1. Verificar sesión de administrador
  checkAdminSession();

  // 2. Cargar la lista de sorteos disponibles y luego los tickets del sorteo activo
  await refreshSorteosList();
  await refreshRaffleData();
}

/**
 * Carga la lista de sorteos disponibles y arma el selector
 */
async function refreshSorteosList() {
  try {
    const token = getAdminToken();
    const result = await apiListSorteos(token);
    const lista = (result && result.sorteos) || [];

    // En modo Admin la API retorna objetos {nombre, visible, estado}; en modo público, solo nombres
    if (isAdminLoggedIn()) {
      sorteosDetalle = lista;
      sorteosDisponibles = lista.map(s => s.nombre);
      renderSorteoManagement();
    } else {
      sorteosDetalle = lista.map(s => typeof s === 'string' ? { nombre: s } : s);
      sorteosDisponibles = sorteosDetalle.map(s => s.nombre);
      renderPublicRaffles(sorteosDetalle);
    }

    const savedSorteo = localStorage.getItem(CURRENT_SORTEO_KEY);
    if (savedSorteo && sorteosDisponibles.includes(savedSorteo)) {
      currentSorteo = savedSorteo;
    } else {
      currentSorteo = sorteosDisponibles[0] || null;
    }

    renderSorteoSelector();
  } catch (error) {
    console.error('Error al cargar la lista de sorteos:', error);
    // Los sorteos siempre provienen de Google Sheets; no usar una lista fija.
    sorteosDisponibles = [];
    currentSorteo = null;
    renderSorteoSelector();
  }
}

async function renderPublicRaffles(raffles) {
  const container = document.getElementById('public-raffles-container');
  const legacyGrid = document.getElementById('tickets-container');
  const legend = document.querySelector('#view-public > .legend');
  if (!container || isAdminLoggedIn()) { if (container) container.innerHTML = ''; if (legacyGrid) legacyGrid.closest('.grid-container').style.removeProperty('display'); if (legend) legend.style.removeProperty('display'); return; }
  if (legacyGrid) legacyGrid.closest('.grid-container').style.setProperty('display', 'none', 'important');
  if (legend) legend.style.setProperty('display', 'none', 'important');
  container.innerHTML = '<p class="raffle-history-empty">Cargando sorteos publicados…</p>';
  const cards = await Promise.all(raffles.map(async raffle => {
    const [data, prizesResult] = await Promise.all([apiGetTickets(raffle.nombre), apiListPremios(raffle.nombre)]);
    const tickets = (data.tickets || []).map(t => `<span class="ticket ${String(t.estado).toLowerCase()}"><b>#${t.numero}</b><small>${t.estado}</small></span>`).join('');
    const premios = (prizesResult.premios || []).map(p => `<div class="public-prize">${p.imagen ? `<img src="${p.imagen}" alt="${p.titulo}">` : '<span>🏆</span>'}<div><b>Premio ${p.orden}: ${p.titulo}</b><small>${p.descripcion || ''}</small></div></div>`).join('');
    const legacyPrize = raffle.imagen ? `<div class="public-prize"><img src="${raffle.imagen}" alt="Premio ${raffle.nombre}"><div><b>Premio principal</b><small>${raffle.descripcion || ''}</small></div></div>` : '';
    return `<article class="grid-container" style="margin-bottom:2rem"><h2>${raffle.nombre}</h2><p style="color:#c8d8f3">Participa y apoya al club.</p><p style="margin:1rem 0;color:#80b1ff;font-weight:800">Valor por número: ${formatCurrency(raffle.precio || 5000)}</p>${premios ? `<div class="public-prizes">${premios}</div>` : legacyPrize}<div class="tickets-grid">${tickets}</div></article>`;
  }));
  container.innerHTML = cards.join('') || '<p class="raffle-history-empty">No hay sorteos publicados.</p>';
}

/**
 * Renderiza el selector de sorteo en el encabezado
 */
function renderSorteoSelector() {
  const title = document.getElementById('raffle-title');
  if (title && currentSorteo) title.dataset.currentRaffle = currentSorteo;
  const currentName = document.getElementById('current-raffle-name');
  if (currentName) currentName.textContent = currentSorteo || 'Sin rifa seleccionada';
}

/**
 * Refresca todos los datos del sorteo, grilla, marcador y contabilidad
 */
async function refreshRaffleData() {
  showLoading();
  try {
    const token = getAdminToken();
    const result = await apiGetTickets(currentSorteo, token);

    if (result && result.tickets) {
      ticketsData = result.tickets;
      if (result.sorteo) currentSorteo = result.sorteo;
      renderTicketsGrid();

      // El marcador de estadísticas es información sensible: solo se muestra en modo Admin
      if (isAdminLoggedIn()) {
        updateScoreboard();
        renderAccountingTable();
      }
    } else if (result && result.error) {
      alert('Error del servidor: ' + result.error);
    }
  } catch (error) {
    alert('No se pudieron cargar los datos del sorteo. Si estás usando Google Sheets real, verifica tu conexión y la URL de la API.');
    console.error(error);
  } finally {
    hideLoading();
  }
}

/**
 * Renderiza la grilla de números/tickets
 */
function renderTicketsGrid() {
  const container = document.getElementById('tickets-container');
  if (!container) return;
  
  container.innerHTML = '';
  const adminMode = isAdminLoggedIn();
  
  ticketsData.forEach(t => {
    const ticketEl = document.createElement('div');
    const isSelected = selectedNumbers.includes(t.numero);
    
    // Asignar clases de estilo según estado
    const estadoClass = t.estado.toLowerCase(); // disponible, reservado, pagado
    ticketEl.className = `ticket ${estadoClass} ${isSelected ? 'selected' : ''}`;
    ticketEl.dataset.numero = t.numero;
    
    // Crear el dorsal visual
    ticketEl.innerHTML = `
      <span class='num-val'>#${t.numero}</span>
      <span class='status-badge'>${t.estado === 'Pagado' ? 'Gol!' : t.estado === 'Reservado' ? 'VAR' : 'Libre'}</span>
    `;
    
    // Controlar evento clic
    ticketEl.addEventListener('click', () => {
      if (adminMode) {
        toggleNumberSelection(t.numero, ticketEl);
      } else {
        showPublicTicketInfo(t);
      }
    });
    
    container.appendChild(ticketEl);
  });
}

/**
 * Actualiza las estadísticas del marcador superior
 */
function updateScoreboard() {
  let disponibles = 0;
  let reservados = 0;
  let pagados = 0;
  
  ticketsData.forEach(t => {
    if (t.estado === 'Pagado') pagados++;
    else if (t.estado === 'Reservado') reservados++;
    else disponibles++;
  });
  
  const recaudado = pagados * TICKET_PRICE;
  
  // Elementos del DOM
  document.getElementById('stat-recaudado').innerText = formatCurrency(recaudado);
  document.getElementById('stat-pagados').innerText = padZero(pagados);
  document.getElementById('stat-reservados').innerText = padZero(reservados);
  document.getElementById('stat-disponibles').innerText = padZero(disponibles);
}

/**
 * Acción al hacer clic en un número en vista pública (Visitante)
 */
function showPublicTicketInfo(ticket) {
  if (ticket.estado === 'Disponible') {
    alert(`⚽ ¡El número #${ticket.numero} está DISPONIBLE!

Para reservarlo o comprarlo, por favor comunícate con el administrador del club y pídele este número.`);
  } else if (ticket.estado === 'Reservado') {
    alert(`⏳ El número #${ticket.numero} ya está RESERVADO.

Puedes elegir otro de los números verdes disponibles.`);
  } else if (ticket.estado === 'Pagado') {
    alert(`🎉 ¡GOL! El número #${ticket.numero} ya está COMPRADO y PAGADO.

¡Busca otra camiseta verde en el campo!`);
  }
}

/**
 * Navegación de Pestañas
 */
function switchTab(tabId) {
  // Desactivar todos los botones de navegación
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => btn.classList.remove('active'));
  
  // Desactivar todas las secciones
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.remove('active'));
  
  // Activar botón seleccionado
  // Buscamos el botón por su onclick o id correspondiente
  let activeBtn;
  if (tabId === 'public-view') {
    activeBtn = navButtons[0];
    document.getElementById('view-public').classList.add('active');
  } else if (tabId === 'accounting-view') {
    activeBtn = document.getElementById('nav-accounting-tab');
    document.getElementById('view-accounting').classList.add('active');
    // Actualizar tabla al entrar
    renderAccountingTable();
  } else if (tabId === 'login-view') {
    activeBtn = document.getElementById('nav-login-tab');
    document.getElementById('view-login').classList.add('active');
  } else if (tabId === 'raffles-view') {
    activeBtn = document.getElementById('nav-raffles-tab');
    document.getElementById('view-raffles').classList.add('active');
  }
  
  if (activeBtn) activeBtn.classList.add('active');
  
  // Cerrar barra de tácticas flotante al cambiar de pestaña
  if (tabId !== 'public-view') {
    clearSelection();
  }
}

function openRaffleHub() {
  if (!isAdminLoggedIn()) {
    switchTab('login-view');
    return;
  }
  switchTab('raffles-view');
  refreshSorteosList();
}

/* --- UTILIDADES --- */

/**
 * Formatea un número como moneda chilena/pesos (ej: .000)
 */
function formatCurrency(value) {
  return '$' + value.toLocaleString('es-CL');
}

/**
 * Añade un cero a la izquierda si el número es menor a 10 (estética de marcador)
 */
function padZero(num) {
  return num < 10 ? '0' + num : num;
}

/**
 * Simula un indicador de carga en la grilla
 */
function showLoading() {
  const container = document.getElementById('tickets-container');
  if (container && container.innerHTML === '') {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--color-grass-neon); font-weight: bold;">⚽ Saltando a la cancha... Cargando datos...</div>';
  }
}

function hideLoading() {}
