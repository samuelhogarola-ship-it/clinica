export default {
  baseUrl: 'http://127.0.0.1:4173',
  webServer: {
    command: "/bin/zsh -lc 'mkdir -p .tmp-e2e-data && PORT=3001 APP_PASSWORD=testpass DATA_DIR=.tmp-e2e-data node backend/server.js & npm run dev --prefix frontend -- --host 127.0.0.1 --port 4173'",
    cwd: '/Users/sam/Desktop/webs/clinica',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  pages: ['/'],
  smoke: {
    requireH1: true,
    requireFooter: false
  },
  navigation: false,
  seo: false,
  whatsapp: false,
  forms: []
};
