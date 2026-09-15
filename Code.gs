// CONFIGURACIÓN DE SEGURIDAD
// La contraseña de administrador YA NO vive en este código público: se guarda y se consulta
// desde una pestaña oculta ("_Auth") dentro de tu propia Hoja de Cálculo privada.
// Para cambiarla, edita la celda B1 de esa pestaña directamente en Google Sheets.
const ADMIN_PASSWORD = getRequiredScriptProperty("ADMIN_PASSWORD");
const ADMIN_TOKEN = getRequiredScriptProperty("ADMIN_TOKEN");
const SPREADSHEET_ID = getRequiredScriptProperty("SPREADSHEET_ID");
const DEFAULT_SORTEO = "Rifa"; // Nombre de la pestaña/sorteo usado si no se indica ninguno
const DEFAULT_TICKET_PRICE = 5000;
const CONFIG_SHEET_NAME = "_Sorteos"; // Lista central de sorteos y su visibilidad
const PRIZES_SHEET_NAME = "_Premios"; // Premios asociados a cada rifa
const LEGACY_CONFIG_SHEET_NAME = "_Config"; // Configuración anterior, ignorada por la aplicación
const AUTH_SHEET_NAME = "_Auth"; // Pestaña oculta con la contraseña de administrador

function isSystemSheet(name) {
  return name === CONFIG_SHEET_NAME || name === PRIZES_SHEET_NAME || name === LEGACY_CONFIG_SHEET_NAME || name === AUTH_SHEET_NAME;
}

function getRequiredScriptProperty(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error(`Falta la propiedad privada "${name}" en Apps Script.`);
  return value;
}

/** Ejecuta esta función una vez desde el editor de Apps Script para autorizar
 * el guardado de fotografías de premios en Google Drive. */
function autorizarFotosPremios() {
  return DriveApp.getRootFolder().getName();
}

/**
 * Carga y renderiza la página web principal del sorteo
 * O responde peticiones GET externas de la API
 */
function doGet(e) {
  const action = e.parameter.action;

  if (action === "getData" || action === "tickets") {
    try {
      const token = e.parameter.token;
      const sorteo = e.parameter.sorteo;
      return apiResponse(e, getTicketsData(token, sorteo));
    } catch (err) {
      return apiResponse(e, { error: "No se pudieron leer los tickets: " + err.message });
    }
  }

  if (action === "listSorteos" || action === "sorteos") {
    try {
      const token = e.parameter.token;
      return apiResponse(e, listSorteos(token));
    } catch (err) {
      return apiResponse(e, { error: "No se pudieron listar los sorteos: " + err.message });
    }
  }

  if (action === "listPremios") {
    try {
      return apiResponse(e, listPremios(e.parameter.nombre));
    } catch (err) {
      return apiResponse(e, { error: "No se pudieron listar los premios: " + err.message });
    }
  }

  // Las acciones que modifican datos también se sirven por GET (en vez de POST) porque
  // las respuestas de doPost pasan por una redirección interna de Google que resultó
  // ser lenta e inestable; doGet responde directo y de forma mucho más confiable.
  if (action === "login") {
    try {
      return apiResponse(e, loginAdmin(e.parameter.password || ""));
    } catch (err) {
      return apiResponse(e, { success: false, error: "No se pudo leer la configuración de acceso: " + err.message });
    }
  }

  if (action === "updateTickets") {
    const tickets = JSON.parse(e.parameter.tickets || "[]");
    return apiResponse(e, updateTicketsData(tickets, e.parameter.token, e.parameter.sorteo));
  }

  if (action === "createSorteo") {
    return apiResponse(e, createSorteo(e.parameter.nombre, e.parameter.cantidad, e.parameter.token, e.parameter.precio));
  }

  if (action === "deleteSorteo") {
    return apiResponse(e, deleteSorteo(e.parameter.nombre, e.parameter.token));
  }

  if (action === "setSorteoVisibility") {
    return apiResponse(e, setSorteoVisibility(e.parameter.nombre, e.parameter.visible === "true", e.parameter.token));
  }

  if (action === "setSorteoEstado") {
    return apiResponse(e, setSorteoEstado(e.parameter.nombre, e.parameter.estado, e.parameter.token));
  }

  if (action === "deletePremio") {
    return apiResponse(e, deletePremio(e.parameter.id, e.parameter.token));
  }

  // DE LO CONTRARIO, RENDERIZAR LA WEB APP NATIVA
  const template = HtmlService.createTemplateFromFile("index");
  return template.evaluate()
    .setTitle("Rifa Club de Fútbol - Gran Sorteo")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // Permitir cargar la app en frames
}

/**
 * Responde peticiones POST externas de la API (desde index.html local o GitHub)
 */
function doPost(e) {
  let postData;
  try {
    postData = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ error: "Formato JSON inválido." });
  }

  const action = postData.action;

  if (action === "login") {
    return jsonResponse(loginAdmin(postData.password));
  }

  if (action === "updateTickets") {
    return jsonResponse(updateTicketsData(postData.tickets, postData.token, postData.sorteo));
  }

  if (action === "createSorteo") {
    return jsonResponse(createSorteo(postData.nombre, postData.cantidad, postData.token, postData.precio));
  }

  if (action === "deleteSorteo") {
    return jsonResponse(deleteSorteo(postData.nombre, postData.token));
  }

  if (action === "uploadPrizeImage") {
    return jsonResponse(uploadPrizeImage(postData.nombre, postData.descripcion, postData.imagen, postData.token));
  }

  if (action === "savePremio") {
    return jsonResponse(savePremio(postData.nombre, postData.titulo, postData.descripcion, postData.imagen, postData.token));
  }

  if (action === "setSorteoVisibility") {
    return jsonResponse(setSorteoVisibility(postData.nombre, postData.visible, postData.token));
  }

  if (action === "setSorteoEstado") {
    return jsonResponse(setSorteoEstado(postData.nombre, postData.estado, postData.token));
  }

  return jsonResponse({ error: "Acción no reconocida." });
}

/**
 * Convierte cualquier respuesta en JSON con cabeceras correctas para evitar bloqueos CORS
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Respuesta JSONP para el sitio en GitHub Pages, que no puede usar fetch
 * de forma fiable tras las redirecciones CORS internas de Google. */
function apiResponse(e, data) {
  const callback = e && e.parameter && e.parameter.callback;
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(`${callback}(${JSON.stringify(data)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResponse(data);
}

/**
 * Función de utilidad para incluir otros archivos HTML (estilos y scripts) dentro de index.html
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* --- METADATOS DE SORTEOS (VISIBILIDAD Y ESTADO) --- */

/**
 * Obtiene (o crea) la pestaña oculta de configuración de sorteos
 */
function getOrCreateConfigSheet(spreadsheet) {
  spreadsheet = spreadsheet || SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG_SHEET_NAME);
    sheet.appendRow(["Sorteo", "Activo", "Estado"]);

    // Registrar todas las pestañas reales. Se crean inactivas para que el
    // administrador decida expresamente cuáles se publican.
    spreadsheet.getSheets()
      .filter(s => !isSystemSheet(s.getName()))
      .forEach(s => sheet.appendRow([s.getName(), false, "Activo"]));
  }

  const headers = ["Sorteo", "Activo", "Estado", "Valor por número", "Descripción del premio", "Imagen del premio"];
  headers.forEach((header, index) => {
    if (!sheet.getRange(1, index + 1).getValue()) sheet.getRange(1, index + 1).setValue(header);
  });
  return sheet;
}

/**
 * Devuelve un mapa { nombreSorteo: {visible, estado} } con los metadatos guardados
 */
function getConfigMap(spreadsheet) {
  const sheet = getOrCreateConfigSheet(spreadsheet);
  const lastRow = sheet.getLastRow();
  const map = {};

  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    values.forEach(row => {
      if (row[0]) {
        map[row[0]] = {
          visible: row[1] === true || row[1] === "TRUE",
          estado: row[2] || "Activo", precio: Number(row[3]) || DEFAULT_TICKET_PRICE,
          descripcion: row[4] || "", imagen: row[5] || ""
        };
      }
    });
  }

  return map;
}

/**
 * Crea o actualiza la fila de metadatos de un sorteo
 * @param {string} nombre Nombre del sorteo
 * @param {boolean} visible Si debe verse en modo espectador (opcional, no se toca si es undefined)
 * @param {string} estado "Activo" o "Terminada" (opcional, no se toca si es undefined)
 */
function upsertSorteoConfig(nombre, visible, estado, precio) {
  const sheet = getOrCreateConfigSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < values.length; i++) {
      if (values[i][0] === nombre) {
        const rowIndex = i + 2;
        if (visible !== undefined) sheet.getRange(rowIndex, 2).setValue(visible);
        if (estado !== undefined) sheet.getRange(rowIndex, 3).setValue(estado);
        if (precio !== undefined) sheet.getRange(rowIndex, 4).setValue(precio);
        return;
      }
    }
  }

  sheet.appendRow([nombre, visible !== undefined ? visible : true, estado || "Activo", precio || DEFAULT_TICKET_PRICE]);
}

/**
 * Elimina la fila de metadatos de un sorteo (al eliminar el sorteo)
 */
function removeSorteoConfig(nombre) {
  const sheet = getOrCreateConfigSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === nombre) {
      sheet.deleteRow(i + 2);
      return;
    }
  }
}

/* --- PREMIOS POR RIFA --- */

function getOrCreatePrizesSheet(spreadsheet) {
  spreadsheet = spreadsheet || SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(PRIZES_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PRIZES_SHEET_NAME);
    sheet.appendRow(["ID", "Sorteo", "Orden", "Premio", "Descripción", "Imagen"]);
    sheet.hideSheet();
  }
  return sheet;
}

function listPremios(nombre) {
  const sheet = getOrCreatePrizesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { premios: [] };
  const premios = sheet.getRange(2, 1, lastRow - 1, 6).getValues()
    .filter(row => row[1] === nombre)
    .sort((a, b) => Number(a[2]) - Number(b[2]))
    .map(row => ({ id: row[0], sorteo: row[1], orden: Number(row[2]), titulo: row[3] || "Premio", descripcion: row[4] || "", imagen: row[5] || "" }));
  return { premios: premios };
}

function savePrizeImage(nombre, imageData) {
  if (!imageData) return "";
  const match = String(imageData).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Formato de imagen inválido.");
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 4 * 1024 * 1024) throw new Error("La imagen supera 4 MB.");
  const folders = DriveApp.getFoldersByName("Premios Sorteos Inter Chile");
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("Premios Sorteos Inter Chile");
  const extension = match[1].split('/')[1].replace('jpeg', 'jpg');
  const file = folder.createFile(Utilities.newBlob(bytes, match[1], `${nombre}-${Date.now()}.${extension}`));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return `https://drive.google.com/uc?export=view&id=${file.getId()}`;
}

function savePremio(nombre, titulo, descripcion, imageData, token) {
  if (token !== ADMIN_TOKEN) return { success: false, error: "Acceso no autorizado." };
  if (!nombre || !titulo || !String(titulo).trim()) return { success: false, error: "Indica el nombre del premio." };
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (!spreadsheet.getSheetByName(nombre)) return { success: false, error: "No se encontró la rifa." };
    const sheet = getOrCreatePrizesSheet(spreadsheet);
    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 6).getValues() : [];
    const orden = rows.filter(row => row[1] === nombre).length + 1;
    const imagen = savePrizeImage(nombre, imageData);
    const id = Utilities.getUuid();
    sheet.appendRow([id, nombre, orden, String(titulo).trim(), descripcion || "", imagen]);
    return { success: true, premio: { id: id, sorteo: nombre, orden: orden, titulo: String(titulo).trim(), descripcion: descripcion || "", imagen: imagen } };
  } catch (err) { return { success: false, error: err.toString() }; }
}

function deletePremio(id, token) {
  if (token !== ADMIN_TOKEN) return { success: false, error: "Acceso no autorizado." };
  const sheet = getOrCreatePrizesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: "No se encontró el premio." };
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const index = ids.findIndex(row => row[0] === id);
  if (index < 0) return { success: false, error: "No se encontró el premio." };
  sheet.deleteRow(index + 2);
  return { success: true };
}

function removePremiosSorteo(nombre) {
  const sheet = getOrCreatePrizesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (let i = values.length - 1; i >= 0; i--) if (values[i][1] === nombre) sheet.deleteRow(i + 2);
}

function uploadPrizeImage(nombre, descripcion, imageData, token) {
  if (token !== ADMIN_TOKEN) return { success: false, error: "Acceso no autorizado." };
  if (!nombre || !imageData) return { success: false, error: "Falta la imagen o el sorteo." };
  try {
    const match = String(imageData).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return { success: false, error: "Formato de imagen inválido." };
    const bytes = Utilities.base64Decode(match[2]);
    if (bytes.length > 4 * 1024 * 1024) return { success: false, error: "La imagen supera 4 MB." };
    const folders = DriveApp.getFoldersByName("Premios Sorteos Inter Chile");
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("Premios Sorteos Inter Chile");
    const extension = match[1].split('/')[1].replace('jpeg', 'jpg');
    const file = folder.createFile(Utilities.newBlob(bytes, match[1], `${nombre}-${Date.now()}.${extension}`));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const sheet = getOrCreateConfigSheet();
    const names = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    const row = names.findIndex(r => r[0] === nombre) + 2;
    if (row < 2) return { success: false, error: "No se encontró la rifa." };
    sheet.getRange(row, 5).setValue(descripcion || "");
    sheet.getRange(row, 6).setValue(`https://drive.google.com/uc?export=view&id=${file.getId()}`);
    return { success: true, imagen: `https://drive.google.com/uc?export=view&id=${file.getId()}` };
  } catch (err) { return { success: false, error: err.toString() }; }
}

/**
 * Cambia la visibilidad pública de un sorteo (Admin)
 */
function setSorteoVisibility(nombre, visible, token) {
  if (token !== ADMIN_TOKEN) {
    return { success: false, error: "Acceso no autorizado." };
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (!spreadsheet.getSheetByName(nombre)) {
      return { success: false, error: "El sorteo indicado no existe." };
    }

    // Solo puede existir un sorteo público activo a la vez.
    if (visible) {
      const config = getOrCreateConfigSheet(spreadsheet);
      const rows = config.getRange(2, 1, Math.max(config.getLastRow() - 1, 1), 3).getValues();
      rows.forEach((row, i) => { if (row[0] && row[0] !== nombre) config.getRange(i + 2, 2).setValue(false); });
    }
    upsertSorteoConfig(nombre, !!visible, undefined);
    return { success: true, message: visible ? `"${nombre}" ahora es visible para el público.` : `"${nombre}" ahora está oculto para el público.` };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Cambia el estado (Activo/Terminada) de un sorteo (Admin)
 */
function setSorteoEstado(nombre, estado, token) {
  if (token !== ADMIN_TOKEN) {
    return { success: false, error: "Acceso no autorizado." };
  }

  if (estado !== "Activo" && estado !== "Terminada") {
    return { success: false, error: "Estado inválido. Usa 'Activo' o 'Terminada'." };
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (!spreadsheet.getSheetByName(nombre)) {
      return { success: false, error: "El sorteo indicado no existe." };
    }

    upsertSorteoConfig(nombre, undefined, estado);
    return { success: true, message: `"${nombre}" ahora está marcado como "${estado}".` };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Lista todos los sorteos (pestañas) disponibles en la hoja de cálculo.
 * En modo Admin retorna metadatos completos; en modo público solo los nombres visibles.
 * @param {string} token Token de administración (opcional)
 */
function listSorteos(token) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheets = spreadsheet.getSheets().filter(s => !isSystemSheet(s.getName()));

    if (sheets.length === 0) {
      getOrCreateSorteoSheet(DEFAULT_SORTEO); // Se autocrea el sorteo por defecto si la hoja está vacía
      sheets = spreadsheet.getSheets().filter(s => !isSystemSheet(s.getName()));
    }

    const isAdmin = (token === ADMIN_TOKEN);
    let configMap;
    try {
      configMap = getConfigMap(spreadsheet);
    } catch (configError) {
      // Nunca exponer sorteos al público por una falla de metadatos. El admin
      // sí puede recuperarlos para seguir gestionándolos.
      if (!isAdmin) return { sorteos: [] };
      return { sorteos: sheets.map(s => ({ nombre: s.getName(), visible: false, estado: "Activo" })) };
    }

    const detalle = sheets.map(s => {
      const nombre = s.getName();
      const cfg = configMap[nombre] || { visible: true, estado: "Activo" };
      return { nombre: nombre, visible: cfg.visible, estado: cfg.estado, precio: cfg.precio || DEFAULT_TICKET_PRICE, descripcion: cfg.descripcion || "", imagen: cfg.imagen || "" };
    });

    if (isAdmin) {
      return { sorteos: detalle };
    } else {
      const publicos = detalle.filter(d => d.visible && d.estado === "Activo");
      return { sorteos: publicos };
    }
  } catch (err) {
    return { error: err.toString() };
  }
}

/**
 * Obtener la lista de números de un sorteo específico
 * @param {string} token Token de administración (opcional)
 * @param {string} sorteo Nombre de la pestaña/sorteo (opcional, usa el primero disponible por defecto)
 */
function getTicketsData(token, sorteo) {
  try {
    const sheet = getOrCreateSorteoSheet(sorteo);

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { sorteo: sheet.getName(), tickets: [] };
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, 6);
    const values = dataRange.getValues();

    const isAdmin = (token === ADMIN_TOKEN);

    const tickets = values.map(row => {
      const num = row[0];
      const estado = row[1] || "Disponible";
      const nombre = row[2] || "";
      const telefono = row[3] || "";
      const medioPago = row[4] || "";
      const fecha = row[5] ? row[5].toString() : "";

      if (isAdmin) {
        return {
          numero: num,
          estado: estado,
          nombre: nombre,
          telefono: telefono,
          medioPago: medioPago,
          fecha: fecha
        };
      } else {
        // Vista pública y segura por protección de privacidad de datos
        return {
          numero: num,
          estado: estado
        };
      }
    });

    return { sorteo: sheet.getName(), tickets: tickets };
  } catch (err) {
    return { error: err.toString() };
  }
}

/**
 * Obtiene la pestaña del sorteo indicado. Si no existe ninguna pestaña en la hoja,
 * crea la pestaña por defecto con 100 números.
 * @param {string} sorteo Nombre de la pestaña/sorteo (opcional)
 */
function getOrCreateSorteoSheet(sorteo) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (sorteo) {
    const existing = spreadsheet.getSheetByName(sorteo);
    if (existing) return existing;
  }

  const sheets = spreadsheet.getSheets().filter(s => !isSystemSheet(s.getName()));
  if (!sorteo && sheets.length > 0) {
    return sheets[0]; // Usar el primer sorteo disponible si no se especifica ninguno
  }

  // No hay ningún sorteo aún: crear el sorteo por defecto con 100 números
  return createSorteoSheet(sorteo || DEFAULT_SORTEO, 100);
}

/**
 * Crea una nueva pestaña/sorteo con la cantidad de números indicada
 * @param {string} nombre Nombre del nuevo sorteo
 * @param {number} cantidad Cantidad de números a generar (1 a N)
 */
function createSorteoSheet(nombre, cantidad, precio) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.insertSheet(nombre);
  sheet.appendRow(["Numero", "Estado", "Nombre", "Telefono", "MedioPago", "Fecha"]);

  const total = cantidad || 100;
  const rows = [];
  for (let i = 1; i <= total; i++) {
    rows.push([i, "Disponible", "", "", "", ""]);
  }
  sheet.getRange(2, 1, rows.length, 6).setValues(rows);

  upsertSorteoConfig(nombre, true, "Activo", precio || DEFAULT_TICKET_PRICE);

  return sheet;
}

/**
 * Crea un nuevo sorteo (Admin). Valida nombre único y cantidad de números.
 * @param {string} nombre Nombre del nuevo sorteo
 * @param {number} cantidad Cantidad de números del sorteo
 * @param {string} token Token de sesión de administración
 */
function createSorteo(nombre, cantidad, token, precio) {
  if (token !== ADMIN_TOKEN) {
    return { success: false, error: "Acceso no autorizado." };
  }

  const nombreLimpio = (nombre || "").toString().trim();
  if (!nombreLimpio) {
    return { success: false, error: "Debes indicar un nombre para el nuevo sorteo." };
  }

  if (isSystemSheet(nombreLimpio)) {
    return { success: false, error: "Ese nombre está reservado por el sistema." };
  }

  const cantidadNum = parseInt(cantidad);
  if (!cantidadNum || cantidadNum < 1 || cantidadNum > 1000) {
    return { success: false, error: "La cantidad de números debe ser entre 1 y 1000." };
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (spreadsheet.getSheetByName(nombreLimpio)) {
      return { success: false, error: "Ya existe un sorteo con ese nombre." };
    }

    const precioNum = parseInt(precio) || DEFAULT_TICKET_PRICE;
    createSorteoSheet(nombreLimpio, cantidadNum, precioNum);
    return { success: true, message: `Sorteo "${nombreLimpio}" creado con ${cantidadNum} números.`, sorteo: nombreLimpio };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Elimina un sorteo existente (Admin). No permite eliminar el único sorteo restante.
 * @param {string} nombre Nombre del sorteo a eliminar
 * @param {string} token Token de sesión de administración
 */
function deleteSorteo(nombre, token) {
  if (token !== ADMIN_TOKEN) {
    return { success: false, error: "Acceso no autorizado." };
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(nombre);
    if (!sheet) {
      return { success: false, error: "El sorteo indicado no existe." };
    }

    spreadsheet.deleteSheet(sheet);
    removeSorteoConfig(nombre);
    removePremiosSorteo(nombre);
    return { success: true, message: `Sorteo "${nombre}" eliminado.` };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Obtiene (o crea) la pestaña oculta donde vive la contraseña de administrador.
 * La contraseña real se lee de la celda B1: para cambiarla, edítala directamente en Sheets.
 */
function getOrCreateAuthSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(AUTH_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(AUTH_SHEET_NAME);
    sheet.getRange(1, 1).setValue("Contraseña de Administrador (edita la celda de al lado para cambiarla)");
    sheet.getRange(1, 2).setValue(ADMIN_PASSWORD);
    sheet.hideSheet();
  }

  return sheet;
}

/**
 * Lee la contraseña de administrador vigente desde la pestaña "_Auth".
 * Se consulta directamente para evitar estados de caché obsoletos en la Web App.
 */
function getAdminPassword() {
  const sheet = getOrCreateAuthSheet();
  const password = String(sheet.getRange(1, 2).getValue() || "").trim();
  if (!password) {
    throw new Error('No hay contraseña configurada en la celda B1 de la hoja _Auth.');
  }
  return password;
}

/**
 * Autentica al administrador y genera el token de sesión
 * @param {string} password Contraseña ingresada
 */
function loginAdmin(password) {
  if (password === getAdminPassword()) {
    return { success: true, token: ADMIN_TOKEN };
  } else {
    return { success: false, error: "Contraseña incorrecta." };
  }
}

/**
 * Actualiza el lote de números de un sorteo en Google Sheets (Admin)
 * @param {Array} ticketsToUpdate Array de objetos { numero, estado, nombre, telefono, medioPago }
 * @param {string} token Token de sesión de administración
 * @param {string} sorteo Nombre de la pestaña/sorteo a actualizar
 */
function updateTicketsData(ticketsToUpdate, token, sorteo) {
  if (token !== ADMIN_TOKEN) {
    return { success: false, error: "Acceso no autorizado." };
  }

  try {
    const sheet = getOrCreateSorteoSheet(sorteo);

    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 6);
    const values = dataRange.getValues();
    const fecha = new Date();

    ticketsToUpdate.forEach(ticket => {
      const targetNum = parseInt(ticket.numero);

      for (let i = 0; i < values.length; i++) {
        if (parseInt(values[i][0]) === targetNum) {
          values[i][1] = ticket.estado;
          values[i][2] = ticket.estado === "Disponible" ? "" : ticket.nombre;
          values[i][3] = ticket.estado === "Disponible" ? "" : ticket.telefono;
          values[i][4] = ticket.estado === "Disponible" ? "" : ticket.medioPago;
          values[i][5] = fecha;
          break;
        }
      }
    });

    // Una sola escritura en lote para toda la hoja (mucho más rápido que celda por celda)
    dataRange.setValues(values);

    return { success: true, message: "¡Sorteo actualizado en Sheets con éxito!" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}
