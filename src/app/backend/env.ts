import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: process.env.PORT || 4000,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASS: process.env.DB_PASS || '',
  DB_NAME: process.env.DB_NAME || 'radius',
  JWT_SECRET: process.env.JWT_SECRET || 'MY_SECRET_KEY',
};
