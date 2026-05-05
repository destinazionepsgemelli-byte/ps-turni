// ==============================================
//  CONFIGURAZIONE SUPABASE
// ==============================================
const SUPABASE_URL = 'https://hqgdnhinxvaoeicplkbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxZ2RuaGlueHZhb2VpY3Bsa2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjkxMTEsImV4cCI6MjA5MzU0NTExMX0.tw3Po_SURv7ycAIkT9sK9XnF9ioVoLUHCSDh8wJrDbA';

// Cambia questa password con una sicura!
const ADMIN_PASSWORD = 'psgemelli2026';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);