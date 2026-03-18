import { COACHFIT_API_BASE_URL } from '../constants/api';
import { getDeviceToken } from './secureStorage';
import { AuthError } from './apiClient';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate: string | null;
  daysSinceLastCheckIn: number | null;
  milestones: MilestoneData[];
}

export interface MilestoneData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  targetValue: number | null;
  achievedAt: string | null;
  coachMessage: string | null;
  coachName: string | null;
}

/** Fetch streak and milestones for the current client. */
export async function getStreak(): Promise<StreakData> {
  const token = await getDeviceToken();
  if (!token) throw new AuthError('Not paired');

  const response = await fetch(`${COACHFIT_API_BASE_URL}/api/client/streak`, {
    headers: {
      'X-Pairing-Token': token,
    },
  });

  if (response.status === 401) {
    throw new AuthError('Session expired');
  }

  if (!response.ok) {
    throw new Error(`Streak fetch failed (${response.status})`);
  }

  return response.json();
}
