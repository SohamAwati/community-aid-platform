import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { applicationBlockReason, dateFilterBounds, validateOpportunity } from './workflow-rules.js';

const now = Date.parse('2026-10-18T12:00:00Z');
const futureDate = '2026-11-01T10:00';
const laterFutureDate = '2026-11-02T10:00';
const pastDate = '2026-10-10T10:00';

const valid = {
  title: 'Teaching',
  description: 'Tutor students',
  slots: 2,
  hours_estimate: 4,
  min_age: 18,
  starts_at: '',
  ends_at: '',
  application_deadline: '',
  is_paid: false,
  stipend: '',
};

describe('Opportunity rules', () => {
  test('valid required fields are accepted', () => {
    assert.equal(validateOpportunity(valid, false, now), null);
  });

  test('required title is enforced', () => {
    assert.notEqual(validateOpportunity({ ...valid, title: '' }, false, now), null);
  });

  test('paid roles require pay details', () => {
    assert.notEqual(validateOpportunity({ ...valid, is_paid: true }, false, now), null);
  });

  test('slots must be a positive integer', () => {
    assert.notEqual(validateOpportunity({ ...valid, slots: 0 }, false, now), null);
    assert.notEqual(validateOpportunity({ ...valid, slots: 1.5 }, false, now), null);
  });

  test('end cannot precede start', () => {
    assert.notEqual(
      validateOpportunity({ ...valid, starts_at: laterFutureDate, ends_at: futureDate }, false, now),
      null
    );
  });

  test('start date cannot be in the past when creating', () => {
    assert.notEqual(
      validateOpportunity({ ...valid, starts_at: pastDate, ends_at: futureDate }, false, now),
      null
    );
  });

  test('end date cannot be in the past', () => {
    assert.notEqual(
      validateOpportunity({ ...valid, starts_at: pastDate, ends_at: pastDate }, false, now),
      null
    );
  });

  test('deadline cannot be past or after start', () => {
    assert.notEqual(
      validateOpportunity({ ...valid, starts_at: futureDate, ends_at: laterFutureDate, application_deadline: '2026-10-10' }, false, now),
      null
    );
    assert.notEqual(
      validateOpportunity({ ...valid, starts_at: futureDate, ends_at: laterFutureDate, application_deadline: '2026-11-05' }, false, now),
      null
    );
  });
});

describe('Application rules', () => {
  test('open deadline and available slot allow application', () => {
    assert.equal(applicationBlockReason('published', '2026-10-19T12:00:00Z', 1, now), null);
  });

  test('expired deadline prevents application', () => {
    assert.notEqual(applicationBlockReason('published', '2026-10-17T12:00:00Z', 1, now), null);
  });

  test('no remaining slots prevents application', () => {
    assert.notEqual(applicationBlockReason('published', null, 0, now), null);
  });

  test('drafts do not accept applications', () => {
    assert.notEqual(applicationBlockReason('draft', null, 1, now), null);
  });

  test('date search includes entire final day', () => {
    const b = dateFilterBounds('2026-10-18', '2026-10-18');
    assert.equal(new Date(b.from ?? '').getHours(), 0);
    assert.equal(new Date(b.to ?? '').getHours(), 23);
    assert.equal(new Date(b.to ?? '').getMilliseconds(), 999);
  });
});
