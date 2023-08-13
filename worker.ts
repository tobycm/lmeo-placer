import { Image } from "image-pixels";
import io, { Socket } from "socket.io-client";
import { isMainThread, workerData } from "worker_threads";

if (isMainThread) {
  throw new Error("this file can only be run as a worker");
}

export interface WorkerData {
  place: Image;
  canvas: Image;
  startingCoord: [number, number];
  finalX: number;
  yOffset: number;
}

const { place, canvas, startingCoord, finalX, yOffset } =
  workerData as WorkerData;

let ws: Socket | undefined;
let ready = false;

const maxRetries = 40;
let retries = 0;

async function getWS(): Promise<void> {
  do {
    ws = io("wss://foloplace.tobycm.systems", { transports: ["websocket"] });
    ws.on("connect", () => {
      ready = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (!ws.connected);
}

const currentCoord: [number, number] = [...startingCoord];

async function getCoord(): Promise<[number, number]> {
  const coord: [number, number] = [currentCoord[0], currentCoord[1]];

  if (currentCoord[0] === finalX) {
    // done
    process.exit(0);
  } else {
    currentCoord[0]++;
  }

  return coord;
}

let currentPixel = 0;
const finalPixel = place.width - 1 + yOffset * place.width;

currentPixel += yOffset * place.width;

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

    ws!.emit("place", coord[0], coord[1], color);
    await new Promise((resolve) => setTimeout(resolve, 250)); // cool down
  }
})();
