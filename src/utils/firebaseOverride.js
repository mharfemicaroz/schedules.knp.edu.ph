import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

let appInstance = null;

function getFirebaseApp() {
  if (appInstance) return appInstance;
  const config = {
    apiKey: import.meta.env.VITE_FB_API_KEY,
    authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FB_DATABASE_URL,
    projectId: import.meta.env.VITE_FB_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FB_APP_ID,
  };
  if (!config.apiKey || !config.databaseURL) return null;
  const apps = getApps();
  appInstance = apps.length ? apps[0] : initializeApp(config);
  return appInstance;
}

function getDb() {
  const app = getFirebaseApp();
  if (!app) return null;
  return getDatabase(app);
}

export function listenToBellOverride(onEvent) {
  const db = getDb();
  if (!db || typeof onEvent !== 'function') return () => {};
  const target = ref(db, 'events/bellOverride/latest');
  return onValue(target, (snap) => {
    if (snap.exists()) onEvent(snap.val());
  });
}

export function listenToFirebaseConnection(onStatus) {
  const db = getDb();
  if (!db || typeof onStatus !== 'function') return () => {};
  const target = ref(db, '.info/connected');
  return onValue(target, (snap) => {
    onStatus(!!snap.val());
  });
}
