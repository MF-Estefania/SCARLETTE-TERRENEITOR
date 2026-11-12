"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const formulario = document.getElementById("login-form");
  const cuenta = document.getElementById("account");
  const usuario = document.getElementById("username");
  const password = document.getElementById("password");
  const boton = formulario?.querySelector('button[type="submit"]');
  const mensaje = document.querySelector("#auth-note span");

  if (!formulario || !cuenta || !usuario || !password || !boton || !mensaje) {
    console.error("No se encontraron todos los elementos del formulario.");
    return;
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (boton.disabled) return;

    boton.disabled = true;
    mensaje.textContent = "Verificando credenciales...";

    try {
      await window.SCARLETTE_AUTH.iniciarSesion(
        cuenta.value,
        usuario.value,
        password.value
      );

      password.value = "";
      mensaje.textContent = "Acceso correcto. Abriendo SCARLETTE...";

      window.location.assign("panel.html");
    } catch (error) {
      password.value = "";

      if (error.status === 401) {
        mensaje.textContent = "Usuario o contraseña incorrectos.";
      } else if (error.status === 429) {
        mensaje.textContent = "Demasiados intentos. Intenta más tarde.";
      } else {
        mensaje.textContent = error.message || "No fue posible iniciar sesión.";
      }

      boton.disabled = false;
    }
  });
});
