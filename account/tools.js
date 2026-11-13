// The private AP Tools page.
//
// Why it works this way: GitHub Pages hands every file in this repo to anyone who asks, signed in or not, and the repo itself
// is public. A login check in the browser can hide a page but cannot stop someone downloading the file behind it. So the tools
// are published as /ap-tools.enc, encrypted (AES-256-GCM, with the AES key wrapped by an RSA-OAEP public key). The matching
// private key is kept in Supabase, in a table row that Row-Level Security lets only its owner read (auth.uid() = user_id).
// Signing in is what unlocks the private key; without it the published file is unreadable noise.
//
// Nobody else's account can open the tools: another account has a different key (or none), and the file is not encrypted for it.
import { supabase } from "./client.js";
import { sessionReady } from "./guard.js";

const $ = id => document.getElementById(id);
const panel = $("panel"), frameBox = $("frame");
const RSA = { name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
const AAD = new TextEncoder().encode("ap-tools/1");
let blobUrl = "";

const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
/* short fingerprint of a public key, so the page can tell "encrypted for another key" from "damaged file" */
async function keyId(pub) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pub.n + "." + pub.e))).slice(0, 16); }

function show(title, text, opts = {}) {
  frameBox.hidden = true; panel.hidden = false;
  $("pTitle").textContent = title; $("pText").textContent = text;
  const go = $("pGo"); go.hidden = !opts.action; if (opts.action) { go.textContent = opts.action; go.onclick = opts.run; go.disabled = false; }
  const pub = opts.publicKey; $("pKeyRow").hidden = $("pCopy").hidden = !pub;
  if (pub) $("pKey").value = JSON.stringify(pub);
  $("pMsg").textContent = "";
}
$("pCopy").addEventListener("click", async () => {
  const t = $("pKey"); let ok = false;
  try { await navigator.clipboard.writeText(t.value); ok = true; } catch (e) { t.focus(); t.select(); }
  $("pMsg").textContent = ok ? "Copied." : "Press Ctrl+C (or Cmd+C) to copy the selected text.";
});

async function myKey(user) {
  const { data, error } = await supabase.from("tool_keys").select("private_key, public_key").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("keys");
  return data;
}

/* One-time setup: the key pair is made in this browser. The private half goes straight to this account's own row; only the public half is shown. */
async function createKey(user) {
  $("pGo").disabled = true; $("pMsg").textContent = "Creating your key…";
  try {
    const pair = await crypto.subtle.generateKey(RSA, true, ["encrypt", "decrypt"]);
    const private_key = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const public_key = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const { error } = await supabase.from("tool_keys").insert({ user_id: user.id, private_key, public_key });
    if (error) throw new Error("insert");
    await start(user);
  } catch (e) { $("pGo").disabled = false; $("pMsg").textContent = "The key couldn't be saved. Check that the tool_keys table and its policies exist, then try again."; }
}

async function decrypt(file, row) {
  const priv = await crypto.subtle.importKey("jwk", row.private_key, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, b64(file.wrapped));
  const aes = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  const zipped = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(file.iv), additionalData: AAD }, aes, b64(file.data));
  const stream = new Blob([zipped]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).blob();
}

async function start(user) {
  let row;
  try { row = await myKey(user); }
  catch (e) { show("AP Tools", "Couldn't check your access just now. Reload the page to try again."); return; }
  if (!row) {
    show("Set up this account", "This account has no key yet. Create one to continue. It is made in this browser and stored in your own private row.",
      { action: "Create my key", run: () => createKey(user) });
    return;
  }
  const waiting = "Nothing has been published for this account. If this is your site, send the public key below to whoever builds the tools so the next build is encrypted for it.";
  let file;
  try {
    const r = await fetch("/ap-tools.enc", { cache: "no-cache" });
    if (!r.ok) throw new Error("missing");
    file = await r.json();
  } catch (e) { show("Not available yet", waiting, { publicKey: row.public_key }); return; }
  if (!file || file.v !== 1 || file.kid !== await keyId(row.public_key)) { show("Not available for this account", waiting, { publicKey: row.public_key }); return; }
  let page;
  try { page = await decrypt(file, row); }
  catch (e) { show("Couldn't open the tools", "The published file couldn't be read with your key. It may need to be rebuilt.", { publicKey: row.public_key }); return; }

  blobUrl = URL.createObjectURL(new Blob([page], { type: "text/html;charset=utf-8" }));
  const f = document.createElement("iframe");
  f.title = "AP Tools"; f.src = blobUrl + (/^#[a-z0-9-]+$/.test(location.hash) ? location.hash : "");
  frameBox.replaceChildren(f); panel.hidden = true; frameBox.hidden = false;
}

function close() { frameBox.replaceChildren(); if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ""; } }
$("out").addEventListener("click", async () => {
  close();
  try { await supabase.auth.signOut(); } catch (e) {}
  location.replace("/login.html");
});
supabase.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") close(); });

const { user } = await sessionReady;
$("who").textContent = user.email || "";
start(user);
