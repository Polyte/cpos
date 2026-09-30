#!/usr/bin/env node

/**
 * Clinton POS platform smoke + performance tests.
 *
 * Read-only by default. Set PLATFORM_AUTH_TOKEN and pass --run-import to run
 * one 100-row LoyaltyHub import batch as an explicit integration test.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const baseUrl = (process.env.PLATFORM_API_URL || 'https://tktryrmospxbbuylweui.supabase.co/functions/v1/make-server-69ad2d15').replace(/\/$/, '');
const authToken = process.env.PLATFORM_AUTH_TOKEN || '';
const runImport = process.argv.includes('--run-import');
const results = [];

function record(name, passed, durationMs, details = {}) {
  const result = { name, passed, durationMs: Math.round(durationMs * 100) / 100, ...details };
  results.push(result);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name} (${result.durationMs}ms)${details.message ? ` — ${details.message}` : ''}`);
  return result;
}

async function request(path, options = {}) {
  const started = performance.now();
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const durationMs = performance.now() - started;
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { response, body, durationMs };
}

async function testHealth() {
  const { response, body, durationMs } = await request('/health');
  return record('API health', response.ok && body?.status === 'ok', durationMs, { status: response.status });
}

async function testCount() {
  const { response, body, durationMs } = await request('/product-cloud/count');
  return record('Full catalogue count', response.ok && Number(body?.count) > 0, durationMs, {
    status: response.status,
    count: Number(body?.count || 0),
  });
}

async function testPage(page, limit = 100, label = `Catalogue page ${page}`) {
  const { response, body, durationMs } = await request(`/product-cloud/page?page=${page}&limit=${limit}`);
  const products = Array.isArray(body?.products) ? body.products : [];
  const keys = products.map((product) => String(product.barcode || product.sku || product.id || '').replace(/[\s-]/g, '').toUpperCase());
  const uniqueKeys = new Set(keys.filter(Boolean));
  return record(label, response.ok && body?.page === page && products.length <= 100 && uniqueKeys.size === keys.filter(Boolean).length, durationMs, {
    status: response.status,
    returned: products.length,
    total: Number(body?.total || 0),
    duplicates: keys.filter(Boolean).length - uniqueKeys.size,
  });
}

async function testPageBoundary() {
  const first = await request('/product-cloud/page?page=1&limit=100');
  const second = await request('/product-cloud/page?page=2&limit=100');
  const firstKeys = new Set((first.body?.products || []).map((p) => String(p.barcode || p.sku || p.id || '').replace(/[\s-]/g, '').toUpperCase()));
  const secondKeys = new Set((second.body?.products || []).map((p) => String(p.barcode || p.sku || p.id || '').replace(/[\s-]/g, '').toUpperCase()));
  const overlap = [...firstKeys].filter((key) => key && secondKeys.has(key));
  return record('Page boundary uniqueness', first.response.ok && second.response.ok && overlap.length === 0, first.durationMs + second.durationMs, {
    overlap: overlap.length,
    firstCount: first.body?.products?.length || 0,
    secondCount: second.body?.products?.length || 0,
  });
}

async function testSearch() {
  const { response, body, durationMs } = await request('/product-cloud/page?page=1&limit=100&query=milk');
  const products = Array.isArray(body?.products) ? body.products : [];
  const matching = products.every((product) => JSON.stringify(product).toLowerCase().includes('milk'));
  return record('Catalogue search pagination', response.ok && matching && Number(body?.total || 0) >= products.length, durationMs, {
    status: response.status,
    returned: products.length,
    matches: Number(body?.total || 0),
  });
}

async function testImportGuard() {
  if (runImport) return null;
  const { response, body, durationMs } = await request('/product-cloud/import-loyaltyhub-catalog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offset: 0, limit: 100 }),
  });
  return record('Import authorization guard', response.status === 403, durationMs, { status: response.status, message: body?.error || '' });
}

async function testImportBatch() {
  if (!runImport) return null;
  if (!authToken) throw new Error('--run-import requires PLATFORM_AUTH_TOKEN');
  const { response, body, durationMs } = await request('/product-cloud/import-loyaltyhub-catalog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offset: 0, limit: 100 }),
  });
  return record('LoyaltyHub import batch', response.ok && body?.success === true && Number(body?.imported) >= 0, durationMs, {
    status: response.status,
    discovered: Number(body?.discovered || 0),
    imported: Number(body?.imported || 0),
    hasMore: Boolean(body?.hasMore),
  });
}

async function main() {
  const started = performance.now();
  let fatal = null;
  try {
    await testHealth();
    await testCount();
    await testPage(1);
    await testPage(2);
    await testPage(21, 100, 'Catalogue page beyond original 2,000-row window');
    await testPageBoundary();
    await testSearch();
    await testImportGuard();
    await testImportBatch();
  } catch (error) {
    fatal = error?.message || String(error);
    console.error(`FAIL harness (${fatal})`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    mode: runImport ? 'read + import integration' : 'read-only smoke/performance',
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    passed: !fatal && results.every((result) => result.passed),
    totals: {
      tests: results.length,
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length,
    },
    results,
    fatal,
  };
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/platform-latest.json', JSON.stringify(report, null, 2));
  console.log(`\n${report.passed ? 'PASS' : 'FAIL'} ${report.totals.passed}/${report.totals.tests} tests · ${report.durationMs}ms`);
  console.log('Report: test-results/platform-latest.json');
  process.exitCode = report.passed ? 0 : 1;
}

main();
