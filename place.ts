import pixel from "image-pixels";
import WebSocket from "ws";

const { data: image, width, height } = await pixel("place.png");

const wss: WebSocket[] = [];

const number_of_ws = 75;

let readying = number_of_ws;

const maxRetries = 50;
let retries = 0;

async function newWs(num: number): Promise<void> {
  const ws = new WebSocket(
    "wss://voyeurweb-hints-experiment-subsequent.trycloudflare.com/ws"
  );

  ws.on("open", () => {
    console.log("ws", num, "ready");
    readying--;
  });

  ws.on("error", (error) => {
    console.error(error);
    readying--;

    newWs(num);

    if (retries++ > maxRetries) {
      throw new Error("too many retries");
    }
  });

  wss.push(ws);
  await new Promise((resolve) => setTimeout(resolve, 75));
}

(async () => {
  for (let i = 0; i < number_of_ws; i++) await newWs(i);
})();

async function getWS(): Promise<WebSocket> {
  let ws: WebSocket;
  let ded = wss.length;
  do {
    ws = wss.shift()!;
    ded--;
    if (ded === 0) {
      throw new Error("no ws available");
    }
  } while (ws.readyState !== WebSocket.OPEN);
  wss.push(ws);

  return ws;
}

const startingCoord: [number, number] = [400, 380];
const currentCoord: [number, number] = [400, 380];
const offset: [number, number] = [0, 0];

currentCoord[0] += offset[0];
currentCoord[1] += offset[1];

const finalCoord: [number, number] = [
  startingCoord[0] + width - 1,
  startingCoord[1] + height - 1,
];
async function getCoord(): Promise<[number, number]> {
  const coord: [number, number] = [currentCoord[0], currentCoord[1]];

  if (currentCoord[0] === finalCoord[0]) {
    currentCoord[1]++;
    currentCoord[0] = startingCoord[0];
    await new Promise((resolve) => setTimeout(resolve, 500)); // cool down
  } else {
    currentCoord[0]++;
  }

  return coord;
}

while (readying > 0) {
  console.log("waiting for WS to be ready...");
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

let currentPixel = 0;
const finalPixel = image.length / 4;
currentPixel += offset[0] + offset[1] * width;

async function getColor(): Promise<Uint8Array | true> {
  if (currentPixel === finalPixel) {
    return true;
  }

  const r = image[currentPixel * 4];
  const g = image[currentPixel * 4 + 1];
  const b = image[currentPixel * 4 + 2];

  const color = new Uint8Array([r, g, b]);
  currentPixel++;

  return color;
}

(async () => {
  while (true) {
    let ws: WebSocket;
    try {
      ws = await getWS();
    } catch (e) {
      console.error(e);
      return;
    }
    const color = await getColor();

    if (color === true) {
      console.log("done");
      return;
    }

    const coord = await getCoord();

    console.log("Placing pixel at", coord, "...");

    const data = new Uint8Array(11);

    const view = new DataView(data.buffer);
    view.setUint32(0, coord[0], false);
    view.setUint32(4, coord[1], false);

    for (let i = 0; i < 3; i++) {
      data[8 + i] = color[i];
    }

    ws.send(data);

    await new Promise((resolve) => setTimeout(resolve, 15)); // cool down
  }
})();
