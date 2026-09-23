import http from 'http';

import cors from 'cors';

import { app } from './app';
import { env } from './config/env';
import './config/db';
import apiRoutes from './routes';

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use('/api', apiRoutes);

const startServer = (port: number) => {
  const server = http.createServer(app);

  server.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use. Trying port ${port + 1}...`);
      startServer(port + 1);
      return;
    }

    console.error('Server error:', err);
    process.exitCode = 1;
  });

  server.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
};

startServer(env.PORT);
