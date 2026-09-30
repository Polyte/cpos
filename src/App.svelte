<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { Toaster, toast } from 'svelte-sonner';
  import {
    Store, Package, BarChart3, Settings, Users, ShieldCheck, Wrench, Database,
    LogOut, Bell, Moon, Sun, Lock, ChevronDown, Activity, LayoutDashboard,
    Fuel, UtensilsCrossed, ChefHat, UserCog, FileText, Headset, Network, Smartphone,
    ShoppingCart, Clock, Shield, Heart, Gauge, Menu, X
  } from 'lucide-svelte';

  import { api } from './lib/api';
  import { registerDevice } from './lib/deviceInfo';
  import { syncManager } from './lib/SyncManager';
  import Auth from './lib/components/Auth.svelte';
  import TerminalLock from './lib/components/TerminalLock.svelte';
  import Inventory from './lib/components/Inventory.svelte';
  import ExecutiveDashboard from './lib/components/ExecutiveDashboard.svelte';
  import TrialBanner from './lib/components/TrialBanner.svelte';
  import ConversionDashboard from './lib/components/ConversionDashboard.svelte';
  import MobilePOS from './lib/components/MobilePOS.svelte';
  import POSInterface from './lib/components/POSInterface.svelte';
  import MerchantManagement from './lib/components/MerchantManagement.svelte';
  import IdentityManagement from './lib/components/IdentityManagement.svelte';
  import SupportCenter from './lib/components/SupportCenter.svelte';
  import WorkshopManagement from './lib/components/WorkshopManagement.svelte';
  import Reports from './lib/components/Reports.svelte';
  import ForensicLedger from './lib/components/ForensicLedger.svelte';
  import CustomerManagement from './lib/components/CustomerManagement.svelte';
  import ManagerDashboard from './lib/components/ManagerDashboard.svelte';
  import MerchantSettings from './lib/components/MerchantSettings.svelte';
  import NetworkResilienceMonitor from './lib/components/NetworkResilienceMonitor.svelte';
  import CustomerDisplay from './lib/components/CustomerDisplay.svelte';
  import ProductCloud from './lib/components/ProductCloud.svelte';
  import RestaurantPOS from './lib/components/RestaurantPOS.svelte';
  import RestaurantCustomerMenu from './lib/components/RestaurantCustomerMenu.svelte';
  import KitchenDisplay from './lib/components/KitchenDisplay.svelte';

  // â”€â”€â”€ Standalone customer display route â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Matches both #/display (hash) and /display (path) so either link works.
  function computeRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const path = window.location.pathname.replace(/^\//, '').replace(/\/+$/, '');
    return hash || path;
  }
  let route = $state(computeRoute());
  $effect(() => {
    const onChange = () => { route = computeRoute(); };
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  });
  let isCustomerDisplay = $derived(route === 'display');
  let isRestaurantMenu = $derived(route === 'menu' || route === 'restaurant-menu');
  let isKitchenDisplay = $derived(route === 'kitchen');

  // â”€â”€â”€ Module-level timer refs (not reactive) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  const LOCK_TIMEOUT = 5 * 60 * 1000;

  // â”€â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let profile = $state<string>('Retail');
  let role = $state<string>('Cashier');
  let activeTab = $state('pos');
  let isAuthenticated = $state(false);
  let currentTime = $state(new Date());
  let loading = $state(true);
  let userProfile = $state<any>(null);
  let activeShift = $state<any>(null);
  let showNotifications = $state(false);
  let notifications = $state<any[]>([]);
  let darkMode = $state(localStorage.getItem('clint_dark_mode') === 'true');
  let terminalLocked = $state(false);
  let mobileMenuOpen = $state(false);
  let settingsInitialTab = $state<string | undefined>(undefined);
  let isMobile = $state(window.innerWidth < 768);
  let showConversionDashboard = $state(false);
  let notifEl = $state<HTMLElement | null>(null);
  let mobileMenuEl = $state<HTMLElement | null>(null);

  // â”€â”€â”€ Static config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const roleProfiles: Record<string, { name: string; description: string; color: string; tabs: string[] }> = {
    Admin: {
      name: 'Executive Command',
      description: 'Full system access with administrative privileges',
      color: 'indigo',
      tabs: ['dashboard', 'merchants', 'customers', 'reports', 'forensic', 'users', 'product-cloud', 'support', 'settings'],
    },
    Manager: {
      name: 'Operations Manager',
      description: 'Operational oversight with reporting access',
      color: 'emerald',
      tabs: ['mgr-dashboard', 'inventory', 'customers', 'users', 'reports', 'forensic', 'workshop', 'settings'],
    },
    Supervisor: {
      name: 'Floor Supervisor',
      description: 'Floor-level supervision and inventory access',
      color: 'amber',
      tabs: ['inventory', 'forensic', 'support'],
    },
    Cashier: {
      name: 'Terminal Operator',
      description: 'Point-of-sale terminal operations',
      color: 'rose',
      tabs: ['pos'],
    },
    StockController: {
      name: 'Logistics Lead',
      description: 'Inventory and workshop management',
      color: 'blue',
      tabs: ['inventory', 'workshop', 'support'],
    },
  };

  const roleThemes = {
    Admin: { primary: '#4f46e5', accent: '#818cf8', bg: '#F4F5F7', text: '#4f46e5' },
    Manager: { primary: '#059669', accent: '#34d399', bg: '#f0fdf4', text: '#059669' },
    Supervisor: { primary: '#d97706', accent: '#fbbf24', bg: '#fffbeb', text: '#d97706' },
    Cashier: { primary: '#e11d48', accent: '#fb7185', bg: '#fff1f2', text: '#e11d48' },
    StockController: { primary: '#2563eb', accent: '#60a5fa', bg: '#eff6ff', text: '#2563eb' },
  };

  const navigation = [
    { id: 'pos', name: 'Terminal', icon: ShoppingCart, roles: ['Cashier'] },
    { id: 'kitchen', name: 'Kitchen Display', icon: ChefHat, roles: ['Manager', 'Supervisor', 'Cashier'] },
    { id: 'inventory', name: 'Stock Control', icon: Package, roles: ['Admin', 'Manager', 'Supervisor', 'StockController'] },
    { id: 'merchants', name: 'Merchants', icon: Store, roles: ['Admin'] },
    { id: 'users', name: 'Users & Access', icon: Users, roles: ['Admin', 'Manager'] },
    { id: 'product-cloud', name: 'ClintonProduct Cloud', icon: Database, roles: ['Admin'] },
    { id: 'support', name: 'Remote Support', icon: Activity, roles: ['Admin', 'Manager', 'Supervisor', 'StockController'] },
    { id: 'reports', name: 'Global Audit', icon: BarChart3, roles: ['Admin', 'Manager'] },
    { id: 'forensic', name: 'Forensic Ledger', icon: Shield, roles: ['Admin', 'Manager', 'Supervisor'] },
    { id: 'workshop', name: 'Job Cards', icon: ShieldCheck, roles: ['Admin', 'Manager', 'StockController'] },
    { id: 'customers', name: 'Customers', icon: Heart, roles: ['Admin', 'Manager'] },
    { id: 'mgr-dashboard', name: 'Ops Dashboard', icon: Gauge, roles: ['Manager'] },
    { id: 'dashboard', name: 'Clinton View', icon: LayoutDashboard, roles: ['Admin'] },
    { id: 'settings', name: 'System Config', icon: Settings, roles: ['Admin', 'Manager'] },
  ];

  // â”€â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let currentProfileConfig = $derived.by(() => {
    const base = roleProfiles[role] || roleProfiles['Cashier'];
    if (profile === 'Restaurant' && role !== 'Admin') {
      return { ...base, tabs: Array.from(new Set([...base.tabs, 'pos', 'kitchen'])) };
    }
    return base;
  });
  let filteredNav = $derived(navigation.filter(nav => currentProfileConfig.tabs.includes(nav.id)));
  let currentTheme = $derived(roleThemes[role as keyof typeof roleThemes] || roleThemes['Cashier']);

  // â”€â”€â”€ Effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Clock
  $effect(() => {
    const timer = setInterval(() => { currentTime = new Date(); }, 1000);
    return () => clearInterval(timer);
  });

  // Initial session check
  $effect(() => {
    checkSession();
  });

  // Enforce valid tab for role
  $effect(() => {
    if (isAuthenticated && !currentProfileConfig.tabs.includes(activeTab)) {
      activeTab = currentProfileConfig.tabs[0];
    }
  });

  // Apply CSS theme variables
  $effect(() => {
    document.documentElement.style.setProperty('--clint-primary', currentTheme.primary);
    document.documentElement.style.setProperty('--clint-accent', currentTheme.accent);
  });

  // Sync manager + notification polling
  $effect(() => {
    if (!isAuthenticated) return;
    syncManager.start();
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  });

  // Dark mode persistence
  $effect(() => {
    localStorage.setItem('clint_dark_mode', String(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  });

  // Click-outside for notifications
  $effect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notifEl && !notifEl.contains(e.target as Node)) showNotifications = false;
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') showNotifications = false; };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  });

  // Click-outside for mobile menu
  $effect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuEl && !mobileMenuEl.contains(e.target as Node)) mobileMenuOpen = false;
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') mobileMenuOpen = false; };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  });

  // Inactivity lock
  $effect(() => {
    if (!isAuthenticated) return;
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    const reset = () => resetInactivityTimer();
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  });

  // Ctrl+L lock
  $effect(() => {
    const handleLockKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'l' && isAuthenticated) {
        e.preventDefault();
        terminalLocked = true;
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        showConversionDashboard = !showConversionDashboard;
      }
    };
    window.addEventListener('keydown', handleLockKey);
    return () => window.removeEventListener('keydown', handleLockKey);
  });

  // Mobile detection
  $effect(() => {
    const handleResize = () => { isMobile = window.innerWidth < 768; };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  // â”€â”€â”€ Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (!isAuthenticated || terminalLocked) return;
    inactivityTimer = setTimeout(() => {
      terminalLocked = true;
      toast('Terminal locked due to inactivity', { description: 'Authenticate to resume' });
    }, LOCK_TIMEOUT);
  }

  async function checkSession() {
    try {
      loading = true;
      const token = localStorage.getItem('clintpos_auth_token');
      const storedUser = localStorage.getItem('clintpos_auth_user');
      if (token && storedUser) {
        const user = JSON.parse(storedUser);
        const profileData = await api.getUserProfile(user.id);
        if (profileData) {
          userProfile = profileData;
          role = profileData.role || 'Cashier';
          profile = profileData.profile || 'Retail';
          if (profileData.profile === 'Restaurant') activeTab = 'pos';
          try {
            const shiftRes = await api.getActiveShift(user.id);
            if (shiftRes.active) {
              activeShift = shiftRes.shift;
            } else if (['Cashier', 'Supervisor', 'Manager'].includes(profileData.role)) {
              const startRes = await api.startShift(user.id, profileData.merchantId || 'merchant:M1', profileData.name);
              if (startRes.success) activeShift = startRes.shift;
            }
          } catch (shiftErr) {
            console.error('Shift sync error:', shiftErr);
          }
          loadNotifications();
        } else {
          role = user.role || 'Cashier';
          profile = user.profile || 'Retail';
          if (user.profile === 'Restaurant') activeTab = 'pos';
        }
        isAuthenticated = true;
        try {
          await registerDevice(api);
        } catch (e) {
          console.warn('[Device Registration] Failed:', e);
        }
      } else {
        isAuthenticated = false;
      }
    } catch (e) {
      console.error(e);
      isAuthenticated = false;
    } finally {
      loading = false;
    }
  }

  async function loadNotifications() {
    try {
      const res = await api.getNotifications();
      if (Array.isArray(res)) {
        notifications = res.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
    } catch (e) {
      console.error('Failed to load notifications');
    }
  }

  async function handleLogout() {
    localStorage.removeItem('clintpos_auth_token');
    localStorage.removeItem('clintpos_auth_user');
    isAuthenticated = false;
    userProfile = null;
    activeShift = null;
  }

  async function handleCloseShift() {
    if (!activeShift) return;
    if (!confirm('Are you sure you want to CLOSE your shift? This will finalize your daily timesheet.')) return;
    try {
      const res = await api.endShift(activeShift.id);
      if (res.success) {
        toast.success('Shift closed successfully. Data synced to management reports.');
        activeShift = null;
      }
    } catch (e) {
      toast.error('Failed to close shift');
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await api.markNotificationRead(id);
      notifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    } catch (e) {
      console.error('Failed to mark notification as read');
    }
  }

  async function handleMarkAllRead() {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => api.markNotificationRead(n.id)));
      notifications = notifications.map(n => ({ ...n, read: true }));
    } catch (e) {
      console.error('Failed to mark all as read');
    }
  }

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function formatTime(date: Date) {
    return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  function formatDate(date: Date) {
    return date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function unreadCount() {
    return notifications.filter(n => !n.read).length;
  }
</script>

<Toaster position="top-right" />

{#if isCustomerDisplay}
  <CustomerDisplay />
{:else if isRestaurantMenu}
  <RestaurantCustomerMenu />
{:else if isKitchenDisplay}
  <KitchenDisplay />
{:else}

{#if showConversionDashboard}
  <div class="fixed inset-0 z-[999] overflow-y-auto bg-white dark:bg-neutral-950">
    <button
      onclick={() => showConversionDashboard = false}
      class="fixed top-4 right-4 z-10 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-black uppercase tracking-wider hover:bg-neutral-700 transition-colors"
    >
      Close (Ctrl+Shift+D)
    </button>
    <ConversionDashboard />
  </div>
{/if}

<!-- â”€â”€â”€ Loading screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
{#if loading}
  <div class="fixed inset-0 flex items-center justify-center bg-white dark:bg-neutral-950 z-50">
    <div class="flex flex-col items-center gap-4">
      <div class="w-12 h-12 rounded-full border-4 border-neutral-200 dark:border-neutral-800 border-t-[var(--clint-primary)] animate-spin"></div>
      <p class="text-sm text-neutral-400 dark:text-neutral-500 tracking-wide">Loading Clinton POSâ€¦</p>
    </div>
  </div>

<!-- â”€â”€â”€ Unauthenticated â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
{:else if !isAuthenticated}
  <Auth onLogin={checkSession} />


<!-- â”€â”€â”€ Authenticated: mobile cashier shortcut â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
{:else if isMobile && role === 'Cashier' && profile !== 'Restaurant'}
  <MobilePOS
    profile={profile as any}
    role={role as any}
    userName={userProfile?.name || 'User'}
    shiftId={activeShift?.id}
    onLockTerminal={() => terminalLocked = true}
    onLogout={handleLogout}
    onCloseShift={handleCloseShift}
  />

<!-- â”€â”€â”€ Authenticated: full desktop shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
{:else}
  <div class="h-screen flex flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-300">

    {#if terminalLocked}
      <TerminalLock
        userName={userProfile?.name || 'User'}
        role={role}
        onUnlock={() => { terminalLocked = false; resetInactivityTimer(); }}
        lockReason="inactivity"
      />
    {/if}

    <!-- â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <header class="flex-none flex items-center justify-between px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm z-20">

      <!-- Left: logo + role badge -->
      <div class="flex items-center gap-3">
        <!-- Mobile menu toggle -->
        {#if isMobile}
          <button
            onclick={() => mobileMenuOpen = !mobileMenuOpen}
            class="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Toggle menu"
          >
            {#if mobileMenuOpen}
              <X class="w-5 h-5" />
            {:else}
              <Menu class="w-5 h-5"></Menu>
            {/if}
          </button>
        {/if}

        <!-- Logo -->
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-[var(--clint-primary)] flex items-center justify-center">
            <ShoppingCart class="w-4 h-4 text-white" />
          </div>
          <span class="font-semibold text-sm text-neutral-900 dark:text-neutral-100 hidden sm:block">Clinton POS</span>
        </div>

        <!-- Role badge -->
        <div class="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-400">
          <div class="w-1.5 h-1.5 rounded-full bg-[var(--clint-primary)]"></div>
          {currentProfileConfig.name}
        </div>
      </div>

      <!-- Center: clock -->
      <div class="flex flex-col items-center">
        <span class="font-mono text-sm font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
          {formatTime(currentTime)}
        </span>
        <span class="text-[10px] text-neutral-400 dark:text-neutral-500">{formatDate(currentTime)}</span>
      </div>

      <!-- Right: actions -->
      <div class="flex items-center gap-1.5">
        <!-- Dark mode toggle -->
        <button
          onclick={() => darkMode = !darkMode}
          class="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Toggle dark mode"
        >
          {#if darkMode}
            <Sun class="w-4 h-4" />
          {:else}
            <Moon class="w-4 h-4" />
          {/if}
        </button>

        <!-- Lock terminal -->
        <button
          onclick={() => terminalLocked = true}
          class="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Lock terminal"
          title="Lock terminal (Ctrl+L)"
        >
          <Lock class="w-4 h-4" />
        </button>

        <!-- Notifications -->
        <div class="relative" bind:this={notifEl}>
          <button
            onclick={() => showNotifications = !showNotifications}
            class="relative p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Notifications"
          >
            <Bell class="w-4 h-4" />
            {#if unreadCount() > 0}
              <span class="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount() > 9 ? '9+' : unreadCount()}
              </span>
            {/if}
          </button>

          {#if showNotifications}
            <div
              transition:fly={{ y: -8, duration: 150 }}
              class="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl z-50"
            >
              <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Notifications</span>
                {#if unreadCount() > 0}
                  <button
                    onclick={handleMarkAllRead}
                    class="text-xs text-[var(--clint-primary)] hover:underline"
                  >
                    Mark all read
                  </button>
                {/if}
              </div>

              {#if notifications.length === 0}
                <div class="px-4 py-6 text-center text-sm text-neutral-400">No notifications</div>
              {:else}
                {#each notifications as notif (notif.id)}
                  <button
                    onclick={() => handleMarkRead(notif.id)}
                    class="w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border-b border-neutral-100 dark:border-neutral-800 last:border-0"
                  >
                    <div class="flex items-start gap-3">
                      {#if !notif.read}
                        <div class="mt-1.5 w-2 h-2 flex-none rounded-full bg-[var(--clint-primary)]"></div>
                      {:else}
                        <div class="mt-1.5 w-2 h-2 flex-none rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
                      {/if}
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{notif.title || 'Notification'}</p>
                        <p class="text-xs text-neutral-500 mt-0.5 line-clamp-2">{notif.message || ''}</p>
                        <p class="text-[10px] text-neutral-400 mt-1">
                          {new Date(notif.date).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  </button>
                {/each}
              {/if}
            </div>
          {/if}
        </div>

        <!-- User menu / logout -->
        <div class="flex items-center gap-2 pl-1.5 border-l border-neutral-200 dark:border-neutral-700 ml-1">
          <div class="hidden sm:flex flex-col items-end">
            <span class="text-xs font-medium text-neutral-800 dark:text-neutral-200 leading-none">
              {userProfile?.name || 'User'}
            </span>
            <span class="text-[10px] text-neutral-400">{role}</span>
          </div>
          <button
            onclick={handleLogout}
            class="p-1.5 rounded-md text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut class="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>

    {#if role !== 'Admin'}
      <TrialBanner
        merchantId={userProfile?.merchantId || 'merchant:M1'}
        {role}
        onUpgrade={() => { settingsInitialTab = 'billing'; activeTab = 'settings'; }}
      />
    {/if}

    <!-- â”€â”€ Body: sidebar + content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <div class="flex flex-1 overflow-hidden">

      <!-- Sidebar navigation (desktop) -->
      {#if !isMobile && role !== 'Cashier'}
        <nav class="w-60 flex-none flex flex-col border-r border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-950/40 backdrop-blur-xl overflow-y-auto px-3 py-4 z-10">
          <!-- Section label -->
          <p class="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-600">Menu</p>

          <div class="flex flex-col gap-1">
            {#each filteredNav as item (item.id)}
              {@const ItemIcon = item.icon}
              {@const active = activeTab === item.id}
              <button
                onclick={() => { activeTab = item.id; }}
                class="group relative flex items-center gap-3 pl-3.5 pr-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  {active
                    ? 'bg-[var(--clint-primary)] text-white shadow-lg shadow-[var(--clint-primary)]/25'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800/70 hover:text-neutral-900 dark:hover:text-neutral-100 hover:shadow-sm'}"
              >
                <!-- Active accent bar -->
                <span class="absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-white transition-all duration-200 {active ? 'h-5 opacity-90' : 'h-0 opacity-0'}"></span>
                <span class="flex items-center justify-center w-7 h-7 rounded-lg transition-colors {active ? 'bg-white/20' : 'bg-neutral-200/60 dark:bg-neutral-800 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700'}">
                  <ItemIcon class="w-4 h-4 flex-none" />
                </span>
                <span class="truncate">{item.name}</span>
              </button>
            {/each}
          </div>

          <!-- Shift management at bottom of sidebar -->
          <div class="mt-auto pt-4">
            <p class="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-600">Shift</p>
            {#if activeShift}
              <div class="px-3.5 py-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/60 mb-2">
                <div class="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold mb-1">
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Shift Active
                </div>
                <p class="text-[10px] text-emerald-600/80 dark:text-emerald-500/80 pl-4">
                  Since {new Date(activeShift.startTime || activeShift.start_time || '').toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onclick={handleCloseShift}
                class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50/60 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 border border-red-100 dark:border-red-900/40 transition-colors"
              >
                <Clock class="w-3.5 h-3.5" />
                Close Shift
              </button>
            {:else}
              <div class="flex items-center gap-2 px-3.5 py-3 rounded-2xl bg-neutral-100/70 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-800 text-xs font-medium text-neutral-400 dark:text-neutral-500">
                <span class="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600"></span>
                No active shift
              </div>
            {/if}
          </div>
        </nav>
      {/if}

      <!-- Mobile nav dropdown -->
      {#if isMobile && mobileMenuOpen}
        <div
          bind:this={mobileMenuEl}
          transition:fly={{ y: -10, duration: 150 }}
          class="absolute top-[53px] left-0 right-0 z-30 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shadow-lg py-2"
        >
          {#each filteredNav as item (item.id)}
            {@const ItemIcon = item.icon}
            <button
              onclick={() => { activeTab = item.id; mobileMenuOpen = false; }}
              class="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-colors
                {activeTab === item.id
                  ? 'text-[var(--clint-primary)] bg-neutral-50 dark:bg-neutral-800'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
            >
              <ItemIcon class="w-4 h-4 flex-none" />
              {item.name}
            </button>
          {/each}
        </div>
      {/if}

      <!-- â”€â”€ Main content area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
      <main class="flex-1 overflow-hidden">
        <NetworkResilienceMonitor />
        {#key activeTab}
          <div class="h-full overflow-auto" in:fly={{ y: 10, duration: 200 }}>

            {#if activeTab === 'pos'}
              {#key role}
                {#if profile === 'Restaurant'}
                  <RestaurantPOS {profile} {role} userName={userProfile?.name} shiftId={activeShift?.id} />
                {:else}
                  <POSInterface {profile} {role} userName={userProfile?.name} shiftId={activeShift?.id} {darkMode} setDarkMode={(v: boolean) => darkMode = v} onLockTerminal={() => terminalLocked = true} onLogout={handleLogout} />
                {/if}
              {/key}

            {:else if activeTab === 'kitchen' && profile === 'Restaurant'}
              <KitchenDisplay />

            {:else if activeTab === 'inventory'}
              <Inventory {profile} {role} />

            {:else if activeTab === 'dashboard'}
              <ExecutiveDashboard />

            {:else if activeTab === 'merchants'}
              <MerchantManagement {role} />

            {:else if activeTab === 'users'}
              <IdentityManagement {profile} {role} />

            {:else if activeTab === 'product-cloud'}
              <ProductCloud {role} />

            {:else if activeTab === 'support'}
              <SupportCenter />

            {:else if activeTab === 'reports'}
              <Reports {role} merchantId={userProfile?.merchantId || 'merchant:M1'} />

            {:else if activeTab === 'forensic'}
              <ForensicLedger {profile} {role} merchantId={userProfile?.merchantId || 'merchant:M1'} />

            {:else if activeTab === 'workshop'}
              <WorkshopManagement />

            {:else if activeTab === 'customers'}
              <CustomerManagement merchantId={userProfile?.merchantId || 'merchant:M1'} />

            {:else if activeTab === 'mgr-dashboard'}
              <ManagerDashboard merchantId={userProfile?.merchantId || 'merchant:M1'} {role} />

            {:else if activeTab === 'settings'}
              <MerchantSettings merchantId={userProfile?.merchantId} {role} initialTab={settingsInitialTab} />

            {:else}
              <div class="flex items-center justify-center h-full text-neutral-400 text-sm">
                This module is coming soon
              </div>
            {/if}

          </div>
        {/key}
      </main>

    </div>
  </div>
{/if}

{/if}
