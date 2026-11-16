import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { openDatabase, seed, today, shift, calendarDays, transaction, passwordHash, passwordMatches } from './db.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
export function createApp({dbPath=resolve(root,'data/hrms.sqlite'),seedData=true}={}) {
  const db=openDatabase(dbPath); if(seedData)seed(db);
  const all=(sql,...args)=>db.prepare(sql).all(...args),one=(sql,...args)=>db.prepare(sql).get(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
  const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
  const requireRole=(u,roles)=>{if(!roles.includes(u.role))fail('Bạn không có quyền thực hiện thao tác này.',403);};
  const text=(b,k,max=250)=>{if(typeof b[k]!=='string'||!b[k].trim())fail(`Vui lòng nhập ${labels[k]||k}.`);if(b[k].trim().length>max)fail(`${labels[k]||k} quá dài.`);return b[k].trim();};
  const optional=(b,k,max=500)=>{const v=b[k]??'';if(typeof v!=='string'||v.length>max)fail(`Giá trị ${labels[k]||k} không hợp lệ.`);return v.trim();};
  const date=(b,k)=>{const v=text(b,k);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail(`Ngày ${labels[k]||k} không hợp lệ.`);return v;};
  const numeric=(b,k,min,max)=>{const n=Number(b[k]);if(!Number.isFinite(n)||n<min||n>max)fail(`${labels[k]||k} phải từ ${min} đến ${max}.`);return n;};
  const choice=(b,k,choices)=>{const v=text(b,k);if(!choices.includes(v))fail(`${labels[k]||k} không hợp lệ.`);return v;};
  const exists=(table,id)=>{const v=one(`SELECT * FROM ${table} WHERE id=?`,id);if(!v)fail('Không tìm thấy dữ liệu.',404);return v;};
  const activeEmployee=id=>{const e=exists('employees',id);if(e.status==='Đã lưu trữ')fail('Hồ sơ nhân viên đã lưu trữ.');return e;};
  const id=prefix=>prefix+randomBytes(5).toString('hex').toUpperCase();
  const audit=(u,action,target)=>run('INSERT INTO audit_log(user_id,action,target,created_at) VALUES(?,?,?,?)',u.id,action,target,new Date().toISOString());
  const hash=v=>createHash('sha256').update(v).digest('hex');
  function auth(req) {
    const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('hr_session='))?.slice(11);
    if(!token)fail('Vui lòng đăng nhập.',401);
    const u=one(`SELECT u.id,u.username,u.role,u.employee_id,e.name,e.department_id FROM sessions s JOIN users u ON u.id=s.user_id JOIN employees e ON e.id=u.employee_id WHERE s.token_hash=? AND s.expires>? AND u.active=1 AND e.status!='Đã lưu trữ'`,hash(token),Date.now());
    if(!u)fail('Phiên đăng nhập đã hết hạn.',401);return u;
  }
  function canView(u,e) {return ['admin','hr','director'].includes(u.role)||(u.role==='manager'&&e.department_id===u.department_id)||e.id===u.employee_id;}
  function scopedState(u) {
    const employees=all('SELECT * FROM employees ORDER BY id').filter(e=>canView(u,e));
    const ids=new Set(employees.map(e=>e.id));
    const full=['admin','hr','director'].includes(u.role);
    const contracts=all('SELECT * FROM contracts ORDER BY start_date DESC').filter(c=>ids.has(c.employee_id)).map(c=>({...c,status:c.status==='Đã chấm dứt'?c.status:c.start_date>today()?'Chưa hiệu lực':c.end_date&&c.end_date<today()?'Hết hạn':'Hiệu lực',salary:full||c.employee_id===u.employee_id?c.salary:null}));
    const assignments=all('SELECT * FROM assignments ORDER BY effective_date DESC').filter(a=>ids.has(a.employee_id));
    const decisionIds=new Set(assignments.map(a=>a.decision_id));
    const contractIds=new Set(contracts.map(c=>c.id));
    const leaves=all('SELECT * FROM leave_requests ORDER BY submitted_date DESC,id DESC').filter(l=>ids.has(l.employee_id));
    const years=new Set([Number(today().slice(0,4)),...leaves.map(l=>Number(l.start_date.slice(0,4))),...all('SELECT DISTINCT year FROM leave_balances').map(b=>b.year)]);
    const types=all('SELECT * FROM leave_types');
    const annual=new Set(types.filter(t=>t.deduct_annual).map(t=>t.id));
    const balances=[];
    for(const e of employees)for(const year of years){
      const total=one('SELECT total FROM leave_balances WHERE employee_id=? AND year=?',e.id,year)?.total??12;
      const used=leaves.filter(l=>l.employee_id===e.id&&l.status==='Đã duyệt'&&annual.has(l.type_id)&&Number(l.start_date.slice(0,4))===year).reduce((s,l)=>s+l.days,0);
      balances.push({employee_id:e.id,year,total,used,remaining:total-used});
    }
    return {user:u,today:today(),employees,departments:all('SELECT * FROM departments ORDER BY id'),positions:all('SELECT * FROM positions ORDER BY level DESC'),contracts,extensions:all('SELECT * FROM extensions ORDER BY sequence DESC').filter(x=>contractIds.has(x.contract_id)),assignments,decisions:all('SELECT * FROM decisions ORDER BY effective_date DESC').filter(d=>decisionIds.has(d.id)),leaveTypes:types,leaves,balances,users:u.role==='admin'?all('SELECT u.id,u.username,u.role,u.employee_id,u.active,e.name FROM users u JOIN employees e ON e.id=u.employee_id'):[],audit:u.role==='admin'?all('SELECT a.*,u.username FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100'):[]};
  }
  const attempts=new Map();
  async function api(req,res,path) {
    let b={};
    if(['POST','PUT','DELETE'].includes(req.method)){
      const origin=req.headers.origin;
      if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)fail('Nguồn yêu cầu không hợp lệ.',403);
      if(!(req.headers['content-type']||'').startsWith('application/json'))fail('Yêu cầu phải là JSON.',415);
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>65536)fail('Dữ liệu gửi lên quá lớn.',413);}try{b=JSON.parse(body||'{}');if(!b||Array.isArray(b)||typeof b!=='object')fail('Dữ liệu không hợp lệ.');}catch{fail('Dữ liệu JSON không hợp lệ.');}
    }
    const send=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    if(path==='/api/login'&&req.method==='POST'){
      const ip=req.socket.remoteAddress,now=Date.now();
      let attempt=attempts.get(ip);if(!attempt||attempt.until<now){attempt={count:0,until:now+600000};attempts.set(ip,attempt);}
      if(attempt.count>=15)fail('Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 10 phút.',429);
      const user=one(`SELECT u.* FROM users u JOIN employees e ON e.id=u.employee_id WHERE u.username=? COLLATE NOCASE AND u.active=1 AND e.status!='Đã lưu trữ'`,text(b,'username'));
      if(!user||!passwordMatches(text(b,'password'),user.password_hash)){attempt.count++;fail('Tên đăng nhập hoặc mật khẩu không đúng.',401);}
      attempts.delete(ip);run('DELETE FROM sessions WHERE expires<?',Date.now());
      const token=randomBytes(32).toString('hex');run('INSERT INTO sessions VALUES(?,?,?)',hash(token),user.id,Date.now()+8*3600000);
      res.setHeader('Set-Cookie',`hr_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);audit(user,'Đăng nhập',user.username);return send({ok:true});
    }
    const u=auth(req);
    if(path==='/api/state'&&req.method==='GET')return send(scopedState(u));
    if(path==='/api/logout'&&req.method==='POST'){
      const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('hr_session='))?.slice(11);
      if(token)run('DELETE FROM sessions WHERE token_hash=?',hash(token));res.setHeader('Set-Cookie','hr_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send({ok:true});
    }
    if(path==='/api/password'&&req.method==='POST'){
      const current=one('SELECT password_hash FROM users WHERE id=?',u.id);
      if(!passwordMatches(text(b,'current_password'),current.password_hash))fail('Mật khẩu hiện tại không đúng.');
      const pw=text(b,'new_password');if(pw.length<10)fail('Mật khẩu mới phải có ít nhất 10 ký tự.');
      transaction(db,()=>{run('UPDATE users SET password_hash=? WHERE id=?',passwordHash(pw),u.id);run('DELETE FROM sessions WHERE user_id=?',u.id);audit(u,'Đổi mật khẩu',u.username);});return send({ok:true,relogin:true});
    }
    if(path==='/api/users'&&req.method==='POST'){
      requireRole(u,['admin']);const username=text(b,'username',50);if(!/^[a-zA-Z0-9_.-]{3,50}$/.test(username))fail('Tên đăng nhập cần 3–50 ký tự chữ, số, dấu gạch.');
      activeEmployee(text(b,'employee_id'));const role=choice(b,'role',['admin','hr','manager','employee','director']);const pw=text(b,'password');if(pw.length<10)fail('Mật khẩu phải có ít nhất 10 ký tự.');
      const uid=id('U');run('INSERT INTO users VALUES(?,?,?,?,?,1)',uid,username,passwordHash(pw),role,b.employee_id);audit(u,'Tạo tài khoản',username);return send({id:uid},201);
    }
    if(/^\/api\/users\/[^/]+\/toggle$/.test(path)&&req.method==='POST'){
      requireRole(u,['admin']);const target=exists('users',path.split('/')[3]);if(target.id===u.id)fail('Không thể khóa tài khoản của chính bạn.');
      transaction(db,()=>{run('UPDATE users SET active=? WHERE id=?',target.active?0:1,target.id);run('DELETE FROM sessions WHERE user_id=?',target.id);audit(u,'Đổi trạng thái tài khoản',target.username);});return send({ok:true});
    }
    const parts=path.split('/').filter(Boolean),resource=parts[1],action=parts[3];let rid;
    try{rid=parts[2]===undefined?undefined:decodeURIComponent(parts[2]);}catch{fail('Mã dữ liệu không hợp lệ.');}
    if(resource==='employees'&&['POST','PUT'].includes(req.method)&&!action){
      requireRole(u,['admin','hr']);const name=text(b,'name',120),birth=date(b,'birth_date'),join=date(b,'join_date');if(birth>=today()||birth>=join)fail('Ngày sinh phải trước ngày vào làm và ngày hiện tại.');
      const gender=choice(b,'gender',['Nam','Nữ','Khác']),phone=text(b,'phone',20),email=text(b,'email',150);if(!/^[+\d][\d .()-]{7,19}$/.test(phone))fail('Số điện thoại không hợp lệ.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Email không hợp lệ.');
      const department=exists('departments',text(b,'department_id')).id,position=exists('positions',text(b,'position_id')).id;
      const status=choice(b,'status',['Đang làm việc','Thử việc']);
      if(req.method==='PUT'){
        const old=activeEmployee(rid);if(one('SELECT id FROM contracts WHERE employee_id=? AND start_date<?',rid,join)||one('SELECT id FROM assignments WHERE employee_id=? AND effective_date<?',rid,join)||one('SELECT id FROM leave_requests WHERE employee_id=? AND start_date<?',rid,join))fail('Ngày vào làm không được sau lịch sử hợp đồng, công tác hoặc nghỉ phép.');if(old.department_id!==department||old.position_id!==position)fail('Hãy dùng chức năng Công tác để điều chuyển hoặc bổ nhiệm và lưu quyết định.');
        run('UPDATE employees SET name=?,birth_date=?,gender=?,address=?,phone=?,email=?,join_date=?,status=? WHERE id=?',name,birth,gender,optional(b,'address'),phone,email,join,status,rid);audit(u,'Cập nhật hồ sơ',rid);return send({ok:true});
      }
      const eid=text(b,'id',25);if(!/^[A-Za-z0-9_-]+$/.test(eid))fail('Mã nhân viên chỉ gồm chữ, số, gạch ngang hoặc gạch dưới.');
      const username=email.toLowerCase(),initialPassword='Nv@'+randomBytes(9).toString('base64url');
      if(one('SELECT id FROM users WHERE username=? COLLATE NOCASE',username))fail('Email này đã được sử dụng làm tên đăng nhập.',409);
      transaction(db,()=>{
        run('INSERT INTO employees VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',eid,name,birth,gender,optional(b,'address'),phone,email,join,status,null,department,position);
        run('INSERT INTO leave_balances VALUES(?,?,12)',eid,Number(today().slice(0,4)));
        run('INSERT INTO users VALUES(?,?,?,?,?,1)',id('U'),username,passwordHash(initialPassword),'employee',eid);
        audit(u,'Thêm hồ sơ và tài khoản nhân viên',eid);
      });
      return send({id:eid,account:{username,initial_password:initialPassword,role:'employee'}},201);
    }
    if(resource==='employees'&&action==='archive'&&req.method==='POST'){
      requireRole(u,['admin','hr']);const e=activeEmployee(rid);if(e.id===u.employee_id)fail('Không thể lưu trữ hồ sơ của chính bạn.');
      if(one("SELECT id FROM contracts WHERE employee_id=? AND status!='Đã chấm dứt' AND (end_date IS NULL OR end_date>=?)",rid,today()))fail('Cần chấm dứt các hợp đồng hiện hành trước khi lưu trữ.');
      if(one("SELECT id FROM leave_requests WHERE employee_id=? AND status='Chờ duyệt'",rid))fail('Cần xử lý các đơn nghỉ phép chờ duyệt trước khi lưu trữ.');
      transaction(db,()=>{run("UPDATE employees SET status='Đã lưu trữ',archived_date=? WHERE id=?",today(),rid);run('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE employee_id=?)',rid);audit(u,'Lưu trữ hồ sơ',rid);});return send({ok:true});
    }
    if(resource==='employees'&&action==='restore'&&req.method==='POST'){
      requireRole(u,['admin','hr']);const archived=exists('employees',rid);if(archived.status!=='Đã lưu trữ')fail('Chỉ khôi phục hồ sơ đã lưu trữ.');run("UPDATE employees SET status='Đang làm việc',archived_date=NULL WHERE id=?",rid);audit(u,'Khôi phục hồ sơ',rid);return send({ok:true});
    }
    if(['departments','positions'].includes(resource)&&['POST','PUT','DELETE'].includes(req.method)){
      requireRole(u,['admin','hr']);if(rid)exists(resource,rid);
      if(req.method==='DELETE'){run(`DELETE FROM ${resource} WHERE id=?`,rid);audit(u,'Xóa danh mục',rid);return send({ok:true});}
      const name=text(b,'name',120),description=optional(b,'description');let value=resource==='departments'?date(b,'founded_date'):numeric(b,'level',1,10);if(resource==='positions'&&!Number.isInteger(value))fail('Cấp bậc phải là số nguyên.');
      if(req.method==='PUT')run(`UPDATE ${resource} SET name=?,description=?,${resource==='departments'?'founded_date':'level'}=? WHERE id=?`,name,description,value,rid);
      else{rid=text(b,'id',25);if(!/^[A-Za-z0-9_-]+$/.test(rid))fail('Mã danh mục không hợp lệ.');run(`INSERT INTO ${resource} VALUES(?,?,?,?)`,rid,name,description,value);}
      audit(u,'Cập nhật danh mục',rid);return send({ok:true});
    }
    if(resource==='contracts'&&req.method==='POST'){
      requireRole(u,['admin','hr']);
      if(!rid){
        const e=activeEmployee(text(b,'employee_id')),type=choice(b,'type',['Thử việc','Xác định thời hạn','Không xác định thời hạn']),start=date(b,'start_date'),end=type==='Không xác định thời hạn'?null:date(b,'end_date'),salary=numeric(b,'salary',1,100000000000);
        if(start<e.join_date)fail('Hợp đồng không được bắt đầu trước ngày vào làm.');if(end&&end<start)fail('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
        if(one("SELECT id FROM contracts WHERE employee_id=? AND status!='Đã chấm dứt' AND start_date<=? AND (end_date IS NULL OR end_date>=?)",e.id,end||'9999-12-31',start))fail('Khoảng thời gian bị trùng với hợp đồng hiện có.');
        const cid=text(b,'id',30);run('INSERT INTO contracts(id,employee_id,type,start_date,end_date,salary) VALUES(?,?,?,?,?,?)',cid,e.id,type,start,end,salary);audit(u,'Lập hợp đồng',cid);return send({id:cid},201);
      }
      const c=exists('contracts',rid);activeEmployee(c.employee_id);if(c.status==='Đã chấm dứt')fail('Hợp đồng đã chấm dứt.');
      if(action==='extend'){
        if(!c.end_date)fail('Hợp đồng không xác định thời hạn không cần gia hạn.');const end=date(b,'new_end_date'),reason=text(b,'reason',1000);if(end<=c.end_date||end<today())fail('Ngày gia hạn phải sau ngày kết thúc cũ và không trước hôm nay.');
        if(one("SELECT id FROM contracts WHERE employee_id=? AND id!=? AND status!='Đã chấm dứt' AND start_date<=? AND (end_date IS NULL OR end_date>=?)",c.employee_id,rid,end,c.start_date))fail('Thời hạn mới trùng với hợp đồng khác.');
        transaction(db,()=>{const seq=one('SELECT COALESCE(MAX(sequence),0)+1 n FROM extensions WHERE contract_id=?',rid).n;run('INSERT INTO extensions VALUES(?,?,?,?,?,?,?)',id('GH'),rid,seq,today(),c.end_date,end,reason);run('UPDATE contracts SET end_date=? WHERE id=?',end,rid);audit(u,'Gia hạn hợp đồng',rid);});return send({ok:true});
      }
      if(action==='terminate'){
        const ended=date(b,'terminated_date');if(ended<c.start_date||ended>today()||(c.end_date&&ended>c.end_date))fail('Ngày chấm dứt phải từ ngày bắt đầu đến hôm nay.');run("UPDATE contracts SET status='Đã chấm dứt',terminated_date=?,termination_reason=? WHERE id=?",ended,text(b,'reason',1000),rid);audit(u,'Chấm dứt hợp đồng',rid);return send({ok:true});
      }
    }
    if(resource==='assignments'&&!rid&&req.method==='POST'){
      requireRole(u,['admin','hr','director']);const e=activeEmployee(text(b,'employee_id')),dept=exists('departments',text(b,'new_department_id')),pos=exists('positions',text(b,'new_position_id')),effective=date(b,'effective_date'),signed=date(b,'signed_date');
      if(effective>today())fail('Bản chạy tại máy ghi nhận quyết định có hiệu lực đến hôm nay.');if(effective<e.join_date||signed>effective)fail('Ngày ký phải không sau ngày hiệu lực; ngày hiệu lực không trước ngày vào làm.');
      const last=one('SELECT MAX(effective_date) d FROM assignments WHERE employee_id=?',e.id);if(last?.d&&effective<last.d)fail('Ngày hiệu lực không được trước biến động gần nhất.');
      if(e.department_id===dept.id&&e.position_id===pos.id)fail('Phòng ban hoặc chức vụ mới phải thay đổi.');const type=choice(b,'type',['Điều chuyển','Bổ nhiệm','Điều chuyển và bổ nhiệm']),reason=text(b,'reason',1000),number=text(b,'number',60),signer=text(b,'signer',120),existing=one('SELECT * FROM decisions WHERE number=?',number),did=existing?.id||id('QD'),aid=id('QT');
      const expected=e.department_id!==dept.id?(e.position_id!==pos.id?'Điều chuyển và bổ nhiệm':'Điều chuyển'):'Bổ nhiệm';if(type!==expected)fail('Loại biến động không khớp phòng ban/chức vụ thay đổi.');if(existing&&(existing.type!==type||existing.signed_date!==signed||existing.effective_date!==effective||existing.signer!==signer||existing.content!==reason))fail('Thông tin không khớp quyết định đã có.',409);
      transaction(db,()=>{if(!existing)run('INSERT INTO decisions VALUES(?,?,?,?,?,?,?)',did,number,type,signed,effective,signer,reason);run('INSERT INTO assignments VALUES(?,?,?,?,?,?,?,?,?,?)',aid,e.id,did,type,e.department_id,dept.id,e.position_id,pos.id,effective,reason);run('UPDATE employees SET department_id=?,position_id=? WHERE id=?',dept.id,pos.id,e.id);audit(u,'Ghi nhận công tác',e.id);});return send({id:aid},201);
    }
    if(resource==='leaves'&&!rid&&req.method==='POST'){
      requireRole(u,['admin','hr','manager','employee']);const eid=u.role==='employee'||u.role==='manager'?u.employee_id:text(b,'employee_id'),e=activeEmployee(eid),type=exists('leave_types',text(b,'type_id')),start=date(b,'start_date'),end=date(b,'end_date');
      if(start<today())fail('Ngày nghỉ không được trước hôm nay.');if(start<e.join_date)fail('Ngày nghỉ không được trước ngày vào làm.');if(end<start)fail('Ngày kết thúc không được trước ngày bắt đầu.');if(start.slice(0,4)!==end.slice(0,4))fail('Vui lòng chia đơn nghỉ qua năm thành 2 đơn.');
      const days=calendarDays(start,end);if(days>type.max_days)fail(`Loại nghỉ này tối đa ${type.max_days} ngày mỗi đơn.`);
      if(one("SELECT id FROM leave_requests WHERE employee_id=? AND status IN ('Chờ duyệt','Đã duyệt') AND start_date<=? AND end_date>=?",eid,end,start))fail('Khoảng nghỉ trùng với đơn đang chờ duyệt hoặc đã duyệt.');
      const lid=id('NP');run('INSERT INTO leave_requests(id,employee_id,type_id,submitted_date,start_date,end_date,days,reason) VALUES(?,?,?,?,?,?,?,?)',lid,eid,type.id,today(),start,end,days,text(b,'reason',1000));audit(u,'Nộp đơn nghỉ phép',lid);return send({id:lid},201);
    }
    if(resource==='leaves'&&rid&&req.method==='POST'){
      const leave=exists('leave_requests',rid);if(leave.status!=='Chờ duyệt')fail('Đơn đã được xử lý.');
      if(action==='cancel'){
        if(leave.employee_id!==u.employee_id&&!['admin','hr'].includes(u.role))fail('Bạn không có quyền hủy đơn này.',403);run("UPDATE leave_requests SET status='Đã hủy' WHERE id=?",rid);audit(u,'Hủy đơn nghỉ phép',rid);return send({ok:true});
      }
      if(action==='review'){
        requireRole(u,['admin','manager']);const e=activeEmployee(leave.employee_id);if(e.id===u.employee_id)fail('Không được tự duyệt đơn nghỉ phép.');if(u.role==='manager'&&e.department_id!==u.department_id)fail('Chỉ được duyệt đơn trong phòng ban của bạn.',403);
        const status=choice(b,'status',['Đã duyệt','Từ chối']),note=optional(b,'review_note',1000);if(status==='Từ chối'&&!note)fail('Vui lòng nhập lý do từ chối.');
        transaction(db,()=>{if(status==='Đã duyệt'&&exists('leave_types',leave.type_id).deduct_annual){const year=Number(leave.start_date.slice(0,4)),total=one('SELECT total FROM leave_balances WHERE employee_id=? AND year=?',e.id,year)?.total??12;const used=one("SELECT COALESCE(SUM(l.days),0) n FROM leave_requests l JOIN leave_types t ON t.id=l.type_id WHERE l.employee_id=? AND l.status='Đã duyệt' AND t.deduct_annual=1 AND substr(l.start_date,1,4)=?",e.id,String(year)).n;if(used+leave.days>total)fail(`Nhân viên chỉ còn ${total-used} ngày phép năm.`);run('INSERT OR IGNORE INTO leave_balances VALUES(?,?,?)',e.id,year,total);}
          run('UPDATE leave_requests SET status=?,approver_id=?,approved_date=?,review_note=? WHERE id=?',status,u.employee_id,today(),note,rid);audit(u,status+' đơn nghỉ phép',rid);});return send({ok:true});
      }
    }
    if(resource==='balances'&&req.method==='POST'){
      requireRole(u,['admin','hr']);const e=activeEmployee(text(b,'employee_id')),year=numeric(b,'year',2000,2100),total=numeric(b,'total',0,366);if(!Number.isInteger(year)||!Number.isInteger(total))fail('Năm và số ngày phép phải là số nguyên.');
      const used=one("SELECT COALESCE(SUM(l.days),0) n FROM leave_requests l JOIN leave_types t ON t.id=l.type_id WHERE l.employee_id=? AND l.status='Đã duyệt' AND t.deduct_annual=1 AND substr(l.start_date,1,4)=?",e.id,String(year)).n;
      if(total<used)fail('Tổng ngày phép không được nhỏ hơn số ngày đã sử dụng.');run('INSERT INTO leave_balances VALUES(?,?,?) ON CONFLICT(employee_id,year) DO UPDATE SET total=excluded.total',e.id,year,total);audit(u,'Cập nhật quỹ phép',e.id+'/'+year);return send({ok:true});
    }
    fail('Không tìm thấy chức năng.',404);
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try{
      const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);
      if(!['GET','HEAD'].includes(req.method))fail('Phương thức không được hỗ trợ.',405);
      const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'};const file=files[url.pathname];if(!file)fail('Không tìm thấy trang.',404);
      const content=await readFile(resolve(root,'public',file));res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[extname(file)],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
    }catch(error){
      let message=error.message,status=error.status||500;
      if(message.includes('UNIQUE constraint')){status=409;message='Mã, tên danh mục, email hoặc tên đăng nhập đã tồn tại.';}
      else if(message.includes('FOREIGN KEY constraint')){status=409;message='Dữ liệu đang được sử dụng trong hồ sơ hoặc lịch sử; không thể xóa.';}
      else if(status===500){console.error(error);message='Có lỗi xử lý. Vui lòng kiểm tra lại hoặc thử lại.';}
      if(!res.headersSent)res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:message}));
    }
  });
  server.on('close',()=>db.close());return {server,db};
}
const labels={name:'họ tên / tên',birth_date:'sinh',join_date:'vào làm',start_date:'bắt đầu',end_date:'kết thúc',founded_date:'thành lập',signed_date:'ký',effective_date:'hiệu lực',new_end_date:'kết thúc mới',terminated_date:'chấm dứt',salary:'Mức lương',reason:'lý do',number:'số quyết định',signer:'người ký',username:'tên đăng nhập',password:'mật khẩu',current_password:'mật khẩu hiện tại',new_password:'mật khẩu mới',employee_id:'nhân viên',id:'mã',email:'email',phone:'số điện thoại',year:'Năm',total:'Tổng ngày phép',level:'Cấp bậc'};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {server}=createApp({dbPath:process.env.HRMS_DB||resolve(root,'data/hrms.sqlite')});const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
  server.listen(port,host,()=>console.log(`PeopleOps đang chạy tại http://${host}:${port}\nDừng máy chủ: Ctrl+C`));server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Cổng ${port} đang được sử dụng. Đặt biến PORT để đổi cổng.`:e);process.exitCode=1;});
}
