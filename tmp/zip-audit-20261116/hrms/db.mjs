import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
export function passwordHash(value) { const salt=randomBytes(16).toString('hex'); return salt+':'+scryptSync(value,salt,64).toString('hex'); }
export function passwordMatches(value,hash) { const [salt,key]=hash.split(':'); const a=Buffer.from(key,'hex'),b=scryptSync(value,salt,64); return a.length===b.length&&timingSafeEqual(a,b); }
export function openDatabase(path) {
  if(path!==':memory:') mkdirSync(dirname(path),{recursive:true});
  const db=new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS departments(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,description TEXT NOT NULL DEFAULT '',founded_date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS positions(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,description TEXT NOT NULL DEFAULT '',level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 10));
    CREATE TABLE IF NOT EXISTS employees(id TEXT PRIMARY KEY,name TEXT NOT NULL,birth_date TEXT NOT NULL,gender TEXT NOT NULL CHECK(gender IN ('Nam','Nữ','Khác')),address TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE UNIQUE,join_date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('Đang làm việc','Thử việc','Đã lưu trữ')),archived_date TEXT,department_id TEXT NOT NULL REFERENCES departments(id),position_id TEXT NOT NULL REFERENCES positions(id));
    CREATE TABLE IF NOT EXISTS contracts(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL REFERENCES employees(id),type TEXT NOT NULL CHECK(type IN ('Thử việc','Xác định thời hạn','Không xác định thời hạn')),start_date TEXT NOT NULL,end_date TEXT,salary REAL NOT NULL CHECK(salary>0),status TEXT NOT NULL DEFAULT 'Hiệu lực',terminated_date TEXT,termination_reason TEXT);
    CREATE TABLE IF NOT EXISTS extensions(id TEXT PRIMARY KEY,contract_id TEXT NOT NULL REFERENCES contracts(id),sequence INTEGER NOT NULL,created_date TEXT NOT NULL,old_end_date TEXT,new_end_date TEXT NOT NULL,reason TEXT NOT NULL,UNIQUE(contract_id,sequence));
    CREATE TABLE IF NOT EXISTS decisions(id TEXT PRIMARY KEY,number TEXT NOT NULL UNIQUE,type TEXT NOT NULL,signed_date TEXT NOT NULL,effective_date TEXT NOT NULL,signer TEXT NOT NULL,content TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL REFERENCES employees(id),decision_id TEXT NOT NULL REFERENCES decisions(id),type TEXT NOT NULL,old_department_id TEXT NOT NULL REFERENCES departments(id),new_department_id TEXT NOT NULL REFERENCES departments(id),old_position_id TEXT NOT NULL REFERENCES positions(id),new_position_id TEXT NOT NULL REFERENCES positions(id),effective_date TEXT NOT NULL,reason TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS leave_types(id TEXT PRIMARY KEY,name TEXT NOT NULL,max_days INTEGER NOT NULL,deduct_annual INTEGER NOT NULL CHECK(deduct_annual IN (0,1)));
    CREATE TABLE IF NOT EXISTS leave_requests(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL REFERENCES employees(id),type_id TEXT NOT NULL REFERENCES leave_types(id),submitted_date TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,days INTEGER NOT NULL CHECK(days>0),reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Chờ duyệt' CHECK(status IN ('Chờ duyệt','Đã duyệt','Từ chối','Đã hủy')),approver_id TEXT REFERENCES employees(id),approved_date TEXT,review_note TEXT);
    CREATE TABLE IF NOT EXISTS leave_balances(employee_id TEXT NOT NULL REFERENCES employees(id),year INTEGER NOT NULL,total INTEGER NOT NULL DEFAULT 12 CHECK(total>=0),PRIMARY KEY(employee_id,year));
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','hr','manager','employee','director')),employee_id TEXT NOT NULL REFERENCES employees(id),active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT REFERENCES users(id),action TEXT NOT NULL,target TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
    CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id,start_date,end_date);
    CREATE INDEX IF NOT EXISTS idx_contract_employee ON contracts(employee_id);
  `);
  return db;
}
export function transaction(db,fn) { db.exec('BEGIN IMMEDIATE'); try {const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;} }
export function seed(db) {
  if(db.prepare('SELECT COUNT(*) AS n FROM departments').get().n) return;
  transaction(db,()=>{
    const date=today(), year=Number(date.slice(0,4));
    const ds=[['PB01','Nhân sự','Tuyển dụng và phát triển con người'],['PB02','Công nghệ','Phát triển sản phẩm và hạ tầng'],['PB03','Kinh doanh','Phát triển khách hàng và thị trường'],['PB04','Tài chính','Tài chính và kế toán'],['PB05','Marketing','Thương hiệu và truyền thông'],['PB06','Ban giám đốc','Điều hành doanh nghiệp']];
    ds.forEach(x=>db.prepare('INSERT INTO departments VALUES(?,?,?,?)').run(...x,`${year-4}-01-01`));
    [['CV01','Chuyên viên',2],['CV02','Trưởng phòng',5],['CV03','Thực tập sinh',1],['CV04','Giám đốc',8],['CV05','Phó phòng',4]].forEach(x=>db.prepare('INSERT INTO positions VALUES(?,?,?,?)').run(x[0],x[1],'',x[2]));
    const people=[['Nguyễn Minh Anh','Nữ','PB01','CV02'],['Trần Quốc Bảo','Nam','PB02','CV02'],['Lê Hoàng Nam','Nam','PB02','CV01'],['Phạm Thu Hà','Nữ','PB03','CV01'],['Võ Ngọc Linh','Nữ','PB04','CV02'],['Đặng Đức Huy','Nam','PB02','CV01'],['Bùi Phương Thảo','Nữ','PB05','CV02'],['Đỗ Thành Đạt','Nam','PB03','CV02'],['Nguyễn Khánh Vy','Nữ','PB01','CV01'],['Trần Hải Đăng','Nam','PB06','CV04'],['Lý Tú Anh','Nữ','PB05','CV03'],['Hoàng Minh Quân','Nam','PB04','CV01']];
    people.forEach((x,i)=>{
      const id=`NV${String(i+1).padStart(3,'0')}`,join=i===10?date:`${year-(i%3)}-${String((i%9)+1).padStart(2,'0')}-05`;
      db.prepare('INSERT INTO employees VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,x[0],`${1990+i}-0${i%8+1}-15`,x[1],'Hà Nội',`090123${String(i+1).padStart(4,'0')}`,`nhanvien${i+1}@example.com`,join,i===10?'Thử việc':'Đang làm việc',null,x[2],x[3]);
      db.prepare('INSERT INTO leave_balances VALUES(?,?,?)').run(id,year,12);
      const end=i===2?shift(date,14):i===6?shift(date,27):`${year+1}-12-31`;
      db.prepare('INSERT INTO contracts(id,employee_id,type,start_date,end_date,salary) VALUES(?,?,?,?,?,?)').run(`HD${String(i+1).padStart(3,'0')}`,id,i===10?'Thử việc':'Xác định thời hạn',join,end,8000000+i*1500000);
    });
    [['LP01','Phép năm',12,1],['LP02','Nghỉ ốm',30,0],['LP03','Việc riêng',5,0],['LP04','Không hưởng lương',30,0]].forEach(x=>db.prepare('INSERT INTO leave_types VALUES(?,?,?,?)').run(...x));
    const leaves=[['NP001','NV003','LP01',shift(date,2),shift(date,3),'Giải quyết việc gia đình','Chờ duyệt'],['NP002','NV004','LP01',shift(date,7),shift(date,7),'Việc cá nhân','Chờ duyệt'],['NP003','NV009','LP02',shift(date,1),shift(date,1),'Khám sức khỏe','Chờ duyệt'],['NP004','NV006','LP01',shift(date,-10),shift(date,-9),'Nghỉ phép theo kế hoạch','Đã duyệt']];
    leaves.forEach(x=>db.prepare('INSERT INTO leave_requests(id,employee_id,type_id,submitted_date,start_date,end_date,days,reason,status,approver_id,approved_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(x[0],x[1],x[2],date,x[3],x[4],calendarDays(x[3],x[4]),x[5],x[6],x[6]==='Đã duyệt'?'NV002':null,x[6]==='Đã duyệt'?date:null));
    const roles=[['admin','admin','NV001'],['nhansu','hr','NV009'],['truongphong','manager','NV002'],['nhanvien','employee','NV003'],['giamdoc','director','NV010']];
    roles.forEach((x,i)=>db.prepare('INSERT INTO users VALUES(?,?,?,?,?,1)').run(`U${i+1}`,x[0],passwordHash('Demo@12345'),x[1],x[2]));
    db.prepare('INSERT INTO decisions VALUES(?,?,?,?,?,?,?)').run('QD001',`01/${year}/QD-NS`,'Bổ nhiệm',date,date,'Trần Hải Đăng','Bổ nhiệm trưởng phòng Marketing');
    db.prepare('INSERT INTO assignments VALUES(?,?,?,?,?,?,?,?,?,?)').run('QT001','NV007','QD001','Bổ nhiệm','PB05','PB05','CV01','CV02',date,'Ghi nhận quyết định bổ nhiệm');
  });
}
export function shift(date,days) {const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function calendarDays(start,end) { return Math.round((Date.parse(end)-Date.parse(start))/86400000)+1; }
