"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const api = window.SCARLETTE_API;
  const auth = window.SCARLETTE_AUTH;

  // El panel permanece oculto hasta verificar la sesión.
  document.body.style.visibility = "hidden";

  if (!api || !auth || !api.obtenerToken()) {
    window.location.replace("index.html");
    return;
  }

  try {
    const usuario = await auth.verificarSesion();

    if (!usuario || !["administradora", "usuario"].includes(usuario.rol)) {
      api.limpiarToken();
      window.location.replace("index.html");
      return;
    }

    window.SCARLETTE_USUARIO = Object.freeze(usuario);

    // Sesión verificada. Mostrar el panel.
    document.body.style.visibility = "visible";

    console.info("SCARLETTE: sesión verificada correctamente.");
  } catch (error) {
    console.error("SCARLETTE: no fue posible verificar la sesión.");

    // No mostrar el panel si la verificación falla.
    window.location.replace("index.html");
  }
});
