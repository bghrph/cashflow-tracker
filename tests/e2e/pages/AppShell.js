import { Selector, t } from 'testcafe';

class AppShell {
  constructor() {
    this.shell = Selector('.app-shell');
    this.headerTitle = Selector('.app-header-title');
    this.themeToggle = Selector('[data-testid="theme-toggle"]');
    this.notificationsBell = Selector('.notification-bell');
  }

  navLink(tabId) {
    // Sidebar on desktop, bottom nav on mobile; either works in TestCafe since
    // visible-only selectors auto-pick the visible one.
    return Selector(`[data-testid="nav-${tabId}"], [data-testid="bottom-nav-${tabId}"]`).filterVisible();
  }

  tabContent(tabId) {
    return Selector(`[data-testid="tab-${tabId}"]`);
  }

  async gotoTab(tabId) {
    await t.click(this.navLink(tabId));
  }
}

export default new AppShell();
