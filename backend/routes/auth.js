const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { nextAvailableUsername } = require("../utils/username");

const router = express.Router();

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizePhone = (value) => String(value || "").replace(/\s+/g, "").trim();

router.post("/signup", async (req, res) => {
  const fullName = String(req.body?.fullName || "").trim().replace(/\s+/g, " ");
  const email = normalizeEmail(req.body?.email);
  const phone = normalizePhone(req.body?.phone);
  const country = String(req.body?.country || "").trim();
  const password = String(req.body?.password || "");

  if (!fullName || !email || !phone || !country || !password) {
    return res.status(400).json({ success: false, code: "REQUIRED_FIELDS", message: "يرجى تعبئة جميع الحقول المطلوبة." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, code: "INVALID_EMAIL", message: "يرجى إدخال بريد إلكتروني صحيح." });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, code: "WEAK_PASSWORD", message: "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل." });
  }

  const connection = await pool.getConnection();
  try {
    const [duplicates] = await connection.execute(
      "SELECT email, phone FROM customers WHERE email = ? OR phone = ? LIMIT 2",
      [email, phone]
    );

    const errors = [];
    if (duplicates.some((row) => row.email === email)) errors.push({ field: "email", message: "البريد الإلكتروني مستخدم مسبقًا." });
    if (duplicates.some((row) => row.phone === phone)) errors.push({ field: "phone", message: "رقم الهاتف مستخدم مسبقًا." });
    if (errors.length) return res.status(409).json({ success: false, code: "DUPLICATE_CUSTOMER", errors });

    const username = await nextAvailableUsername(connection, fullName);
    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await connection.execute(
      `INSERT INTO customers
        (full_name, email, username, phone, country, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullName, email, username, phone, country, passwordHash]
    );

    return res.status(201).json({
      success: true,
      customer: { id: result.insertId, fullName, email, username, phone, country },
      message: "تم إنشاء الحساب بنجاح.",
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, code: "DUPLICATE_CUSTOMER", message: "البريد الإلكتروني أو رقم الهاتف مستخدم مسبقًا. يرجى المحاولة مرة أخرى." });
    }
    console.error("Signup error:", error);
    return res.status(500).json({ success: false, code: "SERVER_ERROR", message: "تعذر إنشاء الحساب حاليًا." });
  } finally {
    connection.release();
  }
});

module.exports = router;
