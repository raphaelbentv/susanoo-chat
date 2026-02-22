import type { Role, Permission } from '../types/index.js';

const ROLE_LEVEL: Record<Role, number> = {
  'readonly': 0,
  'user': 1,
  'manager': 2,
  'admin': 3,
};

const PERMISSIONS: Record<Permission, Role> = {
  chat: 'readonly',
  history_read: 'readonly',
  memory_add: 'user',
  history_clear: 'user',
  pin_change: 'user',
  profile_self_edit: 'user',
  profiles_list: 'manager',
  profiles_manage: 'admin',
  audit_read: 'admin',
  backup_manage: 'admin',
  roles_manage: 'admin',
  pin_reset: 'admin',
};

export function hasPermission(userRole: Role, action: Permission): boolean {
  const minRole = PERMISSIONS[action];
  if (!minRole) return false;
  const userLevel = ROLE_LEVEL[userRole] ?? 0;
  const minLevel = ROLE_LEVEL[minRole] ?? 99;
  return userLevel >= minLevel;
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  return ROLE_LEVEL[actorRole] >= ROLE_LEVEL[targetRole];
}
