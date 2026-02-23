import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, genSalt, genToken, encryptBackup, decryptBackup } from '../src/modules/crypto.js';

describe('crypto', () => {
  describe('hashPin', () => {
    it('should produce consistent hash for same input', () => {
      const salt = 'test-salt-123';
      const hash1 = hashPin('MyPassword1', salt);
      const hash2 = hashPin('MyPassword1', salt);
      assert.equal(hash1, hash2);
    });

    it('should produce different hashes for different passwords', () => {
      const salt = 'test-salt-123';
      const hash1 = hashPin('Password1', salt);
      const hash2 = hashPin('Password2', salt);
      assert.notEqual(hash1, hash2);
    });

    it('should produce different hashes for different salts', () => {
      const hash1 = hashPin('Password1', 'salt-a');
      const hash2 = hashPin('Password1', 'salt-b');
      assert.notEqual(hash1, hash2);
    });

    it('should return a 64-char hex string', () => {
      const hash = hashPin('test', 'salt');
      assert.equal(hash.length, 64);
      assert.match(hash, /^[0-9a-f]+$/);
    });
  });

  describe('genSalt', () => {
    it('should return a 32-char hex string', () => {
      const salt = genSalt();
      assert.equal(salt.length, 32);
      assert.match(salt, /^[0-9a-f]+$/);
    });

    it('should generate unique salts', () => {
      const salts = new Set(Array.from({ length: 20 }, () => genSalt()));
      assert.equal(salts.size, 20);
    });
  });

  describe('genToken', () => {
    it('should return a 48-char hex string', () => {
      const token = genToken();
      assert.equal(token.length, 48);
      assert.match(token, /^[0-9a-f]+$/);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set(Array.from({ length: 20 }, () => genToken()));
      assert.equal(tokens.size, 20);
    });
  });

  describe('encryptBackup / decryptBackup', () => {
    it('should round-trip encrypt and decrypt', () => {
      const data = JSON.stringify({ profiles: {}, test: true });
      const passphrase = 'my-secret-passphrase';
      const encrypted = encryptBackup(data, passphrase);
      assert.ok(encrypted.iv);
      assert.ok(encrypted.data);
      assert.notEqual(encrypted.data, data);

      const decrypted = decryptBackup(encrypted.data, encrypted.iv, passphrase);
      assert.equal(decrypted, data);
    });

    it('should fail with wrong passphrase', () => {
      const encrypted = encryptBackup('secret data', 'correct-pass');
      assert.throws(() => {
        decryptBackup(encrypted.data, encrypted.iv, 'wrong-pass');
      });
    });

    it('should produce different ciphertexts for same data (random IV)', () => {
      const data = 'same-data';
      const pass = 'same-pass';
      const e1 = encryptBackup(data, pass);
      const e2 = encryptBackup(data, pass);
      assert.notEqual(e1.iv, e2.iv);
    });
  });
});
