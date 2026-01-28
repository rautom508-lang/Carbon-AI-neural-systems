
export interface CarbonPrediction {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  timestamp: number;
  aiInsights?: string;
  userId: string;
  metadata?: {
    projectRef?: string;
    nodeId?: string;
    verified?: boolean;
  };
}

export interface GlobalConfig {
  s1_factor: number;
  s2_factor: number;
  s3_factor: number;
  projectNumber: string;
}

export type UserRole = 'OWNER' | 'AUDITOR' | 'MANAGER' | 'OBSERVER' | 'USER' | 'R';

export interface UserRecord {
  id: string; 
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  provider: 'EMAIL' | 'GOOGLE';
  createdAt: number;
  lastLogin?: number;
}

export type AppView = 'DASHBOARD' | 'SCOPE_INPUT' | 'AI_REPORT' | 'LOCKED' | 'SANDBOX' | 'MAPS' | 'VISION' | 'AUTHORITY' | 'PROFILE';

export interface UserState {
  user: UserRecord | null;
  isAuthenticated: boolean;
  isOwner: boolean;
}
