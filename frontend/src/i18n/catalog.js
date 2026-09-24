import { translations } from '../utils/settingsTranslations.js';
import { messages } from './messages.js';
import { feedback } from './feedback.js';
import { errors } from './errors.js';
import { legal } from './legal.js';

export const catalog = Object.create(null);
for (const language of ['ru', 'uk']) {
  for (const [english, translation] of Object.entries(translations[language])) {
    const key = english.trim().replace(/\s+/g, ' ').toLowerCase();
    catalog[key] ??= {};
    catalog[key][language] = translation;
  }
}
for (const [english, ru, uk] of [...messages, ...feedback, ...errors, ...legal]) {
  catalog[english.trim().replace(/\s+/g, ' ').toLowerCase()] = { ru, uk };
}
