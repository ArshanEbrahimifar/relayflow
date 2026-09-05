import { startTracing } from '@app/observability';

type ApiBootstrapModule = {
  bootstrapApi: () => Promise<void>;
};

async function main() {
  startTracing('relayflow-api');

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { bootstrapApi } = require('./bootstrap') as ApiBootstrapModule;

  await bootstrapApi();
}

void main();
