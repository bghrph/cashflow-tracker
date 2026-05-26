import {
  BASE_URL,
  clearLocalStorage,
  seedApp,
  DEFAULT_AUTH,
  SEED_DATA_WITH_BUDGET,
  getTheme,
} from './helpers.js';
import AppShell from './pages/AppShell.js';

fixture('Theme toggle')
  .page(BASE_URL)
  .beforeEach(async (t) => {
    await clearLocalStorage();
    await seedApp(DEFAULT_AUTH, SEED_DATA_WITH_BUDGET);
    await t.navigateTo(BASE_URL);
  });

test('Toggle switches theme and persists across reload', async (t) => {
  const initial = await getTheme();
  await t.click(AppShell.themeToggle);
  const afterToggle = await getTheme();
  await t.expect(afterToggle).notEql(initial, 'theme attribute flipped');

  await t.navigateTo(BASE_URL);
  const afterReload = await getTheme();
  await t.expect(afterReload).eql(afterToggle, 'theme survived reload');
});
