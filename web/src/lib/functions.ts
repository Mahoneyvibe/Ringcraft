import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import app from './firebase';
import type { FindMatchRequest, FindMatchResponse } from '@/types/ai';

// Initialize Functions
const functions = getFunctions(app);

// Connect to emulator in development
if (import.meta.env.DEV) {
  const functionsEmulatorHost = import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST || 'localhost';
  const functionsEmulatorPort = import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001';

  try {
    connectFunctionsEmulator(functions, functionsEmulatorHost, parseInt(functionsEmulatorPort, 10));
  } catch {
    // Already connected, ignore
  }
}

// Callable function reference
export const findMatchCallable = httpsCallable<FindMatchRequest, FindMatchResponse>(
  functions,
  'findMatch'
);

export { functions };
