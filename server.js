const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const app = express();

app.use(cors());
app.use(express.json());

let qrGlobal = null;
let statusGlobal = "iniciando";
let sock = null;

// ======================================
// INICIAR WHATSAPP
// ======================================

async function startWhatsApp() {

  try {

    console.log("🚀 INICIANDO ZAPBRIDGE ENGINE");

    const { state, saveCreds } =
      await useMultiFileAuthState("./auth");

    // VERSÃO MAIS RECENTE WHATSAPP WEB
    const { version } =
      await fetchLatestBaileysVersion();

    console.log("VERSÃO WHATSAPP:", version);

    sock = makeWASocket({

      version,

      auth: state,

      printQRInTerminal: true,

      browser: [
        "ZapBridge",
        "Chrome",
        "1.0.0"
      ]

    });

    // ======================================
    // EVENTOS CONEXÃO
    // ======================================

    sock.ev.on("connection.update", async (update) => {

      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      console.log("UPDATE:", connection);

      // QR GERADO
      if (qr) {

        console.log("✅ QR RECEBIDO");

        qrGlobal =
          await QRCode.toDataURL(qr);

        statusGlobal = "aguardando_qr";

      }

      // CONECTADO
      if (connection === "open") {

        console.log("✅ WHATSAPP CONECTADO");

        statusGlobal = "online";

        qrGlobal = null;

      }

      // DESCONECTOU
      if (connection === "close") {

        console.log("❌ WHATSAPP DESCONECTADO");

        statusGlobal = "offline";

        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;

        if (shouldReconnect) {

          console.log("🔄 RECONECTANDO...");

          startWhatsApp();

        }

      }

    });

    // ======================================
    // SALVAR SESSÃO
    // ======================================

    sock.ev.on("creds.update", saveCreds);

    // ======================================
    // RECEBER MENSAGENS
    // ======================================

    sock.ev.on("messages.upsert", async ({ messages }) => {

      const msg = messages[0];

      if (!msg.message) return;

      const numero =
        msg.key.remoteJid;

      const texto =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      console.log("📩 NOVA MENSAGEM");
      console.log(numero);
      console.log(texto);

    });

  } catch (err) {

    console.log("❌ ERRO ENGINE");
    console.log(err);

    statusGlobal = "erro";

  }

}

// ======================================
// INICIAR ENGINE
// ======================================

startWhatsApp();

// ======================================
// HOME
// ======================================

app.get("/", (req, res) => {

  res.send("ZapBridge Engine Online");

});

// ======================================
// QR CODE
// ======================================

app.get("/qr", (req, res) => {

  res.json({
    status: statusGlobal,
    qr: qrGlobal
  });

});

// ======================================
// STATUS
// ======================================

app.get("/status", (req, res) => {

  res.json({
    status: statusGlobal
  });

});

// ======================================
// ENVIAR MENSAGEM
// ======================================

app.post("/send", async (req, res) => {

  try {

    const {
      number,
      message
    } = req.body;

    if (!number || !message) {

      return res.status(400).json({
        status: "erro",
        mensagem:
          "Número e mensagem obrigatórios"
      });

    }

    const numeroFormatado =
      number.replace(/\D/g, "") +
      "@s.whatsapp.net";

    await sock.sendMessage(
      numeroFormatado,
      {
        text: message
      }
    );

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

// ======================================
// PORTA RENDER
// ======================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `🚀 ZapBridge Engine Online na porta ${PORT}`
  );

});
