import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ThemeProvider } from './lib/theme.jsx';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth as firebaseAuth } from './lib/firebase.js';
import { completeRedirectSignIn } from './lib/authFlow.js';
import { loadProfile, saveProfile, loadData as loadFirestoreData, saveData as saveFirestoreData, loadLegacyData, clearLegacyData } from './lib/firestore.js';
import { awaitPendingWrites, unfreezeMutations, areMutationsFrozen, clearLocalCache } from './lib/cacheLifecycle.js';
import { startDataSync, stopDataSync, markSavePending, markSaveFailed } from './lib/dataSync.js';
import { migrate, DEFAULT_STATE } from './lib/migrate.js';
import { generateNotifications } from './lib/notifications.js';
import { flattenCategories } from './lib/categories.js';
import Auth from './components/Auth.jsx';
import Shell from './components/Shell.jsx';
import UpdateToast from './components/UpdateToast.jsx';
import RemoteChangeNotice from './components/RemoteChangeNotice.jsx';

const SetupTab = React.lazy(() => import('./tabs/SetupTab.jsx'));
const TransactionsTab = React.lazy(() => import('./tabs/TransactionsTab.jsx'));
const OverviewTab = React.lazy(() => import('./tabs/OverviewTab.jsx'));
const GoalsTab = React.lazy(() => import('./tabs/GoalsTab.jsx'));
const TutorialOverlay = React.lazy(() => import('./components/TutorialOverlay.jsx'));
import { pad, monthRange, dateString } from './lib/dates.js';

export default function App() {
  // undefined = onAuthStateChanged not yet fired; null = signed out; object = signed in
  const [auth, setAuth] = useState(undefined);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState(null);
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [profile, setProfile] = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [loadError, setLoadError] = useState(null); // null | 'offline-no-cache' | 'unknown'
  const [redirectError, setRedirectError] = useState(''); // error from a failed redirect sign-in leg
  const authGenerationRef = useRef(0);
  const currentFirebaseUserRef = useRef(null);

  const loadUserSession = useCallback(async (firebaseUser, myGeneration) => {
    setLoadError(null);
    try {
      let loadedProfile = await loadProfile(firebaseUser.uid);
      const userAuth = {
        name: firebaseUser.displayName || firebaseUser.email,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL || null,
      };

      if (!loadedProfile) {
        // First login — create profile
        loadedProfile = {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email,
          photoURL: firebaseUser.photoURL || null,
          createdAt: new Date().toISOString(),
        };
        await saveProfile(firebaseUser.uid, loadedProfile);
      }

      setAuth(userAuth);
      setUid(firebaseUser.uid);
      setAnthropicApiKey(loadedProfile?.anthropicApiKey || '');
      if (authGenerationRef.current === myGeneration) {
        setProfile(loadedProfile);
        setTutorialOpen(loadedProfile?.hasSeenTutorial !== true);
      }

      // Check for existing Firestore data
      const firestoreData = await loadFirestoreData(firebaseUser.uid);
      if (authGenerationRef.current !== myGeneration) return;
      if (firestoreData) {
        setData(migrate(firestoreData));
      } else {
        // First login migration: check localStorage
        const legacy = loadLegacyData();
        if (legacy) {
          const migrated = migrate(legacy);
          await saveFirestoreData(firebaseUser.uid, migrated);
          clearLegacyData();
          setData(migrated);
        } else {
          setData({ ...DEFAULT_STATE });
        }
      }
      startDataSync(firebaseUser.uid);
    } catch (err) {
      if (authGenerationRef.current !== myGeneration) return;
      console.error('Auth init failed:', err);
      setData(null);
      // `getDoc`/`getDocs` reject with `unavailable` when offline and the
      // requested document was never cached on this device — that's the one
      // case worth a distinct "you're offline, nothing cached yet" message
      // instead of a perpetual spinner (plan item 6).
      setLoadError(!navigator.onLine || err?.code === 'unavailable' ? 'offline-no-cache' : 'unknown');
    } finally {
      if (authGenerationRef.current === myGeneration) setLoading(false);
    }
  }, []);

  const retryLoad = useCallback(() => {
    const firebaseUser = currentFirebaseUserRef.current;
    if (!firebaseUser) return;
    const myGeneration = ++authGenerationRef.current;
    setLoading(true);
    loadUserSession(firebaseUser, myGeneration);
  }, [loadUserSession]);

  // "Reconnect → resume normal flow" (plan item 6): once the device is back
  // online, automatically retry a load that previously failed for being
  // offline with nothing cached yet — no manual tap required.
  useEffect(() => {
    if (loadError !== 'offline-no-cache') return undefined;
    const onOnline = () => retryLoad();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [loadError, retryLoad]);

  // Complete any pending redirect sign-in (installed PWA / in-app webview path).
  // onAuthStateChanged delivers the returned user on success; getRedirectResult
  // is the only place a redirect-leg *error* surfaces, so we catch it here and
  // show it on the Auth screen instead of silently dropping back to login.
  useEffect(() => {
    completeRedirectSignIn().catch((err) => {
      setRedirectError(err?.message || 'Sign-in failed. Please try again.');
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      const myGeneration = ++authGenerationRef.current;
      currentFirebaseUserRef.current = firebaseUser;

      if (!firebaseUser) {
        stopDataSync();
        setAuth(null);
        setUid(null);
        setAnthropicApiKey('');
        setData(null);
        setProfile(null);
        setTutorialOpen(false);
        setLoadError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      await loadUserSession(firebaseUser, myGeneration);
    });
    return () => {
      stopDataSync();
      unsubscribe();
    };
  }, [loadUserSession]);

  const update = useCallback((fn) => {
    setData((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : { ...prev, ...fn };
      if (uid && !areMutationsFrozen()) {
        markSavePending();
        // saveFirestoreData was previously fire-and-forget with no error
        // surface (plan item 6) — now failures flip the status indicator
        // to "failed" instead of vanishing silently.
        saveFirestoreData(uid, next).catch((err) => {
          console.error('Failed to save data:', err);
          markSaveFailed();
        });
      }
      return next;
    });
  }, [uid]);

  // Auto-fill recurring transactions on month change
  useEffect(() => {
    if (!data || !data.recurringTemplates || data.recurringTemplates.length === 0) return;
    const now = new Date();
    const cmKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    if (data.lastAutoFillMonth === cmKey) return;
    const range = monthRange(now.getFullYear(), now.getMonth());
    const existing = data.transactions.filter((t) => t.date >= range.start && t.date <= range.end);
    const toAdd = [];
    let nid = data.nextId;
    data.recurringTemplates
      .filter((t) => t.active !== false)
      .forEach((tpl) => {
        const already = existing.some(
          (t) =>
            t.category === tpl.category &&
            t.type === tpl.type &&
            Math.abs(t.amount - tpl.amount) < 0.01 &&
            t.recurring === tpl.id
        );
        if (!already) {
          toAdd.push({
            id: nid++,
            date: dateString(now.getFullYear(), now.getMonth(), 1),
            type: tpl.type,
            category: tpl.category,
            currencyCode: tpl.currencyCode,
            amount: tpl.amount,
            description: tpl.description || '',
            recurring: tpl.id,
          });
        }
      });
    if (toAdd.length > 0) {
      update((p) => ({
        ...p,
        transactions: [...p.transactions, ...toAdd],
        nextId: nid,
        lastAutoFillMonth: cmKey,
      }));
    } else {
      update((p) => ({ ...p, lastAutoFillMonth: cmKey }));
    }
  }, [data?.recurringTemplates, data?.lastAutoFillMonth, data?.nextId, update]);

  const logout = useCallback(async () => {
    setSigningOut(true);

    const pending = await awaitPendingWrites();
    if (!pending.synced && pending.discardsPendingWrites) {
      const proceed = window.confirm(
        "You're offline and have unsynced changes. Signing out now will discard them — sign out anyway?"
      );
      if (!proceed) {
        unfreezeMutations();
        setSigningOut(false);
        return;
      }
    }

    try {
      await signOut(firebaseAuth);

      const cleared = await clearLocalCache();
      if (!cleared.cleared) {
        console.warn(`Local cache clear skipped (${cleared.reason}) — another tab still has it open.`);
      }
    } catch (err) {
      console.error('Sign-out hygiene failed:', err);
    } finally {
      // Reload into a fresh client: the terminated `db` is unusable in this
      // tab, and a full reload re-applies the (possibly toggled) persistence
      // preference cleanly — same reasoning as the persistence-toggle reload.
      window.location.reload();
    }
  }, []);

  const isFirstRun = !profile?.hasSeenTutorial;

  const handleCompleteTutorial = useCallback(async () => {
    setTutorialOpen(false);
    setProfile((prev) => (prev ? { ...prev, hasSeenTutorial: true } : prev));
    try {
      if (uid) await saveProfile(uid, { hasSeenTutorial: true });
    } catch (err) {
      console.error('Failed to persist tutorial completion:', err);
    }
  }, [uid]);

  const incomeCategories = useMemo(
    () => (data ? flattenCategories(data.incomeGroups) : []),
    [data?.incomeGroups]
  );
  const expenseCategories = useMemo(
    () => (data ? flattenCategories(data.expenseGroups) : []),
    [data?.expenseGroups]
  );
  const notifications = useMemo(() => (data ? generateNotifications(data) : []), [data]);

  if (loading || auth === undefined) {
    return (
      <ThemeProvider>
        <div className="boot-loading">Loading…</div>
        <UpdateToast />
      </ThemeProvider>
    );
  }
  if (!auth) {
    return (
      <ThemeProvider>
        <Auth initialError={redirectError} />
        <UpdateToast />
      </ThemeProvider>
    );
  }
  if (!data) {
    if (loadError === 'offline-no-cache') {
      return (
        <ThemeProvider>
          <div className="boot-loading boot-loading-offline">
            <p>You're offline, and this device hasn't loaded your data yet.</p>
            <p>Connect to the internet and try again — it'll load instantly next time.</p>
            <button type="button" className="btn primary sm" onClick={retryLoad}>
              Retry
            </button>
          </div>
          <UpdateToast />
        </ThemeProvider>
      );
    }
    return (
      <ThemeProvider>
        <div className="boot-loading">Loading…</div>
        <UpdateToast />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="app-background" {...(tutorialOpen ? { inert: '' } : {})} aria-hidden={tutorialOpen || undefined}>
        <Shell auth={auth} data={data} tab={tab} setTab={setTab} notifications={notifications} onLogout={logout} signingOut={signingOut} onOpenTutorial={() => setTutorialOpen(true)}>
          <React.Suspense fallback={null}>
            {tab === 'setup' && <SetupTab data={data} update={update} uid={uid} apiKey={anthropicApiKey} onApiKeyChange={setAnthropicApiKey} />}
            {tab === 'transactions' && (
              <TransactionsTab data={data} update={update} incomeCategories={incomeCategories} expenseCategories={expenseCategories} apiKey={anthropicApiKey} />
            )}
            {tab === 'overview' && (
              <OverviewTab data={data} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />
            )}
            {tab === 'goals' && <GoalsTab data={data} update={update} />}
          </React.Suspense>
        </Shell>
      </div>
      <React.Suspense fallback={null}>
        <TutorialOverlay
          open={tutorialOpen}
          isFirstRun={isFirstRun}
          onComplete={handleCompleteTutorial}
          onClose={() => setTutorialOpen(false)}
        />
      </React.Suspense>
      <UpdateToast />
      <RemoteChangeNotice />
    </ThemeProvider>
  );
}
