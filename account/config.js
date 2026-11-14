// Public settings only. Everything in this file is safe to publish: the site is public and so is this repo.
// NEVER put the Supabase service_role key or the Turnstile secret key here (or anywhere in this repo).
// The Turnstile secret lives only in the Supabase dashboard (Authentication > Attack Protection).
export const SUPABASE_URL = "https://djjtshpbxlypoezeylcq.supabase.co";
// The publishable key (Supabase's newer name for the anon key). Public by design; a key starting sb_secret_ must never go here.
export const SUPABASE_ANON_KEY = "sb_publishable_IPqvc8tpYV0YwhqgvzaLIg_rWXhNU2S";
export const TURNSTILE_SITE_KEY = "0x4AAAAAAGAETYy3gukhtfHv";
