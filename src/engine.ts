// One read per worker. A fresh module graph makes a new published engine effective
// without changing the long-lived MCP connection or keeping old modules resident.
import { parentPort, workerData } from 'node:worker_threads';
import { projectDesk } from './projection.ts';
import { ENGINE_ABI, ENGINE_VERSION } from './engine-version.ts';

parentPort!.postMessage({abi: ENGINE_ABI, version: ENGINE_VERSION, snapshot: projectDesk(workerData)});
