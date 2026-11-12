"use strict";

window.SCARLETTE_AUTH = (() => {
  const api = window.SCARLETTE_API;

  const ROLES = Object.freeze({
    admin: "administradora",
    user: "usuario"
  });

  async function iniciarSesion(tipoCuenta, nombreUsuario, password) {
    const rolEsperado = ROLES[tipoCuenta];

    if (!rolEsperado) {
      throw new Error("Selecciona un tipo de cuenta válido.");
    }

    if (!nombreUsuario.trim() || !password) {
      throw new Error("Ingresa tu usuario y contraseña.");
    }

    const resultado = await api.solicitar("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        nombre_usuario: nombreUsuario.trim(),
        password: password
      })
    });

    if (!resultado?.access_token || !resultado?.usuario?.rol) {
      throw new Error("La respuesta de autenticación no es válida.");
    }

    if (resultado.usuario.rol !== rolEsperado) {
      try {
        api.establecerToken(resultado.access_token);
        await api.solicitar("/auth/logout", {
          method: "POST"
        });
      } finally {
        api.limpiarToken();
      }

      throw new Error("La cuenta no corresponde al tipo seleccionado.");
    }

    api.establecerToken(resultado.access_token);

    return resultado.usuario;
  }

  async function verificarSesion() {
    if (!api.obtenerToken()) {
      return null;
    }

    try {
      return await api.solicitar("/auth/me", {
        method: "GET"
      });
    } catch (error) {
      if (error.status === 401) {
        api.limpiarToken();
      }

      throw error;
    }
  }

  async function cerrarSesion() {
    try {
      if (api.obtenerToken()) {
        await api.solicitar("/auth/logout", {
          method: "POST"
        });
      }
    } finally {
      api.limpiarToken();
    }
  }

  return Object.freeze({
    iniciarSesion,
    verificarSesion,
    cerrarSesion
  });
})();
