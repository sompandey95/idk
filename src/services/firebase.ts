import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

// Error Handling Requirements from firebase-integration-rpc
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Error Log: ', JSON.stringify(errInfo));
  return errInfo;
}

// Test connection on boot per skill requirement
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, working in offline-first mode.');
    }
    return false;
  }
}

// Types
export interface LeaderboardEntry {
  id?: string;
  playerId: string;
  displayName: string;
  score: number;
  epoch: number;
  accuracy: number;
  region: string;
  season: string;
  timestamp: string;
}

export interface PlayerProfileData {
  playerId: string;
  displayName: string;
  avatar: string;
  region: string;
  highScore: number;
  totalGames: number;
  ddaRating: number;
  achievements: string;
  updatedAt: string;
}

export interface MultiplayerMatchData {
  matchId: string;
  hostId: string;
  hostName: string;
  guestId?: string;
  guestName?: string;
  hostScore: number;
  guestScore: number;
  status: 'waiting' | 'active' | 'completed';
  winner?: string;
  seed: number;
  createdAt: string;
}

// Global leaderboard subscription with fallback to offline storage
export function subscribeToLeaderboard(
  season: string,
  regionFilter: string,
  onUpdate: (entries: LeaderboardEntry[]) => void,
  onError?: (err: any) => void
) {
  const colPath = 'leaderboard';
  try {
    const q = query(collection(db, colPath), orderBy('score', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snapshot) => {
        let items: LeaderboardEntry[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...d.data() } as LeaderboardEntry);
        });
        if (regionFilter && regionFilter !== 'GLOBAL') {
          items = items.filter(i => i.region === regionFilter);
        }
        if (season && season !== 'ALL') {
          items = items.filter(i => i.season === season);
        }
        onUpdate(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, colPath);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, colPath);
    return () => {};
  }
}

// Save high score to Firestore
export async function submitLeaderboardScore(entry: Omit<LeaderboardEntry, 'id'>): Promise<boolean> {
  const docId = `${entry.playerId}_${entry.season || 's1'}`;
  const path = `leaderboard/${docId}`;
  try {
    await setDoc(doc(db, 'leaderboard', docId), entry, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

// Sync player profile to Firestore
export async function syncPlayerProfileToCloud(profile: PlayerProfileData): Promise<boolean> {
  const path = `players/${profile.playerId}`;
  try {
    await setDoc(doc(db, 'players', profile.playerId), profile, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

// Multiplayer: Host Match
export async function hostMultiplayerMatch(match: MultiplayerMatchData): Promise<boolean> {
  const path = `matches/${match.matchId}`;
  try {
    await setDoc(doc(db, 'matches', match.matchId), match);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    return false;
  }
}

// Multiplayer: Join Match
export async function joinMultiplayerMatch(matchId: string, guestId: string, guestName: string): Promise<boolean> {
  const path = `matches/${matchId}`;
  try {
    await updateDoc(doc(db, 'matches', matchId), {
      guestId,
      guestName,
      status: 'active'
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    return false;
  }
}

// Multiplayer: Update Match Score
export async function updateMatchScore(
  matchId: string,
  isHost: boolean,
  score: number,
  isFinal: boolean = false
): Promise<boolean> {
  const path = `matches/${matchId}`;
  try {
    const updatePayload: Record<string, any> = isHost ? { hostScore: score } : { guestScore: score };
    if (isFinal) {
      updatePayload.status = 'completed';
    }
    await updateDoc(doc(db, 'matches', matchId), updatePayload);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    return false;
  }
}

// Multiplayer: Listen to Match State
export function listenToMatch(
  matchId: string,
  onUpdate: (match: MultiplayerMatchData | null) => void
) {
  const path = `matches/${matchId}`;
  try {
    return onSnapshot(
      doc(db, 'matches', matchId),
      (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data() as MultiplayerMatchData);
        } else {
          onUpdate(null);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}
