import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export async function getCollectionReportController(req: AuthenticatedRequest, res: Response) {
  try {
    let date = req.query.date;
    const group = req.query.group ?? 'day';
    if (!['day', 'month', 'year'].includes(String(group)) || typeof group !== 'string') return res.status(400).json({ success: false, message: 'نوع التقرير غير صالح.' });
    if (date === undefined) {
      const [rows] = await db.query("SELECT DATE_FORMAT(CURRENT_DATE,'%Y-%m-%d') today");
      date = (rows as any[])[0].today;
    }
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ success: false, message: 'أدخل تاريخًا صالحًا.' });
    const currency=req.query.currency??'all',purpose=req.query.purpose??'all',search=req.query.search??'';
    const pageValue=req.query.page??'1';
    if(typeof currency!=='string'||currency.length>10||typeof purpose!=='string'||!['all','initial_subscription','renewal','upgrade','addon_purchase'].includes(purpose)||typeof search!=='string'||search.length>120||typeof pageValue!=='string'||!/^\d+$/.test(pageValue)||Number(pageValue)<1||Number(pageValue)>1000000)return res.status(400).json({success:false,message:'فلاتر التقرير غير صالحة.'});
    const page=Number(pageValue),pageSize=25;
    const filters=["payment_orders.status IN ('paid','completed')","payment_orders.paid_at IS NOT NULL"];
    const filterParams:any[]=[];
    if(currency!=='all'){filters.push('payment_orders.currency_code=?');filterParams.push(currency);}
    if(purpose!=='all'){filters.push('payment_orders.payment_purpose=?');filterParams.push(purpose);}
    if(search.trim()){
      filters.push("EXISTS (SELECT 1 FROM customers lookup_customer WHERE lookup_customer.id=payment_orders.customer_id AND (lookup_customer.full_name LIKE ? ESCAPE '!' OR lookup_customer.username LIKE ? ESCAPE '!' OR lookup_customer.email LIKE ? ESCAPE '!'))");
      const term='%'+search.trim().replace(/[!%_]/g,'!$&')+'%';filterParams.push(term,term,term);
    }
    const filterSql=filters.join(' AND ');
    const selected = new Date(date + 'T00:00:00Z');
    if (Number.isNaN(selected.getTime()) || selected.toISOString().slice(0, 10) !== date || selected.getUTCFullYear() < 2000 || selected.getUTCFullYear() > 9998) return res.status(400).json({ success: false, message: 'أدخل تاريخًا صالحًا بين عامي 2000 و9998.' });
    const year = selected.getUTCFullYear(), month = selected.getUTCMonth();
    const format = (value: Date) => value.toISOString().slice(0, 10);
    const dayStart = date, dayEnd = format(new Date(Date.UTC(year, month, selected.getUTCDate() + 1)));
    const monthStart = format(new Date(Date.UTC(year, month, 1))), monthEnd = format(new Date(Date.UTC(year, month + 1, 1)));
    const yearStart = `${year}-01-01`, yearEnd = `${year + 1}-01-01`;
    const [summaryRows] = await db.query(`SELECT currency_code,
      COALESCE(SUM(CASE WHEN paid_at>=? AND paid_at<? THEN total_amount ELSE 0 END),0) day_amount,
      COALESCE(SUM(CASE WHEN paid_at>=? AND paid_at<? THEN 1 ELSE 0 END),0) day_count,
      COALESCE(SUM(CASE WHEN paid_at>=? AND paid_at<? THEN total_amount ELSE 0 END),0) month_amount,
      COALESCE(SUM(CASE WHEN paid_at>=? AND paid_at<? THEN 1 ELSE 0 END),0) month_count,
      COALESCE(SUM(total_amount),0) year_amount,COUNT(*) year_count
      FROM payment_orders WHERE ${filterSql} AND paid_at>=? AND paid_at<?
      GROUP BY currency_code ORDER BY currency_code`, [dayStart, dayEnd, dayStart, dayEnd, monthStart, monthEnd, monthStart, monthEnd, ...filterParams, yearStart, yearEnd]);
    const periodFormat = group === 'day' ? '%Y-%m-%d' : group === 'month' ? '%Y-%m' : '%Y';
    const start = group === 'day' ? monthStart : yearStart, end = group === 'day' ? monthEnd : yearEnd;
    const [seriesRows] = await db.query(`SELECT DATE_FORMAT(paid_at,'${periodFormat}') period,currency_code,COUNT(*) payment_count,SUM(total_amount) total_amount
      FROM payment_orders WHERE ${filterSql} ${group === 'year' ? '' : 'AND paid_at>=? AND paid_at<?'}
      GROUP BY period,currency_code ORDER BY period,currency_code`, group === 'year' ? filterParams : [...filterParams,start,end]);
    const rangeSql=group==='year'?'':'AND payment_orders.paid_at>=? AND payment_orders.paid_at<?';
    const detailParams=group==='year'?filterParams:[...filterParams,start,end];
    const [countRows]=await db.query(`SELECT COUNT(*) total FROM payment_orders WHERE ${filterSql} ${rangeSql}`,detailParams);
    const [paymentRows]=await db.query(`SELECT payment_orders.id,payment_orders.customer_id,payment_orders.payment_code,payment_orders.payment_purpose,payment_orders.plan_name_snapshot,payment_orders.deployment_name_snapshot,payment_orders.addons_snapshot,payment_orders.total_amount,payment_orders.currency_code,payment_orders.status,payment_orders.paid_at,c.full_name customer_name,c.username customer_username,c.email customer_email,m.full_name confirmed_by_name,m.username confirmed_by_username FROM payment_orders JOIN customers c ON c.id=payment_orders.customer_id LEFT JOIN master_admins m ON m.id=payment_orders.confirmed_by_master_admin_id WHERE ${filterSql} ${rangeSql} ORDER BY payment_orders.paid_at DESC,payment_orders.id DESC LIMIT ? OFFSET ?`,[...detailParams,pageSize,(page-1)*pageSize]);
    const [currencyRows]=await db.query("SELECT DISTINCT currency_code FROM payment_orders WHERE status IN ('paid','completed') AND paid_at IS NOT NULL ORDER BY currency_code");
    const payments=(paymentRows as any[]).map(row=>{
      let addons:any[]=[];
      try{const value=typeof row.addons_snapshot==='string'?JSON.parse(row.addons_snapshot):row.addons_snapshot;if(Array.isArray(value))addons=value;}catch{}
      return {id:row.id,customerId:row.customer_id,customerName:row.customer_name,customerUsername:row.customer_username,customerEmail:row.customer_email,paymentCode:row.payment_code,purpose:row.payment_purpose,planName:row.plan_name_snapshot,deploymentName:row.deployment_name_snapshot,purchasedItems:addons.filter(item=>item&&typeof item==='object').map(item=>String(item.nameAr||item.name_ar||item.name||item.code||'إضافة')),amount:String(row.total_amount),currency:row.currency_code,status:row.status,paidAt:row.paid_at,confirmedBy:row.confirmed_by_name||row.confirmed_by_username||null};
    });
    const summaries = (summaryRows as any[]).map(row => ({ currency: row.currency_code, day: { amount: String(row.day_amount), count: Number(row.day_count) }, month: { amount: String(row.month_amount), count: Number(row.month_count) }, year: { amount: String(row.year_amount), count: Number(row.year_count) } }));
    return res.json({ success: true, date, group, payments, currencies:(currencyRows as any[]).map(row=>row.currency_code), pagination:{page,pageSize,total:Number((countRows as any[])[0].total)}, summary: summaries, series: (seriesRows as any[]).map(row => ({ period: row.period, currency: row.currency_code, count: Number(row.payment_count), amount: String(row.total_amount) })) });
  } catch (error) { console.error('Collection report:', error); return res.status(500).json({ success: false, message: 'تعذر تحميل تقرير التحصيل.' }); }
}
