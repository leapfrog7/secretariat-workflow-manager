import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const register = readFileSync(
  new URL('../src/pages/IssueRegisterPage.jsx', import.meta.url),
  'utf8',
);

test('Issue register defers expensive filtering while keeping the search input immediate', () => {
  assert.match(register, /useDeferredValue\(filters\.query\)/);
  assert.match(register, /query: deferredQuery/);
  assert.match(register, /searchUpdating/);
});

test('Issue register loads communications only when source search is requested', () => {
  assert.match(register, /load\(\{ includeCommunications: false \}\)/);
  assert.match(
    register,
    /includeCommunications \? getAllCommunications\(\) : Promise\.resolve\(null\)/,
  );
  assert.match(
    register,
    /if \(hasSearchQuery\) loadCommunicationsForSearch\(\)/,
  );
  assert.match(
    register,
    /hasSearchQuery && data\.communicationsLoaded[\s\S]*getCommunicationSearchContext/,
  );
});

test('Current, Scheduled and Archived register modes share bounded pagination', () => {
  assert.match(register, /const REGISTER_PAGE_SIZES = \[25, 50, 100\]/);
  assert.match(
    register,
    /const pagedIssues = useMemo\(\(\) => \{[\s\S]*filtered\.slice\(start, start \+ registerPageSize\)/,
  );
  assert.match(register, /<RegisterPagination/);
  assert.doesNotMatch(
    register,
    /filters\.archiveMode === "Archived" && \(\s*<RegisterPagination/,
  );
});
