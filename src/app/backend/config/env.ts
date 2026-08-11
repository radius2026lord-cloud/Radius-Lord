/*import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT) || 4001,
  DB_HOST: process.env.DB_HOST || '172.24.19.13',
  DB_USER: process.env.DB_USER || 'lord',
  DB_PASS: process.env.DB_PASS || 'lord1224',
  DB_NAME: process.env.DB_NAME || 'radius_lord',
  JWT_SECRET: process.env.JWT_SECRET || 'MY_SECRET_KEY',

  //Port FrontEnd
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  NEXT_PUBLIC_API_URL:
    process.env.NEXT_PUBLIC_API_URL ||
    `http://localhost:${process.env.PORT || 4001}`,
};
*/

import dotenv from 'dotenv';

dotenv.config();

export const env = {
  // Backend Port
  PORT: Number(process.env.PORT) || 4001,

  // MySQL
  DB_HOST: process.env.DB_HOST || '172.24.19.13',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER || 'lord',
  DB_PASS: process.env.DB_PASS || 'lord1224',
  DB_NAME: process.env.DB_NAME || 'radius_lord',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'MY_SECRET_KEY',

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  NEXT_PUBLIC_API_URL:
    process.env.NEXT_PUBLIC_API_URL ||
    `http://localhost:${process.env.PORT || 4001}`,
};
