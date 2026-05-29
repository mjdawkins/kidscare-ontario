import dotenv from "dotenv"; dotenv.config({path:".env.local"});
import { postalCodeToCoords } from "../src/lib/geo.js";

async function main() {
  const codes = ["L9T2H3", "M5V2T6", "K1A0B1"];
  for (const code of codes) {
    const coords = await postalCodeToCoords(code);
    console.log(`${code}: ${coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "NOT FOUND"}`);
  }
}
main();
