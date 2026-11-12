"use strict";

// Cliente HTTP de SCARLETTE TERRENEITOR.
// No almacenar contraseñas ni API Keys en este archivo.

window.SCARLETTE_API = (() => {
  const config = window.SCARLETTE_CONFIG;
  const CLAVE_SESION = "scarlette_access_token";

  let tokenSesion = sessionStorage.getItem(CLAVE_SESION);

  function establecerToken(token) {
    tokenSesion = token || null;

    if (tokenSesion) {
      sessionStorage.setItem(CLAVE_SESION, tokenSesion);
    } else {
      sessionStorage.removeItem(CLAVE_SESION);
    }
  }

  function obtenerToken() {
    return tokenSesion;
  }

  function limpiarToken() {
    establecerToken(null);
  }

  async function solicitar(ruta, opciones = {}) {
    const controlador = new AbortController();

    const timeout = setTimeout(
      () => controlador.abort(),
      config.REQUEST_TIMEOUT_MS
    );

    const encabezados = new Headers(opciones.headers || {});

    if (tokenSesion) {
      encabezados.set("Authorization", `Bearer ${tokenSesion}`);
    }

    if (opciones.body !== undefined && !(opciones.body instanceof FormData)) {
      encabezados.set("Content-Type", "application/json");
    }

    try {
      const respuesta = await fetch(
        `${config.API_BASE_URL}${ruta}`,
        {
          ...opciones,
          headers: encabezados,
          signal: controlador.signal,
          cache: "no-store"
        }
      );

      const contenido = await respuesta.text();
      let datos = null;

      if (contenido) {
        try {
          datos = JSON.parse(contenido);
        } catch {
          throw new Error("La API devolvió una respuesta no válida.");
        }
      }

      if (!respuesta.ok) {
        let detalle = datos?.detail;

        if (Array.isArray(detalle)) {
          detalle = detalle.map(item => item.msg).join("; ");
        }

        if (typeof detalle !== "string") {
          detalle = `Error HTTP ${respuesta.status}`;
        }

        const error = new Error(detalle);
        error.status = respuesta.status;
        throw error;
      }

      return datos;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("La solicitud superó el tiempo de espera.");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return Object.freeze({
    solicitar,
    establecerToken,
    obtenerToken,
    limpiarToken
  });
})();
