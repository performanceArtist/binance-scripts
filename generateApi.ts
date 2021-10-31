import {
  generateApifromFile
} from "binance-typescript-api";
import { either } from "fp-ts";
import path from "path";

// TODO: figure out a way to use the remote version - had to replace anyOf with oneOf so devex generation would work
generateApifromFile(
  path.resolve(__dirname, ""),
  "spot_api.yaml",
  "generated"
)().then(either.fold(console.error, console.log));
