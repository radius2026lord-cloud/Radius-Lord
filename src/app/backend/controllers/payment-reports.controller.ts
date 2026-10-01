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
      FROM payment_orders WHERE status IN ('paid','completed') AND paid_at>=? AND paid_at<?
      GROUP BY currency_code ORDER BY currency_code`, [dayStart, dayEnd, dayStart, dayEnd, monthStart, monthEnd, monthStart, monthEnd, yearStart, yearEnd]);
    const periodFormat = group === 'day' ? '%Y-%m-%d' : group === 'month' ? '%Y-%m' : '%Y';
    const start = group === 'day' ? monthStart : yearStart, end = group === 'day' ? monthEnd : yearEnd;
    const [seriesRows] = await db.query(`SELECT DATE_FORMAT(paid_at,'${periodFormat}') period,currency_code,COUNT(*) payment_count,SUM(total_amount) total_amount
      FROM payment_orders WHERE status IN ('paid','completed') AND paid_at IS NOT NULL ${group === 'year' ? '' : 'AND paid_at>=? AND paid_at<?'}
      GROUP BY period,currency_code ORDER BY period,currency_code`, group === 'year' ? [] : [start, end]);
    const summaries = (summaryRows as any[]).map(row => ({ currency: row.currency_code, day: { amount: String(row.day_amount), count: Number(row.day_count) }, month: { amount: String(row.month_amount), count: Number(row.month_count) }, year: { amount: String(row.year_amount), count: Number(row.year_count) } }));
    return res.json({ success: true, date, group, summary: summaries, series: (seriesRows as any[]).map(row => ({ period: row.period, currency: row.currency_code, count: Number(row.payment_count), amount: String(row.total_amount) })) });
  } catch (error) { console.error('Collection report:', error); return res.status(500).json({ success: false, message: 'تعذر تحميل تقرير التحصيل.' }); }
}
