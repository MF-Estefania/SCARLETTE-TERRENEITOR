
"use strict";

window.SCARLETTE_CONNECTIONS = (() => {
  const api = window.SCARLETTE_API;
  const config = window.SCARLETTE_CONFIG;

  const INTERVALO = 30000;
  let temporizador = null;
  let activo = false;
  let consultando = false;
  let actualizacionPendiente = false;
  let actualizacionProgramada = null;
  let ultimoEstado = Object.freeze({ estado: "loading", datos: null, http: null });

  function publicarEstado(estado, datos = ultimoEstado.datos, http = null) {
    ultimoEstado = Object.freeze({ estado, datos, http });
    document.dispatchEvent(new CustomEvent("scarlette:estado-actualizado", { detail: ultimoEstado }));
  }

  function solicitarActualizacion() {
    if (!activo) return;
    actualizacionPendiente = true;
    if (consultando || actualizacionProgramada !== null) return;
    actualizacionProgramada = setTimeout(() => {
      actualizacionProgramada = null;
      void verificar();
    }, 500);
  }

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
    actualizacionPendiente = false;
    if (actualizacionProgramada !== null) clearTimeout(actualizacionProgramada);
    actualizacionProgramada = null;
    publicarEstado("loading");

    try {
      const datos = await api.solicitar(
        `/vehiculos/${config.VEHICLE_ID}/estado`,
        { method: "GET" }
      );

      if (!activo) return;

      actualizarIndicador(1, "Disponible", true);
      actualizarIndicador(2, "Disponible", true);

      // El estado físico no determina la disponibilidad de API/RDS.
      const valido = datos && !Array.isArray(datos) && datos.id_vehiculo === config.VEHICLE_ID &&
        ["comando", "codigo", "fecha_actualizacion"].every(campo =>
          Object.prototype.hasOwnProperty.call(datos, campo) &&
          (datos[campo] === null || typeof datos[campo] === "string"));
      if (!valido) {
        publicarEstado("error");
      } else {
        const registro = Object.freeze({
          comando: datos.comando,
          codigo: datos.codigo,
          fecha_actualizacion: datos.fecha_actualizacion
        });
        publicarEstado(datos.comando || datos.codigo || datos.fecha_actualizacion ? "ready" : "empty", registro);
      }

    } catch (error) {
      if (!activo) return;

      console.warn("SCARLETTE: verificación de conexiones:", error.message);
      publicarEstado("error", ultimoEstado.datos, error.status || null);

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
      if (actualizacionPendiente) solicitarActualizacion();
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
    actualizacionPendiente = false;
    if (actualizacionProgramada !== null) clearTimeout(actualizacionProgramada);
    actualizacionProgramada = null;

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
    verificar,
    solicitarActualizacion,
    obtenerEstado: () => ultimoEstado
  });
})();
