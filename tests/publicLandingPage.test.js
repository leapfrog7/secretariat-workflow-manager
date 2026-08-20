import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('signed-out users land on the public product homepage without losing account flows', () => {
  const gate = source('src/components/auth/AccessGate.jsx');
  const homepage = source('src/pages/PublicLandingPage.jsx');

  assert.match(gate, /if \(!auth\.user\) return <PublicLandingPage/);
  assert.match(homepage, /Move official work from receipt to resolution/);
  assert.match(homepage, /Monitor what matters/);
  assert.match(homepage, /Collaborate with control/);
  assert.match(homepage, /Manage the full lifecycle/);
  assert.match(homepage, /auth\.signIn/);
  assert.match(homepage, /auth\.signUp/);
  assert.match(homepage, /auth\.requestPasswordReset/);
  assert.match(homepage, /auth\.resetPassword/);
});

test('homepage navigation is safe for the application hash router', () => {
  const homepage = source('src/pages/PublicLandingPage.jsx');

  assert.match(homepage, /scrollIntoView/);
  assert.doesNotMatch(homepage, /href="#(?:home|why-swm|workflow|trust)"/);
});

test('homepage and account dialog include responsive and accessible interaction contracts', () => {
  const homepage = source('src/pages/PublicLandingPage.jsx');
  const styles = source('src/index.css');

  assert.match(homepage, /role="dialog"/);
  assert.match(homepage, /aria-modal="true"/);
  assert.match(homepage, /rounded-t-3xl/);
  assert.match(homepage, /sm:rounded-2xl/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /public-home-rise/);
});

test('the first-login welcome banner is removed from the application shell', () => {
  const shell = source('src/layouts/AppShell.jsx');
  const bannerPath = new URL('../src/components/common/WelcomeBanner.jsx', import.meta.url);

  assert.doesNotMatch(shell, /WelcomeBanner/);
  assert.equal(existsSync(bannerPath), false);
});
