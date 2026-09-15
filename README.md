# ⚽ App Sorteo Deportivo - Club de Fútbol (Versión Google Apps Script Nativa) 🏆

¡Bienvenido a la aplicación de gestión de rifas y sorteos del club de fútbol! Esta versión está optimizada para ejecutarse **100% dentro de Google Apps Script** como una aplicación web nativa. 

### 🌟 Ventajas de esta versión:
1. **Sin CORS ni configuraciones externas:** Todo corre bajo el ecosistema seguro de Google.
2. **Cero configuraciones de URL:** El frontend y backend se comunican directamente.
3. **Gratis para siempre:** Alojado de forma segura y permanente en los servidores de Google Drive.

---

## 🛠️ Guía de Instalación en 5 Minutos (Paso a Paso)

Sigue estos sencillos pasos para tener tu aplicación en vivo hoy mismo:

### Paso 1: Configurar la Hoja de Google Sheets
1. Abre tu [Google Drive](https://drive.google.com) y crea una nueva **Hoja de cálculo de Google** (Google Sheets).
2. Nómbrala, por ejemplo: `Sorteo Club de Fútbol`.
3. Renombra la pestaña actual como **`Rifa`** (exactamente con la R mayúscula).
4. En la primera fila (fila 1), escribe los siguientes encabezados de la columna **A** a la **F**:
   * **A1:** `Numero`
   * **B1:** `Estado`
   * **C1:** `Nombre`
   * **D1:** `Telefono`
   * **E1:** `MedioPago`
   * **F1:** `FechaActualizacion`
5. En la columna **A** (Numero), llena la lista de números que vas a vender (ej. escribe del 1 al 100 hacia abajo, de la fila 2 a la 101). Puedes escribir la cantidad de números que quieras (ej. del 1 al 200).
6. Deja las demás columnas vacías.

### Paso 2: Crear el Proyecto en Google Apps Script
1. En tu hoja de cálculo, ve al menú superior y selecciona **Extensiones > Apps Script**.
2. Cambia el nombre del proyecto arriba a la izquierda (ej. `Web App Sorteo`).
3. Verás un archivo llamado `Código.gs` (o `Code.gs`). Borra todo su contenido.
4. Abre el archivo **`Code.gs`** que está dentro de la carpeta `apps-script-project` de tu computadora, copia todo el código y pégalo allí.
5. **Configurar credenciales:** En Apps Script, guarda `ADMIN_PASSWORD`, `ADMIN_TOKEN` y `SPREADSHEET_ID` como Propiedades de script; no las escribas en `Code.gs`.

### Paso 3: Crear los Archivos de Interfaz (HTML)
En la barra lateral izquierda de Apps Script, junto a "Archivos", haz clic en el botón de **+ (Añadir un archivo)** y selecciona **HTML**. Crea exactamente los siguientes 5 archivos con sus nombres correspondientes y pega sus contenidos locales en el editor de Google:

1. Crea **`index`** (Google le pondrá automáticamente _.html_). Borra lo que tenga y pega el contenido de nuestro archivo local `index.html` de la carpeta `apps-script-project`.
2. Crea **`style`**. Borra lo que tenga y pega el contenido de nuestro archivo local `style.html`.
3. Crea **`js_api`**. Borra lo que tenga y pega el contenido de nuestro archivo local `js_api.html`.
4. Crea **`js_app`**. Borra lo que tenga y pega el contenido de nuestro archivo local `js_app.html`.
5. Crea **`js_admin`**. Borra lo que tenga y pega el contenido de nuestro archivo local `js_admin.html`.

Una vez creados los 5 archivos HTML y el archivo GS, haz clic en el icono del **Disquete (Guardar todo)**.

### Paso 4: Publicar e Implementar la Web App
1. En la parte superior derecha de Apps Script, haz clic en el botón azul **Implementar > Nueva implementación**.
2. Haz clic en el icono de **Engranaje** (Seleccionar tipo) y elige **Aplicación web**.
3. Rellena los campos:
   * **Descripción:** `Sorteo Futbol V1`
   * **Ejecutar como:** **Tú** (tu correo de Google).
   * **Quién tiene acceso:** **Cualquiera** (esto permite que los compradores accedan a la web pública).
4. Haz clic en el botón azul **Implementar**.
5. Si te pide autorizar permisos, haz clic en **Autorizar acceso**, selecciona tu cuenta de Google, haz clic en Configuration Avanzada (abajo en letras pequeñas) y luego selecciona Ir a Proyecto (no seguro) para aceptar los permisos de lectura/escritura en Sheets.
6. ¡Listo! Google te dará un enlace bajo la sección **Aplicación web** que termina en `/exec`.
7. **Ese es tu enlace definitivo.** Compártelo por WhatsApp, redes sociales o por correo para que todos puedan ver las camisetas disponibles en tiempo real.

---

## 🔒 Inicio de Sesión y Gestión de Números
1. Abre tu enlace de la Web App en tu celular o computadora.
2. Ve a la pestaña **Modo Admin**.
3. Inicia sesión con la contraseña guardada en las Propiedades de script de Apps Script.
4. Vuelve a la pestaña **Ver Sorteo**. Ahora notarás que la interfaz se ha vuelto interactiva:
   * Puedes hacer clic en múltiples números a la vez.
   * Aparecerá una **Barra de Tácticas Flotante** abajo indicando cuántos has seleccionado.
   * Haz clic en **Asignar Comprador** para registrar en lote: Nombre, Teléfono, Estado (Reservado o Pagado) y el Medio de Pago (Efectivo o Transferencia).
   * Al darle *Confirmar*, se guardarán instantáneamente en tu hoja de Sheets.
5. Visita la pestaña **Contabilidad** (ahora visible) para monitorear el dinero total recaudado en efectivo, transferencia, pendientes por cobrar y buscar compradores ingresando su nombre, teléfono o número en tiempo real.

---
*Desarrollado con pasión futbolera para potenciar el deporte local. ¡Mucho éxito con tu sorteo y que ruede el balón! ⚽🔥*
