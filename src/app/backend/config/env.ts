import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT) || 4001,
  DB_HOST: process.env.DB_HOST || '192.168.182.128',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASS: process.env.DB_PASS || 'asdasd',
  DB_NAME: process.env.DB_NAME || 'radius',
  JWT_SECRET: process.env.JWT_SECRET || 'MY_SECRET_KEY',

  //Port FrontEnd
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  NEXT_PUBLIC_API_URL:
    process.env.NEXT_PUBLIC_API_URL ||
    `http://localhost:${process.env.PORT || 4001}`,
};
