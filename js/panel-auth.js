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

    // Ocultar el aviso de vista previa cuando la sesión sea válida.
    const avisoVistaPrevia = document.querySelector(".preview-notice");
    if (avisoVistaPrevia) {
      avisoVistaPrevia.hidden = true;
    }

    // Notificar a los módulos del panel que la sesión es válida.
    document.dispatchEvent(
      new CustomEvent("scarlette:sesion-verificada", {
        detail: { usuario }
     })
    );

console.info("SCARLETTE: sesión verificada correctamente.");
  } catch (error) {
    console.error("SCARLETTE: no fue posible verificar la sesión.");

    // No mostrar el panel si la verificación falla.
    window.location.replace("index.html");
  }
});

/* SCARLETTE - Cierre de sesion */
document.addEventListener("DOMContentLoaded", () => {
  const boton = document.getElementById("logout-button");
  if (!boton) return;

  boton.addEventListener("click", async () => {
    if (boton.disabled) return;

    boton.disabled = true;
    boton.textContent = "Cerrando sesión...";

    try {
      await window.SCARLETTE_AUTH.cerrarSesion();
    } catch (error) {
      console.warn(
        "No se pudo confirmar el cierre de sesión en AWS:",
        error.message
      );
      alert(
        "Se eliminó la sesión de este navegador, pero no se pudo confirmar su cierre en AWS."
      );
    } finally {
      window.SCARLETTE_API.limpiarToken();
      window.location.replace("index.html");
    }
  });
});
