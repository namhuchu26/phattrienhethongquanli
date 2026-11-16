-- PeopleOps / Nhom 16 - schema SQLite (Node.js 24+)
-- Generated from db.mjs; contains no personnel data.
PRAGMA foreign_keys = ON;

CREATE TABLE assignments(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL REFERENCES employees(id),decision_id TEXT NOT NULL REFERENCES decisions(id),type TEXT NOT NULL,old_department_id TEXT NOT NULL REFERENCES departments(id),new_department_id TEXT NOT NULL REFERENCES departments(id),old_position_id TEXT NOT NULL REFERENCES positions(id),new_position_id TEXT NOT NULL REFERENCES positions(id),effective_date TEXT NOT NULL,reason TEXT NOT NULL);

CREATE TABLE audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT REFERENCES users(id),action TEXT NOT NULL,target TEXT NOT NULL,created_at TEXT NOT NULL);

CREATE TABLE contracts(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL REFERENCES employees(id),type TEXT NOT NULL CHECK(type IN ('Thử việc','Xác định thời hạn','Không xác định thời hạn')),start_date TEXT NOT NULL,end_date TEXT,salary REAL NOT NULL CHECK(salary>0),status TEXT NOT NULL DEFAULT 'Hiệu lực',terminated_date TEXT,termination_reason TEXT);

CREATE TABLE decisions(id TEXT PRIMARY KEY,number TEXT NOT NULL UNIQUE,type TEXT NOT NULL,signed_date TEXT NOT NULL,effective_date TEXT NOT NULL,signer TEXT NOT NULL,content TEXT NOT NULL);

CREATE TABLE departments(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,description TEXT NOT NULL DEFAULT '',founded_date TEXT NOT NULL);

CREATE TABLE employees(id TEXT PRIMARY KEY,name TEXT NOT NULL,birth_date TEXT NOT NULL,gender TEXT NOT NULL CHECK(gender IN ('Nam','Nữ','Khác')),address TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE UNIQUE,join_date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('Đang làm việc','Thử việc','Đã lưu trữ')),archived_date TEXT,department_id TEXT NOT NULL REFERENCES departments(id),position_id TEXT NOT NULL REFERENCES positions(id));

CREATE TABLE extensions(id TEXT PRIMARY KEY,contract_id TEXT NOT NULL REFERENCES contracts(id),sequence INTEGER NOT NULL,created_date TEXT NOT NULL,old_end_date TEXT,new_end_date TEXT NOT NULL,reason TEXT NOT NULL,UNIQUE(contract_id,sequence));

CREATE TABLE leave_balances(employee_id TEXT NOT NULL REFERENCES employees(id),year INTEGER NOT NULL,total INTEGER NOT NULL DEFAULT 12 CHECK(total>=0),PRIMARY KEY(employee_id,year));

CREATE TABLE leave_requests(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL REFERENCES employees(id),type_id TEXT NOT NULL REFERENCES leave_types(id),submitted_date TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,days INTEGER NOT NULL CHECK(days>0),reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Chờ duyệt' CHECK(status IN ('Chờ duyệt','Đã duyệt','Từ chối','Đã hủy')),approver_id TEXT REFERENCES employees(id),approved_date TEXT,review_note TEXT);

CREATE TABLE leave_types(id TEXT PRIMARY KEY,name TEXT NOT NULL,max_days INTEGER NOT NULL,deduct_annual INTEGER NOT NULL CHECK(deduct_annual IN (0,1)));

CREATE TABLE positions(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,description TEXT NOT NULL DEFAULT '',level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 10));

CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);

CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','hr','manager','employee','director')),employee_id TEXT NOT NULL REFERENCES employees(id),active INTEGER NOT NULL DEFAULT 1);

CREATE INDEX idx_contract_employee ON contracts(employee_id);

CREATE INDEX idx_employees_department ON employees(department_id);

CREATE INDEX idx_leave_employee ON leave_requests(employee_id,start_date,end_date);
