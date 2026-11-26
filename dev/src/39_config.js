/* ==========================================================================
   Quillmark – Konfiguration für freiwillige Konten (Supabase Auth)
   Hier stehen NUR die Projekt-URL und der öffentliche Publishable Key
   (Supabase → Project Settings → API Keys → „Publishable key“, beginnt mit sb_publishable_).
   Niemals den Secret Key / service_role Key und niemals das Google Client Secret eintragen –
   das Google Secret bleibt im Supabase-Dashboard (Authentication → Sign In / Providers → Google).
   Leer gelassen startet Quillmark ganz normal nur lokal, ohne Anmelde-Knopf.
   ========================================================================== */
window.QM_CONFIG = Object.assign({
  supabaseUrl: 'https://xluqowehujxmbpqlswks.supabase.co',
  supabaseKey: 'sb_publishable_iQMtMF3r5uq3q34VZuZUWg_kyN5IGjj',
  returnUrl: 'https://elias296.github.io/Quillmark/'       // Rückkehradresse nach Google-Login und E-Mail-Links
}, window.QM_CONFIG || {});
