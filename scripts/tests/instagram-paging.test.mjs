import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPages } from '../../supabase/functions/instagram/paging.ts';

test('continues after an empty page and deduplicates messages', async () => {
  const calls = [];
  const pages = [
    { data: [], paging: { next: 'https://graph.instagram.com/x?after=first&access_token=private' } },
    { data: [{ id: '1' }], paging: { cursors: { after: 'second' }, next: 'https://graph.instagram.com/x' } },
    { data: [{ id: '1' }, { id: '2' }] },
  ];
  const result = await readPages(async after => { calls.push(after); return pages.shift(); });
  assert.deepEqual(calls, [undefined, 'first', 'second']);
  assert.deepEqual(result, { data: [{ id: '1' }, { id: '2' }], hasMore: false });
});

test('bounds work and reports partial results instead of claiming a full sync', async () => {
  let calls = 0;
  const result = await readPages(async () => ({ data: [{ id: String(++calls) }], paging: { next: `https://example.com/?after=${calls}` } }), 2);
  assert.equal(calls, 2);
  assert.equal(result.hasMore, true);
});

test('stops a repeated cursor without dropping existing results', async () => {
  let calls = 0;
  const result = await readPages(async () => { calls++; return { data: [{ id: '1' }], paging: { next: 'https://example.com/?after=same' } }; });
  assert.equal(calls, 2);
  assert.deepEqual(result.data, [{ id: '1' }]);
  assert.equal(result.hasMore, true);
});
