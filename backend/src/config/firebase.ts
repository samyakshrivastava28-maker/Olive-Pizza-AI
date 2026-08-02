import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, type Firestore } from 'firebase-admin/firestore';
import { env } from './env';

let _firestore: Firestore | null = null;
let _initAttempted = false;

export function getFirestore(): Firestore | null {
  if (_firestore) return _firestore;
  if (_initAttempted) return null;

  _initAttempted = true;

  try {
    const apps = getApps();
    if (!apps.length) {
      if (!env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_BASE64 is empty, running Firestore in offline mock mode.');
        return null;
      }

      const serviceAccountJson = Buffer.from(
        env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        'base64',
      ).toString('utf-8');
      const serviceAccount = JSON.parse(serviceAccountJson);

      initializeApp({
        credential: cert(serviceAccount),
        projectId: env.VITE_FIREBASE_PROJECT_ID,
      });
    }

    _firestore = getAdminFirestore();
    _firestore.settings({ ignoreUndefinedProperties: true });
    console.log('✅ Firebase Admin SDK initialized');
    return _firestore;
  } catch (err) {
    console.warn('⚠️ Firebase Admin initialization failed (falling back to vector knowledge only):', (err as Error).message);
    return null;
  }
}
