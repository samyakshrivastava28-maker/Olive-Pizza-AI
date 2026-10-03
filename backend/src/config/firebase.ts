import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, type Firestore } from 'firebase-admin/firestore';
import { env } from './env';

let _firestore: Firestore | null = null;
let _initAttempted = false;
let _initError: string | null = null;

/** Initialise the Firebase Admin app exactly once. Returns true if an app is available. */
function ensureApp(): boolean {
  if (getApps().length) return true;
  if (_initAttempted) return false;
  _initAttempted = true;

  if (!env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    _initError = 'FIREBASE_SERVICE_ACCOUNT_BASE64 is not configured';
    console.warn(`⚠️ ${_initError}; Firebase Admin unavailable.`);
    return false;
  }

  try {
    const serviceAccount = JSON.parse(
      Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8'),
    );
    initializeApp({
      credential: cert(serviceAccount),
      projectId: env.VITE_FIREBASE_PROJECT_ID,
    });
    console.log('✅ Firebase Admin SDK initialized');
    return true;
  } catch (err) {
    _initError = (err as Error).message;
    console.warn('⚠️ Firebase Admin initialization failed:', _initError);
    return false;
  }
}

export function getFirestore(): Firestore | null {
  if (_firestore) return _firestore;
  if (!ensureApp()) return null;
  try {
    _firestore = getAdminFirestore();
    _firestore.settings({ ignoreUndefinedProperties: true });
    return _firestore;
  } catch (err) {
    console.warn('⚠️ Firestore unavailable (falling back to vector knowledge only):', (err as Error).message);
    return null;
  }
}

/**
 * Firebase Auth handle used to VERIFY ID tokens. Returns null when Firebase Admin is not
 * configured — callers must treat that as "cannot authenticate" and reject (fail closed).
 */
export function getFirebaseAuth(): Auth | null {
  if (!ensureApp()) return null;
  return getAuth();
}

export function getFirebaseInitError(): string | null {
  return _initError;
}
