// Protected-page guard. Load it first on any page that needs a signed-in visitor:
//   <html class="locked"> ... <script type="module" src="/account/guard.js"></script>
// The page stays hidden (see account.css, html.locked) until a session is confirmed; anyone without one is sent to the login page.
//
// Honest limit: this file runs in the visitor's browser, so it controls what the PAGE shows, not what the web server hands out.
// GitHub Pages serves every file in this repo to anyone. Anything that must stay private is therefore never stored here in
// readable form: it is either kept in Supabase behind Row-Level Security or published encrypted (see tools.js).
import { supabase, LOGIN_PAGE } from "./client.js";

let leaving = false;
function toLogin() {
  if (leaving) return; leaving = true;
  const next = location.pathname + location.search;
  location.replace(LOGIN_PAGE + "?next=" + encodeURIComponent(next));
}
const never = () => new Promise(() => {});

/* Resolves to { session, user } for a signed-in visitor. For anyone else the page is redirected and this never resolves. */
export const sessionReady = (async () => {
  let session = null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error) session = data.session;
  } catch (e) {}
  if (!session) { toLogin(); return never(); }
  /* getSession() reads this browser's saved copy; getUser() asks Supabase whether that session is still good. */
  let user = session.user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error && (error.status === 401 || error.status === 403 || error.name === "AuthSessionMissingError")) {
      try { await supabase.auth.signOut({ scope: "local" }); } catch (e) {}
      toLogin(); return never();
    }
    if (data && data.user) user = data.user;
  } catch (e) {}
  document.documentElement.classList.remove("locked");
  return { session, user };
})();

/* Signing out here, in another tab, or a session that can no longer be refreshed: leave the page straight away. */
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
    document.documentElement.classList.add("locked");
    toLogin();
  }
});
