/**
 * api/session.js — Vercel serverless replacement for session.php
 * Token ISSUE only (sirf landing pe ek baar chalta hai).
 * Private key se token sign hota hai. Verify browser khud karta hai
 * (public key se), isliye baaki pages pe server code bilkul nahi chalta.
 *
 *   GET /api/session?action=issue&utm_campign=allcountry  -> { ok, token }
 *
 * Private key ENV var SESSION_PRIVATE_KEY se aati hai (Vercel project
 * settings -> Environment Variables), source code me hardcode nahi.
 */
const crypto = require('crypto');

const DURATION = 3600; // 1 hour (seconds)
const ALLOWED_ORIGINS = [
  // 'https://yoursite.com',
];

function originOk(req) {
  if (ALLOWED_ORIGINS.length === 0) return true;
  let origin = req.headers['origin'] || '';
  if (!origin && req.headers['referer']) {
    try {
      const u = new URL(req.headers['referer']);
      origin = `${u.protocol}//${u.host}`;
    } catch (e) { }
  }
  return ALLOWED_ORIGINS.includes(origin);
}

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const action = req.query.action || '';
  if (action !== 'issue') {
    res.status(200).json({ ok: false });
    return;
  }

  if (!originOk(req)) {
    res.status(200).json({ ok: false });
    return;
  }

  const campign = req.query.utm_campign || '';
  if (campign !== 'allcountry') {
    res.status(200).json({ ok: false });
    return;
  }

  const privateKey = process.env.SESSION_PRIVATE_KEY;
  if (!privateKey) {
    res.status(500).json({ ok: false, error: 'server misconfigured' });
    return;
  }

  const expires = Math.floor(Date.now() / 1000) + DURATION;
  const payload = String(expires);

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(payload);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64');

  const token = `${payload}.${signature}`;
  res.status(200).json({ ok: true, token });
};
