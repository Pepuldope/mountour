import { describe, expect, it } from "vitest";
import { b64url, encryptFor, fromB64url, isPushEndpoint, newVapidKeys, vapidPublicKey } from "@/lib/webPush";

const enc = new TextEncoder();

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
const cat = (...p: Uint8Array[]) => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let at = 0;
  for (const x of p) {
    out.set(x, at);
    at += x.length;
  }
  return out;
};

describe("webPush", () => {
  it("encrypts so the browser side (RFC 8291) can read it", async () => {
    // The phone's side: its key pair and auth secret, as a subscription carries them.
    const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: b64url(uaPublic), auth: b64url(auth) } };

    const body = await encryptFor(sub, '{"title":"Túruj"}');

    const salt = body.slice(0, 16);
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    const asPublic = body.slice(21, 21 + body[20]);
    const sealed = body.slice(21 + body[20]);
    const theirs = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: theirs }, ua.privateKey, 256));
    const ikm = await hmac(await hmac(auth, shared), cat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
    const prk = await hmac(salt, ikm);
    const cek = (await hmac(prk, cat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
    const nonce = (await hmac(prk, cat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
    const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, sealed));
    expect(plain[plain.length - 1]).toBe(2);
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe('{"title":"Túruj"}');
  });

  it("gives the public key in the form subscribe() takes", async () => {
    const keys = await newVapidKeys();
    const raw = fromB64url(vapidPublicKey(keys));
    expect(raw).toHaveLength(65);
    expect(raw[0]).toBe(4);
  });

  it("only sends to real push services", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/QK")).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isPushEndpoint("https://evil.example/googleapis.com")).toBe(false);
    expect(isPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
  });
});
