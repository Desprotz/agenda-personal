# Agenda Personal — Documento de Proyecto

> Este archivo es la fuente de verdad del proyecto. Se actualiza con cada avance,
> decisión técnica y cambio de rumbo. Antes de tocar código, revisar este documento.

Última actualización: 2026-08-20 (v9 — Fase 6 cerrada: buscador global de eventos + notas, exportar/backup en JSON)

---

## 1. Descripción general

Aplicación web de **uso personal** para gestionar el día a día. Combina:

1. **Agenda / Calendario** — horario diario, tareas recurrentes y tareas puntuales.
2. **Notas / Diario** — estilo cuaderno, con soporte de imágenes, opcionalmente
   vinculadas a un evento de la agenda.
3. **Notificaciones / Alarmas** — avisos cuando empieza una tarea o cuando se
   cumple una alarma programada.

No es multiusuario ni multi-tenant: es una herramienta personal, pero se construye
con buenas prácticas de todas formas (separación de responsabilidades, código
mantenible, credenciales de base de datos que nunca llegan al navegador, etc.).

**Dispositivo objetivo: uso principal desde celular, específicamente iPhone.**
Esto es una restricción importante de diseño y no un detalle menor, porque
Safari/iOS tiene reglas particulares para notificaciones (ver sección 4.3 y 9).
El diseño (CSS) se hace **mobile-first**, y las decisiones técnicas de
notificaciones se toman pensando en iOS como caso principal, no como añadido.

---

## 2. Stack técnico

| Capa            | Tecnología                          |
|-----------------|--------------------------------------|
| Frontend        | HTML + CSS + JavaScript (vanilla, sin framework por ahora) |
| Hosting         | Netlify                              |
| Backend / API   | Netlify Functions (Node) — única pieza que conoce las credenciales de la base |
| Base de datos   | Turso (SQLite / libSQL)              |
| Storage (imágenes/audio) | Netlify Blobs               |
| Notificaciones  | Web Push API + Service Worker, dentro de una **PWA instalada** (obligatorio en iPhone, ver sección 4.3). El envío programado (Web Push vía APNs) también corre como Netlify Function — ver sección 4.3. |
| Instalación     | Web App Manifest (`manifest.json`) → la agenda se "instala" en el iPhone desde Safari |

**Por qué vanilla JS y no un framework:** al ser un proyecto de uso propio y con
foco en aprender/mantener buenas prácticas manuales, se organiza el código en
módulos ES (`type="module"`) en vez de meter todo en un solo archivo. Si el
proyecto crece demasiado, se puede reevaluar (ver sección 8, "Ideas a futuro").

**Por qué Turso y no Supabase (cambio 2026-07-22):** se decidió migrar de
Supabase a Turso. Diferencia importante que cambia la forma del proyecto: el
anon key de Supabase estaba *diseñado* para vivir en el navegador (la
protección real era RLS, que aquí ni se usaba). El token de Turso, en cambio,
da acceso completo de lectura/escritura si se filtra — no es seguro ponerlo en
un archivo del frontend como se hacía con `supabaseConfig.js`. Por eso el
frontend deja de hablar directo con la base de datos: ahora llama a **Netlify
Functions**, que son las únicas que tienen el token (como variable de entorno
en Netlify, nunca en el repo). De paso, esto resuelve algo que el proyecto ya
iba a necesitar: la sección 4.3 pedía un backend para disparar Web Push por
APNs en el momento exacto — ahora ya existe (mismas Functions).

Como Turso tampoco tiene un equivalente a Supabase Storage, las imágenes y
notas de voz (sección 4.2) pasan a guardarse en **Netlify Blobs** — incluido
gratis en el mismo plan de Netlify que ya se usa para el hosting, así que no
se agrega ninguna cuenta ni servicio nuevo.

**Estado actual (2026-08-19): conexión real en producción.** Ya no es solo
código — la base existe en Turso, las 6 tablas están creadas, las variables
de entorno están puestas en Netlify, el sitio está conectado a GitHub para
que las Functions corran de verdad, y `ajustes.html` confirma
"✅ Conectado a Turso" en el sitio publicado. Ver el cierre de la Fase 2 en
la bitácora (sección 7) para el detalle completo, incluyendo un bug de
formato de respuesta en las Functions que se encontró y corrigió en el camino.

---

## 3. Estructura de carpetas (propuesta)

```
agenda-personal/
├── PROYECTO.md              ← este archivo
├── package.json             ← dependencias de las Netlify Functions (@libsql/client, @netlify/blobs)
├── netlify.toml              ← config de Netlify (headers + carpeta de functions)
├── .env.example              ← plantilla de variables de entorno (sin valores reales)
├── manifest.json            ← Web App Manifest (necesario para instalar como PWA en iPhone)
├── index.html               ← shell principal (layout, nav) — redirige/muestra vista "Hoy"
├── pages/
│   ├── hoy.html             ← pantalla de inicio: resumen del día + últimas notas
│   ├── agenda.html
│   ├── notas.html
│   └── ajustes.html
├── css/
│   ├── base.css             ← reset, variables, tipografía
│   ├── layout.css           ← estructura general (nav, grid principal)
│   ├── hoy.css
│   ├── agenda.css
│   ├── notas.css
│   └── componentes.css      ← botones, modales, tarjetas, inputs, etiquetas
├── js/
│   ├── main.js              ← punto de entrada, routing simple entre vistas
│   ├── config/
│   │   └── apiClient.js     ← fetch wrapper hacia /api/* (Netlify Functions); sin credenciales
│   ├── services/            ← toda la comunicación con la API (vía apiClient.js)
│   │   ├── agendaService.js
│   │   ├── notasService.js
│   │   ├── etiquetasService.js
│   │   ├── cumplimientoService.js  ← checklist "hecho hoy" / rachas
│   │   ├── storageService.js       ← subida de imágenes y audio (Netlify Blobs)
│   │   ├── busquedaService.js      ← buscador global (eventos + notas)
│   │   ├── exportService.js        ← exportar/backup en JSON
│   │   └── notificacionesService.js
│   ├── components/           ← UI reutilizable (render + eventos)
│   │   ├── calendario.js
│   │   ├── modalEvento.js
│   │   ├── modalNota.js
│   │   ├── grabadorAudio.js        ← notas de voz
│   │   ├── proximaAlarma.js        ← widget flotante / barra superior
│   │   └── alarmaManager.js
│   └── utils/
│       ├── fechas.js
│       └── validaciones.js
├── sw/
│   └── service-worker.js     ← notificaciones en background
├── assets/
│   └── icons/
├── turso/
│   └── schema.sql            ← definición de tablas, sintaxis SQLite/libSQL (ver sección 10)
└── netlify/
    └── functions/            ← única capa que conoce el token de Turso
        ├── _db.js            ← cliente de Turso compartido + helper json() (no es un endpoint)
        ├── ping.js           ← health-check de conexión (usado en ajustes.html) — ✅ funcionando en producción
        ├── eventos.js        ← API de `eventos` (Fase 3)
        ├── notas.js          ← API de `notas` (Fase 4)
        ├── etiquetas.js      ← API de `etiquetas` (Fase 3)
        ├── cumplimientos.js  ← API de `cumplimientos` (Fase 3)
        └── media.js          ← subida/lectura de imágenes y audio vía Netlify Blobs (Fase 4)
```

---

## 4. Funcionalidades

### 4.1 Agenda
- Vista de horario diario (bloques de horas) y vista semanal/mensual.
  ✅ Implementadas como maqueta (Fase 1) — selector día/semana/mes + navegación
  de fecha (‹ hoy ›) en `pages/agenda.html`. Pendiente para Fase 3: que los
  eventos que se muestran dejen de ser datos de ejemplo y vengan de Turso.
- Tipos de actividad:
  - **Recurrente diaria**: se repite todos los días a una hora fija (ej. "gimnasio 7am").
  - **Recurrente por días específicos**: ej. lunes/miércoles/viernes.
  - **Puntual**: fecha y hora concretas, no se repite.
  - **Rango de tiempo / tarea larga**: tiene fecha de inicio y fecha de fin
    (proyectos, hábitos temporales, etc.), no necesariamente ligada a una hora exacta.
- Cada actividad puede tener: título, descripción, hora inicio/fin, color/categoría,
  alarma asociada (sí/no y con cuánta anticipación), y notas vinculadas.

### 4.2 Notas / Diario
- Entradas tipo diario (fecha automática, texto libre, formato simple: negrita,
  listas, etc. — a definir si se usa un editor enriquecido o markdown).
- Soporte para subir una o varias imágenes por nota (Netlify Blobs, vía
  `netlify/functions/media.js`).
- Una nota puede **vincularse a un evento de la agenda** (relación opcional
  nota ↔ evento), útil por ejemplo para dejar constancia de cómo salió una tarea.
- Búsqueda/filtrado por fecha o por evento vinculado.

### 4.3 Notificaciones / Alarmas

- Notificación cuando:
  - Empieza una tarea/actividad programada.
  - Se cumple una alarma configurada manualmente.
- Debe funcionar tanto para tareas de un solo día como para tareas de rango largo
  (la alarma se dispara el día/hora que corresponda dentro del rango).

**⚠️ Restricción real de iPhone (investigado, no es suposición):**
Dado que el uso principal es desde iPhone, esto cambia el diseño técnico:

- Safari **no permite notificaciones push a una pestaña normal abierta**. Desde
  iOS 16.4, las notificaciones push en iOS **solo funcionan si el sitio está
  instalado como PWA en la pantalla de inicio** (Compartir → "Agregar a inicio").
  Un simple bookmark o pestaña abierta no sirve.
- Por lo tanto, **la agenda debe ser una PWA instalable desde el día 1**, con su
  `manifest.json` y modo `standalone`. Esto deja de ser una "idea a futuro" y pasa
  a ser un requisito base del proyecto (se mueve de la sección 8 a aquí).
- El permiso de notificaciones en iOS solo se puede pedir en respuesta directa a
  una interacción del usuario (ej. tocar un botón "Activar notificaciones"), no se
  puede solicitar automáticamente al cargar la página.
- Existen dos caminos técnicos:
  1. **Web Push real vía APNs** (Apple Push Notification service): permite recibir
     avisos aunque la app no esté abierta, incluso con el celular bloqueado. Requiere
     backend que dispare el push en el momento exacto — con el cambio a Turso, esto
     ya no es una pieza pendiente: se implementa como una **Netlify Scheduled
     Function** (equivalente al cron/Edge Function que antes se pensaba hacer en
     Supabase) que corre cada minuto, consulta Turso por lo que debe notificarse
     ahora, y dispara el push.
  2. **Notificaciones locales mientras la PWA está abierta/en background reciente**
     (Notification API simple, sin servidor): más fácil de implementar, pero solo
     avisa si el iPhone tiene la PWA abierta o recientemente activa; no es confiable
     para alarmas si el celular lleva rato bloqueado o la app cerrada del todo.
  - Se recomienda empezar con la opción 2 para el MVP (Fase 5) y evaluar migrar a
    Web Push real (Netlify Scheduled Function + Turso) si las alarmas resultan
    poco confiables.
- Desde Safari 18.4 existe "Declarative Web Push", que simplifica el envío de push
  sin necesitar tanta lógica en el Service Worker — a evaluar cuando lleguemos a esa fase.
- La Badge API (contador en el ícono de la app) también está disponible desde iOS
  16.4 y podría usarse para mostrar cuántas tareas/alarmas pendientes hay hoy.

---

## 5. Modelo de datos (borrador inicial — se refina en `turso/schema.sql`)

- `eventos` — id, titulo, descripcion, tipo (`diario` | `dias_especificos` | `puntual` | `rango`),
  dias_semana (array, si aplica), fecha_inicio, fecha_fin, hora_inicio, hora_fin,
  color, etiqueta_id (FK, nullable), tiene_alarma, minutos_antes_alarma, created_at.
- `notas` — id, titulo, contenido, fecha, evento_id (nullable, FK a eventos),
  etiqueta_id (FK, nullable), created_at.
- `notas_imagenes` — id, nota_id (FK), url_storage, orden.
- `notas_audio` — id, nota_id (FK), url_storage, duracion_segundos, created_at.
- `alarmas` (si se separan de eventos) — id, evento_id (nullable), fecha_hora, mensaje, disparada (bool).
- `etiquetas` — id, nombre, color. Compartida entre `eventos` y `notas` para que
  el filtrado por categoría (trabajo, salud, personal, estudio...) funcione igual
  en ambos lados.
- `cumplimientos` — id, evento_id (FK), fecha, hecho (bool). Registra, para una
  tarea recurrente, si un día específico se marcó como "hecho hoy" sin alterar
  la definición general del evento (necesario para el checklist/racha).

> Pendiente de decidir: ¿alarmas viven dentro de `eventos` como columnas, o en tabla
> propia para permitir múltiples alarmas por evento? Se decide en la fase de backend.
> Lo mismo aplica a si `cumplimientos` se modela como tabla separada (recomendado,
> arriba) o como un array de fechas dentro de `eventos` (más simple pero menos
> flexible para consultas de "racha").

> ✅ **Estado real en Turso (2026-08-19):** las 6 tablas de este modelo
> (`etiquetas`, `eventos`, `cumplimientos`, `notas`, `notas_imagenes`,
> `notas_audio`) ya existen y coinciden exactamente con `turso/schema.sql`.
> Confirmado consultando `sqlite_master` en la SQL console del dashboard de
> Turso. Están vacías — el CRUD real llega en la Fase 3/4.

---

## 6. Roadmap / Fases

- [x] **Fase 0** — Este documento + estructura de carpetas base (vacías, con placeholders).
- [x] **Fase 1** — Maquetado estático **mobile-first** (HTML/CSS) de las 3 vistas:
      agenda, notas, ajustes. Incluye `manifest.json` + íconos básicos desde el
      inicio para que ya se pueda "instalar" en el iPhone mientras se desarrolla.
      Incluye también la vista **"Hoy"** como pantalla de inicio (resumen del día).
      Dentro de esta fase, la vista **Agenda** ya tiene sus 3 modos completos —
      **día / semana / mes** — con navegación de fecha y filtrado por etiqueta,
      todo sobre datos de ejemplo (ver bitácora del 2026-07-22 más abajo).
- [x] **Fase 2** — Setup de Turso (base de datos + tablas) + Netlify Functions
      como capa de API + conexión desde el front. **Completada 2026-08-19**:
      base creada, tablas cargadas, variables de entorno puestas en Netlify,
      sitio conectado a GitHub, y un bug de formato de respuesta en las
      Functions encontrado y corregido. `ajustes.html` en producción confirma
      "✅ Conectado a Turso". Ver bitácora para el detalle completo.
- [x] **Fase 3** — CRUD de eventos de agenda (crear, editar, eliminar, distinguir tipos)
      + **etiquetas/categorías con color** y filtrado por etiqueta
      + **checklist "hecho hoy"** para tareas recurrentes (registro de cumplimiento/racha).
      **Completada 2026-08-19**: las 3 Netlify Functions (`eventos.js`,
      `etiquetas.js`, `cumplimientos.js`), los servicios del frontend
      (`agendaService.js`, `etiquetasService.js`, `cumplimientoService.js`),
      las validaciones de formulario, el modal de crear/editar evento, y las
      vistas Agenda (día/semana/mes) y Hoy ya corren contra datos reales de
      Turso. Ver bitácora para el detalle completo, incluyendo un bug de
      servicios sin implementar que se encontró y corrigió en el camino.
- [x] **Fase 4** — CRUD de notas + subida de imágenes + vínculo nota-evento
      + **notas de voz** (grabación corta, Web Audio API + Storage).
      **Completada 2026-08-20**: `netlify/functions/notas.js` y `media.js`,
      los servicios `notasService.js`/`storageService.js`, el modal
      `modalNota.js` (texto, imágenes, audio, etiqueta, vínculo a evento), la
      grabación real de audio en `grabadorAudio.js` (MediaRecorder), la vista
      Notas (`js/components/notas.js`) y "Últimas notas" en Hoy
      (`notasHoy.js`) ya corren contra datos reales, con archivos en Netlify
      Blobs. Ver bitácora para el detalle y las decisiones tomadas.
- [x] **Fase 5** — Sistema de notificaciones/alarmas + Service Worker
      + **vista de "próxima alarma"** en la barra superior
      + **recordatorio de diario** si no se ha escrito nota en el día.
      **Completada 2026-08-20**: implementada la opción 2 de la sección 4.3
      (notificaciones locales mientras la PWA está abierta/reciente, sin
      servidor todavía). Ver bitácora para el detalle completo.
- [x] **Fase 6** — **Buscador global** (eventos + notas) + **exportar/backup** en JSON.
      **Completada 2026-08-20**: buscador accesible desde un botón ⌕ en la
      tabbar de las 4 páginas (modal singleton, mismo patrón que
      modalEvento/modalNota) + botón "Exportar backup (.json)" de
      `ajustes.html` (ya existía como UI, ahora conectado). Ver bitácora
      para el detalle completo.
- [ ] **Fase 7** — Pulido visual, responsive, despliegue final en Netlify.

---

## 7. Bitácora de avances

> Formato: fecha — qué se hizo — por qué / decisiones tomadas.

- **2026-07-22** — Creación de este documento. Definición inicial de alcance,
  stack (Netlify + Supabase), estructura de carpetas propuesta y roadmap.
  Aún no se ha escrito código.
- **2026-07-22** — Aclaración: el uso principal es desde **iPhone**. Se investigó
  el comportamiento real de notificaciones en iOS/Safari y se confirmó que
  **requiere obligatoriamente que la agenda sea una PWA instalable** desde el
  día 1 (no es opcional). Se actualizó la sección 4.3, se movió la PWA de
  "ideas a futuro" a requisito base, y el diseño CSS pasa a ser mobile-first.
  Se agregó `manifest.json` a la estructura de carpetas (pendiente de crear
  cuando lleguemos al maquetado).
- **2026-07-22** — Definida la dirección visual (sección 9): modo oscuro **por
  defecto** (ya no opcional) con vibra de editor de código/terminal, pensado
  para que el usuario (programador) se sienta en su propio ambiente. Se definió
  paleta de colores con tokens nombrados, tipografía (mono para estructura,
  sans para el diario), concepto de layout (gutter de horas tipo números de
  línea) y el elemento firma (cursor de "hora actual" parpadeante en la
  agenda). Se evitó deliberadamente el look genérico "negro + un solo acento
  neón" típico de diseño con IA.
- **2026-07-22** — Se aceptaron **todas** las funcionalidades que estaban en la
  antigua sección 8 ("ideas a considerar"): vista "Hoy", checklist/racha de
  tareas recurrentes, etiquetas con color, buscador global, exportar/backup en
  JSON, notas de voz, widget de "próxima alarma", y recordatorio de diario.
  Pasan de sugerencias a parte del alcance real del proyecto. Se actualizó el
  modelo de datos (tablas `etiquetas` y `cumplimientos`, tabla `notas_audio`),
  la estructura de carpetas (nuevos servicios y componentes) y el roadmap
  (cada funcionalidad ubicada en la fase donde tiene más sentido implementarla).
- **2026-07-22** — **Fase 0 y Fase 1 completadas.** Se creó la estructura de
  carpetas real (no solo el plan) y el maquetado estático mobile-first de las
  4 vistas: `index.html` (Hoy), `pages/agenda.html`, `pages/notas.html`,
  `pages/ajustes.html`. Incluye:
  - Design system implementado en CSS real (`base.css` con todos los tokens
    de color/tipografía de la sección 9, `layout.css`, `componentes.css`).
  - El elemento firma: timeline con gutter de horas + línea de "hora actual"
    parpadeante, en `css/agenda.css` + `js/components/calendario.js`.
  - `manifest.json` + íconos PNG (192/512) generados con la estética del
    design system, ya funcional para "Agregar a inicio" en iPhone.
  - Franja de "próxima alarma", checklist "hecho hoy" con racha, etiquetas
    con color, buscador global (UI), botón de nota de voz (UI) — todo como
    maqueta visual, sin lógica de datos real todavía.
  - Todos los `services/*.js` y componentes de modal/alarmas quedaron creados
    como placeholders con comentarios `TODO` indicando en qué fase se
    implementan, para respetar la estructura ya documentada en la sección 3.
  - `supabase/schema.sql` con el esquema completo de tablas y políticas RLS
    (auth.uid()) — listo para ejecutar cuando arranque la Fase 2, aunque el
    front todavía no está conectado a Supabase.
  - `netlify.toml` con configuración básica de publicación y cabeceras para
    manifest/service worker.
  - **Pendiente antes de la Fase 2:** configurar el proyecto real de
    Supabase (URL + anon key) y decidir el método de autenticación.
- **2026-07-22** — **Vista Agenda: día / semana / mes completas.** Hasta este
  punto `pages/agenda.html` solo tenía el timeline de un día con 4 eventos de
  ejemplo fijos (siempre los mismos, sin importar la fecha). Se construyó:
  - **Selector de vista** (`día | semana | mes`) + **navegación de fecha**
    (`‹ hoy ›`) que avanza/retrocede por día, semana o mes según la vista activa.
  - **Vista semana**: reutiliza el gutter de horas del timeline diario, con 7
    columnas de día y scroll horizontal (pensado para pantalla de iPhone, donde
    7 columnas completas no caben). La columna de hoy se resalta y conserva la
    línea de "hora actual". Tocar el encabezado de un día abre esa fecha en
    vista día.
  - **Vista mes**: cuadrícula de 6 semanas (lunes a domingo), con puntos de
    color por categoría de evento en cada celda, día actual resaltado, días
    fuera de mes atenuados. Tocar una celda abre esa fecha en vista día.
  - **Datos de ejemplo mejorados**: los 4 eventos fijos se reemplazaron por un
    "pool" (`POOL_EVENTOS` en `calendario.js`) con recurrencia por día de la
    semana (ej. gimnasio lunes/miércoles/viernes), para que semana y mes se
    vean con datos variados en vez de repetir siempre lo mismo. Sigue siendo
    dato de ejemplo — el reemplazo por datos reales de `agendaService.js` está
    pautado para la Fase 3, sin cambiar la forma del objeto evento
    (`{ titulo, inicio, fin, categoria }`) para que el reemplazo sea directo.
  - De paso, se conectaron los **chips de filtro por etiqueta** (trabajo /
    personal / salud / estudio), que antes eran solo decorativos: ahora
    filtran los eventos visibles en las 3 vistas (funcionalidad de UI —
    persistencia real sigue pendiente para Fase 3).
  - Archivos tocados: `pages/agenda.html`, `css/agenda.css`,
    `js/components/calendario.js`, `js/utils/fechas.js` (nuevas utilidades:
    `inicioDeSemana`, `sumarDias`, `sumarMeses`, `formatearRangoSemana`,
    `formatearMesAnio`, `esMismoDia`, `iniciarDia`).
- **2026-07-22** — **Fase 2: conexión con Supabase (código listo, falta setup
  manual).** *(⚠️ Superado por la entrada siguiente, el mismo día: la sesión
  anónima descrita aquí se quitó a pedido explícito. Se deja este párrafo
  como registro histórico de la primera versión.)* Decisión de autenticación:
  se preguntó y se pidió **"sin inicio de sesión, lo más fácil"**. Un "sin
  login" literal habría dejado la base de datos abierta a cualquiera con la
  URL (la anon key siempre es visible en el frontend), así que se implementó
  el punto medio: **sesión anónima de Supabase**
  (`supabase.auth.signInAnonymously()`) — cero pantallas ni campos que
  llenar, pero cada dispositivo tiene su propio `auth.uid()` y RLS sigue
  protegiendo los datos igual que con login normal. Detalle importante: la
  sesión queda atada a ese navegador/PWA; si se borran datos de sitio en
  Safari o se reinstala la PWA, se crea una identidad nueva (los datos viejos
  siguen en la base, pero inaccesibles sin esa sesión).
  - `js/config/supabaseConfig.js` (nuevo) — placeholders `SUPABASE_URL` /
    `SUPABASE_ANON_KEY` a completar a mano.
  - `js/config/supabaseClient.js` — reemplazado el placeholder `null` por el
    cliente real (`createClient` vía CDN esm.sh), con detección de "todavía
    no configurado" para no romper el resto de la app mientras tanto.
  - `js/services/authService.js` (nuevo, luego eliminado — ver entrada
    siguiente) — `asegurarSesion()`, `obtenerUsuarioId()`, `alCambiarSesion()`.
  - `js/main.js` — aseguraba sesión al cargar cualquier página.
  - `js/components/estadoConexion.js` (nuevo) + `pages/ajustes.html` — la
    tarjeta "Cuenta" ya no dice `tú@correo.com` fijo.
  - `supabase/schema.sql` — bucket de Storage `notas-media` (privado) +
    política de que cada usuario solo puede leer/escribir dentro de su
    propia carpeta (`${auth.uid()}/archivo.ext`).
- **2026-07-22** — **Se quitó la sesión anónima: cero login, de verdad.**
  Tras ver la primera versión (sesión anónima), se pidió explícitamente
  quitarla: **ningún tipo de inicio de sesión**, ni siquiera automático. Se
  avisó una vez más del trade-off (sin ninguna sesión, la única protección de
  los datos es que la URL/anon key no se compartan públicamente) y, al ser un
  proyecto personal de un solo usuario/dispositivo, se respetó la decisión.
  Cambios sobre la versión anterior:
  - **Eliminado** `js/services/authService.js` por completo — no hay sesión
    de ningún tipo que asegurar.
  - `js/config/supabaseClient.js` — ya no crea sesión; se agregó
    `verificarConexion()`, un ping simple (`select id from etiquetas`) para
    confirmar que la URL/anon key funcionan y las tablas existen.
  - `js/main.js` — ahora solo llama `verificarConexion()` al cargar la
    página y avisa con el evento `agenda:conexion-lista`.
  - `js/components/estadoConexion.js` — ya no menciona sesión anónima;
    solo muestra "✅ Conectado a Supabase" / "❌ no se pudo conectar" /
    "⚠️ falta configurar".
  - `supabase/schema.sql` — se quitó la columna `usuario_id` de todas las
    tablas y **se quitó RLS por completo** (ninguna tabla la tiene activada).
    El bucket `notas-media` pasó a **público** con una sola política abierta
    (sin filtrar por carpeta de usuario, ya que no existe ese concepto).
  - **Pendiente — pasos manuales que solo se pueden hacer en el dashboard
    real de Supabase** (ya no incluye activar sesión anónima):
    1. Crear el proyecto en https://supabase.com/dashboard.
    2. Pegar el contenido de `supabase/schema.sql` en el SQL Editor y
       ejecutarlo (crea tablas y el bucket de una sola vez).
    3. Copiar **Project Settings → API → Project URL** y **anon public key**
       y pegarlos en `js/config/supabaseConfig.js`.
    4. Abrir `ajustes.html` y confirmar que la tarjeta "Cuenta" diga
       "✅ Conectado a Supabase".
  - Todavía **no hay CRUD real** (crear/editar/borrar eventos o notas todavía
    usa datos de ejemplo) — eso es exactamente el alcance de la Fase 3.
  - *(⚠️ Superado por la entrada siguiente: se decidió cambiar de Supabase a
    Turso antes de completar estos pasos manuales, así que la lista de arriba
    queda como registro histórico y ya no aplica.)*
- **2026-07-22** — **Cambio de plan: Supabase → Turso + Netlify Functions.**
  Se decidió migrar de backend antes de arrancar la Fase 3 (todavía no había
  CRUD real, solo el cliente de conexión), así que no hubo datos que migrar.
  Motivo: se prefirió Turso a Supabase. Diferencia clave que cambió la forma
  del proyecto: el token de Turso da acceso completo si se filtra (a
  diferencia del anon key de Supabase, diseñado para el navegador), así que
  el frontend deja de hablar directo con la base — ahora pasa por Netlify
  Functions, que son las únicas que tienen el token. Turso tampoco tiene
  Storage, así que imágenes/audio de notas pasan a Netlify Blobs (gratis en
  el mismo plan de Netlify que ya se usaba para el hosting).
  - **Eliminado**: `supabase/` (carpeta completa) y `js/config/supabaseClient.js`
    / `supabaseConfig.js`.
  - **Nuevo** `turso/schema.sql` — mismo modelo de datos de la sección 5,
    reescrito a sintaxis SQLite/libSQL (`uuid` → `text`, `timestamptz` →
    `text` con `datetime('now')`, sin RLS ni buckets — ver comentarios en el
    archivo para el detalle de cada cambio de tipo).
  - **Nuevo** `netlify/functions/_db.js` — cliente único de Turso, con el
    token leído de `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (variables de
    entorno de Netlify, nunca en el repo).
  - **Nuevo** `netlify/functions/ping.js` — health-check de conexión,
    reemplaza al `verificarConexion()` que antes vivía en el frontend.
  - **Nuevo** (stubs con TODO, mismo criterio que los `*Service.js`):
    `netlify/functions/eventos.js` (Fase 3), `etiquetas.js` (Fase 3),
    `cumplimientos.js` (Fase 3), `notas.js` (Fase 4), `media.js` (Fase 4, usa
    Netlify Blobs en vez de Supabase Storage).
  - **Nuevo** `js/config/apiClient.js` — reemplaza a `supabaseClient.js`;
    expone `apiFetch()` y `verificarConexion()`, ahora contra `/api/*` en vez
    de contra la base de datos directamente.
  - `js/main.js`, `js/components/estadoConexion.js`, `js/services/storageService.js`,
    `js/components/grabadorAudio.js` — actualizados para reflejar Turso /
    Netlify Functions / Netlify Blobs en vez de Supabase.
  - **Nuevo** `package.json` (`@libsql/client`, `@netlify/blobs`) y `.env.example`.
  - `netlify.toml` — se agregó la carpeta `netlify/functions` como directorio
    de funciones.
  - **Pendiente — pasos manuales que solo se pueden hacer en el dashboard/CLI
    real de Turso:**
    1. Crear la base con `turso db create agenda-personal` (o desde el
       dashboard de turso.tech).
    2. Ejecutar `turso db shell agenda-personal < turso/schema.sql` para
       crear las tablas.
    3. Generar la URL (`turso db show agenda-personal --url`) y el token
       (`turso db tokens create agenda-personal`).
    4. Pegar esos dos valores como `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`
       en Netlify → Site settings → Environment variables (**no** en ningún
       archivo del repo).
    5. Correr `npm install` en la raíz del proyecto (dependencias de las
       Functions).
    6. Hacer deploy (o `netlify dev` en local) y abrir `ajustes.html` para
       confirmar que la tarjeta "Cuenta" diga "✅ Conectado a Turso".
  - Todavía **no hay CRUD real** (crear/editar/borrar eventos o notas todavía
    usa datos de ejemplo) — sigue siendo exactamente el alcance de la Fase 3,
    ahora implementado contra Turso en vez de Supabase.
  - *(⚠️ Los pasos manuales de arriba se completaron el 2026-08-19 — ver la
    entrada siguiente para el detalle real de cómo se ejecutaron y los
    imprevistos que salieron en el camino.)*
- **2026-08-19** — **Fase 2 cerrada: Turso + Netlify Functions en producción.**
  Se ejecutaron los pasos manuales pendientes de la entrada anterior. El
  proceso real tuvo varias diferencias frente al plan original (documentadas
  aquí para referencia futura):
  - **Base de datos:** se creó en el dashboard web de Turso (no por CLI) con
    el nombre `agenda-personal`, subiendo un archivo `.db` ya armado (opción
    "Upload SQLite File") en vez de correr `turso db shell < schema.sql`.
    - Al crear la base salió el error "group not found" — normal en cuentas
      nuevas de Turso que todavía no tienen ningún "group" (unidad que agrupa
      bases por ubicación/región). Se resolvió creando un group manual
      llamado `default` desde "Create Group" antes de reintentar. Región
      elegida: **AWS US East (Virginia)** — la más cercana en latencia para
      Colombia/LatAm de las disponibles en el plan free.
    - El archivo `.db` subido creó la base pero **vacía** (sin tablas) — no
      quedó claro por qué. Se recuperó ejecutando el `schema.sql` a mano
      desde la SQL console del dashboard.
    - Detalle importante de la SQL console del dashboard: **ejecuta un solo
      `CREATE TABLE` a la vez**, no un script completo con varias
      instrucciones separadas por `;`. Se corrieron las 6 sentencias una por
      una (respetando el orden por las referencias FK: `etiquetas` antes que
      `eventos`, y esas dos antes que `cumplimientos`/`notas`). Confirmado el
      resultado final con `SELECT name FROM sqlite_master WHERE type='table'`
      y también visualmente en el panel "Tables" del dashboard (Drizzle
      Studio) — las 6 tablas con todas sus columnas coinciden con
      `turso/schema.sql`.
  - **Variables de entorno:** `TURSO_DATABASE_URL` (sin marcar como secreta,
    es solo una URL) y `TURSO_AUTH_TOKEN` (marcada como "Contiene valores
    secretos") puestas en Netlify → Project configuration → Environment
    variables, con "All scopes" y "Same value for all deploy contexts".
    - ⚠️ Nota de seguridad: en el proceso, un token de Turso se compartió por
      error en texto plano en la conversación con el asistente. Se roto
      inmediatamente (revocado en Turso, generado uno nuevo) antes de
      ponerlo en Netlify. Queda como recordatorio: el token nunca debe
      copiarse/pegarse por canales que no sean directo Turso → Netlify.
  - **Deploy real de las Functions:** el sitio de Netlify (`desprotz`,
    dominio `desprotz.netlify.app`) había quedado desplegado originalmente
    por "Netlify Drop" (arrastrar y soltar archivos sueltos), lo cual **no
    ejecuta Netlify Functions**. Se conectó el repositorio real de GitHub
    (`Desprotz/agenda-personal`, creado y subido por primera vez en este
    mismo cierre de fase, con `git init` / `git add` / `git commit` /
    `git push` desde local) vía "Continuous deployment" en Netlify.
    - Al vincular el repo, Netlify **creó un sitio nuevo** en vez de
      reutilizar el existente (comportamiento por defecto de "Import from
      Git"). El sitio viejo (`legendary-syrniki-d64c1e`, el del deploy por
      Netlify Drop) quedó huérfano/sin usar — el sitio real de aquí en
      adelante es `desprotz.netlify.app`. Las variables de entorno se
      tuvieron que volver a crear en este sitio nuevo (no se heredan del viejo).
    - También hizo falta autorizar a la GitHub App de Netlify sobre el
      repositorio nuevo (`github.com/settings/installations` → Configure →
      dar acceso a `agenda-personal`), porque por defecto solo tenía permiso
      sobre repos autorizados anteriormente.
  - **Bug encontrado y corregido — formato de respuesta de las Functions:**
    primer deploy con el repo conectado dio **502 Bad Gateway** en
    `/api/ping` (confirmado en la pestaña Network del navegador, con el
    mensaje `[apiClient] Falló el ping de conexión: Error 502 llamando a
    /ping`). Causa: `netlify/functions/_db.js` exportaba un helper `json()`
    que devolvía el formato **viejo** de Netlify Functions
    (`{statusCode, headers, body}`), pero todas las funciones estaban
    escritas con la sintaxis **nueva** (`export default async function
    handler()` + `export const config = { path: ... }`), que espera que se
    devuelva un objeto `Response` real (`new Response(...)`). Esa mezcla
    hacía que la función lanzara una excepción al ejecutarse. Se corrigió
    `json()` para que devuelva `new Response(JSON.stringify(body), {
    status, headers })`. **Aplica a futuro:** al implementar `eventos.js`,
    `notas.js`, `etiquetas.js`, `cumplimientos.js` y `media.js` en las
    próximas fases, todas deben seguir devolviendo `Response` a través de
    este mismo helper — no volver al formato viejo.
  - **Resultado final confirmado:** tras el fix y el redeploy automático
    (push a `main` → Netlify redespliega solo), `desprotz.netlify.app/pages/ajustes.html`
    muestra **"✅ Conectado a Turso"** en producción. Fase 2 oficialmente
    cerrada.
- **2026-08-19** — **Fase 3 cerrada: CRUD de eventos/etiquetas + checklist
  "hecho hoy" + racha, conectados de punta a punta.**
  - **Backend (`netlify/functions/`):**
    - `etiquetas.js` — CRUD completo (GET/POST/PUT/DELETE), valida nombre
      (obligatorio, máx. 40 caracteres) y color en formato hex.
    - `eventos.js` — CRUD completo con validación específica por `tipo`
      (`diario` / `dias_especificos` / `puntual` / `rango`): horario
      obligatorio salvo en `rango`, `dias_semana` obligatorio en
      `dias_especificos`, `fecha_inicio`/`fecha_fin` obligatorias en
      `puntual`/`rango`.
    - `cumplimientos.js` — GET por `evento_id` o por `fecha`, POST con upsert
      (`on conflict(evento_id, fecha)`) para marcar "hecho hoy"; desmarcar
      simplemente borra la fila (no existe un estado "hecho: false"
      persistido).
    - Ambas `eventos.js` y `etiquetas.js` leen el `:id` de la ruta con
      `context.params.id` (forma oficial de Netlify Functions v2), con
      respaldo manual parseando el pathname si `context` no trae el dato.
  - **Frontend — servicios (`js/services/`):**
    - `agendaService.js` — CRUD contra `/api/eventos` (`listarEventos`,
      `crearEvento`, `actualizarEvento`, `eliminarEvento`) + la lógica de
      expansión de recurrencia (`eventoOcurreEnFecha`, `eventosParaFecha`,
      `esRecurrente`, `describirRecurrencia`), compartida entre la vista
      Agenda y la vista Hoy para que ambas coincidan siempre.
    - `etiquetasService.js` — CRUD contra `/api/etiquetas`.
    - `cumplimientoService.js` — ya existía `calcularRacha`; ahora depende de
      `agendaService.eventoOcurreEnFecha` (antes esa función no existía, ver
      "bug encontrado" más abajo).
    - `js/utils/validaciones.js` — `validarFormularioEvento` y
      `validarEtiqueta`, espejo en el cliente de las reglas del backend, para
      dar feedback inmediato sin esperar el roundtrip a la API. La API sigue
      siendo la fuente de verdad final.
  - **Frontend — UI (`js/components/`):**
    - `modalEvento.js` (nuevo) — modal único de crear/editar evento, inyectado
      como singleton en `<body>`, reutilizado tanto por `agenda.html` como por
      `index.html` (vista Hoy). Incluye selector de tipo con campos
      condicionales, selector de días de la semana, selector de etiqueta con
      creación inline, y alarma opcional.
    - `calendario.js` — reescrito para usar `agendaService`/`etiquetasService`
      reales en vez del `POOL_EVENTOS` de ejemplo de la Fase 1 (eliminado).
      Mantiene los 3 modos (día/semana/mes), el filtro dinámico por etiqueta,
      y ahora los bloques de evento abren el modal al hacer clic.
    - `checklistHoy.js` (nuevo) — conecta la sección "Horario de hoy" de
      `index.html` con eventos reales: checklist de "hecho hoy" para tareas
      recurrentes, badge de racha, y clic en cualquier ítem para editar.
      "Últimas notas" sigue siendo maqueta estática hasta la Fase 4.
  - **CSS:** nuevas clases en `componentes.css` (modal, selector de días,
    `task-check`, `etiqueta-picker`) y ajustes en `agenda.css`/`hoy.css` para
    los bloques de evento y los ítems del checklist.
  - **Decisiones tomadas durante la implementación:**
    - Un evento de tipo `rango` **sin hora fija** se trata como "todo el día"
      tanto en el timeline (ocupa el bloque completo visible) como en el
      render de la vista Hoy (se muestra `·` en vez de una hora).
    - El cálculo de racha (`calcularRacha`) tiene un tope de **730 días (2
      años)** hacia atrás, para no iterar sin límite en eventos muy antiguos.
    - Desmarcar un cumplimiento **no** guarda un registro con `hecho: 0` —
      simplemente borra la fila de `cumplimientos`. La tabla solo registra
      días efectivamente cumplidos.
    - El día de hoy nunca rompe la racha aunque todavía no esté marcado (se
      puede marcar más tarde); sí la rompe cualquier día *anterior* que haya
      quedado sin marcar.
  - **⚠️ Bug encontrado y corregido — servicios del frontend sin implementar:**
    al revisar el estado del proyecto antes de cerrar la fase, se encontró que
    `js/services/agendaService.js` y `js/services/etiquetasService.js` habían
    quedado como los stubs de 4 líneas ("TODO Fase 3") heredados de la Fase 2,
    mientras que `calendario.js`, `modalEvento.js` y `checklistHoy.js` ya
    llamaban a funciones de esos archivos (`listarEventos`, `eventosParaFecha`,
    `crearEvento`, etc.) que no existían — esto habría roto la vista Agenda y
    la vista Hoy apenas se abrieran. Se encontró también que
    `js/utils/validaciones.js` tenía el mismo problema (stub sin implementar,
    pero ya importado por `modalEvento.js`). Los tres archivos se
    implementaron completos antes de dar la fase por cerrada. **Aplica a
    futuro:** antes de marcar una fase como completada, revisar que cada
    archivo que otro módulo importa realmente exporte lo que se está usando —
    no asumirlo por el nombre del archivo o por haberlo mencionado en un
    resumen previo.
  - **Resultado final:** `node --check` sobre los 18 archivos JS del proyecto
    pasa sin errores; se verificó cruzando cada llamada `agendaService.X` /
    `etiquetasService.X` / `cumplimientoService.X` usada en los componentes
    contra las funciones realmente exportadas por cada servicio, y que las
    clases CSS referenciadas por el modal/checklist/calendario existen en
    `componentes.css` / `agenda.css` / `hoy.css`. Pendiente de verificación
    manual en producción (abrir `agenda.html` e `index.html` tras el deploy)
    porque este entorno no puede levantar Netlify Dev/Turso.
- **2026-08-19** — **Fix post-cierre de Fase 3: `[hidden]` no ocultaba nada.**
  Al probar en producción, dos síntomas aparentemente distintos resultaron
  ser el mismo bug:
  1. En `agenda.html`, la vista "día" (`.timeline`) se quedaba visible
     encima de "semana"/"mes" al cambiar de pestaña.
  2. En el modal de evento, "cancelar" y la "×" no cerraban nada
     visualmente (aunque "eliminar" sí borraba en la base de datos, y
     "guardar" parecía necesitar un segundo tap para "funcionar").
  **Causa raíz:** varios componentes (`.timeline`, `.modal-backdrop`,
  `.field-row`, `.nueva-etiqueta-form`) declaran su propio `display`
  (`grid`/`flex`) en `agenda.css`/`componentes.css`. Esa regla de autor tiene
  la misma especificidad que el `[hidden] { display: none }` que trae el
  navegador por defecto, pero al cargarse después en la cascada, **siempre
  ganaba** — así que poner `elemento.hidden = true` desde JS (`cambiarVista()`
  en `calendario.js`, `cerrar()` en `modalEvento.js`) dejaba de tener efecto
  visual, aunque la lógica de JS sí se ejecutaba (por eso "eliminar" sí
  borraba de verdad, y "guardar" sí guardaba en el primer tap — solo que no
  se notaba porque el modal no desaparecía).
  **Fix:** una sola regla global en `css/base.css` (sección de reset):
  `[hidden] { display: none !important; }`. Con `!important` se garantiza que
  gane siempre, sin tener que tocar cada componente individualmente. Corrige
  de una vez: el cambio de vista día/semana/mes, el cierre del modal
  (cancelar/×/guardar/eliminar), los campos condicionales según tipo de
  evento (`data-tipo-visible`), y el formulario inline de nueva etiqueta.
  **Aplica a futuro:** cualquier componente nuevo que se oculte con el
  atributo `hidden` de HTML no necesita preocuparse por esto — pero si algún
  componente necesita mostrarse con un `display` distinto de `none` de forma
  condicional por *otro* motivo (no `hidden`), no debe depender de quitar el
  atributo `hidden` para eso; debe usar su propia clase/estado.
- **2026-08-20** — **Fase 4 cerrada: notas + imágenes + audio + vínculo a
  evento, con Netlify Blobs.**
  - **Backend (`netlify/functions/`):**
    - `media.js` (nuevo) — sube (`POST`), sirve (`GET /:key`) y borra
      (`DELETE /:key`) archivos con `getStore('notas-media')` de
      `@netlify/blobs`. Recibe el archivo como base64 dentro del JSON (no
      `multipart/form-data`, para no complicar el parseo en una Netlify
      Function v2) y responde con `{ key, url }`. Valida `contentType` contra
      una lista blanca (imágenes: jpeg/png/webp/gif/heic; audio:
      webm/ogg/mp4/mpeg/wav) y limita a 6 MB decodificados.
    - `notas.js` (nuevo) — CRUD completo de `notas`, con `notas_imagenes` y
      `notas_audio` anidados en la respuesta (`nota.imagenes`, `nota.audio`).
      Soporta filtros combinables por querystring: `fecha`, `evento_id`,
      `etiqueta_id`, `q` (búsqueda `LIKE` en título/contenido). En `PUT`, si
      el body trae la llave `imagenes` o `audio` (aunque sea `[]`), se
      reemplaza el set completo — y se borran del storage las keys que ya no
      queden referenciadas. En `DELETE`, se borran primero los blobs
      (best-effort: si falla borrar uno, se sigue con el resto) y luego la
      fila de `notas` (cascada limpia `notas_imagenes`/`notas_audio` en la
      BD).
  - **Frontend — servicios (`js/services/`):**
    - `storageService.js` — `subirImagen`/`subirAudio` (leen el
      File/Blob como base64 con `FileReader`, llaman a `/media`),
      `obtenerUrlPublica` (`/api/media/{key}`), `eliminarArchivo`.
    - `notasService.js` — `listarNotas(filtros)`, `listarUltimasNotas(n)`
      (para la vista Hoy), `crearNota`, `actualizarNota`, `eliminarNota`.
  - **Frontend — UI (`js/components/`):**
    - `modalNota.js` (nuevo) — modal singleton, mismo patrón que
      `modalEvento.js`. Campos: título (opcional), contenido, fecha,
      etiqueta (con creación inline, reutiliza `validarEtiqueta`), vínculo a
      evento (select con todos los eventos), imágenes (input múltiple con
      preview y botón de quitar por imagen) y audio (un adjunto a la vez, con
      preview/duración/quitar). Las imágenes/audio nuevas no se suben al
      elegirlas — se guardan como `File`/`Blob` en memoria y se suben recién
      al dar "guardar" (`subirAdjuntosPendientes`), así que cancelar no deja
      archivos huérfanos en el storage.
    - `grabadorAudio.js` (reescrito) — antes solo cambiaba el estado visual
      del botón 🎙; ahora graba de verdad con `MediaRecorder`
      (`navigator.mediaDevices.getUserMedia({audio:true})`). Al soltar/parar,
      abre `modalNota.js` en modo "crear" con el audio ya adjunto
      (`abrirParaCrearNotaConAudio`), para que el título/etiqueta/vínculo se
      completen ahí antes de guardar.
    - `notas.js` (nuevo) — vista Notas completa: lista real desde la API,
      buscador con debounce de 300ms, filtro por etiqueta (chips dinámicos,
      mismo patrón que el filtro de `calendario.js`), eliminar (botón 🗑 por
      tarjeta, con confirmación), clic en la tarjeta para editar (excepto
      sobre el reproductor de audio o el botón de eliminar).
    - `notasHoy.js` (nuevo) — reemplaza la maqueta estática de "Últimas
      notas" en `index.html` con las 3 notas más recientes reales. Cada
      tarjeta es un link a `pages/notas.html` (el modal de edición vive ahí;
      Hoy es solo un vistazo rápido, igual que antes con el mockup).
  - **HTML/CSS:** `index.html` y `pages/notas.html` reescritos para usar los
    componentes reales en vez de las tarjetas de ejemplo de la Fase 1. CSS
    nuevo en `componentes.css` (preview de imágenes del modal) y
    `notas.css`/`hoy.css` (reproductor de audio, ajuste de color del título
    en las tarjetas de "Últimas notas" — ver bug corregido abajo).
  - **Decisiones tomadas durante la implementación:**
    - Aunque el esquema (`notas_audio`) permite varios audios por nota, la UI
      solo maneja **uno a la vez** — grabar uno nuevo reemplaza al anterior.
      Si más adelante se quiere permitir varios, el backend ya lo soporta
      (`reemplazarAdjuntos` recibe un arreglo); solo habría que cambiar
      `modalNota.js`.
    - Las keys de Netlify Blobs se generan **sin `/`** (`img_{uuid}.ext`,
      `aud_{uuid}.ext}`) a propósito, para que el parámetro de ruta
      `:id`/`:key` de Netlify Functions v2 las capture completas sin
      necesitar un splat.
    - El upload va como **base64 dentro de JSON**, no `multipart/form-data` —
      más simple de validar/parsear en una Netlify Function v2, a costa de
      ~33% más peso en la subida. Con el límite de 6 MB decodificados es
      aceptable para fotos de un diario personal; si en el futuro se quieren
      adjuntar archivos más pesados, ahí sí valdría la pena migrar a
      `multipart/form-data` o subida directa a Blobs con URL firmada.
    - Al eliminar una nota o reemplazar sus adjuntos, borrar los blobs es
      **best-effort**: si Netlify Blobs falla al borrar uno, se registra en
      log y se sigue con el resto — se prefiere no dejar una nota "atascada"
      en la BD por un blob que no se pudo borrar, aunque eso puede dejar
      blobs huérfanos ocasionales (aceptable para el tamaño de este
      proyecto; no hay un job de limpieza).
  - **Bug encontrado y corregido en el camino:** al convertir las tarjetas
    de "Últimas notas" en `<a>` (para que lleven a `notas.html`), heredaban
    el color cian de los links (`a { color: var(--accent-cyan) }` en
    `base.css`) en vez del color de texto normal — se corrigió con una regla
    específica en `hoy.css`. Mismo tipo de descuido que el bug de `[hidden]`
    de la entrada anterior: un estilo global genérico chocando con un
    componente más específico: al añadir un elemento nuevo dentro de un
    contenedor con estilos globales (como `a`, `button`, `input`), vale la
    pena revisar visualmente el resultado, no asumir que la clase del
    componente es suficiente.
  - **Pendiente / limitaciones conocidas:**
    - No se probó en un entorno real con Netlify Dev + Turso + Blobs (este
      entorno no puede levantarlo) — la verificación fue estática:
      `node --check` en todos los archivos, cruce de cada llamada de
      servicio usada en los componentes contra lo que cada servicio
      exporta, y verificación de que las clases CSS usadas existen.
      **Recomendado probar en el iPhone real, en particular la grabación de
      audio** (`getUserMedia`/`MediaRecorder`), ya que iOS Safari es más
      estricto con permisos de micrófono que otros navegadores.
    - El punto (`.dot-unsaved`, "Nota sin terminar") junto a la pestaña
      "notas.html" en la barra de navegación sigue siendo un elemento
      cosmético estático — no refleja un borrador real en curso. No se tocó
      en esta fase; si se quiere que sea real, habría que decidir qué cuenta
      como "nota sin terminar" (¿un adjunto grabado pero no guardado?).
    - La búsqueda (`q`) usa `LIKE` simple sobre `titulo`/`contenido` — no hay
      normalización de acentos/mayúsculas más allá de lo que SQLite haga por
      default, así que "cafe" no encuentra "café". Suficiente para esta
      fase; si se vuelve un problema, revisar en la Fase 6 (buscador
      global).

---

## 8. Funcionalidades adicionales (aceptadas)

> Estaban como sugerencias sin confirmar; el 2026-07-22 se aceptaron todas.
> Ya no son "ideas a considerar", son parte del alcance del proyecto.

- [x] **Vista "Hoy"** como pantalla de inicio: resumen del horario del día +
  últimas notas, en vez de abrir directo al calendario completo.
- [x] **Checklist de tareas recurrentes**: poder marcar "hecho hoy" en una tarea
  diaria sin que eso afecte los demás días (registro de cumplimiento/racha).
- [x] **Etiquetas/categorías con color** para eventos y notas (trabajo, salud,
  personal, estudio...) y poder filtrar por ellas.
- [x] **Buscador global** (busca en eventos y notas a la vez).
- [x] **Exportar/backup**: botón para exportar tus datos (JSON) por si algún día
  quieres migrar o simplemente tener respaldo local.
- [x] **Notas de voz** (grabación corta) como alternativa a escribir, usando la
  Web Audio API + Netlify Blobs.
- [x] **Vista de "próxima alarma"** flotante o en la barra superior, para ver
  siempre cuál es la próxima tarea/alarma sin abrir el calendario.
- [x] **Recordatorio de diario**: si no se ha escrito nota en el día, notificación
  suave sugiriendo escribir algo antes de dormir.

> ✅ **PWA (instalable)** ya no está en esta lista de "ideas opcionales": pasó a ser
> un **requisito obligatorio** del proyecto (ver sección 4.3), porque sin ella las
> notificaciones simplemente no funcionan en iPhone.
>
> ✅ **Modo oscuro** tampoco es "opcional": es el **modo por defecto y principal**
> de la aplicación (no un modo alternativo). Ver sección 9 — Dirección visual.

---

## 9. Dirección visual (Design System)

**Brief de diseño (en tus palabras):** modo oscuro por defecto, "vibra tecnológica",
que se sienta como tu propio ambiente de programador. No un dashboard genérico
con dark mode encima — algo que se sienta como una herramienta hecha *por* un
programador *para* un programador.

**De dónde sale la identidad:** no de "IA + tema oscuro" genérico, sino del mundo
real de un editor de código: gutter con números de línea, tabs de archivo, cursor
parpadeante, colores de diff (verde=agregado, rojo=eliminado), comentarios de código.
La agenda ya tiene una estructura de líneas de tiempo por hora — eso calza natural
con un gutter de números de línea, no es decoración forzada.

### 10.1 Paleta (tokens de color)

| Token               | Hex       | Uso |
|---------------------|-----------|-----|
| `--bg-base`         | `#12141C` | Fondo principal (azul-carbón oscuro, no negro puro) |
| `--bg-surface`      | `#1A1D28` | Tarjetas, paneles, "ventanas" tipo editor |
| `--bg-gutter`       | `#0F111A` | Franja de números de línea / horas (más oscura que el fondo) |
| `--border-subtle`   | `#2A2E3D` | Bordes y divisores, muy sutil |
| `--text-primary`    | `#E4E6EB` | Texto principal (blanco roto, no blanco puro) |
| `--text-muted`      | `#7B8394` | Texto secundario, timestamps, metadata |
| `--accent-amber`    | `#E8A33D` | Acento primario — CTAs, "hoy", foco (evoca `// TODO` / warning de linter) |
| `--accent-cyan`     | `#5FD4D0` | Acento secundario — enlaces, info, hover (evoca strings en syntax highlighting) |
| `--accent-violet`   | `#9D8CFF` | Etiquetas/categorías, elementos de "nota vinculada" |
| `--accent-success`  | `#6FCF97` | Tarea completada (verde apagado tipo diff, no verde neón) |
| `--accent-alert`    | `#F2726B` | Alarmas activas, eliminar, vencido |

> Nota deliberada: se evita el típico "negro puro + un solo verde ácido o naranja
> neón" que es el default genérico de diseño con IA. Aquí hay una paleta con 3
> acentos con roles claros (no decorativos), y el fondo tiene tinte azulado, no
> negro plano — se ve y se siente más a tema de editor real (tipo temas custom
> que hace la gente en VSCode) que a "plantilla con dark mode".

### 10.2 Tipografía

- **Monoespaciada (protagonista):** para horas, timestamps, títulos de sección,
  y cualquier dato "estructural" — refuerza la vibra de terminal/editor. Candidatas:
  `JetBrains Mono` o `IBM Plex Mono` (ambas gratuitas, con buen soporte de pesos).
- **Sans (cuerpo de texto):** para el contenido de las notas/diario y descripciones
  largas — la monoespaciada cansa en párrafos largos, así que el diario usa una
  sans limpia y legible (`Inter` o `IBM Plex Sans`) para no sacrificar lectura.
- **Jerarquía:** la mono se usa con restricción (headers, horas, etiquetas de
  estado tipo `[PENDIENTE]` `[HECHO]`), la sans lleva el peso del contenido real.

### 10.3 Concepto de layout

- Vista de **Agenda** con gutter de horas al estilo números de línea (columna
  izquierda oscura y angosta, alineada monoespaciada), y un indicador de "línea
  actual" (la hora de ahora) con un cursor parpadeante sutil — el signature element
  de la app.
- Paneles con esquinas rectas o de radio mínimo (no todo redondeado tipo app
  móvil genérica) — más "ventana de editor" que "tarjeta de dashboard".
- Barra superior tipo "tabs de archivo abierto" para navegar entre Agenda / Notas /
  Ajustes (como pestañas de archivos abiertos en un editor).
- Estados vacíos y mensajes de error con voz de "consola/log" (ej. en vez de
  "No tienes notas todavía" → algo como `> sin entradas para hoy — escribe la primera`),
  sin exagerar ni forzar el chiste en cada texto.

### 10.4 Elemento firma (signature)

El **gutter de horas con cursor de "hora actual" parpadeante** en la vista de
Agenda: una franja vertical oscura con las horas como números de línea, y una
línea horizontal fina que marca "ahora" con un pequeño cursor tipo terminal que
parpadea suavemente. Es el elemento que hace que la agenda se sienta un editor
de código real y no un calendario genérico con tema oscuro.

### 10.5 Accesibilidad y buen gusto (piso de calidad, no opcional)

- Contraste AA mínimo en texto sobre fondo (los tokens de arriba ya se
  eligieron pensando en esto, pero se valida al implementar).
- Foco de teclado visible en todos los controles.
- Animaciones (cursor parpadeante, transiciones de tabs) respetan
  `prefers-reduced-motion`.
- El look "técnico" no debe sacrificar legibilidad del diario — por eso el
  cuerpo de las notas usa la sans, no la mono.

## 10. Notas técnicas / pendientes

- Definir si el editor de notas será texto plano, markdown renderizado, o un
  editor WYSIWYG simple.
- ~~Definir política de autenticación~~ — **Resuelto 2026-07-22:**
  sin ningún tipo de login (ni sesión anónima) — decisión consciente para
  priorizar simplicidad en una app de un solo usuario y dispositivo. Con
  Supabase esto significaba que la protección dependía de no compartir
  públicamente la URL/anon key. Tras el cambio a Turso (mismo día, ver
  bitácora), la protección mejoró de forma incidental: el token con permisos
  de escritura ya no vive en el frontend en absoluto, solo en variables de
  entorno de Netlify — así que sigue sin haber login, pero ahora tampoco hay
  ninguna credencial expuesta en el navegador. Ver la bitácora de la Fase 2 y
  la entrada de migración a Turso más abajo para el detalle completo.
- Definir tamaño máximo y compresión de imágenes antes de subir a Storage.
- Diseño **mobile-first** en CSS (breakpoints pensados primero para pantalla de
  iPhone, luego se adapta hacia arriba si algún día se usa desde escritorio).

### 10.1 Investigación ya hecha: notificaciones en iOS/Safari (2026)

- Confirmado: push en iOS **solo** funciona si el sitio está agregado a la
  pantalla de inicio como PWA (Safari → Compartir → "Agregar a inicio"); una
  pestaña normal de Safari no puede recibir push, sin importar el permiso.
- Requisito mínimo: **iOS 16.4+** (marzo 2023) para push; hoy en día (2026) ya
  es una base razonable de asumir en cualquier iPhone actualizado.
- El permiso de notificaciones debe pedirse tras una acción explícita del
  usuario (tap en un botón), nunca automáticamente al cargar la página.
- Detalle a tener en cuenta si en algún momento se usa fuera de Colombia/LatAm:
  en la Unión Europea, por temas regulatorios (DMA), Apple desactivó el modo
  standalone de las PWAs y las notificaciones push dejaron de funcionar ahí —
  no afecta el uso pensado para este proyecto, pero queda anotado por si acaso.
- Safari 18.4 introdujo "Declarative Web Push" (envío de push sin tanta lógica
  de Service Worker) y Screen Wake Lock (evita que la pantalla se apague) — se
  evaluó al llegar a la Fase 5 (ver bitácora) y se decidió no usarlo todavía,
  quedó anotado para cuando se migre a Web Push real.
- La Badge API (número en el ícono de la app) funciona desde iOS 16.4.

- **2026-08-20** — **Fase 5 cerrada: notificaciones/alarmas locales, próxima
  alarma real, recordatorio de diario, Service Worker.**
  - **Decisión de alcance:** se implementó la **opción 2** de la sección 4.3
    (notificaciones locales mientras la PWA está abierta o recientemente
    activa, sin servidor de por medio), tal como recomendaba este mismo
    documento para el MVP. **No** se implementó Web Push real vía APNs
    todavía — eso implicaría agregar una Netlify Scheduled Function, guardar
    la suscripción push en Turso (tabla nueva) y manejar claves VAPID/APNs,
    que es explícitamente el "siguiente paso si esto resulta poco confiable"
    y no parte de esta fase. Queda pendiente evaluar tras probar en el
    iPhone real (ver "Pendiente" más abajo).
  - **`js/services/notificacionesService.js`** (implementado) —
    `soportado()`, `permisoActual()`, `registrarServiceWorker()`,
    `pedirPermiso()` (debe llamarse solo desde un manejador de click, nunca
    automático — restricción de iOS) y `notificar(titulo, opciones)`, que
    muestra la notificación vía `registro.showNotification()` del Service
    Worker (más confiable con la app en background reciente) con fallback a
    `new Notification()` si no hay SW disponible.
  - **`js/components/alarmaManager.js`** (implementado) — dos
    responsabilidades en un mismo archivo, cargado en **todas** las páginas
    (`index.html`, `pages/agenda.html`, `pages/notas.html`,
    `pages/ajustes.html`) para que las alarmas funcionen sin importar qué
    vista esté abierta:
    1. **Motor de alarmas**: cada 30s (`INTERVALO_CHEQUEO_MS`) revisa los
       eventos de hoy con `tiene_alarma` activada y hora fija, calcula la
       hora exacta de la alarma (`hora_inicio - minutos_antes_alarma`), y
       dispara la notificación si "ahora" cae dentro de una ventana de
       gracia de 5 minutos después de esa hora. Se eligió **polling por
       intervalo en vez de `setTimeout` exacto por alarma** a propósito: es
       más simple y se autocorrige solo si el navegador puso en pausa los
       timers (pestaña en background) — el siguiente tick, o el chequeo
       inmediato al volver a `visibilitychange: visible`, detecta igual la
       alarma mientras siga dentro de la ventana de gracia. Cada alarma
       disparada se marca en `localStorage` (`agenda:alarma-disparada:{id}:{fecha}`)
       para no repetirla si se recarga la página.
       También corre el **recordatorio de diario** (sección 8): desde las
       21:00, si no hay ninguna nota con `fecha` = hoy, notifica una vez
       (mismo mecanismo de marca en `localStorage`, una sola vez al día
       tanto si escribió como si no).
       El motor **nunca pide permiso por su cuenta** — solo arranca si
       `permisoActual() === 'granted'`.
    2. **Botón "Activar notificaciones" de `ajustes.html`**: pinta el
       estado real del permiso al cargar la página (`granted` / `denied` /
       `unsupported` / sin decidir), y al hacer click llama a
       `notificacionesService.pedirPermiso()` — el único lugar de toda la
       app donde se pide permiso, y siempre dentro del manejador de click
       (nunca en `DOMContentLoaded`), como exige iOS. Si se concede, arranca
       el motor de una vez sin necesitar recargar la página.
  - **`js/components/proximaAlarma.js`** (implementado) — reemplaza el
    texto fijo de ejemplo (`17:30 · Reunión de equipo`) por la alarma real
    más próxima. Busca día por día (hasta 14 días adelante) el primer
    evento con `tiene_alarma` cuya hora de alarma sea futura; como se
    recorre en orden cronológico, corta la búsqueda apenas un día produce
    un candidato. Formatea la hora como `"17:30"` si es hoy, `"mañana
    08:00"` si es mañana, o `"vie 9 ago · 08:00"` si es más adelante (nueva
    utilidad `formatearFechaCorta` en `utils/fechas.js`). Si no hay ninguna
    alarma en el horizonte de búsqueda, **oculta el widget entero**
    (`strip.hidden = true`) en vez de dejarlo con texto vacío. Se actualiza
    cada 60s. Solo corre en `index.html` y `pages/agenda.html` — las únicas
    páginas que tienen el widget en el HTML (se les agregó
    `id="next-alarm-strip"` al contenedor para poder ocultarlo/mostrarlo).
  - **`sw/service-worker.js`** (reescrito) — se agregó cache básico de
    "shell" estático (HTML/CSS/JS core + manifest + íconos) con estrategia
    **network-first, fallback a cache** (prioriza contenido fresco cuando
    hay red; solo usa lo cacheado si de verdad no hay conexión), y
    `notificationclick` que enfoca la ventana existente de la PWA o abre una
    nueva si no hay ninguna. **Decisión importante:** las rutas `/api/*`
    (Netlify Functions) están explícitamente excluidas del cache — se
    filtran antes de interceptar el `fetch` — porque cachear una respuesta
    de la API mostraría eventos/notas desactualizados sin ningún aviso, que
    es peor que no tener nada offline. Este SW solo cachea el shell
    estático, nunca datos.
  - **Sin cambios en el esquema de Turso**: la opción 2 no necesita guardar
    ninguna suscripción de push en la base — todo el estado de "ya se
    avisó" vive en `localStorage` del propio dispositivo. Los campos
    `tiene_alarma` / `minutos_antes_alarma` de `eventos` (ya existentes
    desde la Fase 3) fueron suficientes.
  - **Pendiente / limitaciones conocidas:**
    - **No probado en el iPhone real todavía** (este entorno no puede
      levantar Netlify Dev + Turso ni instalar una PWA) — verificación
      hecha de forma estática: `node --check` en todos los `.js`, cruce de
      cada función usada en `alarmaManager.js`/`proximaAlarma.js` contra lo
      que `agendaService.js`/`notasService.js`/`notificacionesService.js`/
      `utils/fechas.js` realmente exportan, y confirmación de que cada
      `id` del HTML que el JS busca (`next-alarm-strip`,
      `proxima-alarma-texto`, `btn-activar-notificaciones`,
      `estado-notificaciones`) existe en el HTML correspondiente.
      **Recomendado probar en el iPhone real, en particular**: pedir el
      permiso desde `ajustes.html`, dejar el celular bloqueado unos
      minutos con una alarma programada dentro de ese rango, y ver si
      la notificación efectivamente llega (esto es justo lo que la
      sección 4.3 advertía como poco confiable en la opción 2 — si falla
      seguido, ahí se justifica migrar a Web Push real vía APNs).
    - El "recordatorio de diario" a las 21:00 depende de que la PWA esté
      abierta (o el intervalo de 30s siga corriendo) en ese momento — con
      la opción 2, si el iPhone lleva rato bloqueado a esa hora, es posible
      que el aviso no llegue justo a las 21:00 sino recién cuando se
      desbloquee y la app haga el chequeo de `visibilitychange`, que puede
      ser bastante después. Es una limitación conocida y aceptada de la
      opción 2, no un bug.
    - La ventana de gracia de 5 minutos es un valor arbitrario razonable,
      no viene de ningún requisito explícito — se puede ajustar en
      `VENTANA_GRACIA_MIN` (`alarmaManager.js`) si en el uso real resulta
      muy corta o muy larga.

- **2026-08-20** — **Fase 6 cerrada: buscador global (eventos + notas) +
  exportar/backup en JSON.**
  - **`js/services/busquedaService.js`** (implementado) — `buscar(query)` ->
    `{ eventos: [...], notas: [...] }`. Las notas se filtran en el backend
    (reutiliza el parámetro `?q=` que `netlify/functions/notas.js` ya tenía
    desde la Fase 4, LIKE sobre título/contenido). Los eventos **no** tienen
    ese parámetro en `netlify/functions/eventos.js` todavía, así que se
    filtran en el cliente (título/descripción) sobre la lista completa que
    ya devuelve `agendaService.listarEventos()` — razonable para el volumen
    de una agenda personal; queda anotado como el punto exacto a cambiar si
    algún día hiciera falta un `?q=` real ahí también.
  - **`js/components/buscadorGlobal.js`** (nuevo) — modal singleton igual
    que `modalEvento.js`/`modalNota.js` (se inyecta una vez en `<body>` la
    primera vez que se abre), con buscador debounced (300ms, mismo patrón
    que `notas.js`). Descarta respuestas que lleguen fuera de orden con un
    contador de "última búsqueda" (si el usuario escribe rápido y una
    respuesta vieja llega después que una más nueva, no pisa el resultado
    correcto). Agrupa resultados en dos secciones ("Actividades" / "Notas");
    tocar un resultado cierra el buscador y abre el modal de edición
    correspondiente (`modalEvento.abrirParaEditar` /
    `modalNota.abrirParaEditarNota`), que ya se encargan de refrescar su
    propia vista al guardar — el buscador no necesita saber nada de eso.
  - **Punto de entrada**: botón `⌕` nuevo al final de la tabbar (clase
    `.tabbar__search-btn`, en `layout.css`), agregado a las **4 páginas**
    (`index.html`, `pages/agenda.html`, `pages/notas.html`,
    `pages/ajustes.html`) igual que se hizo con `alarmaManager.js` en la
    Fase 5, para que el buscador esté disponible sin importar qué vista
    esté abierta.
  - **`js/services/exportService.js`** (implementado) —
    `generarBackup()` trae eventos + notas + etiquetas de la API y arma un
    objeto `{ version, generado_en, eventos, notas, etiquetas }`;
    `exportarTodoComoJSON()` lo serializa y dispara la descarga con un
    `<a download>` temporal (funciona igual dentro de la PWA instalada en
    iOS). El JSON incluye las referencias `url_storage` de imágenes/audio
    de cada nota, pero no los archivos en sí — no es práctico embeber
    binarios de Netlify Blobs en un JSON de texto; queda como mapa de qué
    archivo pertenece a qué nota por si algún día se migra el storage.
  - **`js/components/exportarDatos.js`** (nuevo) — conecta el botón
    "Exportar backup (.json)" que ya existía como UI en `ajustes.html`
    desde la Fase 1 (`btn-exportar`, sin lógica hasta ahora). Deshabilita
    el botón mientras exporta, muestra el nombre del archivo generado como
    confirmación visual, y vuelve al texto original después de un momento.
  - **CSS**: `.search-bar` (antes solo en `notas.css`, usada por el
    buscador de texto local de `notas.html`) se movió a `componentes.css`
    porque ahora el buscador global también la usa y corre en las 4
    páginas, no solo en notas — evita duplicar la regla. Nuevas clases en
    `componentes.css`: `.search-results__section`, `.search-result` (misma
    lógica visual que `.card--interactive`, con ícono + título + meta +
    chip de etiqueta si aplica).
  - **Sin cambios en el esquema de Turso ni en las Netlify Functions**:
    todo se resuelve con los endpoints que ya existían (`/api/eventos`,
    `/api/notas?q=`, `/api/etiquetas`).
  - **Verificación**: `node --check` en los 4 archivos `.js` nuevos/tocados,
    y confirmación de que cada import (`abrirParaEditar` de `modalEvento.js`,
    `abrirParaEditarNota` de `modalNota.js`, utilidades de `fechas.js`, etc.)
    coincide con lo que esos módulos realmente exportan. Igual que en la
    Fase 5, no se probó en el iPhone real (este entorno no puede levantar
    Netlify Dev + Turso) — pendiente confirmar ahí que la descarga del
    backup funciona bien dentro de la PWA instalada (Safari en modo
    standalone maneja `<a download>` distinto a una pestaña normal en
    algunas versiones de iOS; si falla, la alternativa es abrir el JSON en
    una pestaña nueva con `target="_blank"` en vez de forzar la descarga).
