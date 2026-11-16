import { openDatabase } from '../db.mjs';
import { writeFileSync,mkdirSync } from 'node:fs';
const db=openDatabase(':memory:');
const rows=db.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type DESC,name").all();
const dir=new URL('../docs/',import.meta.url);mkdirSync(dir,{recursive:true});
writeFileSync(new URL('schema.sql',dir),'-- PeopleOps / Nhom 16 - schema SQLite (Node.js 24+)\n-- Generated from db.mjs; contains no personnel data.\nPRAGMA foreign_keys = ON;\n\n'+rows.map(r=>r.sql+';').join('\n\n')+'\n');
db.close();console.log('Đã xuất docs/schema.sql');
