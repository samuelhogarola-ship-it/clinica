# FisioApp

Aplicación clínica para fisioterapia con frontend en React/Vite y backend en Node/Express. Este repositorio conserva solo la versión definitiva de la app.

## Estructura

```text
clinica/
├── frontend/   # interfaz React + Vite
├── backend/    # API Express + PDFs + transcripción
└── render.yaml # despliegue remoto de una sola app Node
```

## Desarrollo local

### 1. Instalar dependencias

```bash
npm install --prefix backend
npm install --prefix frontend
```

### 2. Configurar variables

Crea `backend/.env`:

```bash
OPENAI_API_KEY=sk-...
```

Opcionalmente puedes fijar un directorio de datos distinto:

```bash
DATA_DIR=/ruta/a/datos
```

### 3. Arrancar la app

Terminal 1:

```bash
npm run dev --prefix backend
```

Terminal 2:

```bash
npm run dev --prefix frontend
```

Abre [http://localhost:5173](http://localhost:5173).

## Preview remota

El backend está preparado para servir el frontend compilado, así que en remoto se despliega como una sola app Node.

### Render

1. Conecta este repo de GitHub en Render.
2. Render detectará `render.yaml`.
3. Añade `OPENAI_API_KEY` como variable de entorno.
4. Si quieres persistencia real de datos en producción, monta un disco y apunta `DATA_DIR` a esa ruta.

### Qué hace el despliegue

- Instala `backend/` y `frontend/`
- Compila el frontend
- Arranca Express
- Sirve la SPA y la API bajo el mismo dominio

## Nota sobre datos

En local, los datos se guardan en `backend/datos/`. En una preview remota sin disco persistente, los archivos pueden perderse al reiniciar el servicio.
