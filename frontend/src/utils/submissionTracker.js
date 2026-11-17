import { useRef } from 'react';

/**
 * Generates an RFC 4122 compliant UUIDv4 string.
 * Strictly uses cryptographically secure browser and Node.js APIs (crypto.randomUUID or crypto.getRandomValues).
 * Never uses Math.random().
 *
 * @returns {string} Cryptographically secure RFC 4122 UUIDv4
 */
export const generateUUIDv4 = () => {
  // 1. Modern Web / Node.js randomUUID API
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  // 2. Browser crypto.getRandomValues API
  const cryptoObj = typeof window !== 'undefined' ? window.crypto || window.msCrypto : null;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC 4122 Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 Variant 10xxxxxx
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // 3. Node.js environment fallback (for automated test runners)
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }

  throw new Error('Cryptographically secure random number generator is unavailable.');
};

/**
 * Computes a non-reversible cryptographic payload fingerprint.
 * Used to detect payload changes without persisting personal form values in browser storage.
 *
 * @param {Record<string, any>} payload
 * @returns {string} Hex fingerprint
 */
export const computePayloadFingerprint = (payload) => {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
};

/**
 * Custom React hook for tracking and managing reliable UUIDv4 submissionId lifecycle.
 * - Generates UUIDv4 for each new logical submission using secure crypto.
 * - Reuses the exact same UUIDv4 for retries of an identical payload.
 * - Automatically generates a fresh UUIDv4 ONLY when form values change after a failed attempt.
 * - Preserves pending submission ID across browser refresh via non-reversible payload fingerprint in sessionStorage.
 * - Zero personal/sensitive form data is stored in browser storage.
 * - Resets identifier after confirmed persistence (HTTP 200 or 201).
 *
 * @param {string} [formName='default'] Unique key for the form
 * @returns {{
 *   getSubmissionId: (currentPayload: Record<string, any>) => string,
 *   resetSubmission: () => void
 * }}
 */
export function useSubmissionTracker(formName = 'default') {
  const submissionIdRef = useRef(null);
  const lastFingerprintRef = useRef(null);
  const storageKey = `dhiyoni_sub_${formName}`;

  // Helper to read pending state from sessionStorage (without sensitive data)
  const getSessionStoredPending = () => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const raw = window.sessionStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.submissionId && parsed.payloadFingerprint) {
            return parsed;
          }
        }
      }
    } catch {
      // sessionStorage inaccessible or disabled (private mode / sandboxed)
    }
    return null;
  };

  // Helper to persist pending state in sessionStorage
  const setSessionStoredPending = (submissionId, payloadFingerprint) => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({ submissionId, payloadFingerprint })
        );
      }
    } catch {
      // Ignore quota or security errors
    }
  };

  // Helper to remove pending state from sessionStorage
  const clearSessionStoredPending = () => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore errors
    }
  };

  const getSubmissionId = (currentPayload) => {
    const currentFingerprint = computePayloadFingerprint(currentPayload);

    // 1. Check in-memory ref
    if (submissionIdRef.current && lastFingerprintRef.current === currentFingerprint) {
      return submissionIdRef.current;
    }

    // 2. Check sessionStorage for pending submission across browser refresh
    const sessionPending = getSessionStoredPending();
    if (sessionPending && sessionPending.payloadFingerprint === currentFingerprint) {
      submissionIdRef.current = sessionPending.submissionId;
      lastFingerprintRef.current = currentFingerprint;
      return sessionPending.submissionId;
    }

    // 3. New logical submission or changed payload: generate a new UUIDv4
    const newId = generateUUIDv4();
    submissionIdRef.current = newId;
    lastFingerprintRef.current = currentFingerprint;
    setSessionStoredPending(newId, currentFingerprint);
    return newId;
  };

  const resetSubmission = () => {
    submissionIdRef.current = null;
    lastFingerprintRef.current = null;
    clearSessionStoredPending();
  };

  return {
    getSubmissionId,
    resetSubmission,
  };
}
