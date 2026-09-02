import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Accessibility regression suite — one guard per defect found and fixed in the FIGM application's
 * own accessibility pass (FIGM is itself an accessibility-oriented static analysis tool, so its
 * own UI is held to the same WCAG 2.2 AA bar it enforces on scanned code).
 *
 * This project has no jsdom/testing-library/playwright dependency (a deliberate, established
 * choice throughout this codebase — see tests/live-scan-e2e.test.ts and
 * tests/anti-hardcoding-guard.test.ts for the same convention), so these are source-level
 * regression guards: each one reads the real component/CSS source and asserts the specific
 * structural fix is still present. This catches the exact failure mode of a future edit silently
 * reverting a fix (e.g. someone "cleaning up" a button back into a div, or a color back to its
 * sub-AA value) even though it cannot compute rendered contrast or run a live screen reader.
 * `tests/live-scan-e2e.test.ts` already establishes the pattern of testing real route handlers
 * directly for behavioral coverage; this file complements it for these specific UI/markup defects.
 */

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

/**
 * Every password field across the app renders through the shared <PasswordField> component
 * (app/components/PasswordField.tsx) rather than a raw <input>, so its label/id/aria-label
 * markup lives in that one file, not duplicated per page -- a page's own source no longer
 * contains a literal `htmlFor="..."` for a password field. The dedicated structural test below
 * verifies PasswordField.tsx itself correctly associates its label with its input; this helper
 * lets each page-level test count `<PasswordField id="...">` usages as real labeled fields
 * (by the `id` prop that becomes that component's own `htmlFor`/input `id`) instead of expecting
 * to find that markup literally in the page.
 */
function extractPasswordFieldIds(src: string): string[] {
  const ids: string[] = [];
  const re = /<PasswordField\b([\s\S]*?)\/>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) {
    const idMatch = match[1].match(/\sid="([^"]+)"/);
    if (idMatch) ids.push(idMatch[1]);
  }
  return ids;
}

test('app/components/PasswordField.tsx correctly associates its label and aria-label with its input', () => {
  const src = read('app/components/PasswordField.tsx');
  assert.match(src, /htmlFor=\{id\}/, 'the built-in label must be associated to the input via the same `id` prop');
  assert.match(src, /\bid=\{id\}\s/, 'the input must expose that same `id` prop');
  assert.match(src, /aria-label=\{label\}/, 'the input must always carry an aria-label (belt-and-suspenders even when a visible <label> is also rendered, and the only accessible name when hideLabel is set)');
  assert.match(src, /!hideLabel/, 'the visible <label> must be conditionally suppressible via hideLabel, for designs that never had one');
  assert.match(src, /type=\{visible \? 'text' : 'password'\}/, 'must render as a real password input by default, toggling to text only when revealed');
});

test('Accessibility regression: app/login/page.tsx redirects to the canonical /auth/login', async (t) => {
  // /login was a duplicate of /auth/login (different implementation -- plain localStorage token
  // storage instead of the httpOnly cookie the rest of the app relies on, and no real logout
  // wiring anywhere pointed at it). It's now a permanent redirect to the canonical page rather
  // than a second, divergent implementation of the same form -- see the batch-7 fix. The
  // accessibility assertions that used to target this file now target the two canonical pages
  // below (app/auth/login, app/auth/register), which received the same fixes.
  await t.test('redirects to /auth/login rather than rendering its own form', () => {
    const src = read('app/login/page.tsx');
    assert.match(src, /redirect\('\/auth\/login'\)/, 'the duplicate /login route must redirect to the canonical /auth/login, not render a second form');
  });
});

for (const [routeLabel, filePath, expectedLabeledFields] of [
  ['app/auth/login/page.tsx', 'app/auth/login/page.tsx', 2],
  // Was 4 before app/auth/register/page.tsx gained a required Confirm Password field (password
  // policy hardening) -- fullName, email, role, password, confirm password.
  ['app/auth/register/page.tsx', 'app/auth/register/page.tsx', 5],
] as const) {
  test(`Accessibility regression: ${routeLabel} (canonical auth page)`, async (t) => {
    const src = read(filePath);

    await t.test('every label has a matching htmlFor/id pair (unique IDs, real association)', () => {
      // A <PasswordField id="..."> call site is itself a JSX prop that textually looks just like a
      // real DOM `id="..."` attribute -- stripped out first so it isn't double-counted once here
      // (as a generic id) and again via extractPasswordFieldIds below.
      const srcWithoutPasswordFields = src.replace(/<PasswordField\b[\s\S]*?\/>/g, '');
      const labelFors = [...srcWithoutPasswordFields.matchAll(/htmlFor="([^"]+)"/g)].map((m) => m[1]);
      const inputIds = [...srcWithoutPasswordFields.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      const passwordFieldIds = extractPasswordFieldIds(src);
      const totalLabeledFields = labelFors.length + passwordFieldIds.length;
      assert.equal(
        totalLabeledFields,
        expectedLabeledFields,
        `expected ${expectedLabeledFields} labeled fields, found ${totalLabeledFields} (${labelFors.length} native + ${passwordFieldIds.length} PasswordField)`
      );
      for (const forId of labelFors) {
        assert.ok(inputIds.includes(forId), `label htmlFor="${forId}" has no matching input id="${forId}"`);
      }
      const allIds = [...inputIds, ...passwordFieldIds];
      assert.equal(new Set(allIds).size, allIds.length, 'input ids must be unique');
    });

    await t.test('the error message is announced (role="alert") and focus-manageable', () => {
      assert.match(src, /role="alert"/, 'error notice must use role="alert" so it is announced when it appears');
      assert.match(src, /errorRef\.current\?\.focus\(\)/, 'focus must move to the error region when a new error appears');
    });

    await t.test('the page has exactly one top-level heading (h1), not h2', () => {
      const h1Count = (src.match(/<h1[\s>]/g) || []).length;
      assert.equal(h1Count, 1, 'auth page must have exactly one <h1>');
    });

    await t.test('every form control (input/select) uses the shared .input-field class (real :focus border/box-shadow), not raw inline styles with no focus replacement', () => {
      // Every input/select previously set outline:none inline with no replacement at all -- a
      // WCAG 2.4.7 (Focus Visible) violation on what is actually the live, canonical auth page
      // (unlike the old app/login/page.tsx duplicate, which already had this fix but was never
      // the page real users were routed through by middleware.ts/most links).
      const controlCount = (src.match(/<input\b/g) || []).length + (src.match(/<select\b/g) || []).length;
      const inputFieldCount = (src.match(/className="input-field"/g) || []).length;
      assert.equal(inputFieldCount, controlCount, `expected all ${controlCount} form controls to use className="input-field", found ${inputFieldCount}`);
    });
  });
}

test('Accessibility regression: app/notifications/page.tsx', async (t) => {
  const src = read('app/notifications/page.tsx');

  await t.test('notification items are real <button> elements, not a clickable <div>', () => {
    assert.equal(/<div\s+key=\{n\.id\}\s*\n\s*onClick/.test(src), false, 'must not regress to a bare clickable div with no keyboard/role semantics');
    assert.match(src, /<button\s/, 'notification items must render as real <button> elements');
    assert.match(src, /aria-label=\{`\$\{n\.read/, 'each notification button must have a descriptive aria-label');
  });

  await t.test('the loading state is announced via role="status"', () => {
    assert.match(src, /role="status"/);
  });
});

test('Accessibility regression: app/user-study/page.tsx', async (t) => {
  const src = read('app/user-study/page.tsx');

  await t.test('task-selector cards are real <button> elements with aria-pressed, not a clickable <div>', () => {
    assert.equal(/<div\s*\n\s*key=\{t\.num\}\s*\n\s*onClick/.test(src), false, 'must not regress to a bare clickable div for task selection');
    assert.match(src, /aria-pressed=\{activeTask === t\.num\}/);
  });

  await t.test('the scan-result outcome is announced via role="status"', () => {
    assert.match(src, /<span role="status">/);
  });
});

test('Accessibility regression: mobile/tablet navigation drawer', async (t) => {
  const appShellSrc = read('app/AppShell.tsx');
  const sidebarSrc = read('app/Sidebar.tsx');
  const headerSrc = read('app/HeaderBar.tsx');
  const cssSrc = read('app/globals.css');

  await t.test('AppShell owns shared sidebarOpen state and closes on Escape, returning focus to the trigger', () => {
    assert.match(appShellSrc, /useState\(false\)/);
    assert.match(appShellSrc, /e\.key === 'Escape'/, 'Escape must close the drawer');
    assert.match(appShellSrc, /menuButtonRef\.current\?\.focus\(\)/, 'closing must return focus to the hamburger trigger, not strand it');
  });

  await t.test('a backdrop exists and closing it closes the drawer', () => {
    assert.match(appShellSrc, /className="sidebar-backdrop"/);
    assert.match(appShellSrc, /onClick=\{closeSidebar\}/);
  });

  await t.test('Sidebar actually applies the sidebar-open class conditionally (the CSS class is no longer dead)', () => {
    assert.match(sidebarSrc, /className=\{`sidebar-desktop\$\{isOpen \? ' sidebar-open' : ''\}`\}/);
  });

  await t.test('Sidebar traps Tab focus within the drawer while open and auto-focuses the first link on open', () => {
    assert.match(sidebarSrc, /firstLinkRef\.current\?\.focus\(\)/);
    assert.match(sidebarSrc, /e\.key !== 'Tab'/);
    assert.match(sidebarSrc, /e\.shiftKey && document\.activeElement === first/);
  });

  await t.test('navigation links are wrapped in a real <nav aria-label> landmark', () => {
    assert.match(sidebarSrc, /<nav aria-label="Primary">/);
  });

  await t.test('nav links close the drawer on click (so navigating collapses the mobile menu)', () => {
    assert.match(sidebarSrc, /onClick=\{onClose\}/);
  });

  await t.test('HeaderBar renders an accessible hamburger trigger with aria-expanded/aria-controls', () => {
    assert.match(headerSrc, /className="mobile-menu-toggle"/);
    assert.match(headerSrc, /aria-expanded=\{sidebarOpen\}/);
    assert.match(headerSrc, /aria-controls="primary-navigation"/);
  });

  await t.test('globals.css defines the toggle/backdrop/close-button rules the components rely on', () => {
    assert.match(cssSrc, /\.mobile-menu-toggle\s*\{/);
    assert.match(cssSrc, /\.sidebar-backdrop\s*\{/);
    assert.match(cssSrc, /\.sidebar-close-btn\s*\{/);
    assert.match(cssSrc, /\.sidebar-desktop\.sidebar-open\s*\{/, 'the previously-dead .sidebar-open rule must still exist and now have a real producer');
  });
});

test('Accessibility regression: contrast', async (t) => {
  const cssSrc = read('app/globals.css');

  await t.test('the sub-AA --text-dim value (#64748b, ~4.23:1 on the app\'s dark backgrounds) is not reintroduced', () => {
    assert.equal(/#64748b/i.test(cssSrc), false, 'the retired sub-AA text color must not reappear in globals.css');
  });

  await t.test('no .tsx file under app/ reintroduces the retired sub-AA color literal', () => {
    const appDir = path.resolve(process.cwd(), 'app');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.tsx') && /#64748b/i.test(fs.readFileSync(full, 'utf-8'))) {
          offenders.push(path.relative(process.cwd(), full));
        }
      }
    };
    walk(appDir);
    assert.deepEqual(offenders, [], `sub-AA color #64748b must not appear in: ${offenders.join(', ')}`);
  });

  await t.test('--text-dim is defined and updated to a value that was verified to clear 4.5:1 against the app\'s dark surfaces', () => {
    assert.match(cssSrc, /--text-dim:\s*#7c8ba6/);
  });
});

test('Accessibility regression: prefers-reduced-motion', async (t) => {
  const cssSrc = read('app/globals.css');

  await t.test('a prefers-reduced-motion: reduce block exists and neutralizes animation/transition duration', () => {
    assert.match(cssSrc, /@media \(prefers-reduced-motion: reduce\)/);
    const block = cssSrc.split('@media (prefers-reduced-motion: reduce)')[1] || '';
    assert.match(block, /animation-duration:\s*0\.01ms\s*!important/);
    assert.match(block, /transition-duration:\s*0\.01ms\s*!important/);
  });
});

test('Accessibility regression: semantic landmarks', async (t) => {
  await t.test('AppShell renders a real <main> landmark', () => {
    assert.match(read('app/AppShell.tsx'), /<main className="main-container">/);
  });

  await t.test('HeaderBar renders a real <header> landmark', () => {
    assert.match(read('app/HeaderBar.tsx'), /<header className="header-bar-container">/);
  });

  await t.test('Sidebar renders a real <aside> containing a real <nav>', () => {
    const src = read('app/Sidebar.tsx');
    assert.match(src, /<aside/);
    assert.match(src, /<nav aria-label="Primary">/);
  });
});

test('Accessibility regression: theme control honesty', async (t) => {
  const src = read('app/settings/page.tsx');

  await t.test('the theme control no longer offers non-functional Light/System options', () => {
    assert.equal(/Light Minimal/.test(src), false, 'the non-functional "Light Minimal" option must not be reintroduced without also implementing real theme switching');
    assert.equal(/System Default/.test(src), false, 'the non-functional "System Default" option must not be reintroduced without also implementing real theme switching');
  });

  await t.test('the settings page is explicit that only Dark Glass is currently implemented', () => {
    assert.match(src, /not implemented yet/i);
  });
});

test('Accessibility regression: Cmd+K search modal has a real keyboard focus trap', async (t) => {
  const src = read('app/HeaderBar.tsx');

  await t.test('the dialog and its input/trigger are ref-tracked (required for a trap and focus restoration)', () => {
    assert.match(src, /searchDialogRef/, 'the dialog element must be ref-tracked so Tab/Shift+Tab can be bounded to its own focusable elements');
    assert.match(src, /searchInputRef/, 'the input must be ref-tracked so focus can move into the dialog programmatically on open');
    assert.match(src, /searchTriggerRef/, 'the trigger must be ref-tracked so focus can return to it on close');
  });

  await t.test('Tab/Shift+Tab wraps within the dialog instead of escaping to the page behind it', () => {
    assert.match(src, /e\.key !== 'Tab'/, 'a Tab handler must exist alongside the Escape handler');
    assert.match(src, /shiftKey && document\.activeElement === first/, 'Shift+Tab from the first focusable element must wrap to the last');
    assert.match(src, /!e\.shiftKey && document\.activeElement === last/, 'Tab from the last focusable element must wrap to the first');
  });

  await t.test('closing the modal (by any path) returns focus to the search trigger', () => {
    // The ref is captured into a local variable at effect-open time and that variable is what's
    // called in cleanup (not a live re-read of searchTriggerRef.current) -- an ESLint
    // react-hooks/exhaustive-deps fix for the same stale-ref-in-cleanup class of bug, functionally
    // equivalent for this always-mounted trigger element.
    assert.match(src, /const triggerEl = searchTriggerRef\.current/, 'the trigger ref must be captured before the dialog opens');
    assert.match(src, /triggerEl\?\.focus\(\)/, 'focus must be restored to the captured trigger element when the modal closes, not left on a removed element');
  });
});

test('Accessibility regression: Monaco live-scan editor has an accessible name', async (t) => {
  const src = read('app/live-scan/page.tsx');

  await t.test('the editor options include a real ariaLabel (the only supported way to name Monaco\'s internal input for screen readers)', () => {
    assert.match(src, /ariaLabel:\s*['"]/, 'Monaco renders its own hidden textarea as the actual focusable element -- a wrapping <div aria-label> has no effect on it, only the editor\'s own `ariaLabel` option does');
  });
});

test('Regression: the application requires authentication before showing the product', async (t) => {
  await t.test('middleware.ts no longer treats "/" as a public path', () => {
    const src = read('middleware.ts');
    assert.equal(
      /path === '\/'\s*\|\|/.test(src),
      false,
      '"/" must not be listed as a public path -- an unauthenticated visitor to the homepage must be redirected to /auth/login, not shown the app'
    );
    assert.match(src, /matcher: \['\/\(\(\?!/, 'the middleware matcher must be a negative (catch-all-except-static-assets) pattern, not a hand-maintained allow-list of protected routes -- the latter is exactly the gap that let most of the app render unauthenticated before this fix');
  });

  await t.test('AppShell renders the auth pages standalone, without the authenticated app\'s Sidebar/HeaderBar chrome', () => {
    const src = read('app/AppShell.tsx');
    assert.match(src, /isBareRoute/, 'AppShell must render public/pre-auth routes without the app chrome around them');
    assert.match(src, /pathname\.startsWith\('\/auth\/'\)/);
  });

  await t.test('the homepage renders the authenticated dashboard, not a public landing page', () => {
    const src = read('app/page.tsx');
    assert.match(src, /LiveDashboardContent/);
    assert.equal(/HeroSection/.test(src), false, 'the public landing/marketing content must not be shown at "/" -- it now lives at the public /about route');
  });
});

test('Accessibility regression: app/profile/page.tsx (user profile)', async (t) => {
  const src = read('app/profile/page.tsx');

  await t.test('has exactly one top-level heading (h1) -- the account-name heading is an h2, not a second h1', () => {
    const h1Count = (src.match(/<h1[\s>]/g) || []).length;
    assert.equal(h1Count, 1, 'exactly one <h1> ("My Profile") -- the fullName heading below it must be an <h2>');
    assert.match(src, /<h2[^>]*>\s*\{user\.fullName\}/, 'the account-name heading must be an <h2>, a subsection of the page\'s single <h1>');
  });

  await t.test('has the required page title and subtitle text', () => {
    assert.match(src, /My Profile/, 'page must have a literal "My Profile" title');
    assert.match(src, /Manage your personal account and activity\./, 'page must have the required subtitle');
  });

  await t.test('password fields and the API key field use real label/input association (htmlFor/id), not just visually-adjacent text', () => {
    const srcWithoutPasswordFields = src.replace(/<PasswordField\b[\s\S]*?\/>/g, '');
    const labelFors = [...srcWithoutPasswordFields.matchAll(/htmlFor="([^"]+)"/g)].map((m) => m[1]);
    const inputIds = [...srcWithoutPasswordFields.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const passwordFieldIds = extractPasswordFieldIds(src);
    const totalLabeledFields = labelFors.length + passwordFieldIds.length;
    assert.ok(
      totalLabeledFields >= 5,
      `expected at least 5 labeled fields (3 password via PasswordField + api key + theme), found ${totalLabeledFields}`
    );
    for (const forId of labelFors) {
      assert.ok(inputIds.includes(forId), `label htmlFor="${forId}" has no matching input/select id="${forId}"`);
    }
    const allIds = [...inputIds, ...passwordFieldIds];
    assert.equal(new Set(allIds).size, allIds.length, 'field ids must be unique');
  });

  await t.test('the delete-account confirmation has real dialog semantics: role, aria-modal, labelledby, focus trap, Escape-to-close, focus restoration', () => {
    assert.match(src, /role="dialog"/, 'the delete confirmation must be a real dialog, not an unlabeled positioned <div>');
    assert.match(src, /aria-modal="true"/);
    assert.match(src, /aria-labelledby="delete-account-modal-title"/);
    assert.match(src, /id="delete-account-modal-title"/, 'the referenced labelledby id must exist on the actual heading');
    assert.match(src, /e\.key === 'Escape'/, 'Escape must close the modal');
    assert.match(src, /deleteCancelRef\.current\?\.focus\(\)/, 'focus must move into the dialog (the Cancel button) when it opens');
    assert.match(src, /const triggerEl = deleteTriggerRef\.current/, 'the trigger ref must be captured at effect-run time, not read from inside the cleanup closure (stale-ref bug)');
    assert.match(src, /triggerEl\?\.focus\(\)/, 'focus must return to the trigger button when the dialog closes');
  });
});

test('Accessibility regression: app/admin/profile/page.tsx (admin profile)', async (t) => {
  const src = read('app/admin/profile/page.tsx');

  await t.test('has exactly one top-level heading (h1) -- the account-name heading is an h2, not a second h1', () => {
    const h1Count = (src.match(/<h1[\s>]/g) || []).length;
    assert.equal(h1Count, 1, 'exactly one <h1> ("Admin Profile") -- the fullName heading below it must be an <h2>');
    assert.match(src, /<h2[^>]*>\{user\.fullName\}/, 'the account-name heading must be an <h2>, a subsection of the page\'s single <h1>');
  });

  await t.test('has the required page title and subtitle text', () => {
    assert.match(src, /Admin Profile/, 'page must have a literal "Admin Profile" title');
    assert.match(src, /Manage your administrative account and security\./, 'page must have the required subtitle');
  });

  await t.test('the password-change fields keep their existing label association (now via the shared PasswordField component, which always carries an aria-label -- see its own dedicated structural test)', () => {
    const labels = (src.match(/label="(Current|New|Confirm new) password"/g) || []).length;
    assert.equal(labels, 3, 'all three password fields must be PasswordField usages naming them "Current/New/Confirm new password"');
    assert.match(src, /import PasswordField from/, 'must use the shared PasswordField component, not a raw <input type="password">');
  });
});
