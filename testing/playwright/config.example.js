export default {
  baseUrl: "http://localhost:3000",

  pages: ["/", "/blog", "/vacantes", "/entregas", "/eventos"],

  navigation: true,
  seo: true,
  whatsapp: true,

  forms: [
    "/contacto",
    {
      path: "/presupuesto",
      formSelector: 'form[data-testid="lead-form"]',
      successText: "Gracias",
      submit: {
        mode: "stub",
        urlMatcher: "**/api/presupuesto",
        method: "POST"
      }
    }
  ]
};
