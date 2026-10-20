import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, parseFlags, suggestions } from '../src/commands.js';
import { byCli, validateInput, needsConfirmation } from '../src/tools.js';

test('Tab completion matches a real built-in post command', () => {
  assert.deepEqual(suggestions('/cre', ['/create-post', '/posts']), ['/create-post']);
});
test('quoted captions and arrays survive terminal parsing', () => {
  const [, ...tokens] = tokenize(`/create-post --caption "Hello creators" --platforms '["facebook"]'`);
  assert.deepEqual(parseFlags(tokens, byCli['create-post']), { caption: 'Hello creators', platforms: ['facebook'] });
});
test('upgraded aliases preserve caption and timestamp values', () => {
  assert.deepEqual(parseFlags(['--content','001','--scheduledAt','2027-01-15T09:00:00Z'], byCli['create-post']), { caption: '001', scheduled_at: '2027-01-15T09:00:00Z' });
});
test('publishing requires explicit confirmation', () => {
  assert.equal(needsConfirmation(byCli.publish, { post_id: 'p1' }), true);
});
test('read-only channels need no mutation confirmation', () => {
  assert.equal(needsConfirmation(byCli.channels, {}), false);
});
test('draft creation does not silently request immediate publishing', () => {
  const args = validateInput(byCli['create-post'], { caption: 'Hello', platforms: ['facebook'] });
  assert.equal(args.publish_now, undefined); assert.equal(args.schedule_mode, undefined);
});
test('unknown command fields are rejected rather than ignored', () => {
  assert.throws(() => parseFlags(['--channels', '["id"]'], byCli['create-post']), /Unknown flag/);
});
test('time schedule requires a timestamp', () => {
  assert.throws(() => validateInput(byCli.schedule, { post_id: 'p1', mode: 'time' }), /scheduled_at is required/);
});
test('past dates cannot be scheduled', () => {
  assert.throws(() => validateInput(byCli.schedule, { post_id: 'p1', scheduled_at: '2020-01-01T10:00:00Z' }), /future ISO/);
});
test('future schedule must specify timezone', () => {
  assert.throws(() => validateInput(byCli.schedule, { post_id: 'p1', scheduled_at: '2099-01-01T10:00:00' }), /timezone/);
});
