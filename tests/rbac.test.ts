import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, canManageRole } from '../src/modules/rbac.js';

describe('rbac — hasPermission', () => {
  it('readonly can chat and read history', () => {
    assert.equal(hasPermission('readonly', 'chat'), true);
    assert.equal(hasPermission('readonly', 'history_read'), true);
  });

  it('readonly cannot add memory or clear history', () => {
    assert.equal(hasPermission('readonly', 'memory_add'), false);
    assert.equal(hasPermission('readonly', 'history_clear'), false);
  });

  it('user can add memory, change pin', () => {
    assert.equal(hasPermission('user', 'memory_add'), true);
    assert.equal(hasPermission('user', 'pin_change'), true);
    assert.equal(hasPermission('user', 'chat'), true);
  });

  it('user cannot manage profiles', () => {
    assert.equal(hasPermission('user', 'profiles_manage'), false);
    assert.equal(hasPermission('user', 'audit_read'), false);
  });

  it('manager can list profiles', () => {
    assert.equal(hasPermission('manager', 'profiles_list'), true);
    assert.equal(hasPermission('manager', 'memory_add'), true);
  });

  it('manager cannot manage profiles or read audit', () => {
    assert.equal(hasPermission('manager', 'profiles_manage'), false);
    assert.equal(hasPermission('manager', 'audit_read'), false);
  });

  it('admin has all permissions', () => {
    assert.equal(hasPermission('admin', 'chat'), true);
    assert.equal(hasPermission('admin', 'profiles_manage'), true);
    assert.equal(hasPermission('admin', 'audit_read'), true);
    assert.equal(hasPermission('admin', 'backup_manage'), true);
    assert.equal(hasPermission('admin', 'roles_manage'), true);
    assert.equal(hasPermission('admin', 'pin_reset'), true);
  });
});

describe('rbac — canManageRole', () => {
  it('admin can manage all roles', () => {
    assert.equal(canManageRole('admin', 'admin'), true);
    assert.equal(canManageRole('admin', 'user'), true);
    assert.equal(canManageRole('admin', 'readonly'), true);
  });

  it('user cannot manage admin', () => {
    assert.equal(canManageRole('user', 'admin'), false);
  });

  it('manager can manage user and below', () => {
    assert.equal(canManageRole('manager', 'user'), true);
    assert.equal(canManageRole('manager', 'readonly'), true);
    assert.equal(canManageRole('manager', 'admin'), false);
  });
});
