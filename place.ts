import pixel from "image-pixels";
import { Worker } from "worker_threads";
import WebSocket from "ws";

const canvas = await pixel("https://foloplace.tobycm.systems/place.png");

const place = await pixel("place.png");

let masterWs: WebSocket;

masterWs = new WebSocket("wss://foloplace.tobycm.systems/ws");
masterWs.on("message", (data) => {
  if (data.constructor !== Buffer) return;

  const view = new DataView(Uint8Array.from(data as Buffer).buffer);
  const x = view.getUint32(0, false);
  const y = view.getUint32(4, false);
  const r = view.getUint8(8);
  const g = view.getUint8(9);
  const b = view.getUint8(10);

  canvas.data[x * 4 + y * canvas.width * 4] = r;
  canvas.data[x * 4 + y * canvas.width * 4 + 1] = g;
  canvas.data[x * 4 + y * canvas.width * 4 + 2] = b;
});

const numberOfWorkers = 50;

const startingCoord: [number, number] = [514, 234];

for (let i = 0; i < numberOfWorkers; i++) {
  new Worker("./worker.ts", {
    workerData: {
      place,
      canvas,
      startingCoord: [startingCoord[0], startingCoord[1] + i * numberOfWorkers],
      finalCoord: [
        startingCoord[0] + place.width - 1,
        startingCoord[1] + (place.height / numberOfWorkers) * i - 1,
      ],
      offset: [i * numberOfWorkers, 0],
    },
  });
}
