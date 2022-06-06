import consola, { JSONReporter } from "consola";
import { isProduction } from "../config";

if (isProduction) {
  consola.setReporters([new JSONReporter()]);
}

export const logger = consola;
