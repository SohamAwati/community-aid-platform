import { describe, expect, test } from 'bun:test';
import { applicationBlockReason, dateFilterBounds, validateOpportunity } from './workflow-rules';
const valid = { title: 'Teaching', description: 'Tutor students', slots: 2, hours_estimate: 4, min_age: 18, starts_at: '', ends_at: '', application_deadline: '', is_paid: false, stipend: '' };
describe('Opportunity rules', () => {
 test('valid required fields are accepted', () => expect(validateOpportunity(valid)).toBeNull());
 test('required title is enforced', () => expect(validateOpportunity({ ...valid, title: '' })).not.toBeNull());
 test('paid roles require pay details', () => expect(validateOpportunity({ ...valid, is_paid: true })).not.toBeNull());
 test('slots must be a positive integer', () => { expect(validateOpportunity({ ...valid, slots: 0 })).not.toBeNull(); expect(validateOpportunity({ ...valid, slots: 1.5 })).not.toBeNull(); });
 test('end cannot precede start', () => expect(validateOpportunity({ ...valid, starts_at: '2026-11-02', ends_at: '2026-11-01' })).not.toBeNull());
});
describe('Application rules', () => {
 const now = Date.parse('2026-10-18T12:00:00Z');
 test('open deadline and available slot allow application', () => expect(applicationBlockReason('published','2026-10-19T12:00:00Z',1,now)).toBeNull());
 test('expired deadline prevents application', () => expect(applicationBlockReason('published','2026-10-17T12:00:00Z',1,now)).not.toBeNull());
 test('no remaining slots prevents application', () => expect(applicationBlockReason('published',null,0,now)).not.toBeNull());
 test('drafts do not accept applications', () => expect(applicationBlockReason('draft',null,1,now)).not.toBeNull());
 test('date search includes entire final day', () => { const b=dateFilterBounds('2026-10-18','2026-10-18'); expect(new Date(b.from ?? '').getHours()).toBe(0); expect(new Date(b.to ?? '').getHours()).toBe(23); expect(new Date(b.to ?? '').getMilliseconds()).toBe(999); });
});
