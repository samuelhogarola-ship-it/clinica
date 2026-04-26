# FisioApp

App de revisiones clínicas para fisioterapia. Datos anonimizados, almacenamiento local en red.

## Estructura

```
fisioapp/
├── backend/    → Node + Express (puerto 3001)
│   └── datos/  → carpeta generada automáticamente con sesiones e índice
└── frontend/   → React + Vite (puerto 5173)
```

## Configuración inicial

### 1. API Key de OpenAI (Whisper)

Crea un archivo `.env` dentro de `backend/`:

```
OPENAI_API_KEY=sk-...tu-clave-aquí...
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

### 3. Frontend (otra terminal)

```bash
cd frontend
npm install
npm run dev
```

### 4. Abrir en las tablets

Desde cualquier tablet en la misma red WiFi:

```
http://[IP-del-ordenador-servidor]:5173
```

Para saber la IP del servidor en macOS/Linux: `ifconfig | grep inet`
En Windows: `ipconfig`

## Cómo funciona

### Privacidad y datos
- El fisioterapeuta asigna una ID codificada a cada paciente (ej: `4F92K`)
- El único dato personal guardado es la fecha de nacimiento, usada para buscar al paciente
- La carpeta `datos/` tiene dos partes separadas:
  - `datos/sesiones/` → informes clínicos por ID
  - `datos/indice/` → solo contiene ID + fecha de nacimiento (sin nombres)
- Nada sale a Internet. Todo en red local.

### Flujo de uso
1. Buscar paciente por fecha de nacimiento → seleccionar su ID
2. O crear nuevo paciente con ID y fecha de nacimiento
3. En la ficha: hablar al micrófono → el audio va a Whisper → texto se añade al campo (acumulativo)
4. Editar manualmente si se necesita
5. Autoguardado tras cada cambio
6. Generar PDF → se descarga en el navegador y se guarda en `datos/sesiones/[ID]/`

### Datos guardados por sesión
Cada visita genera dos archivos con la fecha como nombre:
- `YYYY-MM-DD.json` → datos en bruto (autoguardado)
- `YYYY-MM-DD.pdf` → informe generado al pulsar el botón

## Ampliaciones futuras
- Añadir nuevas plantillas en el backend y selector en el frontend
- Autenticación básica para proteger el acceso por red
- Backup automático de la carpeta `datos/`
