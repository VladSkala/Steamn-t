import { useSyncExternalStore } from 'react';
import { catalog } from './catalog.js';

export const supportedLocales = ['en', 'ru', 'uk'];
const storageKey = 'steamnt-language';
const listeners = new Set();
const read = key => { try { return globalThis.localStorage?.getItem(key); } catch { return null; } };
const write = (key, value) => { try { globalThis.localStorage?.setItem(key, value); } catch { /* Private browsing must not break language selection. */ } };
const valid = value => supportedLocales.includes(value);
let locale = valid(read(storageKey)) ? read(storageKey) : 'en';
const publish = () => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }
  listeners.forEach(listener => listener());
};
export function setLocale(value, userId) {
  if (!valid(value)) return;
  locale = value;
  write(storageKey, value);
  if (userId != null) write(`steamnt-language:${userId}`, value);
  publish();
}
export function syncProfileLocale(profile) {
  if (!profile) return;
  // Migrate the existing settings preference without changing API language choices.
  const saved = read(`steamnt-language:${profile.id}`) || read(`steamnt-settings-language:${profile.id}`);
  setLocale(valid(saved) ? saved : valid(profile.language) ? profile.language : locale, profile.id);
}
export const getLocale = () => locale;
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const useLocale = () => useSyncExternalStore(subscribe, getLocale, () => 'en');
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === storageKey && valid(event.newValue)) { locale = event.newValue; publish(); }
  });
  publish();
}

export function t(message, values = {}, language = locale) {
  if (typeof message !== 'string') return message;
  const normalized = message.trim().replace(/\s+/g, ' ').toLowerCase();
  const entry = catalog[normalized];
  const translated = language === 'en' ? message : entry?.[language] ?? message;
  return translated.replace(/\{(\w+)\}/g, (match, key) => values[key] == null ? match : String(values[key]));
}
export function translateNotification(item) {
  if (!item) return { title: '', body: '' };
  const rules = [
    [/^Message from (.+)$/i, "Message from {name}", "name"],
    [/^Price drop: (.+)$/i, "Price drop: {title}", "title"],
    [/^(.+) sent you a request\.$/i, "{name} sent you a request.", "name"],
    [/^(.+) commented on your post\.$/i, "{name} commented on your post.", "name"],
    [/^(.+) liked your post\.$/i, "{name} liked your post.", "name"],
    [/^(.+) followed you\.$/i, "{name} followed you.", "name"],
    [/^(.+) declined your request\.$/i, "{name} declined your request.", "name"],
  ];
  const localize = value => {
    for (const [pattern, key, parameter] of rules) {
      const match = String(value || '').match(pattern);
      if (match) return t(key, { [parameter]: match[1] });
    }
    return t(String(value || ''));
  };
  return { title: localize(item.title), body: localize(item.body) };
}
