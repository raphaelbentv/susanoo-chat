export type AuditEvent =
  | 'login_blocked'
  | 'login_failed'
  | 'login_success'
  | 'login_disabled'
  | 'admin_login_success'
  | 'profile_created'
  | 'profile_disabled'
  | 'profile_enabled'
  | 'profile_deleted'
  | 'role_changed'
  | 'pin_changed'
  | 'pin_reset'
  | 'memory_cleared'
  | 'backup_created'
  | 'admin_profiles_list';

export interface AuditEntry {
  ts: string;
  event: AuditEvent;
  [key: string]: unknown;
}

export interface AuditLog {
  total: number;
  items: AuditEntry[];
}
