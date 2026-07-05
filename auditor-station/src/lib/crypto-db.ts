/**
 * crypto-db.ts — at-rest encryption for the catalog snapshot (SQ2-7).
 *
 * Encrypts the built catalog.db with AES-256-GCM (key derived from a passphrase via scrypt).
 * At launch the encrypted file is decrypted IN MEMORY to a Buffer and opened read-only — no
 * plaintext database ever touches the laptop's disk while running. Without the passphrase the
 * .enc file is useless; a wrong passphrase or any tampering fails GCM authentication.
 *
 * Zero new dependencies — node:crypto only. (SQLCipher would mean swapping the native driver;
 * this achieves the same at-rest guarantee with the driver we already ship.)
 *
 * File layout: [ MAGIC(8) | salt(16) | iv(12) | authTag(16) | ciphertext ]
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const MAGIC = Buffer.from("ASTNENC1", "utf8"); // 8 bytes — format marker
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN, { N: 16384, r: 8, p: 1 });
}

/** Encrypt an arbitrary buffer (the serialized db bytes). */
export function encryptBytes(plain: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, salt, iv, tag, ciphertext]);
}

/** Decrypt a buffer produced by encryptBytes. Throws on wrong passphrase or tampering. */
export function decryptBytes(blob: Buffer, passphrase: string): Buffer {
  if (blob.length < MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Not a valid encrypted catalog (bad header).");
  }
  let o = MAGIC.length;
  const salt = blob.subarray(o, (o += SALT_LEN));
  const iv = blob.subarray(o, (o += IV_LEN));
  const tag = blob.subarray(o, (o += TAG_LEN));
  const ciphertext = blob.subarray(o);
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Could not decrypt the catalog — wrong passphrase or the file was modified.");
  }
}

/** Encrypt a plain db file → .enc file. */
export function encryptDbFile(plainPath: string, encPath: string, passphrase: string): void {
  writeFileSync(encPath, encryptBytes(readFileSync(plainPath), passphrase));
}

/** Decrypt an .enc file to an in-memory Buffer (open with new Database(buffer, {readonly:true})). */
export function decryptToBuffer(encPath: string, passphrase: string): Buffer {
  return decryptBytes(readFileSync(encPath), passphrase);
}
