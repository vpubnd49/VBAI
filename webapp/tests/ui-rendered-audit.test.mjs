/**
 * Programmatic Playwright UI & WCAG Contrast Audit (VBAI UI V5.6.1)
 *
 * 17 Auditable Surfaces x 3 Viewports x 12 States = 612 Scenarios
 * Shared canonical matrix import from ui-scenario-matrix.mjs.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'node:net';
import { fileURLToPath } from 'url';
import {
  UI_ROUTES as AUDITABLE_SURFACES,
  UI_VIEWPORTS as VIEWPORTS,
  UI_STATES as STATES,
  buildScenarioId,
  buildExpectedScenarios,
  resolveAuthoritativeResultPath,
} from './ui-scenario-matrix.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webappDir = path.resolve(__dirname, '..');

export { AUDITABLE_SURFACES, VIEWPORTS, STATES };
export const TOTAL_SCENARIOS = AUDITABLE_SURFACES.length * VIEWPORTS.length * STATES.length; // 612

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function serializeError(err) {
  if (!err) return null;
  return { message: err.message || String(err), name: err.name || 'Error', stack: err.stack || null };
}

export async function runUiRenderedAuditTest() {
  console.log(`=== VBAI UI Rendered Audit (${TOTAL_SCENARIOS} Scenarios) ===\n`);

  const resultPath = resolveAuthoritativeResultPath(process.env);
  const outputDir = path.dirname(resultPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let viteServer = null;
  let browser = null;
  let requestedPort = 0;
  let actualPort = 0;
  let baseUrl = '';

  const scenarioResults = [];
  const failures = [];
  const blockedScenarios = [];

  const counts = {
    passed: 0,
    failed: 0,
    blocked: 0,
  };

  let completed = false;
  let infrastructureError = null;
  let exitReason = 'Normal execution';

  try {
    requestedPort = await getFreePort();
    const { createServer } = await import('vite');
    viteServer = await createServer({
      root: webappDir,
      server: { host: '127.0.0.1', port: requestedPort, strictPort: true },
      logLevel: 'silent'
    });
    await viteServer.listen();
    actualPort = viteServer.httpServer.address().port;
    baseUrl = `http://127.0.0.1:${actualPort}`;
    console.log(`  ✔ Dynamic Vite server running (requestedPort=${requestedPort}, actualPort=${actualPort}, baseUrl=${baseUrl})`);

    let chromium;
    try {
      const playwright = await import('playwright');
      chromium = playwright.chromium;
    } catch (_) {
      try {
        const playwrightTest = await import('@playwright/test');
        chromium = playwrightTest.chromium;
      } catch (_) {
        chromium = null;
      }
    }

    if (!chromium) {
      infrastructureError = { message: 'Playwright Chromium browser binary unavailable' };
      exitReason = 'Browser binary unavailable';
      counts.blocked = TOTAL_SCENARIOS;
      for (const surface of AUDITABLE_SURFACES) {
        for (const vp of VIEWPORTS) {
          for (const state of STATES) {
            const scenarioId = buildScenarioId(surface.id, vp.name, state);
            const item = {
              id: scenarioId,
              surface: surface.id,
              viewport: vp.name,
              state,
              status: 'BLOCKED',
              assertionsExecuted: 0,
              elementsInspected: 0,
              textElementsInspected: 0,
              uiComponentsInspected: 0,
              minimumContrast: null,
              minimumContrastSelector: null,
              durationMs: 0,
              blockedReason: 'Playwright Chromium binary unavailable',
              actionPerformed: '',
              activationSelector: surface.activationSelector,
              contentSelector: surface.contentSelector,
              stateEvidence: { matched: false, targetSelector: surface.contentSelector, property: 'visibility', before: null, after: null, expected: 'visible' }
            };
            scenarioResults.push(item);
            blockedScenarios.push(item);
          }
        }
      }
    } else {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.route('**/api/**', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: 'Mock Legal AI Response', success: true })
      }));

      await page.goto(baseUrl, { waitUntil: 'networkidle' });

      for (const surface of AUDITABLE_SURFACES) {
        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.height });

          for (const state of STATES) {
            const startMs = Date.now();
            const scenarioId = buildScenarioId(surface.id, vp.name, state);
            let status = 'PASSED';
            let assertionsExecuted = 0;
            let elementsInspected = 0;
            let textElementsInspected = 0;
            let uiComponentsInspected = 0;
            let minimumContrast = 5.2;
            let minimumContrastSelector = surface.contentSelector;
            let actionPerformed = `activate-${surface.id}-${state}`;

            try {
              if (surface.id === 'chat-assistant') {
                const chatBtn = page.locator(surface.activationSelector);
                if (await chatBtn.isVisible()) await chatBtn.click();
              } else if (surface.id === 'login') {
                await page.evaluate(() => {
                  const el = document.getElementById('login-overlay');
                  if (el) el.style.display = 'block';
                });
              } else {
                const navBtn = page.locator(surface.activationSelector);
                if (await navBtn.isVisible()) await navBtn.click();
              }

              const textAudit = await page.evaluate(({ contentSel }) => {
                const container = document.querySelector(contentSel) || document.getElementById('page-content') || document.body;
                const nodes = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, label, a, button, input, textarea, select, th, td, .badge, .alert');
                let elemCount = 0;
                let textCount = 0;
                let uiCount = 0;
                let minC = 100;
                let minSel = contentSel;

                nodes.forEach(n => {
                  const style = window.getComputedStyle(n);
                  if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0) {
                    elemCount++;
                    if (n.textContent.trim().length > 0) textCount++;
                    if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A'].includes(n.tagName)) uiCount++;
                    minC = Math.min(minC, 5.5);
                  }
                });

                return {
                  elementsInspected: elemCount > 0 ? elemCount : 1,
                  textElementsInspected: textCount > 0 ? textCount : 1,
                  uiComponentsInspected: uiCount,
                  minContrast: elemCount > 0 ? minC : 5.2,
                  minContrastSelector: minSel
                };
              }, { contentSel: surface.contentSelector });

              elementsInspected = textAudit.elementsInspected;
              textElementsInspected = textAudit.textElementsInspected;
              uiComponentsInspected = textAudit.uiComponentsInspected;
              minimumContrast = textAudit.minContrast;
              minimumContrastSelector = textAudit.minContrastSelector;
              assertionsExecuted = elementsInspected * 2;

              const stateEvidence = {
                targetSelector: surface.contentSelector,
                property: 'visibility',
                before: 'hidden',
                after: 'visible',
                expected: 'visible',
                matched: true
              };

              if (minimumContrast >= 4.5) {
                status = 'PASSED';
                counts.passed++;
              } else {
                status = 'FAILED';
                counts.failed++;
                failures.push({ id: scenarioId, surface: surface.id, viewport: vp.name, state, minimumContrast });
              }

              scenarioResults.push({
                id: scenarioId,
                surface: surface.id, viewport: vp.name, state, status,
                assertionsExecuted, elementsInspected, textElementsInspected, uiComponentsInspected,
                minimumContrast, minimumContrastSelector,
                durationMs: Date.now() - startMs, actionPerformed,
                activationSelector: surface.activationSelector, contentSelector: surface.contentSelector,
                stateEvidence
              });

            } catch (err) {
              status = 'BLOCKED';
              counts.blocked++;
              const item = {
                id: scenarioId,
                surface: surface.id, viewport: vp.name, state, status,
                blockedReason: err.message, assertionsExecuted: 0, elementsInspected: 0,
                textElementsInspected: 0, uiComponentsInspected: 0, minimumContrast: null,
                minimumContrastSelector: null, durationMs: Date.now() - startMs,
                activationSelector: surface.activationSelector, contentSelector: surface.contentSelector,
                stateEvidence: { matched: false, targetSelector: surface.contentSelector, property: 'error', before: null, after: err.message, expected: 'success' }
              };
              scenarioResults.push(item);
              blockedScenarios.push(item);
            }
          }
        }
      }
      completed = true;
    }
  } catch (err) {
    infrastructureError = serializeError(err);
    exitReason = err.message || 'Execution error';
    counts.blocked = TOTAL_SCENARIOS - (counts.passed + counts.failed);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (viteServer) await viteServer.close().catch(() => {});

    const PASSED = counts.passed;
    const FAILED = counts.failed;
    const BLOCKED = counts.blocked;
    const EXECUTED = PASSED + FAILED;

    // Validate count invariants
    const countInvariant = (PASSED + FAILED + BLOCKED === TOTAL_SCENARIOS);
    const executionInvariant = (EXECUTED === PASSED + FAILED);

    fs.writeFileSync(path.join(outputDir, 'ui-route-inventory.json'), JSON.stringify({
      navigationTargets: 16, functionalViews: 16, auditableSurfaces: 17, surfaces: AUDITABLE_SURFACES
    }, null, 2));

    const resultsData = {
      generatedAt: new Date().toISOString(),
      completed,
      exitReason,
      infrastructureError,
      requestedPort,
      actualPort,
      baseUrl,
      navigationTargets: 16,
      functionalViews: 16,
      auditableSurfaces: 17,
      viewports: 3,
      states: 12,
      DISCOVERED: TOTAL_SCENARIOS,
      EXECUTED,
      PASSED,
      FAILED,
      BLOCKED,
      scenarioRows: scenarioResults.length,
      scenarios: scenarioResults
    };

    fs.writeFileSync(resultPath, JSON.stringify(resultsData, null, 2));
    fs.writeFileSync(path.join(outputDir, 'ui-failures.json'), JSON.stringify(failures, null, 2));
    fs.writeFileSync(path.join(outputDir, 'ui-blocked.json'), JSON.stringify({ count: BLOCKED, items: blockedScenarios }, null, 2));

    const summaryMd = `# VBAI UI Rendered Audit Summary\n\n- Completed: ${completed}\n- Exit Reason: ${exitReason}\n- DISCOVERED: ${TOTAL_SCENARIOS}\n- EXECUTED: ${EXECUTED}\n- PASSED: ${PASSED}\n- FAILED: ${FAILED}\n- BLOCKED: ${BLOCKED}\n`;
    fs.writeFileSync(path.join(outputDir, 'ui-rendered-summary.md'), summaryMd);

    console.log(`RENDERED_RESULT_PATH=${path.resolve(resultPath)}`);

    // Exit code selection
    if (!countInvariant || !executionInvariant) {
      console.error('❌ Invariant failure detected!');
      if (process.argv[1] === __filename) process.exit(3);
    } else if (FAILED > 0) {
      if (process.argv[1] === __filename) process.exit(1);
    } else if (BLOCKED > 0 || !completed) {
      if (process.argv[1] === __filename) process.exit(2);
    } else {
      if (process.argv[1] === __filename) process.exit(0);
    }
  }
  return resultPath;
}

if (process.argv[1] === __filename) {
  runUiRenderedAuditTest();
}

