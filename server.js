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

// =====================================
// INICIAR WHATSAPP
// =====================================

async function startWhatsApp() {

  try {

    console.log("INICIANDO ENGINE...");

    const { state, saveCreds } =
      await useMultiFileAuthState("./auth");

    // PEGA VERSÃO MAIS RECENTE
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

    // =====================================
    // EVENTOS CONEXÃO
    // =====================================

    sock.ev.on("connection.update", async (update) => {

      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      console.log("UPDATE:", update);

      // QR GERADO
      if (qr) {

        console.log("QR RECEBIDO");

        qrGlobal =
          await QRCode.toDataURL(qr);

        statusGlobal = "aguardando_qr";

      }

      // CONECTADO
      if (connection === "open") {

        console.log("WHATSAPP CONECTADO");

        statusGlobal = "online";

        qrGlobal = null;

      }

      // DESCONECTOU
      if (connection === "close") {

        console.log("CONEXÃO FECHADA");

        statusGlobal = "offline";

        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;

        if (shouldReconnect) {

          console.log("RECONECTANDO...");

          startWhatsApp();

        }

      }

    });

    // SALVAR SESSÃO
    sock.ev.on("creds.update", saveCreds);

    // =====================================
    // RECEBER MENSAGENS
    // =====================================

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

  } catch (err) {

    console.log("ERRO
