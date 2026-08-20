# Agenda Personal — Documento de Proyecto

> Este archivo es la fuente de verdad del proyecto. Se actualiza con cada avance,
> decisión técnica y cambio de rumbo. Antes de tocar código, revisar este documento.

Última actualización: 2026-08-19 (v6 — Fase 3 cerrada: CRUD de eventos/etiquetas, checklist "hecho hoy" y racha, conectados de punta a punta)

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
- [ ] **Fase 4** — CRUD de notas + subida de imágenes + vínculo nota-evento
      + **notas de voz** (grabación corta, Web Audio API + Storage).
- [ ] **Fase 5** — Sistema de notificaciones/alarmas + Service Worker
      + **vista de "próxima alarma"** en la barra superior
      + **recordatorio de diario** si no se ha escrito nota en el día.
- [ ] **Fase 6** — **Buscador global** (eventos + notas) + **exportar/backup** en JSON.
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
  evalúan cuando lleguemos a la Fase 5.
- La Badge API (número en el ícono de la app) funciona desde iOS 16.4.
