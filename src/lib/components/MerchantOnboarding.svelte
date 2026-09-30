<script lang="ts">
  import {
    User, Building2, CreditCard, MapPin, Monitor, ShieldCheck,
    ArrowRight, ArrowLeft, CheckCircle2, Lock, Smartphone, Globe,
    Plus, Info, FileText, UploadCloud, Loader2, AlertCircle, Search,
    X, Zap, Crown, Rocket, Clock, Check, Star
  } from 'lucide-svelte';
  import { fly } from 'svelte/transition';
  import { api } from '../api';
  import { toast } from 'svelte-sonner';
  import AddressAutocomplete from './AddressAutocomplete.svelte';

  let { oncomplete }: { oncomplete: () => void } = $props();

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^(\+?27|0)\d{9}$/;

  type FieldErrors = Record<string, string>;

  function validateStep1(data: any): FieldErrors {
    const e: FieldErrors = {};
    if (!data.account.firstName.trim()) e['account.firstName'] = 'First name is required';
    if (!data.account.lastName.trim()) e['account.lastName'] = 'Last name is required';
    if (!data.account.email.trim()) e['account.email'] = 'Email is required';
    else if (!EMAIL_RE.test(data.account.email)) e['account.email'] = 'Enter a valid email address';
    if (!data.account.mobile.trim()) e['account.mobile'] = 'Mobile number is required';
    else if (!PHONE_RE.test(data.account.mobile.replace(/[\s-]/g, ''))) e['account.mobile'] = 'Enter a valid SA mobile (e.g. 082 123 4567)';
    if (!data.account.password) e['account.password'] = 'Password is required';
    else if (data.account.password.length < 8) e['account.password'] = 'Minimum 8 characters';
    else if (!/[A-Z]/.test(data.account.password)) e['account.password'] = 'Must include an uppercase letter';
    else if (!/\d/.test(data.account.password)) e['account.password'] = 'Must include a number';
    if (!data.account.confirmPassword) e['account.confirmPassword'] = 'Please confirm your password';
    else if (data.account.password !== data.account.confirmPassword) e['account.confirmPassword'] = 'Passwords do not match';
    return e;
  }

  function validateStep2(data: any): FieldErrors {
    const e: FieldErrors = {};
    if (!data.businessInfo.legalName.trim()) e['businessInfo.legalName'] = 'Legal business name is required';
    if (!data.businessInfo.type) e['businessInfo.type'] = 'Business type is required';
    if (!data.businessInfo.address.trim()) e['businessInfo.address'] = 'Business address is required';
    return e;
  }

  function validateStep3(data: any): FieldErrors {
    const e: FieldErrors = {};
    if (!data.banking.bankName.trim()) e['banking.bankName'] = 'Bank name is required';
    if (!data.banking.accountNumber.trim()) e['banking.accountNumber'] = 'Account number is required';
    else if (!/^\d{5,20}$/.test(data.banking.accountNumber.trim())) e['banking.accountNumber'] = 'Enter a valid numeric account number';
    if (!data.banking.routingNumber.trim()) e['banking.routingNumber'] = 'Branch/routing code is required';
    else if (!/^\d{4,10}$/.test(data.banking.routingNumber.trim())) e['banking.routingNumber'] = 'Enter a valid branch code (4-10 digits)';
    return e;
  }

  function validateStep4(data: any): FieldErrors {
    const e: FieldErrors = {};
    const reqDocs = ['cipc', 'id'];
    for (const docId of reqDocs) {
      if (!data.documents.find((d: any) => d.type === docId)) {
        e[`doc.${docId}`] = docId === 'cipc' ? 'Company registration is required' : 'Director ID is required';
      }
    }
    return e;
  }

  function validateStep5(data: any): FieldErrors {
    const e: FieldErrors = {};
    if (!data.location.name.trim()) e['location.name'] = 'Store / branch name is required';
    if (!data.location.address.trim()) e['location.address'] = 'Store address is required';
    return e;
  }

  function validateStep8(data: any): FieldErrors {
    const e: FieldErrors = {};
    if (!data.agreements.tos) e['agreements.tos'] = 'You must accept the Terms of Service';
    if (!data.agreements.privacy) e['agreements.privacy'] = 'You must accept the Privacy Policy';
    return e;
  }

  const VALIDATORS: Record<number, (data: any) => FieldErrors> = {
    1: validateStep1, 2: validateStep2, 3: validateStep3,
    4: validateStep4, 5: validateStep5, 8: validateStep8,
  };

  let step = $state(1);
  let uploading = $state<string | null>(null);
  let applicationId = $state<string | null>(null);
  let errors = $state<FieldErrors>({});
  let touched = $state<Set<string>>(new Set());
  let formData = $state<any>({
    account: { firstName: '', lastName: '', email: '', mobile: '', password: '', confirmPassword: '' },
    businessInfo: { legalName: '', dba: '', type: 'Retail', subtype: '', structure: 'Company', address: '', city: '', province: '', postalCode: '', phone: '', website: '', monthlySales: '0-50k', lat: null, lng: null },
    banking: { bankName: '', accountNumber: '', routingNumber: '', holderName: '', accountType: 'Checking' },
    documents: [] as any[],
    location: { name: '', phone: '', address: '', city: '', province: '', postalCode: '', currency: 'ZAR', timezone: 'GMT+2', lat: null, lng: null },
    hardware: { terminalCount: 1, hardwareOption: 'own' },
    plan: { selected: 'kiosk', billing: 'monthly' },
    agreements: { tos: false, privacy: false, paymentAuth: false }
  });

  function markTouched(field: string) {
    touched = new Set(touched).add(field);
  }

  $effect(() => {
    const validator = VALIDATORS[step];
    if (validator) {
      const allErrors = validator(formData);
      const visibleErrors: FieldErrors = {};
      for (const key of Object.keys(allErrors)) {
        if (touched.has(key)) visibleErrors[key] = allErrors[key];
      }
      errors = visibleErrors;
    }
  });

  function tryNextStep() {
    const validator = VALIDATORS[step];
    if (validator) {
      const stepErrors = validator(formData);
      if (Object.keys(stepErrors).length > 0) {
        const next = new Set(touched);
        for (const k of Object.keys(stepErrors)) next.add(k);
        touched = next;
        errors = stepErrors;
        toast.error('Please fix the highlighted fields before continuing');
        return;
      }
    }
    errors = {};
    step = Math.min(step + 1, 9);
  }

  function prevStep() {
    errors = {};
    step = Math.max(step - 1, 1);
  }

  async function handleFileUpload(e: Event, docType: string) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File exceeds 10MB limit');
        return;
      }
      uploading = docType;
      try {
        const res = await api.uploadFile(file);
        if (res.success) {
          const newDoc = {
            name: res.name,
            path: res.path,
            size: (res.size / 1024 / 1024).toFixed(2) + 'MB',
            date: new Date().toISOString().split('T')[0],
            type: docType
          };
          formData = {
            ...formData,
            documents: [...formData.documents.filter((d: any) => d.type !== docType), newDoc]
          };
          const next = { ...errors };
          delete next[`doc.${docType}`];
          errors = next;
          toast.success('Document uploaded');
        } else {
          toast.error('Upload failed');
        }
      } catch {
        toast.error('Upload error');
      } finally {
        uploading = null;
      }
    }
  }

  async function handleSubmit() {
    const stepErrors = validateStep8(formData);
    if (Object.keys(stepErrors).length > 0) {
      const next = new Set(touched);
      for (const k of Object.keys(stepErrors)) next.add(k);
      touched = next;
      errors = stepErrors;
      toast.error('Please accept the required agreements');
      return;
    }
    try {
      const data = await api.submitOnboarding(formData);
      if (data.success) {
        applicationId = data.applicationId;
        step = 9;
      } else {
        toast.error(data.error || 'Submission failed');
      }
    } catch {
      toast.error('Submission failed. Please check your connection.');
    }
  }

  function hasErr(field: string) { return !!errors[field]; }

  function fieldClass(field: string) {
    return `w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white border rounded-2xl font-bold outline-none focus:ring-2 transition-all ${hasErr(field) ? 'border-red-300 focus:ring-red-400 bg-red-50/30 dark:bg-red-950/20' : 'border-neutral-100 dark:border-neutral-700 focus:ring-indigo-500'}`;
  }

  function stepValid(s: number) {
    const v = VALIDATORS[s];
    if (!v) return true;
    return Object.keys(v(formData)).length === 0;
  }

  const steps = [
    { id: 1, title: 'Identity', icon: User },
    { id: 2, title: 'Business', icon: Building2 },
    { id: 3, title: 'Financials', icon: CreditCard },
    { id: 4, title: 'Documents', icon: FileText },
    { id: 5, title: 'Location', icon: MapPin },
    { id: 6, title: 'Hardware', icon: Monitor },
    { id: 7, title: 'Plan', icon: Rocket },
    { id: 8, title: 'Compliance', icon: ShieldCheck }
  ];
</script>

<div class="onboarding-shell min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-3 sm:p-6">
  <div class="max-w-4xl w-full bg-white dark:bg-neutral-900 rounded-[24px] sm:rounded-[48px] shadow-2xl border border-neutral-100 dark:border-neutral-700 overflow-hidden flex flex-col md:flex-row min-h-[700px] md:max-h-[90vh]">
    <!-- Sidebar Nav -->
    <div class="w-full md:w-72 bg-neutral-900 p-10 text-white flex flex-col justify-between">
      <div class="space-y-8">
        <div class="flex items-center gap-3 mb-10">
          <span class="text-2xl font-black tracking-tighter text-white">CLINTPOS</span>
        </div>
        <div class="space-y-4">
          {#each steps as s}
            {@const isComplete = s.id < step && stepValid(s.id)}
            <div class="flex items-center gap-4 transition-all {step === s.id ? 'opacity-100 translate-x-2' : step > s.id ? 'opacity-70' : 'opacity-40'}">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center transition-all {isComplete ? 'bg-emerald-500' : step === s.id ? 'bg-indigo-500' : step > s.id ? 'bg-white/20' : 'bg-white/10'}">
                  {#if isComplete}
                    <CheckCircle2 class="w-4 h-4" />
                  {:else}
                    {@const StepIcon = s.icon}
                    <StepIcon class="w-4 h-4" />
                {/if}
              </div>
              <div>
                <p class="text-[10px] font-black uppercase tracking-widest">{s.title}</p>
                {#if step === s.id}
                  <p class="text-[8px] text-indigo-400 font-bold uppercase">Current Step</p>
                {/if}
                {#if isComplete}
                  <p class="text-[8px] text-emerald-400 font-bold uppercase">Complete</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
      <div class="p-6 bg-white/5 rounded-3xl border border-white/10">
        <p class="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2">Support</p>
        <p class="text-xs font-medium text-neutral-300">Need help? Call +27 11 000 0000</p>
      </div>
    </div>

    <!-- Form Area -->
    <div class="onboarding-form flex-1 flex flex-col p-5 sm:p-12 overflow-y-auto">
      {#key step}
        <!-- STEP 1: Identity -->
        {#if step === 1}
          <div in:fly={{ x: 20 }} out:fly={{ x: -20 }} class="space-y-8">
            <div>
              <h2 class="text-3xl font-black tracking-tight text-white">Primary Account Holder</h2>
              <p class="text-neutral-300 font-medium">Define the root administrator for this merchant node.</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">First Name <span class="text-red-400">*</span></label>
                <input class={fieldClass('account.firstName')} value={formData.account.firstName} oninput={e => formData = {...formData, account: {...formData.account, firstName: e.target.value}}} onblur={() => markTouched('account.firstName')} placeholder="John" />
                {#if errors['account.firstName']}
                  <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors['account.firstName']}</p>
                {/if}
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">Last Name <span class="text-red-400">*</span></label>
                <input class={fieldClass('account.lastName')} value={formData.account.lastName} oninput={e => formData = {...formData, account: {...formData.account, lastName: e.target.value}}} onblur={() => markTouched('account.lastName')} placeholder="Smith" />
                {#if errors['account.lastName']}
                  <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors['account.lastName']}</p>
                {/if}
              </div>
              <div class="col-span-2 space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">Email (System Login) <span class="text-red-400">*</span></label>
                <input type="email" class={fieldClass('account.email')} value={formData.account.email} oninput={e => formData = {...formData, account: {...formData.account, email: e.target.value}}} onblur={() => markTouched('account.email')} placeholder="john@company.co.za" />
                {#if errors['account.email']}
                  <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors['account.email']}</p>
                {/if}
              </div>
              <div class="col-span-2 space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">Mobile Number <span class="text-red-400">*</span></label>
                <input type="tel" class={fieldClass('account.mobile')} value={formData.account.mobile} oninput={e => formData = {...formData, account: {...formData.account, mobile: e.target.value}}} onblur={() => markTouched('account.mobile')} placeholder="082 123 4567" />
                {#if errors['account.mobile']}
                  <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors['account.mobile']}</p>
                {/if}
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">Create Password <span class="text-red-400">*</span></label>
                <input type="password" class={fieldClass('account.password')} value={formData.account.password} oninput={e => formData = {...formData, account: {...formData.account, password: e.target.value}}} onblur={() => markTouched('account.password')} placeholder="Min. 8 characters" />
                {#if errors['account.password']}
                  <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors['account.password']}</p>
                {/if}
                {#if formData.account.password}
                  {@const checks = [
                    { label: '8+ characters', ok: formData.account.password.length >= 8 },
                    { label: 'Uppercase letter', ok: /[A-Z]/.test(formData.account.password) },
                    { label: 'Number', ok: /\d/.test(formData.account.password) },
                    { label: 'Special character', ok: /[!@#$%^&*(),.?":{}|<>]/.test(formData.account.password) },
                  ]}
                  {@const score = checks.filter(c => c.ok).length}
                  <div class="mt-3 space-y-2">
                    <div class="flex gap-1.5">
                      {#each [1,2,3,4] as i}
                        <div class="h-1 flex-1 rounded-full transition-all duration-300 {i <= score ? score <= 1 ? 'bg-red-400' : score <= 2 ? 'bg-amber-400' : score <= 3 ? 'bg-emerald-400' : 'bg-indigo-500' : 'bg-neutral-200 dark:bg-neutral-700'}"></div>
                      {/each}
                    </div>
                    <div class="flex flex-wrap gap-x-4 gap-y-1">
                      {#each checks as c}
                        <span class="text-[9px] font-bold {c.ok ? 'text-emerald-500' : 'text-neutral-300'}">{c.ok ? '\u2713' : '\u2022'} {c.label}</span>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">Confirm Password <span class="text-red-400">*</span></label>
                <input type="password" class={fieldClass('account.confirmPassword')} value={formData.account.confirmPassword} oninput={e => formData = {...formData, account: {...formData.account, confirmPassword: e.target.value}}} onblur={() => markTouched('account.confirmPassword')} placeholder="Re-enter password" />
                {#if errors['account.confirmPassword']}
                  <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors['account.confirmPassword']}</p>
                {/if}
              </div>
            </div>
          </div>

        {:else if step === 2}
          <!-- STEP 2: Business -->
          <div in:fly={{ x: 20 }} out:fly={{ x: -20 }} class="space-y-8">
            <div>
              <h2 class="text-3xl font-black tracking-tight text-white">Business Profile</h2>
              <p class="text-neutral-300 font-medium">Verify your legal entity and operational footprint.</p>
            </div>
            <div class="space-y-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">Legal Business Name <span class="text-red-400">*</span></label>
                <input class={fieldClass('businessInfo.legalName')} value={formData.businessInfo.legalName} oninput={e => formData = {...formData, businessInfo: {...formData.businessInfo, legalName: e.target.value}}} onblur={() => markTouched('businessInfo.legalName')} placeholder="ABC Trading (Pty) Ltd" />
                {#if errors['businessInfo.legalName']}
                  <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors['businessInfo.legalName']}</p>
                {/if}
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-black uppercase tracking-widest text-white">Business Type <span class="text-red-400">*</span></label>
                  <select class={fieldClass('businessInfo.type')} value={formData.businessInfo.type} onchange={e => formData = {...formData, businessInfo: {...formData.businessInfo, type: e.target.value}}}>
                    <option value="Retail">Retail</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Forecourt">Forecourt / Fuel</option>
                    <option value="Hospitality">Hospitality</option>
                  </select>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black uppercase tracking-widest text-white">Est. Monthly Sales</label>
                  <select class="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 text-white border border-neutral-100 dark:border-neutral-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={formData.businessInfo.monthlySales} onchange={e => formData = {...formData, businessInfo: {...formData.businessInfo, monthlySales: e.target.value}}}>
                    <option value="0-50k">R0 - R50,000</option>
                    <option value="50k-250k">R50,000 - R250,000</option>
                    <option value="250k+">R250,000+</option>
                  </select>
                </div>
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">Business Address <span class="text-red-400">*</span></label>
                <AddressAutocomplete
                  value={formData.businessInfo.address}
                  onchange={(v: string) => { formData = {...formData, businessInfo: {...formData.businessInfo, address: v}}; markTouched('businessInfo.address'); }}
                  onselect={(details: any) => {
                    formData = {...formData, businessInfo: {...formData.businessInfo, address: details.formattedAddress || formData.businessInfo.address, city: details.city || '', province: details.province || '', postalCode: details.postalCode || '', lat: details.lat, lng: details.lng}};
                  }}
                  placeholder="Start typing your business address..."
                  hasError={hasErr('businessInfo.address')}
                  errorMessage={errors['businessInfo.address']}
                />
                {#if formData.businessInfo.city}
                  <div class="mt-3 flex flex-wrap gap-2">
                    {#if formData.businessInfo.city}<span class="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">{formData.businessInfo.city}</span>{/if}
                    {#if formData.businessInfo.province}<span class="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">{formData.businessInfo.province}</span>{/if}
                    {#if formData.businessInfo.postalCode}<span class="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">{formData.businessInfo.postalCode}</span>{/if}
                  </div>
                {/if}
              </div>
            </div>
          </div>

        {:else if step === 3}
          <!-- STEP 3: Financials -->
          <div in:fly={{ x: 20 }} out:fly={{ x: -20 }} class="space-y-8">
            <div>
              <h2 class="text-3xl font-black tracking-tight text-white">Financial Settlement</h2>
              <p class="text-neutral-300 font-medium">Configure bank account for automated clearing.</p>
            </div>
            <div class="space-y-6">
              <div class="p-6 bg-indigo-50 dark:bg-indigo-950/30 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 flex gap-4">
                <Lock class="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <p class="text-[11px] font-medium text-indigo-900 dark:text-indigo-300 leading-relaxed">Your banking details are transmitted via a PCI-DSS compliant secure vault. CLINTPOS does not store plaintext bank credentials.</p>
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">Bank Name <span class="text-red-400">*</span></label>
                <input class={fieldClass('banking.bankName')} value={formData.banking.bankName} oninput={e => formData = {...formData, banking: {...formData.banking, bankName: e.target.value}}} onblur={() => markTouched('banking.bankName')} placeholder="e.g. FNB, Standard Bank, Nedbank" />
                {#if errors['banking.bankName']}
                  <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors['banking.bankName']}</p>
                {/if}
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-black uppercase tracking-widest text-white">Account Number <span class="text-red-400">*</span></label>
                  <input class={fieldClass('banking.accountNumber')} value={formData.banking.accountNumber} oninput={e => formData = {...formData, banking: {...formData.banking, accountNumber: e.target.value.replace(/\D/g, '')}}} onblur={() => markTouched('banking.accountNumber')} placeholder="1234567890" inputmode="numeric" />
                  {#if errors['banking.accountNumber']}
                    <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors['banking.accountNumber']}</p>
                  {/if}
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black uppercase tracking-widest text-white">Branch Code <span class="text-red-400">*</span></label>
                  <input class={fieldClass('banking.routingNumber')} value={formData.banking.routingNumber} oninput={e => formData = {...formData, banking: {...formData.banking, routingNumber: e.target.value.replace(/\D/g, '')}}} onblur={() => markTouched('banking.routingNumber')} placeholder="250655" inputmode="numeric" />
                  {#if errors['banking.routingNumber']}
                    <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors['banking.routingNumber']}</p>
                  {/if}
                </div>
              </div>
            </div>
          </div>

        {:else if step === 4}
          <!-- STEP 4: Documents -->
          <div in:fly={{ x: 20 }} out:fly={{ x: -20 }} class="space-y-8">
            <div>
              <h2 class="text-3xl font-black tracking-tight text-white">Compliance Documents</h2>
              <p class="text-neutral-300 font-medium">Upload required verification documents (KYC/FICA).</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {#each [{ id: 'cipc', label: 'Company Registration (CIPC)', desc: 'COR 14.3', required: true }, { id: 'id', label: 'Director ID / Passport', desc: 'Certified Copy', required: true }, { id: 'bank', label: 'Bank Confirmation Letter', desc: '< 3 Months Old', required: false }, { id: 'proof', label: 'Proof of Address', desc: 'Utility Bill / Lease', required: false }] as doc}
                {@const uploaded = formData.documents.find((d: any) => d.type === doc.id)}
                {@const docErr = errors[`doc.${doc.id}`]}
                <div class="col-span-1">
                  <label class="block p-6 rounded-[24px] border-2 border-dashed transition-all cursor-pointer group relative {docErr ? 'border-red-300 bg-red-50/20 hover:border-red-400' : uploaded ? 'border-emerald-300 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-neutral-200 hover:border-indigo-400 hover:bg-indigo-50/30'}">
                    <input type="file" class="hidden" onchange={(e) => handleFileUpload(e, doc.id)} accept=".pdf,.jpg,.png,.jpeg" />
                    <div class="flex items-start gap-4">
                      <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 {uploaded ? 'bg-emerald-100 text-emerald-600' : docErr ? 'bg-red-100 text-red-500' : 'bg-neutral-100 text-neutral-400 group-hover:bg-white group-hover:text-indigo-500'}">
                        {#if uploading === doc.id}
                          <Loader2 class="w-5 h-5 animate-spin" />
                        {:else if uploaded}
                          <CheckCircle2 class="w-6 h-6" />
                        {:else}
                          <UploadCloud class="w-6 h-6" />
                        {/if}
                      </div>
                      <div>
                        <p class="font-black text-sm mb-1 {uploaded ? 'text-emerald-700 dark:text-emerald-400' : docErr ? 'text-red-600' : 'text-neutral-900 dark:text-neutral-200'}">
                          {uploaded ? 'Uploaded Successfully' : doc.label}
                          {#if doc.required && !uploaded}<span class="text-red-400"> *</span>{/if}
                        </p>
                        <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">{uploaded ? uploaded.name : doc.desc}</p>
                        {#if docErr}<p class="text-[9px] font-bold text-red-500 mt-1 flex items-center gap-1"><AlertCircle class="w-3 h-3" /> {docErr}</p>{/if}
                      </div>
                    </div>
                  </label>
                </div>
              {/each}
            </div>
            <div class="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex gap-3">
              <Info class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p class="text-[10px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">Ensure all documents are clear and legible. Maximum file size is 10MB per document. Allowed formats: PDF, JPG, PNG.</p>
            </div>
          </div>

        {:else if step === 5}
          <!-- STEP 5: Location -->
          <div in:fly={{ x: 20 }} out:fly={{ x: -20 }} class="space-y-8">
            <div>
              <h2 class="text-3xl font-black tracking-tight text-white">Store Details</h2>
              <p class="text-neutral-300 font-medium">Initial location setup for your POS deployment.</p>
            </div>
            <div class="space-y-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">Store / Branch Name <span class="text-red-400">*</span></label>
                <input class={fieldClass('location.name')} value={formData.location.name} oninput={e => formData = {...formData, location: {...formData.location, name: e.target.value}}} onblur={() => markTouched('location.name')} placeholder="Main Branch" />
                {#if errors['location.name']}
                  <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors['location.name']}</p>
                {/if}
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">Store Address <span class="text-red-400">*</span></label>
                <AddressAutocomplete
                  value={formData.location.address}
                  onchange={(v: string) => { formData = {...formData, location: {...formData.location, address: v}}; markTouched('location.address'); }}
                  onselect={(details: any) => {
                    formData = {...formData, location: {...formData.location, address: details.formattedAddress || formData.location.address, city: details.city || '', province: details.province || '', postalCode: details.postalCode || '', lat: details.lat, lng: details.lng}};
                  }}
                  placeholder="Start typing the store address..."
                  hasError={hasErr('location.address')}
                  errorMessage={errors['location.address']}
                />
                {#if formData.location.city}
                  <div class="mt-3 flex flex-wrap gap-2">
                    {#if formData.location.city}<span class="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">{formData.location.city}</span>{/if}
                    {#if formData.location.province}<span class="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">{formData.location.province}</span>{/if}
                    {#if formData.location.postalCode}<span class="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">{formData.location.postalCode}</span>{/if}
                  </div>
                {/if}
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-black uppercase tracking-widest text-white">Currency</label>
                  <select class="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 text-white border border-neutral-100 dark:border-neutral-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={formData.location.currency} onchange={e => formData = {...formData, location: {...formData.location, currency: e.target.value}}}>
                    <option value="ZAR">ZAR (Rand)</option>
                    <option value="USD">USD (Dollar)</option>
                  </select>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black uppercase tracking-widest text-white">Timezone</label>
                  <select class="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 text-white border border-neutral-100 dark:border-neutral-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={formData.location.timezone} onchange={e => formData = {...formData, location: {...formData.location, timezone: e.target.value}}}>
                    <option value="GMT+2">SAST (GMT+2)</option>
                    <option value="GMT+0">GMT</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

        {:else if step === 6}
          <!-- STEP 6: Hardware -->
          <div in:fly={{ x: 20 }} out:fly={{ x: -20 }} class="space-y-8">
            <div>
              <h2 class="text-3xl font-black tracking-tight text-white">Hardware Fleet</h2>
              <p class="text-neutral-300 font-medium">Provision your initial device infrastructure.</p>
            </div>
            <div class="space-y-6">
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-white">Number of Terminals Required</label>
                <div class="flex items-center gap-4">
                  <button onclick={() => formData = {...formData, hardware: {...formData.hardware, terminalCount: Math.max(1, formData.hardware.terminalCount - 1)}}} class="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center font-black text-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">-</button>
                  <div class="flex-1 px-6 py-3.5 bg-neutral-900 text-white rounded-2xl text-center font-black text-lg">{formData.hardware.terminalCount} Units</div>
                  <button onclick={() => formData = {...formData, hardware: {...formData.hardware, terminalCount: formData.hardware.terminalCount + 1}}} class="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center font-black text-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">+</button>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onclick={() => formData = {...formData, hardware: {...formData.hardware, hardwareOption: 'own'}}} class="p-6 rounded-[32px] border-2 transition-all text-left {formData.hardware.hardwareOption === 'own' ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30' : 'border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800'}">
                  <Smartphone class="w-8 h-8 mb-4 {formData.hardware.hardwareOption === 'own' ? 'text-indigo-600' : 'text-neutral-400'}" />
                  <p class="font-black text-sm text-neutral-900 dark:text-neutral-100">BYOD (Compatible)</p>
                  <p class="text-[10px] text-neutral-500 font-medium">Use own hardware</p>
                </button>
                <button onclick={() => formData = {...formData, hardware: {...formData.hardware, hardwareOption: 'purchase'}}} class="p-6 rounded-[32px] border-2 transition-all text-left {formData.hardware.hardwareOption === 'purchase' ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30' : 'border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800'}">
                  <Plus class="w-8 h-8 mb-4 {formData.hardware.hardwareOption === 'purchase' ? 'text-indigo-600' : 'text-neutral-400'}" />
                  <p class="font-black text-sm text-neutral-900 dark:text-neutral-100">Purchase Bundle</p>
                  <p class="text-[10px] text-neutral-500 font-medium">CLINTPOS HW Kit</p>
                </button>
              </div>
            </div>
          </div>

        {:else if step === 7}
          <!-- STEP 7: Plan -->
          <div in:fly={{ x: 20 }} out:fly={{ x: -20 }} class="space-y-8">
            <div>
              <h2 class="text-3xl font-black tracking-tight dark:text-neutral-100">Choose Your Plan</h2>
              <p class="text-neutral-400 font-medium">All plans include a <span class="text-amber-500 font-black">30-day free trial</span>. No credit card required.</p>
            </div>
            <div class="flex items-center justify-center gap-4">
              <span class="text-xs font-black uppercase tracking-widest {formData.plan.billing === 'monthly' ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400'}">Monthly</span>
              <button onclick={() => formData = {...formData, plan: {...formData.plan, billing: formData.plan.billing === 'monthly' ? 'annual' : 'monthly'}}} class="relative w-14 h-7 rounded-full transition-colors {formData.plan.billing === 'annual' ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'}">
                <div class="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-lg transition-all {formData.plan.billing === 'annual' ? 'left-7' : 'left-0.5'}"></div>
              </button>
              <span class="text-xs font-black uppercase tracking-widest {formData.plan.billing === 'annual' ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400'}">Annual</span>
              {#if formData.plan.billing === 'annual'}
                <span class="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest">Save 20%</span>
              {/if}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {#each [{ id: 'kiosk', name: 'Kiosk / Start-up', icon: Zap, monthlyPrice: 0, annualPrice: 0, afterTrial: 'from R299/mo', color: 'amber', features: ['1 Terminal', 'Basic POS', 'Up to 50 SKUs', 'Email Support', 'Basic Reports', 'Standard Settlement (T+2)', 'Single Location'], limitations: ['No API access', 'No multi-branch', 'No batch settlement'] }, { id: 'standard', name: 'Standard Retail', icon: Star, monthlyPrice: 899, annualPrice: 719, color: 'indigo', popular: true, features: ['Up to 5 Terminals', 'Full POS + Kitchen Display', 'Up to 2 000 SKUs', 'Priority Support', 'Advanced Analytics', 'Fast Settlement (T+1)', 'Multi-Location (3 branches)', 'Batch Settlement', 'Customer Loyalty'], limitations: ['No API access', 'No white-label'] }, { id: 'multi', name: 'Multi-Branch', icon: Crown, monthlyPrice: 1999, annualPrice: 1599, color: 'neutral', features: ['Unlimited Terminals', 'All POS Features', 'Unlimited SKUs', 'Dedicated Account Manager', 'Real-time Analytics + Forensic Ledger', 'Same-day Settlement (T+0)', 'Unlimited Locations', 'API Access & Webhooks', 'White-Label Options', 'Custom Integrations', 'SLA Guarantee'], limitations: [] }] as plan}
                {@const isSelected = formData.plan.selected === plan.id}
                {@const price = formData.plan.billing === 'annual' ? plan.annualPrice : plan.monthlyPrice}
                {@const PlanIcon = plan.icon}
                <button onclick={() => formData = {...formData, plan: {...formData.plan, selected: plan.id}}} class="relative text-left p-5 rounded-[28px] border-2 transition-all duration-300 {isSelected ? (plan.color === 'indigo' ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-xl shadow-indigo-500/10' : plan.color === 'amber' ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 shadow-xl shadow-amber-500/10' : 'border-neutral-900 bg-neutral-50 dark:bg-neutral-800 shadow-xl') : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'}">
                  {#if plan.popular}
                    <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full">Most Popular</div>
                  {/if}
                  <div class="flex items-center gap-2.5 mb-3">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center {isSelected ? (plan.color === 'indigo' ? 'bg-indigo-600 text-white' : plan.color === 'amber' ? 'bg-amber-500 text-white' : 'bg-neutral-900 text-white') : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400'}">
                      <PlanIcon class="w-4.5 h-4.5" />
                    </div>
                    <div><p class="text-sm font-black text-neutral-900 dark:text-neutral-100">{plan.name}</p></div>
                  </div>
                  <div class="mb-3">
                    {#if price === 0}
                      <div>
                        <p class="text-2xl font-black text-neutral-900 dark:text-neutral-100">Free</p>
                        <p class="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">30 days &bull; then {plan.afterTrial}</p>
                      </div>
                    {:else}
                      <div>
                        <div class="flex items-baseline gap-1">
                          <span class="text-[8px] font-black text-neutral-400 uppercase tracking-widest">from</span>
                          <span class="text-[10px] font-black text-neutral-400">R</span>
                          <span class="text-2xl font-black text-neutral-900 dark:text-neutral-100">{price.toLocaleString()}</span>
                          <span class="text-[10px] font-bold text-neutral-400">/mo</span>
                        </div>
                        <p class="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-0.5"><Clock class="w-3 h-3 inline mr-1" />30-day free trial</p>
                      </div>
                    {/if}
                  </div>
                  <div class="space-y-1.5 mb-3">
                    {#each plan.features as f}
                      <div class="flex items-start gap-2">
                        <Check class="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                        <span class="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 leading-tight">{f}</span>
                      </div>
                    {/each}
                  </div>
                  {#if plan.limitations.length > 0}
                    <div class="pt-2 border-t border-neutral-100 dark:border-neutral-700 space-y-1">
                      {#each plan.limitations as l}
                        <div class="flex items-start gap-2">
                          <X class="w-3 h-3 text-neutral-300 shrink-0 mt-0.5" />
                          <span class="text-[9px] font-bold text-neutral-400 leading-tight">{l}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                  {#if isSelected}
                    <div class="mt-3 py-2 rounded-xl text-center text-[9px] font-black uppercase tracking-widest {plan.color === 'indigo' ? 'bg-indigo-600 text-white' : plan.color === 'amber' ? 'bg-amber-500 text-white' : 'bg-neutral-900 text-white'}">Selected</div>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

        {:else if step === 8}
          <!-- STEP 8: Compliance -->
          <div in:fly={{ x: 20 }} out:fly={{ x: -20 }} class="space-y-8">
            <div>
              <h2 class="text-3xl font-black tracking-tight text-white">Legal & Agreements</h2>
              <p class="text-neutral-300 font-medium">Finalize your merchant service agreement.</p>
            </div>
            <div class="space-y-4">
              {#each [{ id: 'tos', label: 'I agree to the CLINTPOS Terms of Service', required: true }, { id: 'privacy', label: 'I have read and accept the Privacy Policy', required: true }, { id: 'paymentAuth', label: 'Authorize automated payment processing', required: false }] as agg}
                {@const errKey = `agreements.${agg.id}`}
                <div>
                  <div onclick={() => { formData = {...formData, agreements: {...formData.agreements, [agg.id]: !formData.agreements[agg.id]}}; markTouched(errKey); }} class="flex items-center gap-4 p-6 rounded-3xl border cursor-pointer transition-all {errors[errKey] ? 'bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-800/40 hover:bg-red-50 dark:hover:bg-red-950/20' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700'}">
                    <div class="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all {formData.agreements[agg.id] ? 'bg-indigo-600 border-indigo-600' : errors[errKey] ? 'border-red-400' : 'border-neutral-300 dark:border-neutral-600'}">
                      {#if formData.agreements[agg.id]}<CheckCircle2 class="w-4 h-4 text-white" />{/if}
                    </div>
                    <p class="text-xs font-bold text-white">{agg.label}{#if agg.required}<span class="text-red-400"> *</span>{/if}</p>
                  </div>
                  {#if errors[errKey]}
                    <p class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-red-500"><AlertCircle class="w-3 h-3 shrink-0" /> {errors[errKey]}</p>
                  {/if}
                </div>
              {/each}
            </div>
            <div class="p-6 bg-neutral-900 dark:bg-neutral-800 rounded-3xl">
              <p class="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-3">Application Summary</p>
              <div class="grid grid-cols-2 gap-3 text-xs">
                <div><span class="font-bold text-neutral-300">Applicant:</span> <span class="font-black text-white">{formData.account.firstName} {formData.account.lastName}</span></div>
                <div><span class="font-bold text-neutral-300">Email:</span> <span class="font-black text-white">{formData.account.email}</span></div>
                <div><span class="font-bold text-neutral-300">Business:</span> <span class="font-black text-white">{formData.businessInfo.legalName || '\u2014'}</span></div>
                <div><span class="font-bold text-neutral-300">Type:</span> <span class="font-black text-white">{formData.businessInfo.type}</span></div>
                <div><span class="font-bold text-neutral-300">Terminals:</span> <span class="font-black text-white">{formData.hardware.terminalCount}</span></div>
                <div><span class="font-bold text-neutral-300">Docs:</span> <span class="font-black text-white">{formData.documents.length} uploaded</span></div>
                <div><span class="font-bold text-neutral-300">Plan:</span> <span class="font-black text-amber-400 uppercase">{[{ kiosk: 'Kiosk / Start-up' }, { standard: 'Standard Retail' }, { multi: 'Multi-Branch' }].find(p => p[formData.plan.selected])?.[formData.plan.selected] || formData.plan.selected} ({formData.plan.billing})</span></div>
                <div><span class="font-bold text-neutral-300">Trial:</span> <span class="font-black text-emerald-400">30 Days Free</span></div>
              </div>
            </div>
          </div>

        {:else if step === 9}
          <!-- STEP 9: Success -->
          <div in:fly={{ y: 20 }} class="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div class="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-[40px] flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 class="w-12 h-12" />
            </div>
            <div>
              <h2 class="text-3xl font-black tracking-tight dark:text-neutral-100">Application Submitted</h2>
              <p class="text-neutral-500 font-medium max-w-sm mx-auto mt-2">Our compliance team is reviewing your profile. You will receive an email verification and OTP shortly.</p>
            </div>
            <div class="space-y-3 w-full max-w-sm">
              <div class="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-[24px] border border-neutral-100 dark:border-neutral-700">
                <p class="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Application ID</p>
                <p class="text-sm font-black text-neutral-900 dark:text-neutral-100 tracking-widest">{applicationId ? applicationId : '#0000000'}</p>
              </div>
              <div class="p-5 bg-amber-50 dark:bg-amber-950/20 rounded-[24px] border border-amber-200 dark:border-amber-900/40">
                <div class="flex items-center gap-2 mb-1">
                  <Clock class="w-3.5 h-3.5 text-amber-600" />
                  <p class="text-[10px] font-black uppercase tracking-widest text-amber-600">30-Day Trial Activated</p>
                </div>
                <p class="text-xs font-bold text-amber-800 dark:text-amber-300">Plan: <span class="uppercase font-black">{formData.plan.selected}</span> &bull; Trial ends in 30 days</p>
              </div>
            </div>
            <button onclick={oncomplete} class="px-10 py-4 bg-neutral-900 dark:bg-neutral-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-neutral-800 active:scale-95 transition-all">Return to Login</button>
          </div>
        {/if}
      {/key}

      {#if step < 9}
        <div class="mt-auto pt-12 flex items-center justify-between border-t border-neutral-50 dark:border-neutral-800">
          <button onclick={prevStep} disabled={step === 1} class="flex items-center gap-2 px-6 py-3 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 font-black text-[10px] uppercase tracking-widest disabled:opacity-0 transition-all">
            <ArrowLeft class="w-4 h-4" /> Previous Step
          </button>
          <div class="flex items-center gap-1.5">
            {#each steps as s}
              <div class="h-1.5 rounded-full transition-all duration-300 {s.id === step ? 'w-6 bg-indigo-500' : s.id < step ? 'w-1.5 bg-emerald-400' : 'w-1.5 bg-neutral-200 dark:bg-neutral-700'}"></div>
            {/each}
          </div>
          <button onclick={step === 8 ? handleSubmit : tryNextStep} class="flex items-center gap-2 px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all">
            {step === 8 ? 'Submit Application' : 'Next Sequence'}
            <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="mt-12 flex items-center gap-8 opacity-40">
    <div class="flex items-center gap-2">
      <ShieldCheck class="w-4 h-4" />
      <p class="text-[9px] font-black uppercase tracking-widest">PCI-DSS Level 1</p>
    </div>
    <div class="flex items-center gap-2">
      <Lock class="w-4 h-4" />
      <p class="text-[9px] font-black uppercase tracking-widest">256-bit AES Encryption</p>
    </div>
    <div class="flex items-center gap-2">
      <Globe class="w-4 h-4" />
      <p class="text-[9px] font-black uppercase tracking-widest">CLINTPOS Cloud Global</p>
    </div>
  </div>
</div>

<style>
  /* Keep the form legible on the light card; the legacy classes used white
     text on light inputs, which made onboarding appear blank or unusable. */
  .onboarding-form :global(h2),
  .onboarding-form :global(label),
  .onboarding-form :global(input),
  .onboarding-form :global(select),
  .onboarding-form :global(textarea) {
    color: #171717 !important;
  }

  .onboarding-form :global(input::placeholder),
  .onboarding-form :global(textarea::placeholder) {
    color: #737373 !important;
  }

  :global(.dark) .onboarding-form :global(h2),
  :global(.dark) .onboarding-form :global(label),
  :global(.dark) .onboarding-form :global(input),
  :global(.dark) .onboarding-form :global(select),
  :global(.dark) .onboarding-form :global(textarea) {
    color: #f5f5f5 !important;
  }
</style>
