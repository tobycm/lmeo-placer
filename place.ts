import pixel from "image-pixels";
import WebSocket from "ws";

const {
  data: currentCanvas,
  width: canvasWidth,
  height: canvasHeight,
} = await pixel("https://foloplace.tobycm.systems/place.png");

const { data: image, width, height } = await pixel("place.png");

const wss: WebSocket[] = [];

const number_of_ws = 20;

let readying = number_of_ws;

const maxRetries = 40 * number_of_ws;
let retries = 0;

async function newWs(num: number): Promise<void> {
  const ws = new WebSocket("wss://foloplace.tobycm.systems/ws");

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

const startingCoord: [number, number] = [1079, 0];
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

  if (currentCoord[0] === finalCoord[0]) {
    currentCoord[1]++;
    currentCoord[0] = startingCoord[0];
    await new Promise((resolve) => setTimeout(resolve, 100)); // cool down
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
): Promise<Uint8Array | boolean> {
  if (currentPixel === finalPixel) {
    return true;
  }

  const r = image[currentPixel * 4];
  const g = image[currentPixel * 4 + 1];
  const b = image[currentPixel * 4 + 2];

  if (
    currentCanvas[coords[0] * 4 + coords[1] * canvasWidth * 4] === r &&
    currentCanvas[coords[0] * 4 + coords[1] * canvasWidth * 4 + 1] === g &&
    currentCanvas[coords[0] * 4 + coords[1] * canvasWidth * 4 + 2] === b
  ) {
    console.log("skipping", coords);
    currentPixel++;
    return false;
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
    let color: Uint8Array | boolean = false;

    while (color === false) {
      coord = await getCoord();

      color = await getColor(coord);

      if (color === true) {
        console.log("done");
        process.exit(0);
      }
    }

    console.log("Placing pixel at", coord, "...");

    const data = new Uint8Array(11);

    const view = new DataView(data.buffer);
    view.setUint32(0, coord[0], false);
    view.setUint32(4, coord[1], false);

    for (let i = 0; i < 3; i++) {
      data[8 + i] = color[i];
    }

    ws.send(data);

    currentCanvas[coord[0] * 4 + coord[1] * canvasWidth * 4] = color[0];
    currentCanvas[coord[0] * 4 + coord[1] * canvasWidth * 4 + 1] = color[1];
    currentCanvas[coord[0] * 4 + coord[1] * canvasWidth * 4 + 2] = color[2];

    await new Promise((resolve) => setTimeout(resolve, 50)); // cool down
  }
})();
