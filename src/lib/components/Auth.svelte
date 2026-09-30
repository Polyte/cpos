<script lang="ts">
  import { api } from '../../lib/api';
  import { toast } from 'svelte-sonner';
  import { fly, scale } from 'svelte/transition';
  import {
    Lock, Mail, ArrowRight, Loader2, CheckCircle2, ArrowLeft,
    Store, Fuel, Wrench, UtensilsCrossed, Crown, Users,
    ShoppingCart, Gauge, Package, Eye, Zap, Server, ChevronDown
  } from 'lucide-svelte';

  import { FieldGroup, Field, FieldLabel, FieldSeparator } from '@/lib/components/ui/field';
  import { Input } from '@/lib/components/ui/input';
  import { Button } from '@/lib/components/ui/button';

  import clintposLogo from '../../assets/7b6bbd404eeac313228fbca5235f779f7e8e6d0c.png';
  import posCheckoutImage from '../../assets/login-hero-pos-checkout.jpeg';
  import MerchantOnboarding from './MerchantOnboarding.svelte';

  // ---------------------------------------------------------------------------
  // Hero carousel (right panel)
  // ---------------------------------------------------------------------------

  type HeroSlide =
    | { type: 'video'; src: string }
    | { type: 'image'; src: string; alt: string };

  const HERO_SLIDES: HeroSlide[] = [
    {
      type: 'video',
      src: 'https://www.youtube.com/embed/GsqCrz7nbyQ?autoplay=1&mute=1&loop=1&playlist=GsqCrz7nbyQ&controls=0&modestbranding=1&rel=0&playsinline=1',
    },
    {
      type: 'image',
      src: posCheckoutImage,
      alt: 'In-store checkout on a POS tablet',
    },
  ];

  let activeSlide = $state(0);

  $effect(() => {
    const id = setInterval(() => {
      activeSlide = (activeSlide + 1) % HERO_SLIDES.length;
    }, 7000);
    return () => clearInterval(id);
  });

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  type ProfileKey = 'Admin' | 'Retail' | 'Forecourt' | 'Workshop' | 'Restaurant';

  interface RoleConfig {
    key: string;
    label: string;
    email: string;
    icon: any;
  }

  interface ProfileConfig {
    key: ProfileKey;
    label: string;
    subtitle: string;
    description: string;
    merchantId: string | null;
    icon: any;
    color: string;
    colorDim: string;
    borderColor: string;
    bgGlow: string;
    roles: RoleConfig[];
  }

  // ---------------------------------------------------------------------------
  // Static data
  // ---------------------------------------------------------------------------

  const PROFILES: ProfileConfig[] = [
    {
      key: 'Admin',
      label: 'ADMIN',
      subtitle: 'Global Command',
      description: 'Full visibility across all tenants. Real-time metrics, merchant oversight, forensic auditing & strategic control.',
      merchantId: null,
      icon: Crown,
      color: '#FACC15',
      colorDim: 'rgba(250,204,21,0.15)',
      borderColor: 'rgba(250,204,21,0.3)',
      bgGlow: 'radial-gradient(circle at 50% 0%, rgba(250,204,21,0.12) 0%, transparent 60%)',
      roles: [
        { key: 'admin', label: 'Clinton Matos', email: 'admin@roxton.com', icon: Crown },
      ]
    },
    {
      key: 'Retail',
      label: 'RETAIL',
      subtitle: 'Sandton Gateway',
      description: 'Grocery & general merchandise. POS terminal, stock control, loyalty, promotions & shift management.',
      merchantId: 'merchant:M1',
      icon: Store,
      color: '#818cf8',
      colorDim: 'rgba(129,140,248,0.15)',
      borderColor: 'rgba(129,140,248,0.3)',
      bgGlow: 'radial-gradient(circle at 50% 0%, rgba(129,140,248,0.12) 0%, transparent 60%)',
      roles: [
        { key: 'manager',    label: 'Sarah Ndlovu', email: 'retail.manager@roxton.com',    icon: Gauge },
        { key: 'supervisor', label: 'James Botha',  email: 'retail.supervisor@roxton.com', icon: Eye },
        { key: 'cashier',    label: 'Thandi Moyo',  email: 'retail.cashier@roxton.com',    icon: ShoppingCart },
        { key: 'stock',      label: 'David Patel',  email: 'retail.stock@roxton.com',      icon: Package },
      ]
    },
    {
      key: 'Forecourt',
      label: 'FORECOURT',
      subtitle: 'V&A Waterfront Fuels',
      description: 'Fuel pumps, lubricants & convenience store. Pump attendant terminals, tank dips & forecourt reports.',
      merchantId: 'merchant:M2',
      icon: Fuel,
      color: '#34d399',
      colorDim: 'rgba(52,211,153,0.15)',
      borderColor: 'rgba(52,211,153,0.3)',
      bgGlow: 'radial-gradient(circle at 50% 0%, rgba(52,211,153,0.12) 0%, transparent 60%)',
      roles: [
        { key: 'manager',    label: 'Pieter van Wyk', email: 'fuel.manager@roxton.com',    icon: Gauge },
        { key: 'supervisor', label: 'Nomsa Khumalo',  email: 'fuel.supervisor@roxton.com', icon: Eye },
        { key: 'attendant',  label: 'Sipho Dlamini',  email: 'fuel.attendant@roxton.com',  icon: Fuel },
      ]
    },
    {
      key: 'Workshop',
      label: 'WORKSHOP',
      subtitle: 'Roxton Workshop Hub',
      description: 'Mechanical workshop with job cards, parts inventory, labour tracking & service scheduling.',
      merchantId: 'merchant:M3',
      icon: Wrench,
      color: '#f97316',
      colorDim: 'rgba(249,115,22,0.15)',
      borderColor: 'rgba(249,115,22,0.3)',
      bgGlow: 'radial-gradient(circle at 50% 0%, rgba(249,115,22,0.12) 0%, transparent 60%)',
      roles: [
        { key: 'manager',   label: 'Johan Kruger',  email: 'workshop.manager@roxton.com',   icon: Gauge },
        { key: 'mechanic',  label: 'Bongani Nkosi', email: 'workshop.mechanic@roxton.com',  icon: Wrench },
        { key: 'reception', label: 'Lisa Chen',     email: 'workshop.reception@roxton.com', icon: Users },
      ]
    },
    {
      key: 'Restaurant',
      label: 'RESTAURANT',
      subtitle: 'Melrose Arch Kitchen',
      description: 'Full-service restaurant with floor map, KOT kitchen display, course-fire workflow & bill settlement.',
      merchantId: 'merchant:M4',
      icon: UtensilsCrossed,
      color: '#f472b6',
      colorDim: 'rgba(244,114,182,0.15)',
      borderColor: 'rgba(244,114,182,0.3)',
      bgGlow: 'radial-gradient(circle at 50% 0%, rgba(244,114,182,0.12) 0%, transparent 60%)',
      roles: [
        { key: 'manager',    label: 'Marco Rossi',       email: 'chef@roxton.com',                   icon: Gauge },
        { key: 'supervisor', label: 'Ayesha Khan',       email: 'restaurant.supervisor@roxton.com',  icon: Eye },
        { key: 'waiter',     label: 'Luke van der Berg', email: 'waiter@roxton.com',                 icon: UtensilsCrossed },
      ]
    }
  ];

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  let { onLogin }: { onLogin: () => void } = $props();

  // ---------------------------------------------------------------------------
  // Component state
  // ---------------------------------------------------------------------------

  let mode = $state<'login' | 'onboarding'>('login');
  let loading = $state(false);
  let isSeeding = $state(false);
  let selectedProfileIdx = $state(1); // Default to Retail
  let selectedRoleIdx = $state(0);
  let email = $state('');
  let password = $state('');

  // Dropdown open states (one per dropdown)
  let profileDropdownOpen = $state(false);
  let roleDropdownOpen = $state(false);

  // DOM refs for outside-click detection
  let profileDropdownRef = $state<HTMLDivElement>();
  let roleDropdownRef = $state<HTMLDivElement>();

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  let activeProfile = $derived(PROFILES[selectedProfileIdx]);

  // ---------------------------------------------------------------------------
  // Outside-click / escape handlers
  // ---------------------------------------------------------------------------

  $effect(() => {
    if (!profileDropdownOpen && !roleDropdownOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (profileDropdownOpen && profileDropdownRef && !profileDropdownRef.contains(e.target as Node)) {
        profileDropdownOpen = false;
      }
      if (roleDropdownOpen && roleDropdownRef && !roleDropdownRef.contains(e.target as Node)) {
        roleDropdownOpen = false;
      }
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        profileDropdownOpen = false;
        roleDropdownOpen = false;
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleProfileChange(idx: number) {
    selectedProfileIdx = idx;
    selectedRoleIdx = 0;
    profileDropdownOpen = false;
    const profile = PROFILES[idx];
    email = profile.roles[0].email;
    password = 'password123';
    toast.info(`Selected: ${profile.roles[0].label} (${profile.label})`);
  }

  function handleRoleChange(idx: number) {
    selectedRoleIdx = idx;
    roleDropdownOpen = false;
    const role = activeProfile.roles[idx];
    email = role.email;
    password = 'password123';
    toast.info(`Selected: ${role.label}`);
  }

  async function handleSeed() {
    isSeeding = true;
    try {
      const res = await api.seed();
      if (res.success) {
        toast.success('System Initialized: 4 Tenants + Admin + 14 Users');
        toast.info('All profiles seeded. Select a profile and role to auto-fill.', { duration: 6000 });
      } else {
        toast.error('Initialization failed');
      }
    } catch {
      toast.error('Could not connect to server');
    } finally {
      isSeeding = false;
    }
  }

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    if (!email || !password) return;
    loading = true;

    try {
      let res = await api.login(email.trim(), password.trim());

      if (res.error) {
        if (res.error.includes('Invalid credentials') && email.trim() === 'admin@roxton.com') {
          const seedRes = await api.seed();
          if (seedRes.success) {
            res = await api.login(email.trim(), password.trim());
            if (!res.error && res.token) {
              localStorage.setItem('clintpos_auth_token', res.token);
              localStorage.setItem('clintpos_auth_user', JSON.stringify(res.user));
              toast.success('System Auto-Initialized & Access Granted');
              onLogin();
              return;
            }
          }
        }
        throw new Error(res.error);
      }

      if (res.token) {
        localStorage.setItem('clintpos_auth_token', res.token);
        localStorage.setItem('clintpos_auth_user', JSON.stringify(res.user));
      }

      toast.success('Access Granted');
      onLogin();
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
      if (error.message?.includes('Invalid credentials')) {
        toast.info('HINT: Use "Initialize System" if logging in for the first time.', { duration: 5000 });
      }
    } finally {
      loading = false;
    }
  }
</script>

{#if mode === 'onboarding'}
  <MerchantOnboarding oncomplete={() => (mode = 'login')} />

<!-- =========================================================================
     Login screen — split layout
     ========================================================================= -->
{:else}
  <div class="grid min-h-screen lg:grid-cols-2 bg-background selection:bg-amber-200 selection:text-amber-900">

    <!-- ================= Left: form ================= -->
    <div class="flex flex-col gap-6 p-6 md:p-10">
      <div class="flex justify-center md:justify-start">
        <img src={clintposLogo} alt="CLINTPOS" class="h-10 object-contain" />
      </div>

      <div class="flex flex-1 items-center justify-center">
        <div class="w-full max-w-sm" in:fly={{ y: 20, duration: 400 }}>
          {#key activeProfile.key}
            {@const ActiveProfileIcon = activeProfile.icon}
            <form onsubmit={handleLogin}>
              <FieldGroup>
                <div class="flex flex-col items-center gap-1 text-center">
                  <h1 class="text-2xl font-bold text-foreground">Sign in</h1>
                  <p class="text-muted-foreground text-sm text-balance">
                    Multi-Tenant Retail Platform
                  </p>
                </div>

                <!-- Tenant Profile -->
                <Field>
                  <FieldLabel for="profile-dropdown-btn">Tenant Profile</FieldLabel>
                  <div bind:this={profileDropdownRef} class="relative">
                    <button
                      type="button"
                      id="profile-dropdown-btn"
                      onclick={() => (profileDropdownOpen = !profileDropdownOpen)}
                      class="w-full flex items-center justify-between bg-muted/40 border-2 rounded-2xl py-2.5 px-4 text-left transition-all duration-200"
                      style="border-color: {profileDropdownOpen ? activeProfile.color : 'var(--border)'};"
                    >
                      <div class="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style="background-color: {activeProfile.color};"
                        >
                          <ActiveProfileIcon size={16} style="color: #fff;" />
                        </div>
                        <div class="min-w-0">
                          <p class="text-sm font-bold leading-tight truncate text-foreground">{activeProfile.label}</p>
                          <p class="text-[10px] text-muted-foreground truncate">{activeProfile.subtitle}</p>
                        </div>
                      </div>
                      <ChevronDown
                        size={16}
                        class="text-muted-foreground shrink-0 transition-transform duration-200 {profileDropdownOpen ? 'rotate-180' : ''}"
                      />
                    </button>

                    {#if profileDropdownOpen}
                      <div
                        class="absolute left-0 right-0 top-full mt-1.5 bg-popover border border-border rounded-2xl shadow-2xl shadow-black/10 z-50 overflow-hidden max-h-64 overflow-y-auto"
                        in:fly={{ y: -6, duration: 150 }}
                      >
                        {#each PROFILES as profile, i}
                          {@const ProfileIcon = profile.icon}
                          <button
                            type="button"
                            onclick={() => handleProfileChange(i)}
                            class="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 text-sm {i === selectedProfileIdx ? 'bg-muted/50' : 'hover:bg-muted/30'}"
                            style="border-left: 3px solid {i === selectedProfileIdx ? activeProfile.color : 'transparent'};"
                          >
                            <div
                              class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style="background-color: {i === selectedProfileIdx ? profile.color : `${profile.color}25`};"
                            >
                              <ProfileIcon
                                size={16}
                                style="color: {i === selectedProfileIdx ? '#fff' : profile.color};"
                              />
                            </div>
                            <div class="min-w-0 flex-1">
                              <p class="text-sm font-bold leading-tight truncate {i === selectedProfileIdx ? 'text-foreground' : 'text-foreground/80'}">
                                {profile.label}
                              </p>
                              <p class="text-[10px] text-muted-foreground truncate">{profile.subtitle}</p>
                            </div>
                            {#if i === selectedProfileIdx}
                              <CheckCircle2 size={16} class="ml-auto shrink-0" style="color: {activeProfile.color};" />
                            {/if}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </Field>

                <!-- Role -->
                <Field>
                  <FieldLabel for="role-dropdown-btn">User / Role</FieldLabel>
                  <div bind:this={roleDropdownRef} class="relative">
                    <button
                      type="button"
                      id="role-dropdown-btn"
                      onclick={() => (roleDropdownOpen = !roleDropdownOpen)}
                      class="w-full flex items-center justify-between bg-muted/40 border-2 rounded-2xl py-2.5 px-4 text-left transition-all duration-200"
                      style="border-color: {roleDropdownOpen ? activeProfile.color : 'var(--border)'};"
                    >
                      <div class="flex items-center gap-3 min-w-0 flex-1">
                        {#if activeProfile.roles[selectedRoleIdx]}
                          {@const role = activeProfile.roles[selectedRoleIdx]}
                          {@const RoleIcon = role.icon}
                          <RoleIcon size={16} class="shrink-0" style="color: {activeProfile.color};" />
                          <div class="min-w-0">
                            <p class="text-sm font-bold leading-tight truncate text-foreground">{role.label}</p>
                            <p class="text-[10px] truncate" style="color: {activeProfile.color};">
                              {role.key.toUpperCase()}
                            </p>
                          </div>
                        {/if}
                      </div>
                      <ChevronDown
                        size={16}
                        class="text-muted-foreground shrink-0 transition-transform duration-200 {roleDropdownOpen ? 'rotate-180' : ''}"
                      />
                    </button>

                    {#if roleDropdownOpen}
                      <div
                        class="absolute left-0 right-0 top-full mt-1.5 bg-popover border border-border rounded-2xl shadow-2xl shadow-black/10 z-50 overflow-hidden max-h-64 overflow-y-auto"
                        in:fly={{ y: -6, duration: 150 }}
                      >
                        {#each activeProfile.roles as role, i}
                          {@const RoleIcon = role.icon}
                          <button
                            type="button"
                            onclick={() => handleRoleChange(i)}
                            class="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 text-sm {i === selectedRoleIdx ? 'bg-muted/50' : 'hover:bg-muted/30'}"
                            style="border-left: 3px solid {i === selectedRoleIdx ? activeProfile.color : 'transparent'};"
                          >
                            <RoleIcon size={16} class="shrink-0" style="color: {i === selectedRoleIdx ? activeProfile.color : 'var(--muted-foreground)'};" />
                            <div class="min-w-0 flex-1">
                              <p class="text-sm font-bold leading-tight truncate {i === selectedRoleIdx ? 'text-foreground' : 'text-foreground/80'}">
                                {role.label}
                              </p>
                              <p class="text-[10px] truncate" style="color: {i === selectedRoleIdx ? activeProfile.color : 'var(--muted-foreground)'};">
                                {role.key.toUpperCase()}
                              </p>
                            </div>
                            {#if i === selectedRoleIdx}
                              <CheckCircle2 size={16} class="ml-auto shrink-0" style="color: {activeProfile.color};" />
                            {/if}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </Field>

                <FieldSeparator>Credentials</FieldSeparator>

                <Field>
                  <FieldLabel for="email">Email</FieldLabel>
                  <Input id="email" type="email" bind:value={email} placeholder="user@roxton.com" required />
                </Field>
                <Field>
                  <FieldLabel for="password">Password</FieldLabel>
                  <Input id="password" type="password" bind:value={password} placeholder="password123" required />
                </Field>

                <Field>
                  <Button
                    type="submit"
                    disabled={loading || !email}
                    class="w-full text-white"
                    style="background-color: {activeProfile.color}; box-shadow: 0 8px 20px -8px {activeProfile.color}60;"
                  >
                    {#if loading}
                      <Loader2 size={18} class="animate-spin" />
                    {:else}
                      Authenticate as {activeProfile.label}
                      <ArrowRight size={18} />
                    {/if}
                  </Button>
                </Field>

                <FieldSeparator>System Tools</FieldSeparator>

                <div class="grid grid-cols-2 gap-3">
                  <Button variant="outline" type="button" onclick={handleSeed} disabled={isSeeding} class="gap-2">
                    {#if isSeeding}
                      <Loader2 size={14} class="animate-spin" />
                    {:else}
                      <Zap size={14} />
                    {/if}
                    Initialize
                  </Button>
                  <Button variant="outline" type="button" onclick={() => (mode = 'onboarding')} class="gap-2">
                    <Server size={14} />
                    New Merchant
                  </Button>
                </div>
              </FieldGroup>
            </form>
          {/key}
        </div>
      </div>

      <p class="text-center text-xs text-muted-foreground">
        Protected by CLINT Identity Cloud &bull; 5 Profiles &bull; 14 Demo Accounts
      </p>
    </div>

    <!-- ================= Right: hero carousel ================= -->
    <div class="relative hidden lg:flex flex-col items-center justify-center overflow-hidden bg-black">
      {#each HERO_SLIDES as slide, i}
        <div class="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out {i === activeSlide ? 'opacity-100' : 'opacity-0'}">
          {#if slide.type === 'video'}
            <iframe
              class="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              src={slide.src}
              title="Login screen background video"
              frameborder="0"
              allow="autoplay; encrypted-media"
            ></iframe>
          {:else}
            <img src={slide.src} alt={slide.alt} class="absolute inset-0 w-full h-full object-cover" />
          {/if}
        </div>
      {/each}
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/50"></div>

      <!-- Carousel indicators -->
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {#each HERO_SLIDES as _, i}
          <button
            type="button"
            aria-label={`Show slide ${i + 1}`}
            onclick={() => (activeSlide = i)}
            class="h-1.5 rounded-full transition-all duration-300 {i === activeSlide ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}"
          ></button>
        {/each}
      </div>

      {#key activeProfile.key}
        {@const ActiveProfileIcon = activeProfile.icon}
        <div class="relative z-10 flex flex-col items-center text-center px-12 max-w-md" in:fly={{ y: 16, duration: 350 }}>
          <div
            class="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl shadow-black/30 mb-6 bg-white/15 backdrop-blur-sm border border-white/30"
            in:scale={{ duration: 250, start: 0.85 }}
          >
            <ActiveProfileIcon size={40} class="text-white" />
          </div>
          <h2 class="text-3xl font-black text-white tracking-tight mb-1">{activeProfile.label}</h2>
          <p class="text-sm font-medium text-white/80 mb-4">{activeProfile.subtitle}</p>
          <p class="text-sm text-white/70 leading-relaxed">{activeProfile.description}</p>

          <div class="mt-8 flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-full border border-white/30">
            <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <span class="text-[10px] font-bold text-white uppercase tracking-wider">Online</span>
          </div>
        </div>
      {/key}
    </div>
  </div>
{/if}
