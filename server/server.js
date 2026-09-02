// server/server.js
require("dotenv").config();
const os = require("os");
const app = require("./src/app");

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

// Helper function to extract local Wi-Fi / Ethernet IPv4 address
function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignore internal (127.0.0.1) and non-IPv4 addresses
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

const server = app.listen(PORT, HOST, () => {
  const networkIp = getLocalNetworkIp();
  console.log(`\n🚀 [api] Ahmad portfolio backend running!`);
  console.log(`   - Local:   http://localhost:${PORT}`);
  console.log(`   - Network: http://${networkIp}:${PORT}\n`);
});

module.exports = server;