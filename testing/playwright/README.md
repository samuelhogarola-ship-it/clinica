# Playwright Starter Pack

Starter pack reusable de Playwright para webs corporativas y apps sencillas. Está pensado para detectar roturas reales de navegación, SEO, formularios y errores graves de navegador sin introducir mantenimiento visual innecesario.

## Qué detecta

- páginas que no cargan o responden con error
- ausencia de `h1`, `title` o `footer`
- navegación interna rota en `nav` y `footer`
- ausencia de metadatos SEO básicos
- formularios invisibles, sin campos requeridos o con submit roto
- errores graves de JavaScript, `pageerror` y fallos críticos de carga
- CTA de WhatsApp ausente o con `href` inválido

## Qué no detecta

- snapshots visuales
- diferencias pixel-perfect
- cambios menores de padding, tipografía o color
- regresiones puramente estéticas

## Estructura

```text
testing/playwright/
├── README.md
├── config.example.js
├── forms.spec.js
├── github-actions.example.yml
├── helpers.js
├── navigation.spec.js
├── playwright.config.js
├── seo.spec.js
└── smoke.spec.js
```

## Instalación

Desde el proyecto consumidor:

```bash
npm install
npm install -D @playwright/test
npx playwright install
```

Si el proyecto consume este módulo desde `@lab-world/core`, basta con exponer el contenido de `testing/playwright/` en el repo destino y ajustar la config local. Si preferís mantenerlo centralizado, también podéis referenciar los archivos desde `node_modules/@lab-world/core/testing/playwright`.

## Configuración

1. Copia [config.example.js](/Users/sam/.codex/worktrees/6174/core/testing/playwright/config.example.js) como `testing/playwright/config.js` en el proyecto destino.
2. Ajusta `baseUrl`, `pages` y `forms`.
3. Ejecuta los tests con la variable `PLAYWRIGHT_STARTER_CONFIG` si la config vive en otra ruta.

Ejemplo mínimo:

```js
export default {
  baseUrl: "http://localhost:3000",
  pages: ["/", "/blog", "/vacantes", "/entregas", "/eventos"],
  smoke: {
    requireH1: true,
    requireFooter: true
  },
  navigation: true,
  seo: true,
  whatsapp: true,
  forms: ["/contacto"]
};
```

## Opciones soportadas

### `baseUrl`

URL base de la app a testear.

### `webServer`

Opcional. Permite arrancar el proyecto automáticamente antes de ejecutar Playwright:

```js
webServer: {
  command: "npm run dev",
  cwd: process.cwd(),
  url: "http://localhost:3000",
  reuseExistingServer: !process.env.CI,
  timeout: 120000
}
```

### `pages`

Lista de rutas que deben pasar smoke, navegación y SEO.

### `navigation`

Puede ser `true`, `false` o un objeto:

```js
navigation: {
  enabled: true,
  navbarSelector: "nav",
  footerSelector: "footer",
  requireNavbar: true,
  requireFooter: true,
  expectedLinks: ["/", "/blog", "/contacto"],
  checkBrokenInternalLinks: true,
  linkScopeSelectors: ["nav", "footer"]
}
```

### `seo`

Puede ser `true`, `false` o un objeto:

```js
seo: {
  enabled: true,
  requireMetaDescription: true,
  requireCanonical: true,
  requireSingleH1: true
}
```

### `smoke`

Permite afinar checks estructurales cuando el proyecto no es una web corporativa clásica:

```js
smoke: {
  requireH1: true,
  requireFooter: false,
  h1Selector: "h1",
  footerSelector: "footer"
}
```

### `whatsapp`

Puede ser `true`, `false` o un objeto con selector propio:

```js
whatsapp: {
  enabled: true,
  selector: 'a[href*="wa.me/"]'
}
```

### `forms`

Admite strings o configuración avanzada.

Forma simple:

```js
forms: ["/contacto"]
```

Forma avanzada:

```js
forms: [
  {
    path: "/contacto",
    formSelector: 'form[data-testid="contact-form"]',
    successText: "Gracias",
    submit: {
      mode: "stub",
      urlMatcher: "**/api/contact",
      method: "POST",
      status: 200,
      responseBody: { ok: true }
    }
  }
]
```

Notas:

- `mode: "none"` valida visibilidad y requeridos, pero no ejecuta submit.
- `mode: "stub"` intercepta el endpoint y permite probar el flujo sin depender de APIs externas.
- `mode: "live"` deja pasar la petición real y espera respuesta.

## Cómo añadir páginas

Añade nuevas rutas en `pages`:

```js
pages: ["/", "/servicios", "/casos-de-exito", "/contacto"]
```

## Cómo añadir formularios

Para un formulario básico:

```js
forms: ["/contacto"]
```

Para un formulario con submit real o interceptado:

```js
forms: [
  {
    path: "/demo",
    formSelector: "form",
    successUrl: "/gracias",
    submit: {
      mode: "live",
      urlMatcher: "/api/demo",
      method: "POST"
    }
  }
]
```

## Cómo ejecutarlo localmente

Con config en `testing/playwright/config.js`:

```bash
npm run test:e2e
```

Con config en una ruta distinta:

```bash
PLAYWRIGHT_STARTER_CONFIG=./qa/playwright.config.app.js npm run test:e2e
```

Para abrir el runner en modo visible:

```bash
npm run test:e2e:headed
```

## Integración en GitHub Actions

Hay un ejemplo no activo en [github-actions.example.yml](/Users/sam/.codex/worktrees/6174/core/testing/playwright/github-actions.example.yml). La idea es copiarlo a `.github/workflows/playwright-starter-pack.yml` en el proyecto consumidor y ajustar solo la ruta de config si hace falta.

Pasos del workflow:

- `npm install`
- `npx playwright install --with-deps`
- `npm run test:e2e`

## Reutilización recomendada

### AGAMA

Útil para landing, páginas SEO y formularios de captación. Recomendación: activar `whatsapp`, `seo` y formularios con `mode: "stub"`.

### Web Fuengirola

Encaja bien para revisar navegación municipal, páginas de contenidos y formularios de contacto. Recomendación: ampliar `pages` y definir `expectedLinks` en navegación.

### Samuel Coach

Ideal para páginas de servicios, blog, CTA WhatsApp y lead forms. Recomendación: activar `whatsapp` y cubrir formularios de discovery o contacto.

### Personal Trainer

Sirve para detectar caídas en páginas de planes, contacto y reservas simples. Recomendación: usar smoke + SEO + formularios, sin meter snapshots visuales.

### Futuros proyectos

Copiad la carpeta, cread `config.js`, apuntad `baseUrl` al entorno local o preview y añadid solo las rutas críticas del negocio. La cobertura buena aquí no es “todo el sitio”, sino los flujos cuya rotura sí cuesta leads, SEO o confianza.
