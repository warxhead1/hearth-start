// Start page for joining hearth (#689). Static and public: everything
// personal arrives in the URL fragment (#n=<name>&h=<hearth host>&e=<login>&s=<share url>),
// which the browser never sends to this page's host. Once the phone is on the
// tailnet, hearth's /api/onboarding/me says which step she is on.
"use strict";

const STEP_FROM_STAGE = { share: 3, open: 4, passkey: 5, home: 6, done: 7 };

function params() {
  const p = new URLSearchParams(location.hash.replace(/^#/, ""));
  const host = (p.get("h") || "").trim().toLowerCase();
  const share = (p.get("s") || "").trim();
  return {
    name: (p.get("n") || "").trim().slice(0, 40),
    email: (p.get("e") || "").trim().slice(0, 120),
    // Only a tailnet name and only Tailscale's own invite page are honoured.
    host: /^[a-z0-9-]+(\.[a-z0-9-]+)*\.ts\.net$/.test(host) ? host : "",
    share: share.startsWith("https://login.tailscale.com/") ? share : "",
  };
}

function setSteps(current) {
  document.querySelectorAll(".step").forEach((el) => {
    const n = Number(el.dataset.step);
    el.dataset.state = n < current ? "done" : n === current ? "current" : "";
  });
  document.querySelector("[data-done]").hidden = current < 7;
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
    setStatus("off", "Your phone can't see hearth yet. Finish steps 1 to 3, and keep the Tailscale switch on.");
    setSteps(1);
  } else if (!me.invited) {
    setStatus("on", "Connected to hearth, but with a Tailscale account hearth doesn't know. Sign in with the account Eric invited.");
    setSteps(4);
  } else {
    const step = STEP_FROM_STAGE[me.stage_key] || 4;
    setStatus("on", step >= 7 ? "All done. Welcome in." : `Connected. You're on step ${step}.`);
    setSteps(step);
    if (step >= 7) return;
  }
  setTimeout(() => poll(host), 5000);
}

function main() {
  const p = params();
  if (p.name) document.querySelector("[data-name-greeting]").textContent = `Hi ${p.name}.`;
  if (p.email) document.querySelector("[data-email]").textContent = p.email;
  if (p.share) {
    document.querySelector("[data-share-link]").hidden = false;
    document.querySelector("[data-share-email]").hidden = true;
    document.querySelector("[data-share-href]").href = p.share;
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
