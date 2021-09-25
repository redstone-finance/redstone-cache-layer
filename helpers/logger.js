const consola = require("consola");
const config = require("../config");

if (config.enableJsonLogs) {
  consola.setReporters([new consola.JSONReporter()]);
}

module.exports = consola;
