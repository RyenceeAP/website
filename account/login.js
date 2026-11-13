// Sign in, create an account and ask for a password-reset link: one form, three modes.
// Rules this file keeps:
//  - email and password are checked here before anything is sent to Supabase;
//  - whatever Supabase answers, the visitor is never told whether an email address has an account;
//  - text is only ever put on the page with textContent (never innerHTML), so nothing typed or returned can run as markup;
//  - every request carries a fresh Turnstile token, which Supabase checks on its side; tokens are single-use, so the widget is reset after each try.
import { supabase, configured, safeNext, errorKind, emailProblem, newPasswordProblem } from "./client.js";
import { TURNSTILE_SITE_KEY } from "./config.js";

const $ = id => document.getElementById(id);
const form = $("form"), email = $("email"), pw = $("password"), pw2 = $("password2"), msg = $("msg"), go = $("go");
const next = safeNext(new URLSearchParams(location.search).get("next"));

const MODES = {
  signin: { title: "Sign in", lede: "Private area. Sign in to continue.", button: "Sign in", busy: "Signing in…" },
  signup: { title: "Create an account", lede: "You'll get an email with a link to confirm the address.", button: "Create account", busy: "Creating…" },
  forgot: { title: "Reset your password", lede: "Enter your email and we'll send a link to choose a new password.", button: "Send reset link", busy: "Sending…" },
};
const TEXT = {
  badLogin: "Invalid email or password. If you just created the account, confirm your email first.",
  signedUp: "If that address can be registered, a confirmation email is on its way. Open the link in it, then sign in.",
  resetSent: "If there's an account for that email, a reset link is on its way.",
  rate: "Too many attempts. Wait a few minutes and try again.",
  captcha: "The security check didn't pass. Please try again.",
  noCaptcha: "Please complete the security check first.",
  network: "Couldn't reach the sign-in service. Check your connection and try again.",
  weak: "That password isn't strong enough. Try a longer, less common one.",
  setup: "Sign-in isn't set up yet.",
};
let mode = "signin", busy = false, widget = null;

function say(text, kind) { msg.textContent = text || ""; msg.className = "msg" + (kind ? " " + kind : ""); }
function setMode(m) {
  mode = m; const M = MODES[m];
  $("title").textContent = M.title; $("lede").textContent = M.lede; go.textContent = M.button;
  document.title = M.title + " | Ryan Carrillo";
  $("pwRow").hidden = m === "forgot";
  $("pw2Row").hidden = $("pwHint").hidden = m !== "signup";
  pw.autocomplete = m === "signup" ? "new-password" : "current-password";
  pw.value = pw2.value = "";
  document.querySelectorAll("[data-mode]").forEach(b => { b.hidden = b.dataset.mode === m; });
  say("");
}
document.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));

/* Turnstile: drawn once the script has loaded; the same widget serves all three modes. */
function drawCaptcha(tries = 0) {
  if (window.turnstile && typeof window.turnstile.render === "function") {
    try { widget = window.turnstile.render("#captcha", { sitekey: TURNSTILE_SITE_KEY, action: "account", theme: "light" }); } catch (e) {}
    return;
  }
  if (tries < 100) setTimeout(() => drawCaptcha(tries + 1), 100);
}
function captchaToken() { try { return (widget !== null && window.turnstile.getResponse(widget)) || ""; } catch (e) { return ""; } }
function captchaReset() { try { if (widget !== null) window.turnstile.reset(widget); } catch (e) {} }

function common(kind) { return kind === "rate" ? TEXT.rate : kind === "captcha" ? TEXT.captcha : kind === "network" ? TEXT.network : ""; }

async function submit() {
  const address = email.value.trim(), password = pw.value;
  /* 1. check the input here first */
  let problem = emailProblem(address);
  if (!problem && mode === "signin" && !password) problem = "Enter your password.";
  if (!problem && mode === "signin" && password.length > 72) problem = TEXT.badLogin;
  if (!problem && mode === "signup") problem = newPasswordProblem(password, pw2.value);
  if (problem) { say(problem, "bad"); return; }
  const token = captchaToken();
  if (!token) { say(TEXT.noCaptcha, "bad"); return; }

  /* 2. one request, with the single-use token */
  let error = null, session = null;
  try {
    if (mode === "signin") {
      const r = await supabase.auth.signInWithPassword({ email: address, password, options: { captchaToken: token } });
      error = r.error; session = r.data && r.data.session;
    } else if (mode === "signup") {
      const r = await supabase.auth.signUp({ email: address, password, options: { captchaToken: token, emailRedirectTo: location.origin + "/login.html" } });
      error = r.error;
    } else {
      const r = await supabase.auth.resetPasswordForEmail(address, { captchaToken: token, redirectTo: location.origin + "/reset-password.html" });
      error = r.error;
    }
  } catch (e) { error = { name: "AuthRetryableFetchError", status: 0 }; }
  captchaReset();

  /* 3. answer without revealing whether the address has an account */
  const kind = errorKind(error), shared = common(kind);
  if (shared) { say(shared, "bad"); return; }
  if (mode === "signin") {
    if (error || !session) { pw.value = ""; say(TEXT.badLogin, "bad"); return; }
    location.replace(next); return;
  }
  if (mode === "signup") {
    if (kind === "weak") { say(TEXT.weak, "bad"); return; }
    pw.value = pw2.value = ""; say(TEXT.signedUp, "good"); return;
  }
  say(TEXT.resetSent, "good");
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  if (busy) return;
  if (!configured) { say(TEXT.setup, "bad"); return; }
  busy = true; go.disabled = true; go.textContent = MODES[mode].busy;
  try { await submit(); } finally { busy = false; go.disabled = false; go.textContent = MODES[mode].button; }
});

/* Already signed in (or just arrived from the confirmation email): go straight on. */
if (configured) {
  supabase.auth.getSession().then(({ data }) => { if (data && data.session) location.replace(next); }).catch(() => {});
  supabase.auth.onAuthStateChange((event, session) => { if (event === "SIGNED_IN" && session && !busy) location.replace(next); });
  drawCaptcha();
} else { say(TEXT.setup, "bad"); go.disabled = true; }
setMode("signin");
if (!configured) say(TEXT.setup, "bad");
