import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
import { today,shift,openDatabase } from '../db.mjs';

let app,base,cookies={};const temp=mkdtempSync(join(tmpdir(),'peopleops-test-')),dbPath=join(temp,'test.sqlite');
async function call(path,body,who='admin',method=body?'POST':'GET',extra={}){
  const r=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookies[who]?{Cookie:cookies[who]}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
  let data;try{data=await r.json();}catch{data=null;}return {status:r.status,data,headers:r.headers};
}
async function login(name,password='Demo@12345'){
  const r=await call('/api/login',{username:name,password},'nobody');assert.equal(r.status,200,JSON.stringify(r.data));cookies[name]=r.headers.get('set-cookie').split(';')[0];return r;
}
function ok(r,status=200){assert.equal(r.status,status,JSON.stringify(r.data));return r.data;}
const employee=(id='NVTEST')=>({id,name:'Nhân viên kiểm thử',birth_date:'1999-03-04',gender:'Nữ',address:'Dữ liệu kiểm thử',phone:'0909999999',email:`${id}@example.com`,join_date:today(),status:'Đang làm việc',department_id:'PB02',position_id:'CV01'});
before(async()=>{
  app=createApp({dbPath});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');base=`http://127.0.0.1:${app.server.address().port}`;
  for(const role of ['admin','nhansu','truongphong','nhanvien','giamdoc'])await login(role);
});
after(async()=>{await new Promise(r=>app.server.close(r));rmSync(temp,{recursive:true,force:true});});

test('Authentication, invalid login, CSRF origin and HTTP-only session',async()=>{
  assert.equal((await call('/api/state',null,'nobody')).status,401);
  assert.equal((await call('/api/login',{username:'admin',password:'wrong'},'nobody')).status,401);
  const auth=await login('admin');assert.match(auth.headers.get('set-cookie'),/HttpOnly/);assert.match(auth.headers.get('set-cookie'),/SameSite=Strict/);
  assert.equal((await call('/api/leaves',{},'admin','POST',{Origin:'https://malicious.example'})).status,403);
});
test('Role scopes are enforced by server, including salary visibility',async()=>{
  const own=ok(await call('/api/state',null,'nhanvien'));assert.equal(own.employees.length,1);assert.equal(own.employees[0].id,'NV003');assert.equal(own.users.length,0);assert.equal(own.audit.length,0);assert.ok(own.contracts.every(c=>c.employee_id==='NV003'));
  const manager=ok(await call('/api/state',null,'truongphong'));assert.ok(manager.employees.every(e=>e.department_id==='PB02'));assert.equal(manager.contracts.find(c=>c.employee_id==='NV003').salary,null);
  assert.equal((await call('/api/employees',employee('DENIED'),'nhanvien')).status,403);
  assert.equal((await call('/api/employees',employee('DENIED'),'giamdoc')).status,403);
  assert.equal((await call('/api/users',{username:'denied',employee_id:'NV003',role:'admin',password:'Demo@12345'},'nhansu')).status,403);
  assert.equal(ok(await call('/api/state',null,'giamdoc')).employees.length,12);
});
test('Employee validation, update, uniqueness, catalog foreign-key protection',async()=>{
  assert.equal((await call('/api/employees',{...employee(),birth_date:'1999-02-31'})).status,400);
  assert.equal((await call('/api/employees',{...employee(),email:'invalid'})).status,400);
  ok(await call('/api/employees',employee()),201);
  assert.equal((await call('/api/employees',employee())).status,409);
  ok(await call('/api/employees/NVTEST',{...employee(),name:'Tên đã cập nhật'},'admin','PUT'));
  assert.equal((await call('/api/employees/NVTEST',{...employee(),department_id:'PB03'},'admin','PUT')).status,400);
  assert.equal((await call('/api/departments/PB02',{},'admin','DELETE')).status,409);
  ok(await call('/api/departments',{id:'PBTEST',name:'Phòng kiểm thử',founded_date:today(),description:'Dữ liệu kiểm thử'}));
  ok(await call('/api/departments/PBTEST',{name:'Phòng cập nhật',founded_date:today(),description:''},'admin','PUT'));
  ok(await call('/api/departments/PBTEST',{},'admin','DELETE'));
  ok(await call('/api/positions',{id:'CVTEST',name:'Chức vụ kiểm thử',level:3,description:''}));
  ok(await call('/api/positions/CVTEST',{},'admin','DELETE'));
});
test('Contract creation, overlap prevention, extension history, termination and archival',async()=>{
  ok(await call('/api/contracts',{id:'HDTEST',employee_id:'NVTEST',type:'Xác định thời hạn',start_date:today(),end_date:shift(today(),90),salary:10000000}),201);
  assert.equal((await call('/api/contracts',{id:'HDTEST2',employee_id:'NVTEST',type:'Xác định thời hạn',start_date:today(),end_date:shift(today(),10),salary:10000000})).status,400);
  assert.equal((await call('/api/employees/NVTEST/archive',{})).status,400);
  ok(await call('/api/contracts/HDTEST/extend',{new_end_date:shift(today(),120),reason:'Gia hạn kiểm thử'}));
  let state=ok(await call('/api/state'));const extension=state.extensions.find(x=>x.contract_id==='HDTEST');assert.equal(extension.sequence,1);assert.equal(extension.old_end_date,shift(today(),90));assert.equal(extension.new_end_date,shift(today(),120));
  assert.equal((await call('/api/contracts/HDTEST/extend',{new_end_date:shift(today(),100),reason:'Sai ngày'})).status,400);
  ok(await call('/api/contracts/HDTEST/terminate',{terminated_date:today(),reason:'Kết thúc kiểm thử'}));
  ok(await call('/api/employees/NVTEST/archive',{}));state=ok(await call('/api/state'));assert.equal(state.employees.find(e=>e.id==='NVTEST').status,'Đã lưu trữ');assert.equal(state.contracts.find(c=>c.id==='HDTEST').status,'Đã chấm dứt');
  ok(await call('/api/employees/NVTEST/restore',{}));
});
test('Decision and assignment update the employee atomically and preserve history',async()=>{
  const body={employee_id:'NVTEST',new_department_id:'PB03',new_position_id:'CV02',effective_date:today(),signed_date:today(),type:'Điều chuyển và bổ nhiệm',reason:'Bổ nhiệm kiểm thử',number:'QD-TEST-01',signer:'Giám đốc kiểm thử'};
  ok(await call('/api/assignments',body),201);let s=ok(await call('/api/state'));const e=s.employees.find(e=>e.id==='NVTEST');assert.equal(e.department_id,'PB03');assert.equal(e.position_id,'CV02');const a=s.assignments.find(a=>a.employee_id==='NVTEST');assert.equal(a.old_department_id,'PB02');assert.equal(a.old_position_id,'CV01');assert.ok(s.decisions.find(d=>d.id===a.decision_id));
  assert.equal((await call('/api/assignments',{...body,new_department_id:'PB04',type:'Điều chuyển',number:'QD-TEST-01'})).status,409);s=ok(await call('/api/state'));assert.equal(s.employees.find(e=>e.id==='NVTEST').department_id,'PB03');assert.equal(s.assignments.filter(a=>a.employee_id==='NVTEST').length,1);
  assert.equal((await call('/api/assignments',{...body,new_department_id:'PB04',number:'QD-FUTURE',effective_date:shift(today(),1)})).status,400);
});
test('Contract identifiers with slash and spaces round-trip through API paths',async()=>{
  const id='HĐ/TEST 2026';
  ok(await call('/api/contracts',{id,employee_id:'NVTEST',type:'Xác định thời hạn',start_date:shift(today(),1),end_date:shift(today(),30),salary:10000000}),201);
  ok(await call(`/api/contracts/${encodeURIComponent(id)}/extend`,{new_end_date:shift(today(),40),reason:'Kiểm tra mã chứa ký tự'}));
  assert.equal(ok(await call('/api/state')).contracts.find(c=>c.id===id).end_date,shift(today(),40));
});
test('Leave permissions, overlapping dates, balance checks and one-time approval',async()=>{
  assert.equal((await call('/api/leaves/NP001/review',{status:'Đã duyệt'},'nhansu')).status,403);
  assert.equal((await call('/api/leaves/NP002/review',{status:'Đã duyệt'},'truongphong')).status,403);
  const before=ok(await call('/api/state')).balances.find(b=>b.employee_id==='NV003'&&b.year===Number(today().slice(0,4))).used;
  ok(await call('/api/leaves/NP001/review',{status:'Đã duyệt'},'truongphong'));
  const after=ok(await call('/api/state')).balances.find(b=>b.employee_id==='NV003'&&b.year===Number(today().slice(0,4))).used;assert.equal(after-before,2);
  assert.equal((await call('/api/leaves/NP001/review',{status:'Đã duyệt'},'truongphong')).status,400);
  const start=`${Number(today().slice(0,4))+1}-02-01`;
  const leave=ok(await call('/api/leaves',{employee_id:'NV004',type_id:'LP01',start_date:start,end_date:shift(start,2),reason:'Nghỉ kiểm thử'},'nhanvien'),201);
  let s=ok(await call('/api/state'));assert.equal(s.leaves.find(l=>l.id===leave.id).employee_id,'NV003');
  assert.equal((await call('/api/leaves',{type_id:'LP01',start_date:shift(start,1),end_date:shift(start,3),reason:'Trùng lịch'},'nhanvien')).status,400);
  assert.equal((await call(`/api/leaves/${leave.id}/review`,{status:'Đã duyệt'},'nhanvien')).status,403);
  ok(await call('/api/balances',{employee_id:'NV003',year:Number(start.slice(0,4)),total:1}));
  assert.equal((await call(`/api/leaves/${leave.id}/review`,{status:'Đã duyệt'},'admin')).status,400);
  ok(await call('/api/balances',{employee_id:'NV003',year:Number(start.slice(0,4)),total:12}));
  ok(await call(`/api/leaves/${leave.id}/review`,{status:'Đã duyệt'},'admin'));
  assert.equal((await call('/api/balances',{employee_id:'NV003',year:Number(start.slice(0,4)),total:1})).status,400);
  const self=ok(await call('/api/leaves',{employee_id:'NV002',type_id:'LP02',start_date:start,end_date:start,reason:'Nghỉ ốm'},'truongphong'),201);
  assert.equal((await call(`/api/leaves/${self.id}/review`,{status:'Đã duyệt'},'truongphong')).status,400);
  ok(await call(`/api/leaves/${self.id}/cancel`,{},'truongphong'));
  const reject=ok(await call('/api/leaves',{type_id:'LP02',start_date:shift(start,10),end_date:shift(start,10),reason:'Test từ chối'},'nhanvien'),201);
  assert.equal((await call(`/api/leaves/${reject.id}/review`,{status:'Từ chối'},'admin')).status,400);
  ok(await call(`/api/leaves/${reject.id}/review`,{status:'Từ chối',review_note:'Cần đăng ký lại'},'admin'));
});
test('New accounts, session revocation, password change and logout',async()=>{
  ok(await call('/api/users',{username:'testuser',employee_id:'NVTEST',role:'employee',password:'Initial@12345'}),201);await login('testuser','Initial@12345');
  const user=ok(await call('/api/state')).users.find(u=>u.username==='testuser');ok(await call(`/api/users/${user.id}/toggle`,{}));assert.equal((await call('/api/state',null,'testuser')).status,401);
  ok(await call(`/api/users/${user.id}/toggle`,{}));await login('testuser','Initial@12345');
  assert.equal((await call('/api/password',{current_password:'incorrect',new_password:'Updated@12345'},'testuser')).status,400);
  ok(await call('/api/password',{current_password:'Initial@12345',new_password:'Updated@12345'},'testuser'));assert.equal((await call('/api/state',null,'testuser')).status,401);
  await login('testuser','Updated@12345');ok(await call('/api/logout',{},'testuser'));assert.equal((await call('/api/state',null,'testuser')).status,401);
  const me=ok(await call('/api/state')).users.find(u=>u.username==='admin');assert.equal((await call(`/api/users/${me.id}/toggle`,{})).status,400);
});
test('Durable database and schema integrity',()=>{
  const reopened=openDatabase(dbPath);assert.equal(reopened.prepare('SELECT department_id FROM employees WHERE id=?').get('NVTEST').department_id,'PB03');assert.equal(reopened.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(reopened.prepare('PRAGMA foreign_key_check').all().length,0);assert.ok(reopened.prepare('SELECT COUNT(*) n FROM audit_log').get().n>10);reopened.close();
});
test('Static files, security headers, no database exposure or path traversal',async()=>{
  const r=await fetch(base);assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(await r.text(),/lang="vi"/);
  assert.equal((await fetch(base+'/app.js')).status,200);assert.equal((await fetch(base+'/styles.css')).status,200);
  assert.equal((await fetch(base+'/data/hrms.sqlite')).status,404);assert.equal((await fetch(base+'/../server.mjs')).status,404);
});
test('Adding an employee creates a linked login atomically and preserves it on edit',async()=>{
  const created=ok(await call('/api/employees',employee('NVAUTO'),'nhansu'),201);
  assert.equal(created.account.username,'nvauto@example.com');assert.equal(created.account.role,'employee');
  assert.ok(created.account.initial_password.length>=10);
  await login(created.account.username.toUpperCase(),created.account.initial_password);await login(created.account.username,created.account.initial_password);
  const own=ok(await call('/api/state',null,'nvauto@example.com'));
  assert.equal(own.user.role,'employee');assert.equal(own.employees.length,1);assert.equal(own.employees[0].id,'NVAUTO');
  ok(await call('/api/employees/NVAUTO',{...employee('NVAUTO'),name:'Tên cập nhật'},'admin','PUT'));
  await login('nvauto@example.com',created.account.initial_password);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM users WHERE employee_id=?').get('NVAUTO').n,1);
  ok(await call('/api/users',{username:'nvconflict',employee_id:'NVAUTO',role:'employee',password:'Test@123456'}),201);
  assert.equal((await call('/api/employees',{...employee('NVCONFLICT'),email:employee('NVAUTO').email})).status,409);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM employees WHERE id=?').get('NVCONFLICT').n,0);
});
