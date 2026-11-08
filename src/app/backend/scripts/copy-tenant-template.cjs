const {cpSync,mkdirSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
mkdirSync(join(root,'dist','tenant-schema'),{recursive:true});
cpSync(join(root,'tenant-schema','create_tenant_database.sql'),join(root,'dist','tenant-schema','create_tenant_database.sql'));
cpSync(join(root,'tenant-schema','vendor'),join(root,'dist','tenant-schema','vendor'),{recursive:true});

mkdirSync(join(root,'dist','migrations'),{recursive:true});
cpSync(join(root,'migrations','20261106_manual_environment.sql'),join(root,'dist','migrations','20261106_manual_environment.sql'));

mkdirSync(join(root,'dist','scripts'),{recursive:true});
cpSync(join(root,'scripts','database-backup-agent.py'),join(root,'dist','scripts','database-backup-agent.py'));
