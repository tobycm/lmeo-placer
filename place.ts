import pixel from "image-pixels";
import { Worker } from "worker_threads";
import WebSocket from "ws";
import { WorkerData } from "./worker.js";

const canvas = await pixel("https://foloplace.tobycm.systems/place.png");

const place = await pixel("place.png");

const masterWs = new WebSocket("wss://foloplace.tobycm.systems/ws");

masterWs.on("message", (message: Buffer) => {
  if (message.length !== 11) return;

  const view = new DataView(Uint8Array.from(message).buffer);

  const x = view.getUint32(0);
  const y = view.getUint32(4);

  const index = x * 4 + y * canvas.width * 4;

  canvas.data[index] = message[8];
  canvas.data[index + 1] = message[9];
  canvas.data[index + 2] = message[10];
});

const numberOfWorkers = 10;

const startingCoord: [number, number] = [1080, 200];

export class Job {
  public x: number;
  public y: number;
  public color: [number, number, number];
  public locked: boolean = false;

  constructor(x: number, y: number, color: [number, number, number]) {
    this.x = x;
    this.y = y;
    this.color = color;
  }
}

const jobs: Job[] = [];

for (let i = 0; i < numberOfWorkers; i++) {
  const data: WorkerData = { id: i, jobs };

  new Worker("./worker.ts", { workerData: data });
}

(async () => {
  while (true) {
    for (let x = startingCoord[0]; x < startingCoord[0] + place.width; x++) {
      for (let y = startingCoord[1]; y < startingCoord[1] + place.height; y++) {
        const index = x * 4 + y * canvas.width * 4;

        if (
          canvas.data[index] === place.data[index] &&
          canvas.data[index + 1] === place.data[index + 1] &&
          canvas.data[index + 2] === place.data[index + 2]
        )
          continue;

        const color: [number, number, number] = [
          place.data[index],
          place.data[index + 1],
          place.data[index + 2],
        ];

        jobs.push(new Job(x, y, color));
      }
    }
  }
})();
