import { Image } from "image-pixels";
import { isMainThread, workerData } from "worker_threads";
import WebSocket from "ws";

if (isMainThread) {
  throw new Error("this file can only be run as a worker");
}

interface WorkerData {
  place: Image;
  canvas: Image;
  startingCoord: [number, number];
  finalCoord: [number, number];
  offset: [number, number];
}

const { place, canvas, startingCoord, finalCoord, offset } =
  workerData as WorkerData;

let ws: WebSocket | undefined;
let ready = false;

const maxRetries = 40;
let retries = 0;

async function getWS(): Promise<void> {
  do {
    ws = new WebSocket("wss://foloplace.tobycm.systems/ws");
    ws.on("open", () => {
      ready = true;
    });

    ws.on("error", (error) => {
      console.error(error);

      if (retries++ > maxRetries) {
        throw new Error("too many retries");
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (ws.readyState !== WebSocket.OPEN);
  return;
}

const currentCoord: [number, number] = [...startingCoord];

async function getCoord(): Promise<[number, number]> {
  const coord: [number, number] = [currentCoord[0], currentCoord[1]];

  if (currentCoord[1] === finalCoord[1] && currentCoord[0] === finalCoord[0]) {
    currentCoord[1] = startingCoord[1];
    currentCoord[0] = startingCoord[0];
  } else if (currentCoord[0] === finalCoord[0]) {
    currentCoord[1]++;
    currentCoord[0] = startingCoord[0];
    await new Promise((resolve) => setTimeout(resolve, 100)); // cool down
  } else {
    currentCoord[0]++;
  }

  return coord;
}

let currentPixel = 0;
const finalPixel = finalCoord[0] + finalCoord[1] * place.width;

currentPixel += offset[0] + offset[1] * place.width;

async function getColor(
  coords: [number, number]
): Promise<Uint8Array | undefined> {
  if (currentPixel === finalPixel) {
    currentPixel = 0;
  }

  const r = place.data[currentPixel * 4];
  const g = place.data[currentPixel * 4 + 1];
  const b = place.data[currentPixel * 4 + 2];

  if (
    canvas.data[coords[0] * 4 + coords[1] * canvas.width * 4] === r &&
    canvas.data[coords[0] * 4 + coords[1] * canvas.width * 4 + 1] === g &&
    canvas.data[coords[0] * 4 + coords[1] * canvas.width * 4 + 2] === b
  ) {
    currentPixel++;
    return;
  }
  const color = new Uint8Array([r, g, b]);
  currentPixel++;

  return color;
}

(async () => {
  while (true) {
    try {
      await getWS();
    } catch (e) {
      console.error(e);
      return;
    }

    let coord: [number, number] = [0, 0];
    let color: Uint8Array | undefined;

    while (color === undefined || color.constructor !== Uint8Array) {
      coord = await getCoord();
      color = await getColor(coord);
    }

    console.log("Placing pixel at", coord, "...");

    const data = new Uint8Array(11);

    const view = new DataView(data.buffer);
    view.setUint32(0, coord[0], false);
    view.setUint32(4, coord[1], false);

    for (let i = 0; i < 3; i++) {
      data[8 + i] = color[i];
    }

    ws!.send(data);
    await new Promise((resolve) => setTimeout(resolve, 250)); // cool down
  }
})();
