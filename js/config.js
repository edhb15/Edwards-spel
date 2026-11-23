// Inställningar för topplistorna i alla spel.
//
// Tomt = topplistan sparas bara på spelarens egen enhet.
// Fyll i från Supabase (Project Settings → API) för en gemensam topplista online.
// Samma databas som topplistorna i EoJ-spel (se shared/README.md där).
window.EOJ_CONFIG = {
  supabaseUrl: 'https://vqrkexuiigpylwgpcupp.supabase.co', // t.ex. 'https://abcdefgh.supabase.co'
  supabaseKey: 'sb_publishable_v2GfTLeSWERJRA7HARbCiA_5lgLuljY', // "anon public"-nyckeln (den är gjord för att synas i webbläsaren)
};
