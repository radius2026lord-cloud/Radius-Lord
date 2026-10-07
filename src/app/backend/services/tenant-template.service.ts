// Trusted project SQL only. Understands mysql-client DELIMITER directives, quoted
// literals and comments; stored procedure bodies remain one server statement.
export function splitTenantTemplate(source:string):string[]{let delimiter=';',buffer='',quote='',lineComment=false,blockComment=false,lineStart=true;const result:string[]=[];
 for(let i=0;i<source.length;){if(lineStart&&!quote&&!blockComment&&!lineComment){const directive=/^[ \t]*DELIMITER[ \t]+(\S+)[ \t]*\r?\n/i.exec(source.slice(i));if(directive){delimiter=directive[1];i+=directive[0].length;lineStart=true;continue;}}
 const c=source[i],n=source[i+1];if(lineComment){buffer+=c;i++;if(c==='\n'){lineComment=false;lineStart=true;}continue;}
 if(blockComment){buffer+=c;i++;if(c==='*'&&n==='/'){buffer+='/';i++;blockComment=false;}lineStart=c==='\n';continue;}
 if(quote){buffer+=c;i++;if(c==='\\'&&quote!=='`'&&i<source.length){buffer+=source[i++];continue;}if(c===quote){if(n===quote){buffer+=n;i++;}else quote='';}lineStart=c==='\n';continue;}
 if(c==='-'&&n==='-'&&/\s/.test(source[i+2]||'')){lineComment=true;buffer+='--';i+=2;continue;}if(c==='#'){lineComment=true;buffer+=c;i++;continue;}if(c==='/'&&n==='*'){blockComment=true;buffer+='/*';i+=2;continue;}
 if(c==='\''||c==='"'||c==='`'){quote=c;buffer+=c;i++;lineStart=false;continue;}if(source.startsWith(delimiter,i)){if(buffer.trim())result.push(buffer.trim());buffer='';i+=delimiter.length;lineStart=false;continue;}buffer+=c;i++;lineStart=c==='\n';}
 if(quote||blockComment)throw new Error('TENANT_TEMPLATE_UNTERMINATED');if(buffer.trim())result.push(buffer.trim());return result;}
