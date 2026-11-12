"use strict";

// Indicador visual aislado: no solicita ni confirma cambios fisicos del vehiculo.
window.SCARLETTE_LIGHTS = (() => {
  const descripciones = Object.freeze({
    unknown: "Estado de luces desconocido. Sin confirmación física del vehículo.",
    control: "Control de luces activado, estado estimado. Sin confirmación física del vehículo.",
    on: "Luces estimadas encendidas. Sin confirmación física del vehículo.",
    off: "Luces estimadas apagadas. Sin confirmación física del vehículo."
  });

  function setState(estado) {
    if (!Object.prototype.hasOwnProperty.call(descripciones, estado)) {
      throw new RangeError("Estado de luces inválido: usa unknown, control, on u off.");
    }

    const boton = document.querySelector('.movement[data-command="28"]');
    if (!boton) return false;

    const descripcion = descripciones[estado];
    boton.classList.toggle("lights-active", estado === "on");
    boton.dataset.lightsState = estado;
    boton.setAttribute("aria-description", descripcion);
    boton.title = descripcion;

    // Reutiliza la descripción existente sin cambiar etiquetas ni iconos.
    const detalle = document.getElementById("lights-status");
    if (detalle) detalle.textContent = descripcion;
    return true;
  }

  // panel.html carga este script después del marcado del botón.
  setState("unknown");
  return Object.freeze({ setState });
})();
