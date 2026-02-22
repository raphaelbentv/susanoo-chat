export type Role = 'readonly' | 'user' | 'manager' | 'admin';

export type Permission =
  | 'chat'
  | 'history_read'
  | 'memory_add'
  | 'history_clear'
  | 'pin_change'
  | 'profile_self_edit'
  | 'profiles_list'
  | 'profiles_manage'
  | 'audit_read'
  | 'backup_manage'
  | 'roles_manage'
  | 'pin_reset';

export interface Profile {
  salt: string;
  pinHash: string;
  role: Role;
  createdAt: string;
  pinChangedAt: string;
  lastLogin?: string;
  disabled: boolean;
}

export interface Session {
  profile: string;
  role: Role;
  createdAt: number;
  expiresAt: number;
  _token?: string;
}

export interface AdminSession {
  user: string;
  role: 'admin';
  createdAt: number;
  expiresAt: number;
  _token?: string;
}

export interface Database {
  profiles: Record<string, Profile>;
  memory: Record<string, MemoryEntry[]>;
  admin?: {
    user: string;
    salt: string;
    passHash: string;
  };
}

export interface MemoryEntry {
  role: 'user' | 'ai';
  text: string;
  time: string;
}
