import pixel from "image-pixels";
import { io } from "socket.io-client";
import { Worker } from "worker_threads";
import { WorkerData } from "./worker.js";

const canvas = await pixel("https://foloplace.tobycm.systems/place.png");

const place = await pixel("place.png");

const masterWs = io("wss://foloplace.tobycm.systems/ws");

masterWs.on("place", (x, y, color) => {
  canvas.data[x * 4 + y * canvas.width * 4] = color[0];
  canvas.data[x * 4 + y * canvas.width * 4 + 1] = color[1];
  canvas.data[x * 4 + y * canvas.width * 4 + 2] = color[2];
});

const numberOfWorkers = place.height - 1;

const startingCoord: [number, number] = [1080, 200];

for (let i = 0; i < numberOfWorkers; i++) {
  const data: WorkerData = {
    place,
    canvas,
    startingCoord: [startingCoord[0], startingCoord[1] + i],
    finalX: startingCoord[0] + place.width - 1,
    yOffset: i,
  };

  new Worker("./worker.ts", {
    workerData: data,
  });
}
