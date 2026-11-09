
"use strict";

window.SCARLETTE_WS = (() => {
  const api = window.SCARLETTE_API;
  const config = window.SCARLETTE_CONFIG;

  let socket = null;
  let temporizador = null;
  let activo = false;
  let conectando = false;
  let intentos = 0;

  const MAX_EVENTOS = 40;

  function indicadorWebSocket(estado, conectado = false) {
    const indicadores = document.querySelectorAll(
      ".connection"
    );

    const elemento = indicadores[0]?.querySelector(
      ".connection-state"
    );

    if (!elemento) return;

    elemento.innerHTML = "";

    const punto = document.createElement("i");
    const texto = document.createTextNode(estado);

    if (conectado) {
      punto.style.backgroundColor = "#39e6a3";
      punto.style.boxShadow = "0 0 8px #39e6a3";
    }

    elemento.append(punto, texto);
  }

  function registrarEvento(tipo, mensaje) {
    const contenedor = document.querySelector(".events-card");
    if (!contenedor) return;

    const vacio = contenedor.querySelector(".events-empty");
    if (vacio) vacio.remove();

    let lista = contenedor.querySelector(".scarlette-events");

    if (!lista) {
      lista = document.createElement("div");
      lista.className = "scarlette-events";
      lista.setAttribute("aria-live", "polite");
      lista.style.maxHeight = "280px";
      lista.style.overflowY = "auto";
      lista.style.padding = "12px 0";
      contenedor.appendChild(lista);
    }

    const evento = document.createElement("div");
    evento.style.padding = "9px 12px";
    evento.style.marginBottom = "7px";
    evento.style.border = "1px solid rgba(255, 105, 180, .22)";
    evento.style.borderRadius = "9px";
    evento.style.fontSize = ".85rem";
    evento.style.overflowWrap = "anywhere";

    const hora = new Date().toLocaleTimeString("es-MX");

    const encabezado = document.createElement("strong");
    encabezado.textContent = `[${hora}] ${tipo}`;

    const detalle = document.createElement("div");
    detalle.textContent = mensaje;

    evento.append(encabezado, detalle);
    lista.prepend(evento);

    while (lista.children.length > MAX_EVENTOS) {
      lista.lastElementChild.remove();
    }
  }

  function procesarEvento(datos) {
    if (!datos || typeof datos !== "object") return;

    const tipo = datos.tipo || "evento";

    const mensajes = {
      estado_inicial: "Estado inicial recibido desde AWS.",
      movimiento_individual:
        `Movimiento: ${datos.comando || datos.codigo || "Sin nombre"}`,
      detener_vehiculo: "Solicitud STOP enviada por AWS.",
      demo_inicio: "DEMO iniciada.",
      demo_movimiento:
        `DEMO: ${datos.comando || datos.codigo || "Movimiento"}`,
      demo_fin: "DEMO finalizada.",
      demo_cancelada: "DEMO cancelada.",
      demo_error: datos.mensaje || "Error durante la DEMO.",
      error: datos.mensaje || "Error recibido desde AWS."
    };

    registrarEvento(
      tipo,
      mensajes[tipo] || JSON.stringify(datos)
    );

    document.dispatchEvent(
      new CustomEvent("scarlette:evento-ws", {
        detail: datos
      })
    );
  }

  function programarReconexion() {
    if (!activo || temporizador) return;

    intentos += 1;

    const espera = Math.min(
      1000 * Math.pow(2, Math.min(intentos, 5)),
      30000
    );

    indicadorWebSocket("Reconectando...");

    temporizador = setTimeout(() => {
      temporizador = null;
      conectar();
    }, espera);
  }

  async function conectar() {
    if (!activo || conectando) return;

    if (socket && (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    )) return;

    conectando = true;
    indicadorWebSocket("Conectando...");

    try {
      const respuesta = await api.solicitar(
        "/auth/ws-ticket",
        { method: "POST" }
      );

      if (!activo) return;

      if (!respuesta?.ticket) {
        throw new Error("AWS no devolvió un ticket WebSocket.");
      }

      const url =
        `${config.WS_BASE_URL}/ws/vehiculos/${config.VEHICLE_ID}` +
        `?ticket=${encodeURIComponent(respuesta.ticket)}`;

      const conexion = new WebSocket(url);
      socket = conexion;

      conexion.addEventListener("open", () => {
        if (!activo || socket !== conexion) return;

        intentos = 0;
        indicadorWebSocket("Conectado", true);
        registrarEvento("conexión", "WebSocket conectado con AWS.");
      });

      conexion.addEventListener("message", evento => {
        if (!activo || socket !== conexion) return;

        try {
          procesarEvento(JSON.parse(evento.data));
        } catch {
          registrarEvento(
            "aviso",
            "Se recibió un mensaje con formato no válido."
          );
        }
      });

      conexion.addEventListener("close", () => {
        if (socket !== conexion) return;

        socket = null;
        indicadorWebSocket("Desconectado");
        registrarEvento("conexión", "WebSocket desconectado.");

        programarReconexion();
      });

      conexion.addEventListener("error", () => {
        if (socket !== conexion) return;
        indicadorWebSocket("Error de conexión");
      });

    } catch (error) {
      console.error("SCARLETTE: WebSocket", error);

      indicadorWebSocket("Sin conexión");
      registrarEvento("error", error.message);

      if (error.status === 401) {
        detener();
        api.limpiarToken();
        window.location.replace("index.html");
        return;
      }

      programarReconexion();
    } finally {
      conectando = false;
    }
  }

  function iniciar() {
    if (activo) return;

    activo = true;
    conectar();
  }

  function detener() {
    activo = false;

    if (temporizador) {
      clearTimeout(temporizador);
      temporizador = null;
    }

    if (socket) {
      const conexion = socket;
      socket = null;
      conexion.close();
    }

    indicadorWebSocket("Desconectado");
  }

  document.addEventListener(
    "scarlette:sesion-verificada",
    iniciar
  );

  window.addEventListener("pagehide", detener);

  return Object.freeze({
    iniciar,
    detener,
    registrarEvento
  });
})();
