module.exports = {
  apps : [
    { name: "api-server", script: "./server.js" },
    { name: "bookingWorker", script: "./src/worker/bookingWorker.js" },
    { name: "chartWorker", script: "./src/worker/chartWorker.js" },
    { name: "refundWorker", script: "./src/worker/refundWorker.js" }
  ]
}