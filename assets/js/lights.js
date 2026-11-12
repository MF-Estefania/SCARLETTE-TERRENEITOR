"use strict";

// Indicador visual aislado: no solicita ni confirma cambios fisicos del vehiculo.
window.SCARLETTE_LIGHTS = (() => {
  let paso = null;
  let revision = 0;
  let pendientes = 0;
  const observadas = new WeakSet();
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
    // Probar on/off/control solo cambia la apariencia: no inicia ni borra una
    // estimacion ya confirmada. unknown invalida la referencia (errores incluidos).
    if (estado === "unknown") {
      paso = null;
      revision += 1;
    }
    return mostrar(estado);
  }

  function mostrar(estado) {
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

  // Solo iniciar tras verificar fisicamente el estado anterior a la primera
  // pulsacion. No basta con observar luces apagadas (hay estados distintos).
  function startEstimation({ initialStateConfirmed = false } = {}) {
    if (initialStateConfirmed !== true || pendientes) return false;
    revision += 1;
    paso = 0;
    mostrar("unknown");
    return true;
  }

  function confirmPress() {
    if (paso === null || paso >= 3) {
      setState("unknown");
      return;
    }
    paso += 1;
    mostrar(["unknown", "control", "on", "off"][paso]);
  }

  // Observa la peticion ya enviada por controls.js; no crea ni repite comandos.
  function observeRequest(peticion) {
    if (observadas.has(peticion)) return;
    observadas.add(peticion);
    const referencia = revision;
    pendientes += 1;
    void Promise.resolve(peticion).then(() => {
      pendientes -= 1;
      if (referencia === revision) confirmPress();
    }, () => {
      pendientes -= 1;
      setState("unknown");
    });
  }

  // panel.html carga este script después del marcado del botón.
  setState("unknown");
  return Object.freeze({ setState, startEstimation, confirmPress, observeRequest });
})();
