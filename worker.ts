import { isMainThread, workerData } from "worker_threads";
import WebSocket from "ws";
import { Job } from "./place.js";

if (isMainThread) throw new Error("this file can only be run as a worker");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface WorkerData {
  id: number;
  jobs: Job[];
}

const { id, jobs } = workerData as WorkerData;

let ws: WebSocket | undefined;
let ready = false;

async function getWS(): Promise<void> {
  do {
    ws = new WebSocket("wss://foloplace.tobycm.systems/ws");
    ws.on("open", () => {
      ready = true;
      console.log("WS", id, "ready");
    });

    await sleep(1000);
  } while (!ws || ws.readyState !== WebSocket.OPEN);
}

async function getJob(): Promise<Job> {
  let job: Job | undefined;

  do {
    job = jobs.shift();
    if (!job) continue;
    if (job.locked) job = undefined;

    if (job) {
      job.locked = true;
      return job;
    }

    await sleep(100);
  } while (!job);

  return job;
}

(async () => {
  while (true) {
    try {
      await getWS();
    } catch (e) {
      console.error(e);
      return;
    }

    const job = await getJob();

    console.log("Placing pixel at", job.x, job.y, "...");

    const data = new Uint8Array(11);
    const view = new DataView(data.buffer);

    view.setUint32(0, job.x);
    view.setUint32(4, job.y);

    data[8] = job.color[0];
    data[9] = job.color[1];
    data[10] = job.color[2];

    ws?.send(data);

    await sleep(200); // cool down
  }
})();
