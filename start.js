// Start page for joining hearth (#689). Static and public: everything
// personal arrives in the URL fragment (#n=<name>&h=<hearth host>&e=<login>&s=<invite url>),
// which the browser never sends to this page's host. Once the phone is on the
// tailnet, hearth's /api/onboarding/me says which step she is on.
"use strict";

const STEP_FROM_STAGE = { invite: 2, open: 3, home: 4, done: 5 };
const DONE = 5;

function params() {
  const p = new URLSearchParams(location.hash.replace(/^#/, ""));
  const host = (p.get("h") || "").trim().toLowerCase();
  const invite = (p.get("s") || "").trim();
  const okHost = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.ts\.net$/.test(host) ? host : "";
  return {
    name: (p.get("n") || "").trim().slice(0, 40),
    email: (p.get("e") || "").trim().slice(0, 120),
    // Only a tailnet name and only Tailscale's own invite page are honoured.
    host: okHost,
    // hearth.<tailnet>.ts.net -> <tailnet>.ts.net, the network name the app shows.
    tailnet: okHost ? okHost.split(".").slice(1).join(".") : "",
    invite: invite.startsWith("https://login.tailscale.com/") ? invite : "",
  };
}

function setSteps(current) {
  document.querySelectorAll(".step").forEach((el) => {
    const n = Number(el.dataset.step);
    el.dataset.state = n < current ? "done" : n === current ? "current" : "";
  });
  document.querySelector("[data-done]").hidden = current < DONE;
}

function setStatus(state, text) {
  const s = document.querySelector("[data-status]");
  s.dataset.state = state;
  document.querySelector("[data-status-text]").textContent = text;
}

async function check(host) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`https://${host}/api/onboarding/me`, { signal: ctl.signal, credentials: "omit", cache: "no-store" });
    clearTimeout(t);
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    return null;
  }
}

async function poll(host) {
  const me = await check(host);
  if (!me || me.tailnet === false) {
    setStatus("off", "Your phone can't see hearth yet. Finish steps 1 and 2, and keep the Tailscale switch on.");
    setSteps(1);
  } else if (!me.invited) {
    setStatus("on", "Connected, but with a Tailscale account hearth doesn't know. Log in with the account Eric invited.");
    setSteps(2);
  } else {
    const step = STEP_FROM_STAGE[me.stage_key] || 3;
    setStatus("on", step >= DONE ? "All done. Welcome in." : `Connected. You're on step ${step}.`);
    setSteps(step);
    if (step >= DONE) return;
  }
  setTimeout(() => poll(host), 5000);
}

function main() {
  const p = params();
  if (p.name) document.querySelector("[data-name-greeting]").textContent = `Hi ${p.name}.`;
  if (p.email) document.querySelectorAll("[data-email]").forEach((el) => { el.textContent = p.email; });
  if (p.tailnet) document.querySelector("[data-tailnet]").textContent = p.tailnet;
  if (p.invite) {
    document.querySelector("[data-invite-link]").hidden = false;
    document.querySelector("[data-invite-email]").hidden = true;
    document.querySelector("[data-invite-href]").href = p.invite;
  }
  const open = document.querySelector("[data-hearth-href]");
  if (p.host) {
    open.href = `https://${p.host}/`;
    open.removeAttribute("aria-disabled");
    poll(p.host);
  } else {
    document.querySelector("[data-no-host]").hidden = false;
    setStatus("off", "This page needs the personal link Eric sent you.");
    setSteps(1);
  }
}

main();
