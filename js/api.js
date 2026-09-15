/**
 * Módulo de API para conectar el Frontend con Google Apps Script.
 * Incluye un simulador automático si no se ha configurado la URL de producción.
 *
 * NOTA: Todas las llamadas usan GET (parámetros en la URL) en vez de POST.
 * Las respuestas de doPost en Apps Script pasan por una redirección interna
 * de Google (script.google.com -> script.googleusercontent.com) que resultó
 * ser lenta e inestable en pruebas reales. doGet responde directo, sin esa
 * redirección, y es mucho más rápido y confiable.
 */

// Coloca aquí la URL de tu Google Apps Script publicada como Web App
const BASE_API_URL = window.RAFFLE_API_URL || '';

// Clave para localStorage si usamos el simulador
const MOCK_STORAGE_KEY_PREFIX = 'rifa_mock_data_';
const MOCK_SORTEOS_KEY = 'rifa_mock_sorteos';
const MOCK_TOKEN = 'token_seguro_club_futbol_2026_xyz';
const DEFAULT_SORTEO_NAME = 'Rifa';

/**
 * Obtiene la URL de la API publicada. Se ignora cualquier URL antigua que
 * haya quedado guardada en el navegador para evitar conectar a despliegues
 * eliminados o vencidos.
 */
function getApiUrl() {
  // El servidor local incluido (puerto 5174) actúa como puente con Apps Script
  // y evita que el navegador bloquee sus redirecciones entre dominios de Google.
  if (window.location.hostname === '127.0.0.1' && window.location.port === '5174') {
    return `${window.location.origin}/api`;
  }
  return BASE_API_URL;
}

/**
 * Guarda la URL de la API dinámicamente desde la interfaz
 */
function setApiUrl(url) {
  if (url) {
    localStorage.setItem('rifa_api_url', url);
  } else {
    localStorage.removeItem('rifa_api_url');
  }
}

/**
 * Genera datos de prueba iniciales (100 números libres) para un sorteo del simulador
 */
function initMockData(sorteo) {
  const key = MOCK_STORAGE_KEY_PREFIX + sorteo;
  if (!localStorage.getItem(key)) {
    const mockTickets = [];
    for (let i = 1; i <= 100; i++) {
      mockTickets.push({
        numero: i,
        estado: 'Disponible',
        nombre: '',
        telefono: '',
        medioPago: '',
        fecha: ''
      });
    }
    localStorage.setItem(key, JSON.stringify(mockTickets));
  }
}

/**
 * Devuelve la lista de sorteos del simulador (con metadatos), creando el sorteo por defecto si no hay ninguno
 */
function getMockSorteos() {
  let sorteos = JSON.parse(localStorage.getItem(MOCK_SORTEOS_KEY) || 'null');
  if (!sorteos || sorteos.length === 0) {
    sorteos = [{ nombre: DEFAULT_SORTEO_NAME, visible: true, estado: 'Activo' }];
    localStorage.setItem(MOCK_SORTEOS_KEY, JSON.stringify(sorteos));
  }
  return sorteos;
}

function saveMockSorteos(sorteos) {
  localStorage.setItem(MOCK_SORTEOS_KEY, JSON.stringify(sorteos));
}

/**
 * Lista los sorteos disponibles. En modo Admin retorna metadatos completos (objetos),
 * en modo público retorna solo los nombres de los sorteos visibles.
 */
async function apiListSorteos(token = null) {
  const url = getApiUrl();

  if (!url) {
    const sorteos = getMockSorteos();
    if (token === MOCK_TOKEN) {
      return { sorteos: sorteos };
    } else {
      return { sorteos: sorteos.filter(s => s.visible).map(s => s.nombre) };
    }
  }

  try {
    let fetchUrl = `${url}?action=sorteos`;
    if (token) fetchUrl += `&token=${token}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error('Error en la respuesta del servidor.');
    return await response.json();
  } catch (error) {
    console.error('Error al listar sorteos:', error);
    throw error;
  }
}

/**
 * Obtener la lista de números (Público o Admin) de un sorteo específico
 */
async function apiGetTickets(sorteo, adminToken = null) {
  const url = getApiUrl();

  // Si no hay API configurada, usamos el simulador local
  if (!url) {
    const sorteoActivo = sorteo || getMockSorteos()[0].nombre;
    initMockData(sorteoActivo);
    const allTickets = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY_PREFIX + sorteoActivo));

    if (adminToken === MOCK_TOKEN) {
      return { sorteo: sorteoActivo, tickets: allTickets }; // Enviar todo en modo admin
    } else {
      // Retornar versión pública y segura (ocultando datos personales)
      const safeTickets = allTickets.map(t => ({
        numero: t.numero,
        estado: t.estado
      }));
      return { sorteo: sorteoActivo, tickets: safeTickets };
    }
  }

  // Llamada real a la API de Google Apps Script
  try {
    let fetchUrl = `${url}?action=tickets`;
    if (sorteo) {
      fetchUrl += `&sorteo=${encodeURIComponent(sorteo)}`;
    }
    if (adminToken) {
      fetchUrl += `&token=${adminToken}`;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error('Error en la respuesta del servidor.');
    return await response.json();
  } catch (error) {
    console.error('Error al obtener tickets:', error);
    throw error;
  }
}

/**
 * Autenticación de Administrador
 */
async function apiLogin(password) {
  const url = getApiUrl();

  if (!url) {
    return { success: false, error: 'Configura js/config.js con la URL de Apps Script para usar el acceso administrador.' };
  }

  try {
    const fetchUrl = `${url}?action=login&password=${encodeURIComponent(password)}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error('Error en la red al iniciar sesión.');
    return await response.json();
  } catch (error) {
    console.error('Error de login:', error);
    throw error;
  }
}

/**
 * Actualizar estados de números (Múltiple / Individual) de un sorteo específico
 */
async function apiUpdateTickets(ticketsToUpdate, token, sorteo) {
  const url = getApiUrl();

  if (!url) {
    // Simulación local de actualización
    if (token !== MOCK_TOKEN) {
      return { success: false, error: 'No autorizado.' };
    }

    const sorteoActivo = sorteo || getMockSorteos()[0].nombre;
    initMockData(sorteoActivo);
    const key = MOCK_STORAGE_KEY_PREFIX + sorteoActivo;
    const allTickets = JSON.parse(localStorage.getItem(key));

    ticketsToUpdate.forEach(update => {
      const idx = allTickets.findIndex(t => t.numero === parseInt(update.numero));
      if (idx !== -1) {
        allTickets[idx].estado = update.estado;
        allTickets[idx].nombre = update.estado === 'Disponible' ? '' : update.nombre;
        allTickets[idx].telefono = update.estado === 'Disponible' ? '' : update.telefono;
        allTickets[idx].medioPago = update.estado === 'Disponible' ? '' : update.medioPago;
        allTickets[idx].fecha = new Date().toISOString();
      }
    });

    localStorage.setItem(key, JSON.stringify(allTickets));
    return { success: true, message: 'Simulación: Números actualizados correctamente en localStorage.' };
  }

  try {
    const fetchUrl = `${url}?action=updateTickets&token=${encodeURIComponent(token)}&sorteo=${encodeURIComponent(sorteo || '')}&tickets=${encodeURIComponent(JSON.stringify(ticketsToUpdate))}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error('Error de red al actualizar números.');
    return await response.json();
  } catch (error) {
    console.error('Error al actualizar números:', error);
    throw error;
  }
}

/**
 * Crea un nuevo sorteo (Admin)
 */
async function apiCreateSorteo(nombre, cantidad, token, precio = 5000) {
  const url = getApiUrl();

  if (!url) {
    if (token !== MOCK_TOKEN) {
      return { success: false, error: 'No autorizado.' };
    }

    const sorteos = getMockSorteos();
    if (sorteos.some(s => s.nombre === nombre)) {
      return { success: false, error: 'Ya existe un sorteo con ese nombre.' };
    }

    sorteos.push({ nombre: nombre, visible: true, estado: 'Activo' });
    saveMockSorteos(sorteos);
    initMockData(nombre);
    return { success: true, message: `Sorteo "${nombre}" creado con ${cantidad} números.`, sorteo: nombre };
  }

  try {
    const fetchUrl = `${url}?action=createSorteo&nombre=${encodeURIComponent(nombre)}&cantidad=${encodeURIComponent(cantidad)}&precio=${encodeURIComponent(precio)}&token=${encodeURIComponent(token)}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error('Error de red al crear el sorteo.');
    return await response.json();
  } catch (error) {
    console.error('Error al crear sorteo:', error);
    throw error;
  }
}

async function apiUploadPrizeImage(nombre, descripcion, imagen, token) {
  const response = await fetch(getApiUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'uploadPrizeImage', nombre, descripcion, imagen, token }) });
  if (!response.ok) throw new Error('No se pudo subir la imagen.');
  return response.json();
}

/**
 * Elimina un sorteo existente (Admin)
 */
async function apiDeleteSorteo(nombre, token) {
  const url = getApiUrl();

  if (!url) {
    if (token !== MOCK_TOKEN) {
      return { success: false, error: 'No autorizado.' };
    }

    let sorteos = getMockSorteos();
    if (sorteos.length <= 1) {
      return { success: false, error: 'No puedes eliminar el único sorteo existente.' };
    }

    sorteos = sorteos.filter(s => s.nombre !== nombre);
    saveMockSorteos(sorteos);
    localStorage.removeItem(MOCK_STORAGE_KEY_PREFIX + nombre);
    return { success: true, message: `Sorteo "${nombre}" eliminado.` };
  }

  try {
    const fetchUrl = `${url}?action=deleteSorteo&nombre=${encodeURIComponent(nombre)}&token=${encodeURIComponent(token)}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error('Error de red al eliminar el sorteo.');
    return await response.json();
  } catch (error) {
    console.error('Error al eliminar sorteo:', error);
    throw error;
  }
}

/**
 * Cambia la visibilidad pública de un sorteo (Admin)
 */
async function apiSetSorteoVisibility(nombre, visible, token) {
  const url = getApiUrl();

  if (!url) {
    if (token !== MOCK_TOKEN) {
      return { success: false, error: 'No autorizado.' };
    }
    const sorteos = getMockSorteos();
    const item = sorteos.find(s => s.nombre === nombre);
    if (!item) return { success: false, error: 'El sorteo indicado no existe.' };
    item.visible = !!visible;
    saveMockSorteos(sorteos);
    return { success: true, message: visible ? `"${nombre}" ahora es visible para el público.` : `"${nombre}" ahora está oculto para el público.` };
  }

  try {
    const fetchUrl = `${url}?action=setSorteoVisibility&nombre=${encodeURIComponent(nombre)}&visible=${!!visible}&token=${encodeURIComponent(token)}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error('Error de red al cambiar la visibilidad.');
    return await response.json();
  } catch (error) {
    console.error('Error al cambiar visibilidad del sorteo:', error);
    throw error;
  }
}

/**
 * Cambia el estado (Activo/Terminada) de un sorteo (Admin)
 */
async function apiSetSorteoEstado(nombre, estado, token) {
  const url = getApiUrl();

  if (!url) {
    if (token !== MOCK_TOKEN) {
      return { success: false, error: 'No autorizado.' };
    }
    const sorteos = getMockSorteos();
    const item = sorteos.find(s => s.nombre === nombre);
    if (!item) return { success: false, error: 'El sorteo indicado no existe.' };
    item.estado = estado;
    saveMockSorteos(sorteos);
    return { success: true, message: `"${nombre}" ahora está marcado como "${estado}".` };
  }

  try {
    const fetchUrl = `${url}?action=setSorteoEstado&nombre=${encodeURIComponent(nombre)}&estado=${encodeURIComponent(estado)}&token=${encodeURIComponent(token)}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error('Error de red al cambiar el estado.');
    return await response.json();
  } catch (error) {
    console.error('Error al cambiar estado del sorteo:', error);
    throw error;
  }
}
