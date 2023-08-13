import pixel from "image-pixels";
import { Socket, io } from "socket.io-client";

const {
  data: currentCanvas,
  width: canvasWidth,
  height: canvasHeight,
} = await pixel("https://foloplace.tobycm.systems/place.png");

const { data: image, width, height } = await pixel("place.png");

let masterWs = io("wss://foloplace.tobycm.systems/", {
  forceNew: true,
  transports: ["websocket"],
});
masterWs.on("place", (x, y, color) => {
  currentCanvas[x * 4 + y * canvasWidth * 4] = color[0];
  currentCanvas[x * 4 + y * canvasWidth * 4 + 1] = color[1];
  currentCanvas[x * 4 + y * canvasWidth * 4 + 2] = color[2];
});

const number_of_ws = 1;

const wss: Socket[] = [];

let readying = number_of_ws;

async function newWs(num: number): Promise<void> {
  const ws = io("wss://foloplace.tobycm.systems", {
    forceNew: true,
    transports: ["websocket"],
  });

  ws.on("connect", () => {
    console.log("ws", num, "ready");
    readying--;
  });

  wss.push(ws);
  await new Promise((resolve) => setTimeout(resolve, 75));
}

(async () => {
  for (let i = 0; i < number_of_ws; i++) await newWs(i);
})();

async function getWS(): Promise<Socket> {
  let ws: Socket;
  let ded = wss.length;
  do {
    ws = wss.shift()!;
    if (ded === 0) {
      throw new Error("no ws available");
    }
    ded--;
  } while (!ws.connected);
  wss.push(ws);

  return ws;
}

const startingCoord: [number, number] = [1030, 70];
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
    let ws: Socket;
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

    ws.emit("place", coord[0], coord[1], color);
    await new Promise((resolve) => setTimeout(resolve, 2)); // cool down
  }
})();
