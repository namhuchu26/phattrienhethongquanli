import {createApp} from '../hrms/server.mjs';
import {today,shift} from '../hrms/db.mjs';
import {once} from 'node:events';
import {writeFileSync} from 'node:fs';
const {server,db}=createApp({dbPath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;let cookie='';const results=[];
async function call(path,body,method=body?'POST':'GET') {const r=await fetch(base+path,{method,headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),headers:r.headers};}
try{
 const l=await call('/api/login',{username:'admin',password:'Demo@12345'});cookie=l.headers.get('set-cookie').split(';')[0];
 results.push({case:'restore_active_probation',before:db.prepare("SELECT status FROM employees WHERE id='NV011'").get(),response:(await call('/api/employees/NV011/restore',{})).status,after:db.prepare("SELECT status FROM employees WHERE id='NV011'").get()});
 const end=shift(today(),-10),start=shift(today(),-30);
 await call('/api/contracts/HD012/terminate',{terminated_date:shift(today(),-31),reason:'audit'});
 const created=await call('/api/contracts',{id:'AUDIT-EXPIRED',employee_id:'NV012',type:'Xác định thời hạn',start_date:start,end_date:end,salary:100});
 const termination=await call('/api/contracts/AUDIT-EXPIRED/terminate',{terminated_date:today(),reason:'audit'});
 results.push({case:'termination_after_expiry',created:created.status,end_date:end,termination_date:today(),status:termination.status});
 const duplicate=await call('/api/contracts',{id:'AUDIT-OVERLAP',employee_id:'NV012',type:'Xác định thời hạn',start_date:start,end_date:end,salary:100});
 results.push({case:'historical_overlap_terminated',status:duplicate.status});
 const data=(await call('/api/state')).data;
 results.push({case:'seed_leave_chronology',rows:data.leaves.filter(l=>l.submitted_date>l.start_date).map(l=>({id:l.id,submitted:l.submitted_date,start:l.start_date,approved:l.approved_date}))});
 const employeeLogin=await call('/api/login',{username:'nhanvien',password:'Demo@12345'});cookie=employeeLogin.headers.get('set-cookie').split(';')[0];
 const protectedRoutes=['/api/employees/NV004/archive','/api/employees/NV004/restore','/api/contracts/HD004/terminate','/api/assignments','/api/balances','/api/users/U1/toggle'];
 for(const p of protectedRoutes)results.push({case:'employee_denied',path:p,status:(await call(p,{})).status});
 results.push({case:'foreign_key_check',rows:db.prepare('PRAGMA foreign_key_check').all(),integrity:db.prepare('PRAGMA integrity_check').get()});
 console.log(JSON.stringify(results,null,2));writeFileSync(new URL('./audit-extra-results.json',import.meta.url),JSON.stringify(results,null,2));
}finally{await new Promise(r=>server.close(r));}
