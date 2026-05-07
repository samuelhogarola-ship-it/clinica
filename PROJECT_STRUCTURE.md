# Estructura del proyecto

## Regla base

Mantener una sola app Node en la raiz del proyecto.

## Capas actuales

### Runtime de produccion

- `package.json`
- `server.js`
- `public/`

Responsabilidades:

- arrancar la app en Hostinger
- servir el frontend compilado
- exponer la API clinica
- aplicar la autenticacion basica

### Fuente frontend

- `frontend/`

Responsabilidades:

- desarrollo React + Vite
- generar `public/` con `npm run build`

### Compatibilidad local

- `backend/server.js`

Responsabilidades:

- mantener el punto de entrada anterior para desarrollo local
- redirigir al runtime raiz

### Datos

- `backend/datos/` o `DATA_DIR`

Responsabilidades:

- indice de pacientes
- sesiones json
- pdfs generados

## Criterio de deploy

Si Hostinger ve `package.json` y `server.js` en raiz y arranca con `npm start`, la estructura es correcta.
