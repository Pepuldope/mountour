// Web Push without a library (C10 B, Peter 2026-10-29): the message encryption of RFC 8291
// (aes128gcm) and the VAPID sign-in of RFC 8292, on the Web Crypto API that Workers have.
// Push services (Google, Apple, Mozilla) only carry the encrypted message to the phone.

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** The VAPID key pair as JSON Web Keys (the private one holds the public x and y too). */
export interface VapidKeys {
  privateJwk: JsonWebKey;
}

export async function newVapidKeys(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  return { privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey) };
}

/** The public key as the browser wants it for subscribe(): 65 raw bytes, base64url. */
export function vapidPublicKey(keys: VapidKeys): string {
  const { x, y } = keys.privateJwk;
  return b64url(concat(new Uint8Array([4]), fromB64url(x!), fromB64url(y!)));
}

async function vapidAuth(endpoint: string, keys: VapidKeys, now: number): Promise<string> {
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = { aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: "mailto:info@turuj.sk" };
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey("jwk", keys.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // Web Crypto signs ECDSA as raw r||s, which is what a JWT wants.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${body}`)));
  return `vapid t=${header}.${body}.${b64url(sig)}, k=${vapidPublicKey(keys)}`;
}

/** What the browser's PushSubscription.toJSON() gives. */
export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** RFC 8291: the message encrypted for this one subscription, one record. */
export async function encryptFor(sub: PushSub, message: string, salt = crypto.getRandomValues(new Uint8Array(16))): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = fromB64url(sub.keys.p256dh);
  const authSecret = fromB64url(sub.keys.auth);
  const ours = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ours.publicKey));
  const theirs = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: theirs }, ours.privateKey, 256));

  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // 0x02: the last (and only) record.
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(enc.encode(message), new Uint8Array([2]))));
  const head = new Uint8Array(21);
  head.set(salt, 0);
  new DataView(head.buffer).setUint32(16, 4096);
  head[20] = asPublic.length;
  return concat(head, asPublic, sealed);
}

/** Push services we send to. Anything else is refused, so the server only ever calls these. */
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.push\.apple\.com$/, /\.mozilla\.com$/, /\.notify\.windows\.com$/, /^push\.services\.mozilla\.com$/];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

/** Sends one message. "gone": the subscription no longer exists (unsubscribed, app removed). */
export async function sendPush(sub: PushSub, message: string, keys: VapidKeys, now = Date.now()): Promise<"ok" | "gone" | "failed"> {
  if (!isPushEndpoint(sub.endpoint)) return "gone";
  try {
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidAuth(sub.endpoint, keys, now),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        // Not delivered within half an hour (phone off): drop it, a late "turn back" helps nobody.
        TTL: "1800",
        Urgency: "normal",
      },
      body: await encryptFor(sub, message),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}
