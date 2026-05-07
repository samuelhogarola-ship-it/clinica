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

## Modo compartido en Hostinger

- El índice de pacientes (`ID + fechaNacimiento`) vive en el servidor y se comparte entre todos los dispositivos.
- La búsqueda y el listado de pacientes consultan siempre ese índice centralizado.
- Al generar un PDF:
  - se descarga en el dispositivo que lo solicita
  - y además se guarda una copia en el servidor por ahora
- Esto permite trabajar desde móvil, tablet o PC viendo la misma base de pacientes sin depender de carpetas locales del equipo del usuario.

## Autenticación básica

- La app incluye una pantalla de acceso simple.
- La validación de la contraseña se hace en el backend mediante `POST /api/login`.
- La contraseña no se guarda en el frontend.
- Tras un login correcto, el backend genera un token simple en memoria con `crypto.randomUUID()`.
- El frontend guarda ese token en `localStorage` y lo envía en `Authorization: Bearer <token>`.
- Todos los endpoints clínicos quedan protegidos salvo `/api/login`.
- Esta protección está pensada para una app privada/local y no pretende ser seguridad enterprise.

### Cómo funciona

1. El usuario introduce la contraseña definida en `APP_PASSWORD`.
2. `POST /api/login` valida la contraseña y devuelve un token simple.
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
