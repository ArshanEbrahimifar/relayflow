import { startTracing } from '@app/observability';

type WorkerBootstrapModule = {
  bootstrapWorker: () => Promise<void>;
};

async function main() {
  startTracing('relayflow-worker');

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { bootstrapWorker } = require('./bootstrap') as WorkerBootstrapModule;

  await bootstrapWorker();
}

void main();
