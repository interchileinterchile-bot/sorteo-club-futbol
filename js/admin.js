/**
 * Módulo de Administración, Login y Contabilidad
 */

/**
 * Retorna el token de administrador guardado en la sesión
 */
function getAdminToken() {
  return sessionStorage.getItem('rifa_admin_token');
}

/**
 * Retorna si el administrador ha iniciado sesión
 */
function isAdminLoggedIn() {
  return !!getAdminToken();
}

/**
 * Verifica la sesión de administrador y ajusta la interfaz de usuario
 */
function checkAdminSession() {
  const loggedIn = isAdminLoggedIn();

  const loginCard = document.getElementById('login-card-container');
  const sessionContainer = document.getElementById('admin-session-container');
  const accountingTab = document.getElementById('nav-accounting-tab');
  const rafflesTab = document.getElementById('nav-raffles-tab');
  const adminOnlyUis = document.querySelectorAll('.admin-only-ui');
  const scoreboard = document.getElementById('scoreboard-container');

  if (loggedIn) {
    if (loginCard) loginCard.style.display = 'none';
    if (sessionContainer) sessionContainer.style.display = 'block';
    if (accountingTab) accountingTab.style.display = 'flex';
    if (rafflesTab) rafflesTab.style.display = 'flex';
    if (scoreboard) scoreboard.style.display = '';
    adminOnlyUis.forEach(ui => ui.style.display = 'flex');
  } else {
    if (loginCard) loginCard.style.display = 'block';
    if (sessionContainer) sessionContainer.style.display = 'none';
    if (accountingTab) accountingTab.style.display = 'none';
    if (rafflesTab) rafflesTab.style.display = 'none';
    if (scoreboard) scoreboard.style.display = 'none';
    adminOnlyUis.forEach(ui => ui.style.display = 'none');
  }
}

/**
 * Maneja el inicio de sesión
 */
async function handleLogin(e) {
  e.preventDefault();
  const passwordInput = document.getElementById('admin-password');
  const password = passwordInput.value;
  const submitButton = e.currentTarget.querySelector('button[type="submit"]');
  const originalLabel = submitButton ? submitButton.innerHTML : '';

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.classList.add('is-loading');
    submitButton.innerHTML = '<span class="button-spinner" aria-hidden="true"></span> Validando acceso…';
  }
  
  try {
    const response = await apiLogin(password);
    if (response.success) {
      sessionStorage.setItem('rifa_admin_token', response.token);
      passwordInput.value = '';
      checkAdminSession();
      await refreshSorteosList();
      await refreshRaffleData();
      switchTab('raffles-view');
      alert('⚽ ¡Acceso Autorizado! Bienvenido a la cancha técnica del sorteo.');
    } else {
      alert('❌ Contraseña incorrecta. Inténtalo de nuevo.');
    }
  } catch (err) {
    const detail = err && err.message ? `\n\nDetalle: ${err.message}` : '';
    alert('No se pudo conectar con la API del sorteo.\n\nVerifica que la implementación de Google Apps Script esté activa y con acceso para "Cualquiera".' + detail);
    console.error(err);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.remove('is-loading');
      submitButton.innerHTML = originalLabel;
    }
  }
}

/**
 * Cierra la sesión administrativa
 */
function handleLogout() {
  sessionStorage.removeItem('rifa_admin_token');
  clearSelection();
  checkAdminSession();
  refreshRaffleData();
  switchTab('public-view');
  alert('🚪 Has salido del modo de administración de forma segura.');
}

/**
 * Alterna la selección de un número en la grilla (Modo Admin)
 */
function toggleNumberSelection(number, element) {
  const numInt = parseInt(number);
  const idx = selectedNumbers.indexOf(numInt);
  
  if (idx === -1) {
    selectedNumbers.push(numInt);
    element.classList.add('selected');
  } else {
    selectedNumbers.splice(idx, 1);
    element.classList.remove('selected');
  }
  
  updateTacticsBar();
}

/**
 * Actualiza la visibilidad y contador de la barra flotante de acciones rápidas
 */
function updateTacticsBar() {
  const bar = document.getElementById('tactics-bar-container');
  const countEl = document.getElementById('tactics-count');
  
  if (selectedNumbers.length > 0) {
    countEl.innerText = selectedNumbers.length;
    bar.classList.add('active');
  } else {
    bar.classList.remove('active');
  }
}

/**
 * Limpia toda la selección de números y esconde la barra flotante
 */
function clearSelection() {
  selectedNumbers = [];
  const selectedEls = document.querySelectorAll('.ticket.selected');
  selectedEls.forEach(el => el.classList.remove('selected'));
  updateTacticsBar();
}

/**
 * Abre el formulario para registrar un comprador a los números seleccionados
 */
function openMultiSelectModal() {
  const modal = document.getElementById('ticket-modal');
  const descEl = document.getElementById('modal-selected-nums-desc');
  const titleEl = document.getElementById('modal-ticket-title');
  
  if (selectedNumbers.length === 0) return;
  
  // Ordenar números seleccionados numéricamente
  selectedNumbers.sort((a, b) => a - b);
  
  // Título e indicador de números
  titleEl.innerText = selectedNumbers.length === 1 ? 'Registrar Dorsal' : 'Asignar Lote de Dorsales';
  descEl.innerText = `Camiseta(s) seleccionada(s): ${selectedNumbers.join(', ')}`;
  
  // Limpiar campos por defecto
  const nameInput = document.getElementById('buyer-name');
  const phoneInput = document.getElementById('buyer-phone');
  const statusSelect = document.getElementById('ticket-status');
  const paymentSelect = document.getElementById('payment-method');
  
  nameInput.value = '';
  phoneInput.value = '';
  statusSelect.value = 'Reservado';
  paymentSelect.value = 'Transferencia';
  
  // Si es un solo número seleccionado, precargar datos existentes si los tiene
  if (selectedNumbers.length === 1) {
    const ticketNum = selectedNumbers[0];
    const ticketData = ticketsData.find(t => t.numero === ticketNum);
    
    if (ticketData && ticketData.estado !== 'Disponible') {
      nameInput.value = ticketData.nombre || '';
      phoneInput.value = ticketData.telefono || '';
      statusSelect.value = ticketData.estado || 'Reservado';
      paymentSelect.value = ticketData.medioPago || 'Transferencia';
    }
  }
  
  togglePaymentFields();
  modal.classList.add('active');
}

/**
 * Cierra el formulario modal
 */
function closeModal() {
  document.getElementById('ticket-modal').classList.remove('active');
}

/**
 * Activa/Desactiva campos según el estado seleccionado (ej: ocultar método de pago si es disponible)
 */
function togglePaymentFields() {
  const status = document.getElementById('ticket-status').value;
  const paymentContainer = document.getElementById('payment-method-container');
  const nameInput = document.getElementById('buyer-name');
  const phoneInput = document.getElementById('buyer-phone');
  const paymentSelect = document.getElementById('payment-method');
  
  if (status === 'Disponible') {
    // Si se libera, los datos no son requeridos
    nameInput.required = false;
    phoneInput.required = false;
    nameInput.disabled = true;
    phoneInput.disabled = true;
    paymentContainer.style.display = 'none';
  } else {
    nameInput.required = true;
    phoneInput.required = true;
    nameInput.disabled = false;
    phoneInput.disabled = false;
    
    if (status === 'Pagado') {
      paymentContainer.style.display = 'block';
      paymentSelect.required = true;
    } else {
      // Si está reservado, el medio de pago puede ser opcional
      paymentContainer.style.display = 'block';
      paymentSelect.required = false;
    }
  }
}

/**
 * Guarda los datos de los números ingresados en el formulario (Admin)
 */
async function saveTicketData(e) {
  e.preventDefault();
  
  const estado = document.getElementById('ticket-status').value;
  const nombre = document.getElementById('buyer-name').value;
  const telefono = document.getElementById('buyer-phone').value;
  const medioPago = estado === 'Pagado' ? document.getElementById('payment-method').value : '';
  
  // Crear array de actualizaciones para la API
  const ticketsToUpdate = selectedNumbers.map(num => ({
    numero: num,
    estado: estado,
    nombre: estado === 'Disponible' ? '' : nombre,
    telefono: estado === 'Disponible' ? '' : telefono,
    medioPago: estado === 'Disponible' ? '' : medioPago
  }));
  
  const token = getAdminToken();
  showLoading();

  try {
    const result = await apiUpdateTickets(ticketsToUpdate, token, currentSorteo);
    if (result.success) {
      alert(`🎉 ¡Datos guardados correctamente!

${result.message || 'Se actualizaron los dorsales seleccionados.'}`);
      closeModal();
      clearSelection();
      await refreshRaffleData();
    } else {
      alert('❌ Error al actualizar: ' + result.error);
    }
  } catch (error) {
    alert('Ocurrió un error al enviar los datos al servidor.');
    console.error(error);
  } finally {
    hideLoading();
  }
}

/**
 * Renderiza la pestaña de contabilidad completa
 */
function renderAccountingTable() {
  const tableBody = document.getElementById('accounting-table-body');
  const searchInput = document.getElementById('accounting-search');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  // Variables de cálculo contable
  let efectivoRecaudado = 0;
  let transferenciaRecaudado = 0;
  let pendienteCobro = 0; // Total reservados
  
  // Obtener texto de búsqueda
  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
  
  ticketsData.forEach(t => {
    // Cálculos financieros
    if (t.estado === 'Pagado') {
      if (t.medioPago === 'Efectivo') {
        efectivoRecaudado += TICKET_PRICE;
      } else {
        // Por defecto transferencia si no dice efectivo o está marcado transferencia
        transferenciaRecaudado += TICKET_PRICE;
      }
    } else if (t.estado === 'Reservado') {
      pendienteCobro += TICKET_PRICE;
    }
    
    // Filtrado por buscador
    const numeroStr = t.numero.toString();
    const nombreStr = (t.nombre || '').toLowerCase();
    const telefonoStr = (t.telefono || '').toLowerCase();
    
    const matchSearch = searchQuery === '' || 
                        numeroStr.includes(searchQuery) || 
                        nombreStr.includes(searchQuery) || 
                        telefonoStr.includes(searchQuery);
    
    if (matchSearch) {
      const row = document.createElement('tr');
      
      const formattedDate = t.fecha ? formatDateString(t.fecha) : '-';
      
      row.innerHTML = `
        <td style='font-weight: bold; text-align: center; color: var(--color-accent-blue);'>#${t.numero}</td>
        <td><span class='badge-status ${t.estado.toLowerCase()}'>${t.estado}</span></td>
        <td style='font-weight: 600;'>${t.nombre || '-'}</td>
        <td>${t.telefono || '-'}</td>
        <td>${t.estado === 'Pagado' ? t.medioPago : t.estado === 'Reservado' ? '<em style="color: #8b949e;">(Por pagar)</em>' : '-'}</td>
        <td style='color: #8b949e; font-size: 0.8rem;'>${formattedDate}</td>
      `;
      
      tableBody.appendChild(row);
    }
  });
  
  // Renderizar tarjetas contables
  document.getElementById('calc-efectivo').innerText = formatCurrency(efectivoRecaudado);
  document.getElementById('calc-transferencia').innerText = formatCurrency(transferenciaRecaudado);
  document.getElementById('calc-pendiente').innerText = formatCurrency(pendienteCobro);
  document.getElementById('calc-potencial').innerText = formatCurrency(efectivoRecaudado + transferenciaRecaudado + pendienteCobro);
  
  // Agregar listener para búsqueda si no se ha agregado antes
  if (searchInput && !searchInput.dataset.hasListener) {
    searchInput.addEventListener('input', () => {
      renderAccountingTable();
    });
    searchInput.dataset.hasListener = 'true';
  }
}

/**
 * Formatea cadenas ISO de fecha a formato legible (DD/MM/AAAA HH:MM)
 */
function formatDateString(isoString) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString; // Si no es fecha válida, retornar string original
    const day = padZero(d.getDate());
    const month = padZero(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = padZero(d.getHours());
    const minutes = padZero(d.getMinutes());
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    return isoString;
  }
}

/* --- GESTIÓN DE SORTEOS (MÚLTIPLES SORTEOS EN LA MISMA HOJA) --- */

/**
 * Crea un nuevo sorteo desde el formulario de administración
 */
async function handleCreateSorteo(e) {
  e.preventDefault();

  const nameInput = document.getElementById('new-sorteo-name');
  const countInput = document.getElementById('new-sorteo-count');
  const priceInput = document.getElementById('new-sorteo-price');
  const nombre = nameInput.value.trim();
  const cantidad = parseInt(countInput.value);
  const precio = parseInt(priceInput.value);
  const prizes = [...document.querySelectorAll('.create-prize-row')].map(row => ({
    titulo: row.querySelector('.create-prize-title').value.trim(),
    descripcion: row.querySelector('.create-prize-description').value.trim(),
    image: row.querySelector('.create-prize-image').files[0]
  })).filter(prize => prize.titulo || prize.descripcion || prize.image);

  if (!nombre) {
    alert('❌ Debes indicar un nombre para el nuevo sorteo.');
    return;
  }
  if (prizes.some(prize => !prize.titulo)) {
    alert('❌ Cada premio con descripción o foto debe tener un nombre.');
    return;
  }

  const token = getAdminToken();
  showLoading();

  try {
    const result = await apiCreateSorteo(nombre, cantidad, token, precio);
    if (result.success) {
      for (const prize of prizes) {
        const premio = await apiSavePremio(result.sorteo, prize.titulo, prize.descripcion, prize.image ? await readImageAsDataUrl(prize.image) : '', token);
        if (!premio.success) throw new Error(premio.error || 'No se pudo guardar el premio.');
      }
      alert(`⚽ ${result.message}`);
      nameInput.value = '';
      countInput.value = '100';
      priceInput.value = '5000';
      resetCreatePrizeRows();
      await refreshSorteosList();
      currentSorteo = result.sorteo;
      localStorage.setItem(CURRENT_SORTEO_KEY, currentSorteo);
      renderSorteoSelector();
      await refreshRaffleData();
    } else {
      alert('❌ Error al crear el sorteo: ' + result.error);
    }
  } catch (error) {
    const detail = error && error.message ? `\n\nDetalle: ${error.message}` : '';
    alert('Ocurrió un error al crear el sorteo.' + detail);
    console.error(error);
  } finally {
    hideLoading();
  }
}

function addCreatePrizeRow() {
  const list = document.getElementById('create-prizes-list');
  const number = list.querySelectorAll('.create-prize-row').length + 1;
  const row = document.createElement('div');
  row.className = 'form-row create-prize-row';
  row.innerHTML = `<div class="form-group"><label>Premio ${number}</label><input class="create-prize-title" type="text" placeholder="Ej. Segundo premio"></div><div class="form-group"><label>Descripción</label><input class="create-prize-description" type="text" placeholder="Detalles del premio"></div><div class="form-group"><label>Foto / cámara</label><input class="create-prize-image" type="file" accept="image/*" capture="environment"></div><button type="button" class="remove-create-prize" aria-label="Quitar premio">×</button>`;
  row.querySelector('.remove-create-prize').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

function resetCreatePrizeRows() {
  const list = document.getElementById('create-prizes-list');
  list.innerHTML = `<div class="form-row create-prize-row"><div class="form-group"><label>Premio 1</label><input class="create-prize-title" type="text" placeholder="Ej. Camiseta oficial firmada"></div><div class="form-group"><label>Descripción</label><input class="create-prize-description" type="text" placeholder="Ej. Talla L, firmada por el plantel"></div><div class="form-group"><label>Foto / cámara</label><input class="create-prize-image" type="file" accept="image/*" capture="environment"></div></div>`;
}

/**
 * Elimina un sorteo (Admin). Si no se indica nombre, elimina el sorteo activo.
 */
async function handleDeleteSorteo(nombre) {
  const target = nombre || currentSorteo;
  if (!target) return;

  const confirmDelete = confirm(`¿Seguro que quieres eliminar el sorteo "${target}"? Esta acción no se puede deshacer.`);
  if (!confirmDelete) return;

  const token = getAdminToken();
  showLoading();

  try {
    const result = await apiDeleteSorteo(target, token);
    if (result.success) {
      alert(`🗑️ ${result.message}`);
      if (target === currentSorteo) localStorage.removeItem(CURRENT_SORTEO_KEY);
      await refreshSorteosList();
      await refreshRaffleData();
    } else {
      alert('❌ Error al eliminar el sorteo: ' + result.error);
    }
  } catch (error) {
    alert('Ocurrió un error al eliminar el sorteo.');
    console.error(error);
  } finally {
    hideLoading();
  }
}

/**
 * Renderiza la tabla de gestión de sorteos (solo Admin): estado, visibilidad y acciones
 */
function renderSorteoManagement() {
  const container = document.getElementById('sorteo-history-list');
  if (!container) return;

  container.innerHTML = '';
  if (!sorteosDetalle.length) {
    container.innerHTML = '<p class="raffle-history-empty">Aún no hay rifas registradas. Crea la primera desde arriba.</p>';
    return;
  }

  sorteosDetalle.forEach(s => {
    const card = document.createElement('article');
    card.className = 'raffle-history-card';
    const esActivo = s.nombre === currentSorteo;

    const estaPublicado = s.visible && s.estado === 'Activo';
    card.innerHTML = `
      <div class='raffle-card-topline'><span>${estaPublicado ? '● PUBLICADO' : '○ ARCHIVADO'}</span><span>${s.estado}</span></div>
      <h3>${s.nombre}</h3>
      <p>${esActivo ? 'Rifa abierta actualmente. Puedes registrar compradores y modificar sus números.' : 'Historial disponible en Google Sheets.'}</p>
      <div class='raffle-card-actions'>
        <button type='button' class='btn-primary' onclick='handleOpenRaffle("${s.nombre}")'>Abrir y administrar</button>
        <button type='button' class='btn-secondary' onclick='openPrizeManager("${s.nombre}")'>🎁 Premios</button>
        <button type='button' class='btn-secondary' onclick='handleOpenDraw("${s.nombre}")'>🏆 Tirar ganadores</button>
        <button type='button' class='btn-secondary' onclick='handleSetSorteoActive("${s.nombre}", ${estaPublicado})'>${estaPublicado ? 'Desactivar público' : 'Activar público'}</button>
        <button type='button' class='btn-secondary' onclick='handleToggleEstado("${s.nombre}", "${s.estado}")'>${s.estado === 'Terminada' ? 'Reactivar' : 'Finalizar'}</button>
        <button type='button' class='btn-secondary btn-danger' onclick='handleDeleteSorteo("${s.nombre}")'>Eliminar</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function escapeHtml(value) {
  const element = document.createElement('div');
  element.textContent = value || '';
  return element.innerHTML;
}

async function readImageAsDataUrl(file) {
  const original = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
    element.src = original;
  });
  // Las fotos se guardan en una celda de Sheets (límite 50.000 caracteres).
  // Se crea una miniatura nítida y liviana para publicación móvil.
  let maxSide = 420;
  let quality = 0.72;
  let result = original;
  for (let attempt = 0; attempt < 8; attempt++) {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    result = canvas.toDataURL('image/jpeg', quality);
    if (result.length <= 45000) return result;
    maxSide = Math.round(maxSide * 0.78);
    quality = Math.max(0.32, quality - 0.08);
  }
  if (result.length > 48000) throw new Error('No fue posible comprimir la foto lo suficiente. Usa una imagen más simple o recórtala.');
  return result;
}

async function openPrizeManager(nombre) {
  const panel = document.getElementById('prize-manager');
  document.getElementById('prize-manager-raffle').textContent = nombre;
  panel.dataset.sorteo = nombre;
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  await refreshPremios(nombre);
}

function closePrizeManager() {
  document.getElementById('prize-manager').hidden = true;
}

async function refreshPremios(nombre) {
  const list = document.getElementById('prizes-list');
  list.innerHTML = '<p class="raffle-history-empty">Cargando premios…</p>';
  try {
    const result = await apiListPremios(nombre);
    const premios = result.premios || [];
    if (!premios.length) {
      list.innerHTML = '<p class="raffle-history-empty">Aún no hay premios. Agrega el primero aquí.</p>';
      return;
    }
    list.innerHTML = premios.map(p => `<article class="prize-card">${p.imagen ? `<img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.titulo)}">` : '<div class="prize-placeholder">🏆</div>'}<div><span>Premio ${p.orden}</span><h4>${escapeHtml(p.titulo)}</h4><p>${escapeHtml(p.descripcion) || 'Sin descripción.'}</p></div><button type="button" class="btn-secondary btn-danger" onclick="handleDeletePremio('${p.id}')">Eliminar</button></article>`).join('');
  } catch (error) {
    list.innerHTML = '<p class="raffle-history-empty">No se pudieron cargar los premios.</p>';
    console.error(error);
  }
}

async function handleSavePremio(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const panel = document.getElementById('prize-manager');
  const nombre = panel.dataset.sorteo;
  const titulo = document.getElementById('new-prize-title').value.trim();
  const descripcion = document.getElementById('new-prize-description').value.trim();
  const image = document.getElementById('new-prize-image').files[0];
  if (!nombre || !titulo) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.classList.add('is-loading');
  button.innerHTML = '<span class="button-spinner"></span> Guardando premio…';
  try {
    const result = await apiSavePremio(nombre, titulo, descripcion, image ? await readImageAsDataUrl(image) : '', getAdminToken());
    if (!result.success) throw new Error(result.error || 'No se pudo guardar el premio.');
    form.reset();
    await refreshPremios(nombre);
  } catch (error) {
    alert('❌ ' + error.message);
  } finally {
    button.disabled = false;
    button.classList.remove('is-loading');
    button.textContent = 'Agregar premio';
  }
}

async function handleDeletePremio(id) {
  const nombre = document.getElementById('prize-manager').dataset.sorteo;
  if (!confirm('¿Seguro que deseas eliminar este premio?')) return;
  try {
    const result = await apiDeletePremio(id, getAdminToken());
    if (!result.success) throw new Error(result.error || 'No se pudo eliminar el premio.');
    await refreshPremios(nombre);
  } catch (error) { alert('❌ ' + error.message); }
}

/**
 * Cambia el sorteo activo desde la tabla de gestión
 */
async function handleViewSorteoFromTable(nombre) {
  currentSorteo = nombre;
  const detalle = sorteosDetalle.find(s => s.nombre === nombre);
  if (detalle && detalle.precio) TICKET_PRICE = Number(detalle.precio);
  localStorage.setItem(CURRENT_SORTEO_KEY, currentSorteo);
  renderSorteoSelector();
  renderSorteoManagement();
  clearSelection();
  await refreshRaffleData(nombre);
}

async function handleOpenRaffle(nombre) {
  await handleViewSorteoFromTable(nombre);
  switchTab('public-view');
}

async function handleOpenDraw(nombre) {
  await handleViewSorteoFromTable(nombre);
  switchTab('accounting-view');
  document.getElementById('winners-count')?.focus();
}

/**
 * Alterna si un sorteo es visible para el modo espectador (público)
 */
async function handleToggleVisibility(nombre, visibleActual) {
  const token = getAdminToken();
  showLoading();

  try {
    const result = await apiSetSorteoVisibility(nombre, !visibleActual, token);
    if (result.success) {
      await refreshSorteosList();
    } else {
      alert('❌ ' + result.error);
    }
  } catch (error) {
    alert('Ocurrió un error al cambiar la visibilidad del sorteo.');
    console.error(error);
  } finally {
    hideLoading();
  }
}

/**
 * Publica o retira un sorteo de la vista pública. Publicar también lo deja
 * en estado Activo para que aparezca inmediatamente en el selector.
 */
async function handleSetSorteoActive(nombre, estaPublicado) {
  const activar = !estaPublicado;
  const mensaje = activar
    ? `¿Activar "${nombre}" para que se vea en el sitio público?`
    : `¿Desactivar "${nombre}"? Dejará de aparecer para el público.`;

  if (!confirm(mensaje)) return;

  const token = getAdminToken();
  showLoading();
  try {
    if (activar) {
      const estado = await apiSetSorteoEstado(nombre, 'Activo', token);
      if (!estado.success) throw new Error(estado.error || 'No se pudo activar el estado.');
    }
    const resultado = await apiSetSorteoVisibility(nombre, activar, token);
    if (!resultado.success) throw new Error(resultado.error || 'No se pudo cambiar la publicación.');
    await refreshSorteosList();
    alert(activar ? `✅ "${nombre}" ya está activo para el público.` : `✅ "${nombre}" fue desactivado para el público.`);
  } catch (error) {
    alert('No se pudo actualizar el estado público del sorteo.');
    console.error(error);
  } finally {
    hideLoading();
  }
}

/**
 * Alterna el estado de un sorteo entre Activo y Terminada
 */
async function handleToggleEstado(nombre, estadoActual) {
  const nuevoEstado = estadoActual === 'Terminada' ? 'Activo' : 'Terminada';
  const token = getAdminToken();
  showLoading();

  try {
    const result = await apiSetSorteoEstado(nombre, nuevoEstado, token);
    if (result.success) {
      await refreshSorteosList();
    } else {
      alert('❌ ' + result.error);
    }
  } catch (error) {
    alert('Ocurrió un error al cambiar el estado del sorteo.');
    console.error(error);
  } finally {
    hideLoading();
  }
}

/* --- SELECCIÓN ALEATORIA Y SORTEO DE GANADORES --- */

/**
 * Selecciona al azar N números "Disponibles" del sorteo activo, como si el admin
 * los hubiera hecho clic manualmente (quedan listos para "Asignar Comprador")
 */
function handlePickRandomNumbers() {
  const input = document.getElementById('random-pick-count');
  const cantidad = parseInt(input.value);

  if (!cantidad || cantidad < 1) {
    alert('❌ Indica una cantidad válida de números a elegir al azar.');
    return;
  }

  const disponibles = ticketsData.filter(t => t.estado === 'Disponible' && !selectedNumbers.includes(t.numero));

  if (disponibles.length === 0) {
    alert('⚠️ No quedan números disponibles para elegir al azar.');
    return;
  }

  if (cantidad > disponibles.length) {
    alert(`⚠️ Solo quedan ${disponibles.length} número(s) disponible(s). Se seleccionarán todos.`);
  }

  // Barajar (Fisher-Yates) y tomar los primeros N
  const barajados = [...disponibles];
  for (let i = barajados.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [barajados[i], barajados[j]] = [barajados[j], barajados[i]];
  }
  const elegidos = barajados.slice(0, cantidad);

  elegidos.forEach(t => {
    const el = document.querySelector(`.ticket[data-numero='${t.numero}']`);
    if (el) toggleNumberSelection(t.numero, el);
  });

  alert(`🎲 Se seleccionaron al azar: ${elegidos.map(t => '#' + t.numero).join(', ')}. Ahora puedes asignarles un comprador.`);
}

/**
 * Sortea al azar N ganadores entre los números marcados como "Pagado" del sorteo activo
 */
function handleDrawWinners() {
  const input = document.getElementById('winners-count');
  const cantidad = parseInt(input.value);

  if (!cantidad || cantidad < 1) {
    alert('❌ Indica cuántos ganadores debe elegir el sorteo.');
    return;
  }

  const elegibles = ticketsData.filter(t => t.estado === 'Pagado');

  if (elegibles.length === 0) {
    alert('⚠️ Todavía no hay números pagados. Solo los dorsales "Pagado" (Gol!) pueden participar del sorteo del ganador.');
    return;
  }

  if (cantidad > elegibles.length) {
    alert(`❌ Solo hay ${elegibles.length} número(s) pagado(s) en juego. Reduce la cantidad de ganadores.`);
    return;
  }

  const confirmDraw = confirm(`¿Tirar la rifa y elegir ${cantidad} ganador(es) al azar entre los ${elegibles.length} números pagados de "${currentSorteo}"?`);
  if (!confirmDraw) return;

  // Barajar (Fisher-Yates) y tomar los primeros N
  const barajados = [...elegibles];
  for (let i = barajados.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [barajados[i], barajados[j]] = [barajados[j], barajados[i]];
  }
  const ganadores = barajados.slice(0, cantidad);

  renderWinnersResult(ganadores);
}

/**
 * Muestra el resultado del sorteo de ganadores en pantalla
 */
function renderWinnersResult(ganadores) {
  const container = document.getElementById('winners-result');
  if (!container) {
    const lista = ganadores.map((g, i) => `${i + 1}. Dorsal #${g.numero} — ${g.nombre || 'Sin nombre'} (${g.telefono || 'Sin teléfono'})`).join('\n');
    alert(`🏆 ¡GANADOR(ES) DEL SORTEO "${currentSorteo}"!\n\n${lista}`);
    return;
  }

  container.innerHTML = `
    <h4 style='margin-bottom: 0.8rem;'>🏆 Ganador(es) de "${currentSorteo}"</h4>
    <ol style='padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.5rem;'>
      ${ganadores.map(g => `<li><strong>Dorsal #${g.numero}</strong> — ${g.nombre || 'Sin nombre'} (${g.telefono || 'Sin teléfono'})</li>`).join('')}
    </ol>
  `;
  container.style.display = 'block';
}
