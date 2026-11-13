// Public settings only. Everything in this file is safe to publish: the site is public and so is this repo.
// NEVER put the Supabase service_role key or the Turnstile secret key here (or anywhere in this repo).
// The Turnstile secret lives only in the Supabase dashboard (Authentication > Attack Protection).
export const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR-PUBLIC-ANON-KEY";
export const TURNSTILE_SITE_KEY = "0x4AAAAAAGAETYy3gukhtfHv";
