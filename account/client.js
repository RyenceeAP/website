// One Supabase client for every page. Uses only the project URL and the public anon key (see config.js).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const configured = !/YOUR-PROJECT-REF/.test(SUPABASE_URL) && !/YOUR-PUBLIC-ANON-KEY/.test(SUPABASE_ANON_KEY);
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const LOGIN_PAGE = "/login.html";
export const HOME_PAGE = "/ap-tools.html";

/* Only ever send someone to a page on this site: a path that starts with one "/" and resolves to this origin. */
export function safeNext(raw) {
  if (typeof raw !== "string" || !/^\/[^/\\]/.test(raw) || /[\u0000-\u001f]/.test(raw)) return HOME_PAGE;
  try {
    const u = new URL(raw, location.origin);
    if (u.origin !== location.origin || u.pathname === LOGIN_PAGE) return HOME_PAGE;
    return u.pathname + u.search + u.hash;
  } catch (e) { return HOME_PAGE; }
}

/* Sort a Supabase auth error into the few kinds a visitor may be told about. Anything else stays generic. */
export function errorKind(error) {
  if (!error) return "";
  const code = error.code || "", status = error.status || 0;
  if (status === 429 || /rate_limit/.test(code)) return "rate";
  if (code === "captcha_failed") return "captcha";
  if (code === "weak_password") return "weak";
  if (error.name === "AuthRetryableFetchError" || status === 0 || status >= 500) return "network";
  return "other";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function emailProblem(v) {
  if (!v) return "Enter your email address.";
  if (v.length > 254 || !EMAIL_RE.test(v)) return "Enter a valid email address.";
  return "";
}
/* For a NEW password (sign-up and reset). Sign-in only checks that something was typed. */
export function newPasswordProblem(p, again) {
  if (p.length < 12) return "Use at least 12 characters for the password.";
  if (p.length > 72) return "Use 72 characters or fewer for the password.";
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return "Use at least one letter and one number in the password.";
  if (p !== again) return "The two passwords don't match.";
  return "";
}
