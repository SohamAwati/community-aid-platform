const postgres = require('postgres');
const assert = require('node:assert/strict');
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, prepare: false });
async function main() {
 try {
  const functions=await sql`select proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`;
  const defs=new Map(functions.map(f=>[f.proname,f.definition]));
  const rules=[
   ['NGO signup role preserved','handle_new_user',/INSERT INTO public.user_roles/i],
   ['Verified NGO required for publication','validate_opportunity_write',/status='verified'/],
   ['NGO cannot self-verify','guard_ngo_verification',/has_role\(auth.uid\(\),'super_admin'\)/],
   ['Application deadline enforced','guard_application_write',/application_deadline<=now\(\)/],
   ['Capacity guarded under opportunity lock','guard_application_write',/FOR UPDATE/],
   ['Capacity counts pending, accepted, completed','guard_application_write',/occupied>=o.slots/],
   ['Acceptance and rejection notifications installed','notify_application_decision',/NEW.status IN \('accepted','rejected'\)/],
   ['Report moderation requires super admin','review_report',/has_role\(auth.uid\(\),'super_admin'\)/],
  ];
  for(const [label,name,pattern] of rules){assert.match(defs.get(name)??'',pattern);console.log('PASS installed rule: '+label)}
  const triggers=await sql`select tgname from pg_trigger where not tgisinternal`;
  for(const name of ['acceptance_opportunity_guard','acceptance_application_guard','acceptance_decision_notification','acceptance_ngo_verification_guard'])assert.ok(triggers.some(t=>t.tgname===name));
  console.log('PASS all four workflow triggers attached');
  const access=(await sql`select has_column_privilege('authenticated','public.profiles','phone','SELECT') private_read,has_table_privilege('authenticated','public.reports','SELECT') report_read`)[0];
  assert.equal(access.private_read,false);assert.equal(access.report_read,true);console.log('PASS private profile column grants and report access');
  console.log('10 database structure checks passed (not authenticated behavioral tests)');
 } finally {await sql.end()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
