# Deploy en Hostinger

Este proyecto esta preparado para desplegarse como una unica Node app desde la raiz.

## Estructura correcta

Hostinger debe apuntar a la raiz del repositorio, donde viven:

- `package.json`
- `server.js`
- `public/`
- `frontend/`
- `backend/`

El runtime real que debe arrancar Hostinger es la raiz, no `backend/server.js`.

## Comando de inicio

Usa:

```bash
npm start
```

## Variables de entorno

Configura en Hostinger:

- `APP_PASSWORD`
- `OPENAI_API_KEY` si quieres transcripcion

Opcional:

- `PORT`
- `HOST`
- `DATA_DIR`

## Qué sirve esta app

- `GET /`
- `POST /api/login`
- `GET /api/pacientes/buscar`
- `POST /api/pacientes`
- `GET/POST /api/sesiones/*`
- `POST /api/pdf/*`
- `POST /api/transcribir`

## Nota importante

Antes de subir cambios de frontend, ejecuta:

```bash
npm run build
```

Eso regenera `public/`, que es la carpeta que sirve Hostinger.
