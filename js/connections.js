
"use strict";

window.SCARLETTE_CONNECTIONS = (() => {
  const api = window.SCARLETTE_API;
  const config = window.SCARLETTE_CONFIG;

  const INTERVALO = 30000;
  let temporizador = null;
  let activo = false;
  let consultando = false;

  function actualizarIndicador(indice, mensaje, disponible) {
    const conexiones = document.querySelectorAll(".connection");
    const estado = conexiones[indice]?.querySelector(".connection-state");

    if (!estado) return;

    estado.replaceChildren();

    const punto = document.createElement("i");
    const texto = document.createTextNode(mensaje);

    if (disponible) {
      punto.style.backgroundColor = "#39e6a3";
      punto.style.boxShadow = "0 0 8px #39e6a3";
    }

    estado.append(punto, texto);
  }

  async function verificar() {
    if (!activo || consultando) return;

    consultando = true;

    try {
      await api.solicitar(
        `/vehiculos/${config.VEHICLE_ID}/estado`,
        { method: "GET" }
      );

      if (!activo) return;

      actualizarIndicador(1, "Disponible", true);
      actualizarIndicador(2, "Disponible", true);

    } catch (error) {
      if (!activo) return;

      console.warn("SCARLETTE: verificación de conexiones:", error.message);

      if (error.status === 503) {
        actualizarIndicador(1, "Disponible", true);
        actualizarIndicador(2, "No disponible", false);
      } else if (error.status === 401) {
        actualizarIndicador(1, "Sesión expirada", false);
        actualizarIndicador(2, "Sin verificar", false);
      } else if (error.status) {
        actualizarIndicador(1, "Responde con error", false);
        actualizarIndicador(2, "Sin verificar", false);
      } else {
        actualizarIndicador(1, "Sin conexión", false);
        actualizarIndicador(2, "Sin verificar", false);
      }
    } finally {
      consultando = false;
    }
  }

  function iniciar() {
    if (activo) return;

    activo = true;
    verificar();

    temporizador = setInterval(verificar, INTERVALO);
  }

  function detener() {
    activo = false;

    if (temporizador) {
      clearInterval(temporizador);
      temporizador = null;
    }
  }

  document.addEventListener("scarlette:sesion-verificada", iniciar);
  window.addEventListener("pagehide", detener);

  return Object.freeze({
    iniciar,
    detener,
    verificar
  });
})();
