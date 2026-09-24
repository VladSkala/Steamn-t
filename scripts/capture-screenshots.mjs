#!/usr/bin/env node
/** Capture a reproducible tour of Steamn't using a dedicated demo account. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium, request } from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'docs', 'screenshots');
const baseUrl = new URL(process.env.STEAMNT_BASE_URL || 'http://localhost:5180/');
const adminBaseUrl = new URL(process.env.STEAMNT_ADMIN_BASE_URL || baseUrl);
const email = process.env.STEAMNT_DEMO_EMAIL || 'steamnt-demo@example.invalid';
const password = process.env.STEAMNT_DEMO_PASSWORD || 'SteamntDemo2026!';
const adminUser = process.env.STEAMNT_ADMIN_USER;
const adminPassword = process.env.STEAMNT_ADMIN_PASSWORD;
const locale = process.env.STEAMNT_SCREENSHOT_LOCALE || 'ru';
const browserLocale = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-US' }[locale];
const width = Number(process.env.STEAMNT_SCREENSHOT_WIDTH || 1440);
const height = Number(process.env.STEAMNT_SCREENSHOT_HEIGHT || 900);

if (!['en', 'ru', 'uk'].includes(locale)) throw new Error('STEAMNT_SCREENSHOT_LOCALE must be en, ru or uk.');
if (!Number.isInteger(width) || width < 800 || !Number.isInteger(height) || height < 600) {
  throw new Error('Desktop screenshot dimensions must be integers of at least 800 × 600.');
}
if (Boolean(adminUser) !== Boolean(adminPassword)) {
  throw new Error('Set both STEAMNT_ADMIN_USER and STEAMNT_ADMIN_PASSWORD to capture Django admin.');
}

const assetName = name => `${name}.jpg`;
const urlFor = (root, route) => new URL(route.replace(/^\//, ''), root).toString();
const rows = [];

async function json(api, route, options) {
  const response = await api.fetch(urlFor(baseUrl, route), options);
  if (!response.ok()) throw new Error(`${route}: HTTP ${response.status()}. Is the project running and seeded?`);
  return response.json();
}

async function save(page, name, route, group, root = baseUrl) {
  const target = urlFor(root, route);
  const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!response?.ok()) throw new Error(`${name}: ${target} returned HTTP ${response?.status() ?? 'no response'}`);
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle', { timeout: 7500 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  if (new URL(page.url()).pathname.startsWith('/login') && !route.startsWith('/login')) {
    throw new Error(`${name}: redirected to login; check the demo account and token.`);
  }
  if (route.startsWith('/admin/') && new URL(page.url()).pathname.startsWith('/admin/login')) {
    throw new Error(`${name}: admin session expired or the staff account cannot access this page.`);
  }
  const filename = assetName(name);
  await page.screenshot({ path: path.join(outputDir, filename), type: 'jpeg', quality: 86, animations: 'disabled', caret: 'hide' });
  rows.push({ file: filename, group, route, viewport: page.viewportSize() });
  console.log(`✓ ${filename}  ${route}`);
}

const first = (payload, key = 'results') => payload?.[key]?.[0];

async function main() {
  await mkdir(outputDir, { recursive: true });
  const api = await request.newContext({ timeout: 15000 });
  let browser;
  try {
    const health = await api.get(urlFor(baseUrl, '/api/health/')).catch(() => null);
    if (!health?.ok()) throw new Error(`Cannot reach ${baseUrl} or its API. Start Docker first: docker compose up --build -d --wait`);

    const [games, dlc, bundles, posts] = await Promise.all([
      json(api, '/api/games/'), json(api, '/api/dlc/'),
      json(api, '/api/bundles/'), json(api, '/api/community/posts/'),
    ]);
    const login = await json(api, '/api/auth/token/', {
      method: 'POST', data: { email, password },
    });
    if (!login.access || !login.refresh || !login.user?.id) throw new Error('Demo login did not return a complete session.');
    const privateApi = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${login.access}` }, timeout: 15000 });
    try {
      const [library, orders, cart] = await Promise.all([
        json(privateApi, '/api/library/'), json(privateApi, '/api/orders/'), json(privateApi, '/api/cart/'),
      ]);
      const game = first(games);
      const addon = first(dlc);
      const bundle = first(bundles);
      const post = first(posts, 'items');
      const owned = first(library, 'items');
      const order = first(orders);
      const otherProfile = posts.items?.find(item => item.author?.id !== login.user.id)?.author?.id || login.user.id;
      if (![game?.id, addon?.id, bundle?.id, post?.id, owned?.game?.id, order?.id].every(Boolean)) {
        throw new Error('Demo data is incomplete. Run: docker compose exec -T backend python manage.py seed_full_demo');
      }
      if (!cart.items?.length && !cart.dlc_items?.length) {
        console.warn('⚠ Demo cart is empty. Checkout will show its empty state; seed_full_demo can replenish demo data.');
      }

      browser = await chromium.launch({ headless: true });
      const publicContext = await browser.newContext({ viewport: { width, height }, locale: browserLocale, colorScheme: 'dark', reducedMotion: 'reduce' });
      await publicContext.addInitScript(language => localStorage.setItem('steamnt-language', language), locale);
      const publicPage = await publicContext.newPage();
      const publicRoutes = [
        ['01-home', '/', 'Витрина'],
        ['02-catalog', '/catalog', 'Витрина'],
        ['03-game', `/games/${game.id}`, 'Витрина'],
        ['04-game-dlc', `/games/${game.id}/dlc`, 'Витрина'],
        ['05-dlc', `/dlc/${addon.id}`, 'Витрина'],
        ['06-bundles', '/bundles', 'Витрина'],
        ['07-bundle', `/bundles/${bundle.id}`, 'Витрина'],
        ['08-community', '/community', 'Сообщество'],
        ['09-community-post', `/community/posts/${post.id}`, 'Сообщество'],
        ['10-news', '/news', 'Сообщество'],
        ['11-public-profile', `/users/${otherProfile}`, 'Профили'],
        ['12-login', '/login', 'Аккаунт'],
        ['13-register', '/register', 'Аккаунт'],
        ['14-password-reset', '/reset-password', 'Аккаунт'],
        ['15-terms', '/legal/terms', 'Документы'],
        ['16-privacy', '/legal/privacy', 'Документы'],
        ['17-refund-policy', '/legal/refund', 'Документы'],
      ];
      for (const [name, route, group] of publicRoutes) await save(publicPage, name, route, group);
      await publicContext.close();

      const memberContext = await browser.newContext({ viewport: { width, height }, locale: browserLocale, colorScheme: 'dark', reducedMotion: 'reduce' });
      await memberContext.addInitScript(({ access, refresh, language, userId }) => {
        localStorage.setItem('steamnt_access_token', access);
        localStorage.setItem('steamnt_refresh_token', refresh);
        localStorage.setItem('steamnt-language', language);
        localStorage.setItem(`steamnt-language:${userId}`, language);
      }, { access: login.access, refresh: login.refresh, language: locale, userId: login.user.id });
      const memberPage = await memberContext.newPage();
      const memberRoutes = [
        ['18-library', '/library', 'Библиотека'],
        ['19-library-game', `/library/games/${owned.game.id}`, 'Библиотека'],
        ['20-library-feed', '/library/feed', 'Библиотека'],
        ['21-wishlist', '/wishlist', 'Покупки'],
        ['22-cart', '/cart', 'Покупки'],
        ['23-checkout', '/checkout', 'Покупки'],
        ['24-orders', '/orders', 'Покупки'],
        ['25-order', `/orders/${order.id}`, 'Покупки'],
        ['26-profile', '/profile', 'Профили'],
        ['27-my-reviews', '/profile/reviews', 'Профили'],
        ['28-settings', '/settings', 'Профили'],
        ['29-friends', '/friends', 'Общение'],
        ['30-chat', '/chat', 'Общение'],
        ['31-notifications', '/notifications', 'Общение'],
      ];
      for (const [name, route, group] of memberRoutes) await save(memberPage, name, route, group);
      await memberPage.setViewportSize({ width: 390, height: 844 });
      for (const [name, route, group] of [
        ['32-mobile-home', '/', 'Мобильный экран'],
        ['33-mobile-catalog', '/catalog', 'Мобильный экран'],
        ['34-mobile-profile', '/profile', 'Мобильный экран'],
      ]) await save(memberPage, name, route, group);
      await memberContext.close();

      if (adminUser && adminPassword) {
        const adminContext = await browser.newContext({ viewport: { width, height }, locale: 'ru-RU', colorScheme: 'dark' });
        const adminPage = await adminContext.newPage();
        const adminLogin = await adminPage.goto(urlFor(adminBaseUrl, '/admin/login/?next=/admin/'), { waitUntil: 'domcontentloaded' });
        if (!adminLogin?.ok()) throw new Error(`Admin login returned HTTP ${adminLogin?.status()}. Set STEAMNT_ADMIN_BASE_URL if using Vite.`);
        await adminPage.locator('#id_username').fill(adminUser);
        await adminPage.locator('#id_password').fill(adminPassword);
        await Promise.all([adminPage.waitForURL(/\/admin\/$/, { timeout: 15000 }), adminPage.locator('input[type="submit"]').click()]);
        for (const [name, route] of [
          ['35-admin-dashboard', '/admin/'],
          ['36-admin-users', '/admin/users/user/'],
          ['37-admin-games', '/admin/games/game/'],
          ['38-admin-orders', '/admin/store/order/'],
          ['39-admin-wallet', '/admin/users/wallettransaction/'],
          ['40-admin-posts', '/admin/community/communitypost/'],
          ['41-admin-chat-reports', '/admin/chat/conversationreport/'],
        ]) await save(adminPage, name, route, 'Админка', adminBaseUrl);
        await adminContext.close();
      } else {
        console.log('ℹ Admin screenshots skipped: set STEAMNT_ADMIN_USER and STEAMNT_ADMIN_PASSWORD.');
      }
    } finally {
      await privateApi.dispose();
    }
    await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseUrl: baseUrl.origin,
      locale,
      count: rows.length,
      screenshots: rows,
    }, null, 2) + '\n');
    console.log(`\nГотово: ${rows.length} снимков в ${outputDir}`);
  } finally {
    await browser?.close();
    await api.dispose();
  }
}

main().catch(error => { console.error(`Ошибка: ${error.message}`); process.exitCode = 1; });
