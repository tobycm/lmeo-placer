import pixel from "image-pixels";
import WebSocket from "ws";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const {
  data: currentCanvas,
  width: canvasWidth,
  height: canvasHeight,
} = await pixel("https://foloplace.tobycm.systems/place.png");

const { data: image, width, height } = await pixel("place.png");

let masterWs = new WebSocket("wss://foloplace.tobycm.systems/ws");

masterWs.on("message", (message: Buffer) => {
  if (message.length !== 11) return;

  const view = new DataView(Uint8Array.from(message).buffer);

  const x = view.getUint32(0);
  const y = view.getUint32(4);

  const index = x * 4 + y * canvasWidth * 4;

  currentCanvas[index] = message[8];
  currentCanvas[index + 1] = message[9];
  currentCanvas[index + 2] = message[10];
});

const numberOfWs = 20;

const wss: WebSocket[] = [];

let readying = numberOfWs;

function newWs() {
  const ws = new WebSocket("wss://foloplace.tobycm.systems/ws");

  ws.addEventListener("open", () => {
    readying--;
  });

  wss.push(ws);
}

(async () => {
  for (let i = 0; i < numberOfWs; i++) {
    newWs();
    await sleep(75);
  }
})();

async function getWS(): Promise<WebSocket> {
  while (true) {
    const ws = wss.shift();
    if (!ws) continue;
    if (ws.readyState !== WebSocket.OPEN) {
      if (wss.length === numberOfWs) newWs();
      continue;
    }
    wss.push(ws);
    return ws;
  }
}

const startingCoord: [number, number] = [0, 320];
const currentCoord: [number, number] = [...startingCoord];
const offset: [number, number] = [0, 0];

currentCoord[0] += offset[0];
currentCoord[1] += offset[1];

const finalCoord: [number, number] = [
  startingCoord[0] + width - 1,
  startingCoord[1] + height - 1,
];
async function getCoord(): Promise<[number, number]> {
  const coord: [number, number] = [currentCoord[0], currentCoord[1]];

  if (currentCoord[1] === finalCoord[1] && currentCoord[0] === finalCoord[0]) {
    currentCoord[1] = startingCoord[1];
    currentCoord[0] = startingCoord[0];
  } else if (currentCoord[0] === finalCoord[0]) {
    currentCoord[1]++;
    currentCoord[0] = startingCoord[0];
    await sleep(100);
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

async function getColor(
  coords: [number, number]
): Promise<Uint8Array | undefined> {
  if (currentPixel === finalPixel) {
    currentPixel = 0;
  }

  const r = image[currentPixel * 4];
  const g = image[currentPixel * 4 + 1];
  const b = image[currentPixel * 4 + 2];

  if (
    currentCanvas[coords[0] * 4 + coords[1] * canvasWidth * 4] === r &&
    currentCanvas[coords[0] * 4 + coords[1] * canvasWidth * 4 + 1] === g &&
    currentCanvas[coords[0] * 4 + coords[1] * canvasWidth * 4 + 2] === b
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
    let ws: WebSocket;
    try {
      ws = await getWS();
    } catch (e) {
      console.error(e);
      process.exit(1);
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

    view.setUint32(0, coord[0]);
    view.setUint32(4, coord[1]);

    view.setUint8(8, color[0]);
    view.setUint8(9, color[1]);
    view.setUint8(10, color[2]);

    ws.send(data);
    await sleep(5);
  }
})();
