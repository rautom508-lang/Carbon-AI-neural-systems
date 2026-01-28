
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserRecord, CarbonPrediction, UserRole } from "../types";

const SUPABASE_URL = 'https://jclodjhswwjfuwqaxpcj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fg_uCTKwmg2jWlQaqtjRVw_7YikzoTJ';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const LOCAL_STORAGE_KEYS = {
  SESSION: 'carbonai_identity_session',
  HISTORY: 'carbonai_local_buffer',
  AUTH_ATTEMPTS: 'carbonai_security_vitals'
};

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details?: string;
  timestamp: string;
}

interface AuthVitals {
  attempts: number;
  lockedUntil: number | null;
}

export const databaseService = {
  MASTER_EMAILS: ['rautom508@gmail.com'],
  MASTER_PASSWORD_SEED: 'OMRAUT',

  isMaster: (email?: string) => {
    if (!email) return false;
    return databaseService.MASTER_EMAILS.some(m => m.toLowerCase() === email.trim().toLowerCase());
  },

  getSecurityVitals: (): AuthVitals => {
    const data = localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_ATTEMPTS);
    return data ? JSON.parse(data) : { attempts: 0, lockedUntil: null };
  },

  updateSecurityVitals: (vitals: AuthVitals) => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.AUTH_ATTEMPTS, JSON.stringify(vitals));
  },

  getSession: async (): Promise<UserRecord | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) return null;

      const authUser = session.user;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      const email = authUser.email || profile?.email || '';
      const isMaster = databaseService.isMaster(email);

      const user: UserRecord = {
        id: authUser.id,
        name: authUser.user_metadata?.full_name || profile?.full_name || email.split('@')[0],
        email: email,
        phone: authUser.user_metadata?.phone || profile?.phone || '',
        role: (isMaster ? 'OWNER' : (profile?.role || 'USER')) as UserRole, 
        provider: (profile?.provider || 'EMAIL') as 'EMAIL' | 'GOOGLE',
        createdAt: new Date(authUser.created_at).getTime()
      };

      return user;
    } catch (e) {
      const local = localStorage.getItem(LOCAL_STORAGE_KEYS.SESSION);
      if (local) return JSON.parse(local);
      return null;
    }
  },

  register: async (name: string, email: string, phone: string, pass: string, role: UserRole = 'USER'): Promise<{ success: boolean, message: string }> => {
    const isMaster = databaseService.isMaster(email);
    const finalRole = isMaster ? 'OWNER' : role;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: pass,
        options: { 
          data: { full_name: name, phone: phone } 
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Identity creation failed.");

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([{
          id: authData.user.id,
          full_name: name,
          email: email.trim().toLowerCase(),
          phone: phone || 'NODE_PRIME',
          role: finalRole,
          provider: 'EMAIL'
        }], { onConflict: 'id' });
      
      if (profileError) throw profileError;

      return { 
        success: true, 
        message: isMaster ? 'Master Authority Node Online.' : `Identity ${name} synchronized to Neural Registry.` 
      };
    } catch (e: any) {
      return { success: false, message: e.message || "Registry sync failure." };
    }
  },

  login: async (email: string, pass: string): Promise<{ user: UserRecord | null, error?: string, lockedUntil?: number }> => {
    const vitals = databaseService.getSecurityVitals();
    const normalizedEmail = email.trim().toLowerCase();
    
    if (vitals.lockedUntil && Date.now() < vitals.lockedUntil) {
      return { user: null, error: "System Lockdown Active.", lockedUntil: vitals.lockedUntil };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: pass,
      });

      if (error) {
        const newAttempts = vitals.attempts + 1;
        let newLockedUntil = null;
        if (newAttempts >= 3) newLockedUntil = Date.now() + 60000; 
        databaseService.updateSecurityVitals({ attempts: newAttempts, lockedUntil: newLockedUntil });
        throw error;
      }

      databaseService.updateSecurityVitals({ attempts: 0, lockedUntil: null });

      const authUser = data.user;
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      const isMaster = databaseService.isMaster(authUser.email);

      const user: UserRecord = {
        id: authUser.id,
        name: authUser.user_metadata?.full_name || profile?.full_name || authUser.email?.split('@')[0] || 'Node',
        email: authUser.email || profile?.email || '',
        phone: authUser.user_metadata?.phone || profile?.phone || '',
        role: (isMaster ? 'OWNER' : (profile?.role || 'USER')) as UserRole,
        provider: (profile?.provider || 'EMAIL') as 'EMAIL' | 'GOOGLE',
        createdAt: new Date(authUser.created_at).getTime()
      };

      localStorage.setItem(LOCAL_STORAGE_KEYS.SESSION, JSON.stringify(user));
      return { user };
    } catch (e: any) {
      return { user: null, error: e.message || "Access Refused by Gateway." };
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(LOCAL_STORAGE_KEYS.SESSION);
  },

  saveHistory: async (prediction: CarbonPrediction) => {
    try {
      const { error } = await supabase.from('emissions').insert([{
        user_id: prediction.userId,
        scope1: prediction.scope1,
        scope2: prediction.scope2,
        scope3: prediction.scope3,
        total: prediction.total,
        ai_insights: prediction.aiInsights,
        created_at: new Date(prediction.timestamp).toISOString()
      }]);
      if (error) throw error;
    } catch (e) {
      const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HISTORY) || '[]');
      local.push(prediction);
      localStorage.setItem(LOCAL_STORAGE_KEYS.HISTORY, JSON.stringify(local));
    }
  },

  getHistory: async (userId?: string): Promise<CarbonPrediction[]> => {
    try {
      let query = supabase.from('emissions').select('*').order('created_at', { ascending: true });
      if (userId) query = query.eq('user_id', userId);
      
      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(item => ({
        scope1: item.scope1,
        scope2: item.scope2,
        scope3: item.scope3,
        total: item.total,
        timestamp: new Date(item.created_at).getTime(),
        aiInsights: item.ai_insights,
        userId: item.user_id
      }));
    } catch (e) {
      return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HISTORY) || '[]');
    }
  },

  getAllUsers: async (): Promise<UserRecord[]> => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('id', { ascending: false });
      if (error) throw error;
      return (data || []).map(u => ({
        id: u.id,
        name: u.full_name || 'Neural Node',
        email: u.email || 'Encrypted',
        phone: u.phone || '',
        role: (databaseService.isMaster(u.email) ? 'OWNER' : u.role) as UserRole,
        provider: (u.provider || 'EMAIL') as 'EMAIL' | 'GOOGLE',
        createdAt: Date.now()
      }));
    } catch (e) {
      return [];
    }
  },

  logActivity: async (userId: string, userName: string, action: string, details?: string) => {
    try {
      await supabase.from('activity_logs').insert([{
        user_id: userId,
        user_name: userName,
        action,
        details,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {}
  },

  getActivityLogs: async (userId?: string): Promise<ActivityLog[]> => {
    try {
      let query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (userId && !databaseService.isMaster(userId)) query = query.eq('user_id', userId);
      
      const { data } = await query;
      return (data || []).map(log => ({
        id: log.id,
        userId: log.user_id,
        userName: log.user_name,
        action: log.action,
        details: log.details,
        timestamp: log.created_at
      }));
    } catch (e) {
      return [];
    }
  }
};
