import http from 'http';

import cors from 'cors';
import express from 'express';

import { app } from './app';
import { env } from './config/env';
// 👇 هذا السطر هو الذي يشغّل الاتصال بقاعدة البيانات
import './config/db';

import apiRoutes from './routes'; // ← استدعاء ملف الروتات

const server = http.createServer(app);

const startServer = (port: number) => {
  // 👇 تسجيل جميع مسارات API
  app.use('/api', apiRoutes);

  server.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `❌ Port ${port} is already in use. Trying another port...`,
      );
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
};

//Port FrontEnd

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use((req, res, next) => {
  next();
});

startServer(env.PORT);

//startServer(Number(env.PORT));
