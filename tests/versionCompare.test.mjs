import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, compareVersions, isNewerVersion, cacheVersionName, parseCacheVersion, updateKind, CACHE_PREFIX } from '../app/versionCompare.js';

test('parseVersion: acepta MAYOR.MENOR.PARCHE y rechaza el resto con mensaje claro', () => {
  assert.deepEqual(parseVersion('0.5.0'), { major: 0, minor: 5, patch: 0 });
  assert.deepEqual(parseVersion('12.0.345'), { major: 12, minor: 0, patch: 345 });
  for (const bad of ['', '1', '1.2', '1.2.3.4', 'v1.2.3', '1.2.x', '01.2.3', '1.2.3-beta', ' 1.2.3', null, undefined, 3, {}]) {
    assert.throws(() => parseVersion(bad), (e) => e instanceof TypeError && /versión inválida/.test(e.message), String(bad));
  }
});

test('compareVersions: orden numérico, no de texto', () => {
  assert.equal(compareVersions('0.5.0', '0.5.0'), 0);
  assert.equal(compareVersions('0.5.1', '0.5.0'), 1);
  assert.equal(compareVersions('0.4.9', '0.5.0'), -1);
  assert.equal(compareVersions('0.10.0', '0.9.0'), 1, '10 > 9 (no es orden alfabético)');
  assert.equal(compareVersions('1.0.0', '0.99.99'), 1);
  assert.equal(compareVersions('0.0.10', '0.0.9'), 1);
  assert.throws(() => compareVersions('1.0', '1.0.0'), TypeError);
  assert.equal(isNewerVersion('0.6.0', '0.5.0'), true);
  assert.equal(isNewerVersion('0.5.0', '0.5.0'), false);
  assert.equal(isNewerVersion('0.4.0', '0.5.0'), false);
});

test('cacheVersionName y parseCacheVersion: ida y vuelta', () => {
  const name = cacheVersionName('0.5.0', 'a1b2c3d4');
  assert.equal(name, 'sophia-shell-0.5.0-a1b2c3d4');
  assert.ok(name.startsWith(CACHE_PREFIX));
  assert.deepEqual(parseCacheVersion(name), { version: '0.5.0', hash: 'a1b2c3d4' });
  for (const bad of ['', 'sophia-packs-v1', 'sophia-shell-0.5-a1b2c3d4', 'sophia-shell-0.5.0-ZZZZZZZZ', 'sophia-shell-0.5.0-a1b2c3', 'x-sophia-shell-0.5.0-a1b2c3d4', null, 7]) {
    assert.equal(parseCacheVersion(bad), null, String(bad));
  }
  assert.throws(() => cacheVersionName('0.5', 'a1b2c3d4'), /versión inválida/);
  assert.throws(() => cacheVersionName('0.5.0', 'A1B2C3D4'), /hash inválido/);
  assert.throws(() => cacheVersionName('0.5.0', 'abc'), /hash inválido/);
});

test('updateKind: none / content / version / downgrade / unknown', () => {
  const a = 'sophia-shell-0.5.0-aaaaaaaa';
  assert.equal(updateKind(a, a), 'none');
  assert.equal(updateKind(a, 'sophia-shell-0.5.0-bbbbbbbb'), 'content');
  assert.equal(updateKind(a, 'sophia-shell-0.6.0-aaaaaaaa'), 'version');
  assert.equal(updateKind(a, 'sophia-shell-0.4.9-cccccccc'), 'downgrade');
  assert.equal(updateKind(a, 'sophia-shell-0.10.0-aaaaaaaa'), 'version');
  assert.equal(updateKind(a, 'basura'), 'unknown');
  assert.equal(updateKind(undefined, a), 'unknown');
});
