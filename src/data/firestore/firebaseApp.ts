import { initializeApp, type FirebaseApp } from 'firebase/app';

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const env = import.meta.env;
  if (!env.VITE_FIREBASE_API_KEY) {
    throw new Error('Falta la configuració de Firebase. Copia .env.example a .env.local i omple-la.');
  }
  app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  return app;
}
