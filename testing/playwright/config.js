export default {
  baseUrl: 'http://127.0.0.1:4183',
  webServer: {
    command: "/bin/zsh -lc 'mkdir -p .tmp-e2e-data && VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=sb_publishable_test npm run build && PORT=4183 APP_PASSWORD=testpass DATA_DIR=.tmp-e2e-data SUPABASE_URL=https://example.supabase.co SUPABASE_SERVICE_ROLE_KEY=service_role_test node server.js'",
    cwd: '/Users/sam/.codex/worktrees/34f1/clinica',
    url: 'http://127.0.0.1:4183',
    reuseExistingServer: false,
    timeout: 120000
  },
  pages: ['/fisio', '/admin', '/registro.html'],
  smoke: {
    requireH1: true,
    requireFooter: false
  },
  navigation: false,
  seo: false,
  whatsapp: false,
  forms: [
    {
      path: '/registro.html',
      formSelector: 'form',
      successText: 'Registro guardado con el código',
      submit: {
        mode: 'stub',
        urlMatcher: '**/functions/v1/submit-fisio-intake',
        method: 'POST',
        status: 200,
        responseBody: {
          ok: true,
          registry_number: 'REG-TEST-001',
          matched_existing_profile: false,
          profile_id: 'profile-test-001',
          submission_id: 'submission-test-001',
          download_url: 'https://example.com/test.pdf',
          storage_path: 'REG-TEST-001/submission-test-001/2026-05-31-test.pdf'
        }
      }
    }
  ]
};
