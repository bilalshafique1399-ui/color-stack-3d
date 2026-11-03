import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import blueprint from '../../firebase-blueprint.json';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db, googleProvider } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation Synchronicity: parse exact constraints directly from firebase-blueprint.json
const globalScoreProps = blueprint.entities.GlobalScore.properties;
const USER_ID_MIN_LEN = globalScoreProps.userId.minLength;
const USER_ID_MAX_LEN = globalScoreProps.userId.maxLength;
const USER_ID_REGEX = new RegExp(globalScoreProps.userId.pattern);

const DISPLAY_NAME_MIN_LEN = globalScoreProps.displayName.minLength;
const DISPLAY_NAME_MAX_LEN = globalScoreProps.displayName.maxLength;
const DISPLAY_NAME_REGEX = new RegExp(globalScoreProps.displayName.pattern);

const GLOBAL_SCORES_COLLECTION = 'globalScores';
const GLOBAL_TOP_LIMIT = 100;

export interface GlobalLeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  maxCombo: number;
  updatedAtMs: number;
}

export function sanitizeDisplayName(rawName?: string | null): string {
  const withoutDomain = (rawName ?? '').split('@')[0] ?? '';
  const cleaned = withoutDomain
    .replace(/[^a-zA-Z0-9 _.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LEN)
    .trim();

  if (cleaned.length >= DISPLAY_NAME_MIN_LEN && DISPLAY_NAME_REGEX.test(cleaned)) {
    return cleaned;
  }
  return 'Player';
}

function isValidUserId(uid: string): boolean {
  return (
    typeof uid === 'string' &&
    uid.length >= USER_ID_MIN_LEN &&
    uid.length <= USER_ID_MAX_LEN &&
    USER_ID_REGEX.test(uid)
  );
}

function timestampToMillis(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (
    typeof val === 'object' &&
    val !== null &&
    'seconds' in val &&
    typeof (val as { seconds: unknown }).seconds === 'number'
  ) {
    return (val as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function mapDocToEntry(id: string, data: Record<string, unknown>): GlobalLeaderboardEntry | null {
  const score = typeof data.score === 'number' ? Math.floor(data.score) : 0;
  if (score <= 0) return null;
  const maxCombo =
    typeof data.maxCombo === 'number' ? Math.max(0, Math.floor(data.maxCombo)) : 0;
  const displayName =
    typeof data.displayName === 'string' && data.displayName.trim().length > 0
      ? data.displayName.slice(0, DISPLAY_NAME_MAX_LEN)
      : 'Player';

  return {
    userId: typeof data.userId === 'string' ? data.userId : id,
    displayName,
    score,
    maxCombo,
    updatedAtMs: timestampToMillis(data.updatedAt),
  };
}

function buildTop100Query() {
  return query(
    collection(db, GLOBAL_SCORES_COLLECTION),
    where('score', '>', 0),
    orderBy('score', 'desc'),
    limit(GLOBAL_TOP_LIMIT),
  );
}

function sortEntries(entries: GlobalLeaderboardEntry[]): GlobalLeaderboardEntry[] {
  return [...entries].sort(
    (a, b) => b.score - a.score || b.maxCombo - a.maxCombo || b.updatedAtMs - a.updatedAtMs,
  );
}

export function subscribeAuthState(
  onChange: (user: User | null, authReady: boolean) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, (user) => {
    onChange(user, true);
  });
}

export async function signInWithGoogleForLeaderboard(): Promise<User | null> {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    return credential.user;
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : '';
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request'
    ) {
      return null;
    }
    throw err;
  }
}

export async function signOutLeaderboardUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Fetches Top 100 Global Leaderboard once via getDocs (used for unauthenticated viewers
 * so onSnapshot is reserved strictly for authenticated sessions per skill guidelines).
 */
export async function fetchGlobalTop100Once(): Promise<GlobalLeaderboardEntry[]> {
  try {
    const snap = await getDocs(buildTop100Query());
    const items: GlobalLeaderboardEntry[] = [];
    snap.forEach((docSnap) => {
      const parsed = mapDocToEntry(docSnap.id, docSnap.data());
      if (parsed) items.push(parsed);
    });
    return sortEntries(items);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, GLOBAL_SCORES_COLLECTION);
  }
}

/**
 * Subscribes in real time to Top 100 Global Leaderboard when auth is ready and user is signed in.
 */
export function subscribeGlobalTop100(
  onUpdate: (entries: GlobalLeaderboardEntry[]) => void,
  onError: (friendlyError: string) => void,
): Unsubscribe {
  return onSnapshot(
    buildTop100Query(),
    (snap) => {
      const items: GlobalLeaderboardEntry[] = [];
      snap.forEach((docSnap) => {
        const parsed = mapDocToEntry(docSnap.id, docSnap.data());
        if (parsed) items.push(parsed);
      });
      onUpdate(sortEntries(items));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, GLOBAL_SCORES_COLLECTION);
      } catch (formattedErr) {
        onError(parseLeaderboardError(formattedErr));
      }
    },
  );
}

/**
 * Creates or upgrades the signed-in verified Google user's personal best on the Global Top 100.
 */
export async function syncPersonalBestToGlobal(
  candidateScore: number,
  candidateMaxCombo: number,
): Promise<{ synced: boolean; cloudBestScore: number }> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || !isValidUserId(user.uid)) {
    return { synced: false, cloudBestScore: 0 };
  }

  const cleanScore = Math.min(1000000, Math.max(0, Math.floor(candidateScore)));
  const cleanCombo = Math.min(10000, Math.max(0, Math.floor(candidateMaxCombo)));
  const displayName = sanitizeDisplayName(user.displayName);
  const docPath = `${GLOBAL_SCORES_COLLECTION}/${user.uid}`;
  const docRef = doc(db, GLOBAL_SCORES_COLLECTION, user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  if (!existingSnap.exists()) {
    if (cleanScore < 1) {
      return { synced: false, cloudBestScore: 0 };
    }
    try {
      await setDoc(docRef, {
        userId: user.uid,
        displayName,
        score: cleanScore,
        maxCombo: cleanCombo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { synced: true, cloudBestScore: cleanScore };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  }

  const existingData = existingSnap.data();
  const existingScore =
    typeof existingData.score === 'number' ? Math.floor(existingData.score) : 0;
  const existingCombo =
    typeof existingData.maxCombo === 'number' ? Math.floor(existingData.maxCombo) : 0;
  const existingName =
    typeof existingData.displayName === 'string' ? existingData.displayName : '';

  const isHigherScore = cleanScore > existingScore;
  const isSameScoreBetterCombo = cleanScore === existingScore && cleanCombo > existingCombo;
  const isNameRefresh =
    cleanScore >= 1 &&
    cleanScore === existingScore &&
    cleanCombo === existingCombo &&
    displayName !== existingName;

  if (!isHigherScore && !isSameScoreBetterCombo && !isNameRefresh) {
    return { synced: false, cloudBestScore: existingScore };
  }

  const nextScore = Math.max(existingScore, cleanScore);
  const nextCombo = isHigherScore ? cleanCombo : Math.max(existingCombo, cleanCombo);

  try {
    await updateDoc(docRef, {
      displayName,
      score: nextScore,
      maxCombo: nextCombo,
      updatedAt: serverTimestamp(),
    });
    return { synced: true, cloudBestScore: nextScore };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export function parseLeaderboardError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  let extracted = raw;
  try {
    const parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
    if (typeof parsed.error === 'string') {
      extracted = parsed.error;
    }
  } catch {
    // Plain error message
  }

  if (
    extracted.includes(
      "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'",
    )
  ) {
    return `Daily free Firestore read quota reached (resets tomorrow). Upgrade if needed: https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
  }

  if (extracted.includes('Quota exceeded')) {
    return 'Firestore daily free quota exceeded. Quota resets tomorrow (see Firebase Spark plan limits).';
  }

  if (extracted.includes('auth/popup-blocked')) {
    return 'Sign-in popup was blocked. Please allow popups or sign in from Chrome browser.';
  }

  if (
    extracted.includes('auth/operation-not-supported-in-this-environment') ||
    extracted.includes('disallowed_useragent')
  ) {
    return 'Google Sign-In popup is restricted inside Android WebView. Guest play, local coins, haptics, and AdMob ads remain active.';
  }

  if (extracted.includes('auth/unauthorized-domain')) {
    return 'Add localhost to Firebase Console -> Authentication -> Settings -> Authorized domains to enable APK sign-in.';
  }

  if (extracted.includes('auth/network-request-failed')) {
    return 'Network unavailable. Offline gameplay, local scores, and coins remain saved on device.';
  }

  return 'Unable to reach cloud service right now. Local gameplay and scores remain saved.';
}
