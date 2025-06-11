const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 10000;
const SESSION_ID = "arslan-md";

const SESSION_DIR = path.join(__dirname, "sessions", SESSION_ID);
fs.ensureDirSync(SESSION_DIR);

app.use(express.static("public"));

app.get("/qr", async (req, res) => {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const sock = makeWASocket({
      printQRInTerminal: false,
      auth: state,
      logger: pino({ level: "silent" })
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr } = update;
      if (qr) {
        const qrImage = await qrcode.toDataURL(qr);
        res.send(`
          <html>
            <body style="text-align:center; font-family:sans-serif">
              <h2>Scan QR Code to Link WhatsApp</h2>
              <img src="${qrImage}" width="300" />
              <p>QR code refresh hone se pehle scan kar lein</p>
            </body>
          </html>
        `);
      }

      if (connection === "open") {
        console.log("✅ WhatsApp connected");
        await saveCreds();
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).send("QR generate nahi ho paya.");
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
