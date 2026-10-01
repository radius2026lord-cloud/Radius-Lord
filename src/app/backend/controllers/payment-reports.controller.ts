import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

function validDate(value: unknown): value is string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T00:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value&&date.getUTCFullYear()>=2000&&date.getUTCFullYear()<=9998;
}
function dateKey(value:Date){return value.toISOString().slice(0,10);}

export async function getCollectionReportController(req:AuthenticatedRequest,res:Response){
  try{
    const period=req.query.period??'month',group=req.query.group??'none';
    const currency=req.query.currency??'all',purpose=req.query.purpose??'all',search=req.query.search??'',pageValue=req.query.page??'1';
    if(typeof period!=='string'||!['today','month','year','custom'].includes(period)||typeof group!=='string'||!['none','day','month','year'].includes(group)||typeof currency!=='string'||!currency.length||currency.length>10||typeof purpose!=='string'||!['all','initial_subscription','renewal','upgrade','addon_purchase'].includes(purpose)||typeof search!=='string'||search.length>120||typeof pageValue!=='string'||!/^\d+$/.test(pageValue)||Number(pageValue)<1||Number(pageValue)>1000000)return res.status(400).json({success:false,message:'فلاتر التقرير غير صالحة.'});
    const [todayRows]=await db.query("SELECT DATE_FORMAT(CURRENT_DATE,'%Y-%m-%d') today");
    const today=String((todayRows as any[])[0].today),now=new Date(today+'T00:00:00Z'),year=now.getUTCFullYear(),month=now.getUTCMonth();
    let startDate=today,endDate=today;
    if(period==='month'){startDate=dateKey(new Date(Date.UTC(year,month,1)));endDate=dateKey(new Date(Date.UTC(year,month+1,0)));}
    if(period==='year'){startDate=`${year}-01-01`;endDate=`${year}-12-31`;}
    if(period==='custom'){
      if(!validDate(req.query.startDate)||!validDate(req.query.endDate)||req.query.startDate>req.query.endDate)return res.status(400).json({success:false,message:'حدد تاريخ البداية والنهاية، على أن تكون البداية قبل النهاية أو مساوية لها.'});
      startDate=req.query.startDate;endDate=req.query.endDate;
    }
    const endExclusive=new Date(endDate+'T00:00:00Z');endExclusive.setUTCDate(endExclusive.getUTCDate()+1);
    const filters=["payment_orders.status IN ('paid','completed')",'payment_orders.paid_at>=?','payment_orders.paid_at<?'];
    const filterParams:any[]=[startDate,dateKey(endExclusive)];
    if(currency!=='all'){filters.push('payment_orders.currency_code=?');filterParams.push(currency);}
    if(purpose!=='all'){filters.push('payment_orders.payment_purpose=?');filterParams.push(purpose);}
    if(search.trim()){
      filters.push("EXISTS (SELECT 1 FROM customers lookup_customer WHERE lookup_customer.id=payment_orders.customer_id AND (lookup_customer.full_name LIKE ? ESCAPE '!' OR lookup_customer.username LIKE ? ESCAPE '!' OR lookup_customer.email LIKE ? ESCAPE '!'))");
      const term='%'+search.trim().replace(/[!%_]/g,'!$&')+'%';filterParams.push(term,term,term);
    }
    const filterSql=filters.join(' AND '),page=Number(pageValue),pageSize=25;
    const [summaryRows]=await db.query(`SELECT currency_code,COUNT(*) payment_count,SUM(total_amount) total_amount FROM payment_orders WHERE ${filterSql} GROUP BY currency_code ORDER BY currency_code`,filterParams);
    let series:any[]=[];
    if(group!=='none'){
      const periodFormat=group==='day'?'%Y-%m-%d':group==='month'?'%Y-%m':'%Y';
      const [rows]=await db.query(`SELECT DATE_FORMAT(paid_at,'${periodFormat}') period,currency_code,COUNT(*) payment_count,SUM(total_amount) total_amount FROM payment_orders WHERE ${filterSql} GROUP BY period,currency_code ORDER BY period,currency_code`,filterParams);
      series=(rows as any[]).map(row=>({period:row.period,currency:row.currency_code,count:Number(row.payment_count),amount:String(row.total_amount)}));
    }
    const [countRows]=await db.query(`SELECT COUNT(*) total FROM payment_orders WHERE ${filterSql}`,filterParams);
    const [paymentRows]=await db.query(`SELECT payment_orders.id,payment_orders.customer_id,payment_orders.payment_code,payment_orders.payment_purpose,payment_orders.plan_name_snapshot,payment_orders.deployment_name_snapshot,payment_orders.addons_snapshot,payment_orders.total_amount,payment_orders.currency_code,payment_orders.status,payment_orders.paid_at,c.full_name customer_name,c.username customer_username,c.email customer_email,m.full_name confirmed_by_name,m.username confirmed_by_username FROM payment_orders JOIN customers c ON c.id=payment_orders.customer_id LEFT JOIN master_admins m ON m.id=payment_orders.confirmed_by_master_admin_id WHERE ${filterSql} ORDER BY payment_orders.paid_at DESC,payment_orders.id DESC LIMIT ? OFFSET ?`,[...filterParams,pageSize,(page-1)*pageSize]);
    const [currencyRows]=await db.query("SELECT DISTINCT currency_code FROM payment_orders WHERE status IN ('paid','completed') AND paid_at IS NOT NULL ORDER BY currency_code");
    const payments=(paymentRows as any[]).map(row=>{
      let addons:any[]=[];
      try{const value=typeof row.addons_snapshot==='string'?JSON.parse(row.addons_snapshot):row.addons_snapshot;if(Array.isArray(value))addons=value;}catch{}
      return {id:row.id,customerId:row.customer_id,customerName:row.customer_name,customerUsername:row.customer_username,customerEmail:row.customer_email,paymentCode:row.payment_code,purpose:row.payment_purpose,planName:row.plan_name_snapshot,deploymentName:row.deployment_name_snapshot,purchasedItems:addons.filter(item=>item&&typeof item==='object').map(item=>String(item.nameAr||item.name_ar||item.name||item.code||'إضافة')),amount:String(row.total_amount),currency:row.currency_code,paidAt:row.paid_at,confirmedBy:row.confirmed_by_name||row.confirmed_by_username||null};
    });
    return res.json({success:true,range:{period,startDate,endDate,today},summary:(summaryRows as any[]).map(row=>({currency:row.currency_code,count:Number(row.payment_count),amount:String(row.total_amount)})),series,payments,currencies:(currencyRows as any[]).map(row=>row.currency_code),pagination:{page,pageSize,total:Number((countRows as any[])[0].total)}});
  }catch(error){console.error('Collection report:',error);return res.status(500).json({success:false,message:'تعذر تحميل تقرير التحصيل.'});}
}
