const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeInMemoryStore } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static('public'));

app.get('/qr', async (req, res) => {
  try {
    const sessionDir = './sessions/arslan-md';

    // ✅ Make sure directory exists
    fs.ensureDirSync(sessionDir);

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr } = update;
      if (qr) {
        const qrImage = await qrcode.toDataURL(qr);
        res.send(`<h2>Scan QR with WhatsApp</h2><img src="${qrImage}" />`);
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp Connected!');
        await saveCreds();
      }

      if (connection === 'close') {
        const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('🔁 Reconnecting...');
          startWhatsApp();
        } else {
          console.log('❌ Logged out from WhatsApp');
        }
      }
    });
  } catch (err) {
    console.error('❌ Error generating QR:', err);
    res.status(500).send('Something went wrong!');
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
