const express = require("express");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const fs = require("fs-extra");
const QRCode = require("qrcode");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files from public directory
app.use(express.static("public"));

// Ensure session folder exists
const sessionId = "arslan-md";
const sessionFolder = path.join(__dirname, "sessions", sessionId);
fs.ensureDirSync(sessionFolder); // No error even if already exists

let qrData = ""; // Latest QR string for frontend display

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // We show QR on frontend instead
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr } = update;

    if (qr) {
      qrData = await QRCode.toDataURL(qr); // Convert QR to base64 image
      console.log("📱 QR Code generated.");
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Connected!");
    }

    if (connection === "close") {
      console.log("❌ Connection closed, reconnecting...");
      startWhatsApp();
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// Start server and WhatsApp connection
app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
  startWhatsApp();
});

// Endpoint to serve QR code as base64
app.get("/qr", (req, res) => {
  if (qrData) {
    res.send(`<img src="${qrData}" style="width:300px" />`);
  } else {
    res.send("⏳ QR Code not generated yet. Please wait...");
  }
});
