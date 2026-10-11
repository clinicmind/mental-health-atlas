// Dependency-free tests of the exact selection helpers used by the application.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const prefix = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8').split('// BEGIN ATLAS APPLICATION')[0];
const helper = vm.runInNewContext(prefix + '\nVerifiedBudget;');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/verified_budget_observations.json'), 'utf8'));
const rows = data.observations;
assert.equal(rows.length, 18);
assert.equal(new Set(rows.map(r => r.observation_id)).size, 18);
const before = JSON.stringify(rows);
const hk = helper.select(rows, { region: 'HK', status: 'reported_expenditure', year: 'all' });
assert.equal(hk.length, 8);
assert(hk.every(r => r.currency === 'HKD' && r.unit === 'million'));
assert.equal(helper.select(rows, { region: 'MO', status: 'all', year: 'all' }).length, 0);
const y2018 = helper.select(rows, { region: 'HK', status: 'all', year: '2018' });
assert.equal(y2018.length, 2); // estimate and later reported cost: retained, not summed.
assert.deepEqual(y2018.map(r => r.value).sort((a,b) => a-b), [5051, 5074]);
const tw = helper.select(rows, { region: 'TW', status: 'enacted_budget', year: '2025' });
assert.equal(tw.length, 1); assert.equal(tw[0].value, 871583);
const groups = helper.groups(helper.select(rows, { region: 'all', status: 'all', year: 'all' }));
assert.equal(groups.length, 5);
for (const group of groups) assert.equal(new Set(group.map(r => JSON.stringify(r.series_key))).size, 1);
const fixture = { ...rows[0], observation_id: 'missing-fixture', value: null };
assert.equal(helper.select([fixture], { region:'all', status:'all', year:'all' })[0].value, null);
assert.equal(JSON.stringify(rows), before); // Filtering and grouping never mutate original records.
for (const row of rows) {
  assert(new URL(row.source_url).protocol === 'https:');
  assert(row.currency && row.unit && row.accounting_status && row.source_vintage_display);
  if (row.components) assert.equal(Object.values(row.components).reduce((a,b)=>a+b,0), row.value);
}
assert.equal(data.rules.aggregation, 'none');
console.log('PASS: 18 IDs, HK/TW/MO/year/status filters, five separated series, null preservation, source units, component sums, no mutation.');

assert.equal(helper.barLabel({period_start:"2016-04-01",period_end:"2017-03-31"}), "2016/17");
assert.equal(helper.barLabel({period_start:"2025-01-01",period_end:"2025-12-31"}), "2025");
assert.equal(helper.barLabel({period_start:"<img src=x onerror=alert(1)>",period_end:"2027-01-01"}), "–");
for (const row of rows) assert.match(helper.barLabel(row), /^\d{4}(\/\d{2})?$/);
console.log("PASS: short, HTML-safe fiscal chart labels.");
