export type Theme = 'light' | 'dark';

export interface Contest {
  id: string;
  title: string;
  category: string;
  registeredCount: number;
  capacity: number;
  startTime: string;
  durationMinutes: number;
  entryFee: string;
  status: 'upcoming' | 'live' | 'completed';
  proctoringEnabled: boolean;
  institution: string;
  questionsCount: number;
}

export interface Participant {
  id: string;
  name: string;
  institution: string;
  department: string;
  status: 'verified' | 'competing' | 'completed' | 'flagged';
  score?: number;
  rank?: number;
  avatar: string;
  timeSpent?: string;
  flagsCount: number;
}

export interface ProctorAlert {
  id: string;
  timestamp: string;
  participantName: string;
  type: 'tab_switch' | 'fullscreen_exit' | 'multiple_faces' | 'no_face' | 'reconnected' | 'anomaly';
  severity: 'critical' | 'warning' | 'resolved' | 'info';
  status: 'pending' | 'resolved' | 'dismissed';
  details: string;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  previousRank: number;
  name: string;
  department: string;
  institution: string;
  score: number;
  avatar: string;
  delta: 'up' | 'down' | 'flat';
}

export type CertificateVariant = 'classic' | 'modern' | 'minimal';

export interface CertificateData {
  recipientName: string;
  rank: number;
  totalParticipants: number;
  contestName: string;
  date: string;
  verificationCode: string;
  institution: string;
}
