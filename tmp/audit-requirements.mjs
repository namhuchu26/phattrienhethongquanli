// Read-only audit of the delivered application. All mutations use an in-memory DB.
import { createApp } from '../hrms/server.mjs';
import { today, shift } from '../hrms/db.mjs';
import { once } from 'node:events';

const { server, db } = createApp({ dbPath: ':memory:' });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = 'http://127.0.0.1:' + server.address().port;
let cookie = '';
async function call(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
const findings = [];
try {
  const login = await call('/api/login', { username: 'admin', password: 'Demo@12345' });
  if (login.status !== 200) throw new Error('Audit authentication failed');
  cookie = login.headers.get('set-cookie').split(';')[0];

  const decision = {
    new_department_id: 'PB03', new_position_id: 'CV01', effective_date: today(),
    signed_date: today(), type: 'Điều chuyển', reason: 'Kiểm tra đối chiếu ERD',
    number: 'QD-AUDIT-SHARED', signer: 'Người ký minh họa'
  };
  const first = await call('/api/assignments', { ...decision, employee_id: 'NV003' });
  const second = await call('/api/assignments', { ...decision, employee_id: 'NV006' });
  findings.push({
    code: 'ERD-DECISION-1N', first_status: first.status, second_status: second.status,
    second_response: second.data,
    reproduced: first.status === 201 && second.status === 409
  });

  const year = Number(today().slice(0, 4)) + 2;
  const balance = await call('/api/balances', { employee_id: 'NV003', year, total: 20 });
  const state = await call('/api/state');
  findings.push({
    code: 'LEAVE-YEAR-DATA', update_status: balance.status, year,
    stored_total: db.prepare('SELECT total FROM leave_balances WHERE employee_id=? AND year=?').get('NV003', year)?.total,
    returned_balance: state.data.balances.find(b => b.employee_id === 'NV003' && b.year === year) ?? null,
    reproduced: balance.status === 200 && !state.data.balances.some(b => b.employee_id === 'NV003' && b.year === year)
  });

  const old = state.data.employees.find(e => e.id === 'NV004');
  const update = await call('/api/employees/NV004', { ...old, join_date: today() }, 'PUT');
  const after = (await call('/api/state')).data;
  const updated = after.employees.find(e => e.id === 'NV004');
  const preceding = after.contracts.filter(c => c.employee_id === 'NV004' && c.start_date < updated.join_date);
  findings.push({
    code: 'EMPLOYEE-HISTORY-DATES', update_status: update.status,
    join_date: updated.join_date, conflicting_contracts: preceding.map(c => ({ id: c.id, start_date: c.start_date })),
    reproduced: update.status === 200 && preceding.length > 0
  });

  const incorrectType = await call('/api/assignments', {
    ...decision, employee_id: 'NV012', new_department_id: 'PB02',
    type: 'Bổ nhiệm', number: 'QD-AUDIT-TYPE'
  });
  const assignment = db.prepare('SELECT type,old_department_id,new_department_id,old_position_id,new_position_id FROM assignments WHERE id=?').get(incorrectType.data.id ?? 'missing');
  findings.push({
    code: 'ASSIGNMENT-TYPE', status: incorrectType.status, assignment,
    reproduced: incorrectType.status === 201 && assignment.old_position_id === assignment.new_position_id && assignment.old_department_id !== assignment.new_department_id
  });

  const future = await call('/api/assignments', {
    ...decision, employee_id: 'NV006', number: 'QD-AUDIT-FUTURE', effective_date: shift(today(), 5)
  });
  findings.push({ code: 'FUTURE-DECISION-LIMIT', status: future.status, response: future.data });

  console.log(JSON.stringify({ audit_date: today(), production_data_changed: false, findings }, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
}
