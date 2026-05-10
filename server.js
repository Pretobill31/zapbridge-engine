const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();

app.use(cors());
app.use(express.json());

let qrGlobal = null;
let statusGlobal = "offline";
let sock = null;

// =========================
// INICIAR WHATSAPP
// =========================

async function startWhatsApp() {

  const { state, saveCreds } =
    await useMultiFileAuthState("auth");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  // EVENTOS CONEXÃO
  sock.ev.on("connection.update", async (update) => {

    const {
      connection,
      qr,
      lastDisconnect
    } = update;

    // QR CODE
    if (qr) {

      qrGlobal = await QRCode.toDataURL(qr);

      console.log("QR CODE GERADO");

    }

    // CONECTADO
    if (connection === "open") {

      statusGlobal = "online";

      console.log("WHATSAPP CONECTADO");

    }

    // DESCONECTOU
    if (connection === "close") {

      statusGlobal = "offline";

      console.log("WHATSAPP DESCONECTADO");

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) {

        startWhatsApp();

      }

    }

  });

  // SALVAR SESSÃO
  sock.ev.on("creds.update", saveCreds);

  // RECEBER MENSAGENS
  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0];

    if (!msg.message) return;

    const numero =
      msg.key.remoteJid;

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    console.log("NOVA MENSAGEM");
    console.log(numero);
    console.log(texto);

  });

}

// INICIAR ENGINE
startWhatsApp();

// =========================
// ROTA STATUS
// =========================

app.get("/", (req, res) => {

  res.send("ZapBridge Engine Online");

});

// =========================
// QR CODE
// =========================

app.get("/qr", async (req, res) => {

  res.json({
    status: statusGlobal,
    qr: qrGlobal
  });

});

// =========================
// STATUS API
// =========================

app.get("/status", (req, res) => {

  res.json({
    status: statusGlobal
  });

});

// =========================
// ENVIAR MENSAGEM
// =========================

app.post("/send", async (req, res) => {

  try {

    const { number, message } = req.body;

    if (!number || !message) {

      return res.status(400).json({
        error: "Número e mensagem obrigatórios"
      });

    }

    const numeroFormatado =
      number.replace(/\D/g, "") + "@s.whatsapp.net";

    await sock.sendMessage(numeroFormatado, {
      text: message
    });

    res.json({
      status: "ok",
      enviado: true
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      status: "erro",
      detalhes: err.message
    });

  }

});

// =========================
// PORTA
// =========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(`ZapBridge Engine rodando na porta ${PORT}`);

});
