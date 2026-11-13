// The page a password-reset email links to. Supabase puts a one-time recovery code in the link; supabase-js turns it into a
// short session, and only then may a new password be saved. Without a valid link the form never appears.
import { supabase, configured, errorKind, newPasswordProblem, HOME_PAGE } from "./client.js";

const $ = id => document.getElementById(id);
const form = $("form"), pw = $("password"), pw2 = $("password2"), msg = $("msg"), go = $("go"), lede = $("lede");
const say = (text, kind) => { msg.textContent = text || ""; msg.className = "msg" + (kind ? " " + kind : ""); };
const BAD_LINK = "This reset link isn't valid any more. Ask for a new one from the sign-in page.";
let ready = false, busy = false;

function open() { if (ready) return; ready = true; lede.textContent = "Enter a new password for your account."; form.hidden = false; pw.focus(); }

if (!configured) { lede.textContent = "Sign-in isn't set up yet."; }
else {
  supabase.auth.onAuthStateChange((event, session) => { if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) open(); });
  supabase.auth.getSession().then(({ data }) => { if (data && data.session) open(); }).catch(() => {});
  /* no session after a few seconds: the link was missing, used already or has expired */
  setTimeout(() => { if (!ready) lede.textContent = BAD_LINK; }, 4000);
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  if (busy || !ready) return;
  const problem = newPasswordProblem(pw.value, pw2.value);
  if (problem) { say(problem, "bad"); return; }
  busy = true; go.disabled = true; go.textContent = "Saving…";
  let error = null;
  try { error = (await supabase.auth.updateUser({ password: pw.value })).error; } catch (err) { error = { status: 0, name: "AuthRetryableFetchError" }; }
  busy = false; go.disabled = false; go.textContent = "Save new password";
  const kind = errorKind(error);
  if (kind === "network") { say("Couldn't reach the sign-in service. Check your connection and try again.", "bad"); return; }
  if (kind === "rate") { say("Too many attempts. Wait a few minutes and try again.", "bad"); return; }
  if (kind === "weak") { say("That password isn't strong enough. Try a longer, less common one.", "bad"); return; }
  if (error) { say("The password couldn't be changed. Ask for a new reset link and try again.", "bad"); return; }
  pw.value = pw2.value = "";
  /* sign every other device out, so an old session can't outlive the old password */
  try { await supabase.auth.signOut({ scope: "others" }); } catch (err) {}
  form.hidden = true; lede.textContent = "Password changed. Taking you in…";
  setTimeout(() => location.replace(HOME_PAGE), 1200);
});
