# FisioApp

Aplicación clínica para fisioterapia con frontend en React/Vite y backend en Node/Express.

## Estructura

```text
clinica/
├── package.json
├── server.js
├── public/     # frontend compilado listo para servir
├── frontend/   # fuente React + Vite
├── backend/    # compatibilidad local y datos existentes
└── render.yaml
```

## Hostinger

La app está reorganizada para seguir el mismo patrón que tus otros repos Node para Hostinger:

- una sola app Node en la raíz
- `package.json` en raíz
- `server.js` en raíz
- frontend servido desde `public/`
- comando de arranque: `npm start`

Si Hostinger apunta a la raíz del repo, la estructura correcta ya está preparada.

## Desarrollo local

### 1. Instalar dependencias

```bash
npm install
npm install --prefix frontend
```

### 2. Configurar variables

Crea `backend/.env`:

```bash
OPENAI_API_KEY=sk-...
APP_PASSWORD=2026
```

Opcionalmente puedes fijar un directorio de datos distinto:

```bash
DATA_DIR=/ruta/a/datos
```

### 3. Arrancar la app

Terminal 1:

```bash
npm run dev:backend
```

Terminal 2:

```bash
npm run dev --prefix frontend
```

Abre [http://localhost:5173](http://localhost:5173).

## Preview remota

La raíz del proyecto sirve el frontend compilado como una sola app Node.

### Render

1. Conecta este repo de GitHub en Render.
2. Render detectará `render.yaml`.
3. Añade `OPENAI_API_KEY` como variable de entorno.
4. Añade también `APP_PASSWORD`.
5. Si quieres persistencia real de datos en producción, monta un disco y apunta `DATA_DIR` a esa ruta.

### Qué hace el despliegue

- Instala dependencias en raíz y frontend
- Compila el frontend
- Arranca `server.js` en raíz
- Sirve la SPA y la API bajo el mismo dominio

## Nota sobre datos

En local, los datos se guardan en `backend/datos/`. En una preview remota sin disco persistente, los archivos pueden perderse al reiniciar el servicio.

## Persistencia preparada para migración

- Los JSON ya no se tratan como almacenamiento desechable.
- La estructura nueva está pensada para migrar después a SQLite, PostgreSQL, Supabase o una base de datos relacional equivalente.
- Cada entidad nueva usa IDs internos estables:
  - pacientes: `pac_000001`
  - sesiones: `ses_000001`
- El código visible del paciente que usa la app sigue existiendo aparte, para no romper la UX actual.
- Las relaciones se guardan de forma consistente:
  - paciente interno
  - sesión interna
  - relación `paciente_id` en cada sesión
- Todas las fechas estructurales nuevas se guardan en ISO con `new Date().toISOString()`.
- Los datos clínicos siguen siendo utilizables desde la app actual, pero la persistencia queda mucho más cerca de una base de datos relacional.

### Estructura interna

- `backend/datos/pacientes/`
  - un JSON por paciente interno
- `backend/datos/sesiones-registros/`
  - un JSON por sesión interna
- `backend/datos/meta/patient-code-index.json`
  - relación entre código visible e ID interno de paciente
- `backend/datos/meta/patient-sessions-index.json`
  - relación entre paciente interno, fecha e ID interno de sesión
- `backend/datos/meta/counters.json`
  - contadores persistentes para generar IDs estables

### Compatibilidad

- La app mantiene compatibilidad con los datos legacy ya existentes.
- Al arrancar, el backend migra automáticamente el índice y las sesiones antiguas a la nueva estructura interna sin rehacer la app.
- Los PDFs y los JSON legacy por fecha siguen existiendo por compatibilidad operativa, pero la referencia principal para migración futura pasa a ser la estructura nueva.

## Modo compartido en Hostinger

- El índice de pacientes (`ID + fechaNacimiento`) vive en el servidor y se comparte entre todos los dispositivos.
- La búsqueda y el listado de pacientes consultan siempre ese índice centralizado.
- Al generar un PDF:
  - se descarga en el dispositivo que lo solicita
  - y además se guarda una copia en el servidor por ahora
- Esto permite trabajar desde móvil, tablet o PC viendo la misma base de pacientes sin depender de carpetas locales del equipo del usuario.

## Autenticación básica

- La app incluye una pantalla de acceso simple.
- La validación se hace en el backend mediante `POST /api/login`.
- La contraseña no se guarda en el frontend.
- Tras un login correcto, el backend genera un token simple en memoria con `crypto.randomUUID()`.
- El frontend guarda ese token y el usuario actual en `localStorage`, y envía `Authorization: Bearer <token>`.
- Todos los endpoints clínicos quedan protegidos salvo `/api/login`.
- Esta protección está pensada para una app privada/local y no pretende ser seguridad enterprise.

## Usuarios y trazabilidad mínima

- Los usuarios internos viven en `backend/usuarios.json`.
- Cada usuario tiene `id`, `username`, `role` y `displayName`.
- El login sigue siendo simple:
  - `username` identifica quién entra
  - `APP_PASSWORD` sigue siendo la contraseña compartida actual
- Al iniciar sesión, el backend devuelve:
  - `token`
  - `currentUser = { id, username, role, displayName }`
- El backend adjunta ese usuario a la sesión autenticada en memoria y ya puede registrar:
  - `createdBy`
  - `updatedBy`
  - `pdfGeneratedBy`

### Limitaciones reales

- No hay gestión avanzada de usuarios todavía.
- Los tokens y la sesión autenticada viven en memoria.
- Si se reinicia el servidor, hay que volver a iniciar sesión.
- Está pensado para trazabilidad interna básica, no para seguridad enterprise.

### Cómo funciona

1. El usuario introduce su `username` y la contraseña compartida definida en `APP_PASSWORD`.
2. `POST /api/login` valida ambos datos y devuelve un token simple junto con `currentUser`.
3. El backend guarda ese token en memoria.
4. Las peticiones siguientes solo funcionan si incluyen el token válido en `Authorization`.
5. Si el servidor se reinicia, los tokens en memoria dejan de ser válidos y hay que volver a iniciar sesión.

### Configuración

Define estas variables en `backend/.env`:

```bash
OPENAI_API_KEY=sk-...
APP_PASSWORD=2026
DATA_DIR=./datos
```

### Arranque

```bash
npm install
npm install --prefix frontend
npm run dev:backend
npm run dev --prefix frontend
```

O para servir la versión compilada desde Node:

```bash
npm run build
APP_PASSWORD=2026 npm start
```

### Archivos modificados

- `server.js`
- `backend/server.js`
- `package.json`
- `frontend/vite.config.js`
- `frontend/src/App.jsx`
- `README.md`
