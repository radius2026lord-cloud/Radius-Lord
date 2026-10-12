import {startNetworkArchiveWorker} from './services/network-archive.service';
import {startProfileSpeedBoostWorker} from './services/profile-speed-boost.worker';
import {startServerReadinessWorker} from './services/server-readiness.service';
import {startInfrastructureHealthWorker} from './services/infrastructure-health.service';
import { startDatabaseProvisioningWorker } from './workers/database-provisioning.worker';
import { attachSshTerminal } from './services/ssh-terminal.service';
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
  attachSshTerminal(server);

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
    startDatabaseProvisioningWorker();
    const stopArchive=startNetworkArchiveWorker();
    const stopProfileBoosts=startProfileSpeedBoostWorker();
    if(stopProfileBoosts)server.once('close',stopProfileBoosts);
    if(stopArchive)server.once('close',stopArchive);
    const stopReadiness=startServerReadinessWorker();
    if(stopReadiness)server.once('close',stopReadiness);
    const stopHealth=startInfrastructureHealthWorker();
    if(stopHealth)server.once('close',stopHealth);
  });
};

startServer(env.PORT);
