import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { catalog } from './catalog.js';
import { setLocale, t, translateNotification } from './index.js';

const normalizeKey = value => value.trim().replace(/\s+/g, ' ').toLowerCase();

const sourceFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const target = path.join(directory, entry.name);
  if (entry.isDirectory()) return sourceFiles(target);
  return /\.[jt]sx?$/.test(entry.name) ? [target] : [];
});

test('every centralized translation has Russian and Ukrainian text', () => {
  for (const [key, value] of Object.entries(catalog)) {
    assert.equal(typeof value.ru, 'string', `${key} has no Russian translation`);
    assert.equal(typeof value.uk, 'string', `${key} has no Ukrainian translation`);
    assert.ok(value.ru.trim());
    assert.ok(value.uk.trim());
  }
});

test('every literal UI translation key exists in the shared catalog', () => {
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const file of sourceFiles(sourceRoot)) {
    const source = fs.readFileSync(file, 'utf8');
    const literalCall = /\bt\(\s*(["'])(.*?)\1/g;
    for (const match of source.matchAll(literalCall)) {
      const key = match[2];
      const line = source.slice(0, match.index).split('\n').length;
      assert.ok(catalog[normalizeKey(key)], `${path.relative(sourceRoot, file)}:${line} has no catalog entry for ${key}`);
    }
  }
});

test('locale changes translate labels and interpolate dynamic values', () => {
  setLocale('ru');
  assert.equal(t('Store'), 'Магазин');
  assert.equal(t('Back to community'), 'Назад в сообщество');
  assert.equal(t('Weekend Picks'), 'Выбор выходных');
  assert.equal(t('Level {level}', { level: 4 }), 'Уровень 4');
  setLocale('uk');
  assert.equal(t('Settings'), 'Налаштування');
  assert.equal(t('Page {page}', { page: 3 }), 'Сторінка 3');
  setLocale('en');
});

test('system notification templates preserve user names', () => {
  setLocale('uk');
  const notification = translateNotification({ title: 'Message from Alex', body: 'Alex liked your post.' });
  assert.equal(notification.title, 'Повідомлення від Alex');
  assert.match(notification.body, /Alex/);
  setLocale('en');
});
