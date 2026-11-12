
"use strict";

window.SCARLETTE_CONTROLS = (() => {
  const api = window.SCARLETTE_API;
  const ID_VEHICULO = window.SCARLETTE_CONFIG.VEHICLE_ID;

  const COMANDOS = Object.freeze({
    avanzar: 25,
    retroceder: 26,
    diagonalIzquierda: 27,
    luces: 28,
    diagonalDerecha: 29,
    rectoIzquierda: 30,
    postura: 31,
    rectoDerecha: 32,
    musica: 34,
    giro360: 35,
    giroIzquierda: 36,
    giroDerecha: 37
  });

  let controlesActivos = false;
  let movimientoEnCurso = false;

  async function ejecutarMovimiento(idComando) {
    if (!controlesActivos || movimientoEnCurso) return;

    movimientoEnCurso = true;

    try {
      const resultado = await api.solicitar(
        `/vehiculos/${ID_VEHICULO}/movimientos`,
        {
          method: "POST",
          body: JSON.stringify({
            id_comando: idComando,
            origen: "scarlette_web"
          })
        }
      );

      console.info("SCARLETTE: movimiento solicitado", resultado);
      return resultado;
    } catch (error) {
      console.error("SCARLETTE: error de movimiento", error);
      alert(`No se pudo ejecutar el movimiento: ${error.message}`);
    } finally {
      movimientoEnCurso = false;
    }
  }

  async function detenerVehiculo() {
    if (!controlesActivos) return;

    try {
      const resultado = await api.solicitar(
        `/vehiculos/${ID_VEHICULO}/detener`,
        { method: "POST" }
      );

      console.info("SCARLETTE: STOP solicitado", resultado);
      return resultado;
    } catch (error) {
      console.error("SCARLETTE: error de STOP", error);
      alert(`No se pudo enviar STOP: ${error.message}`);
    }
  }

  function vincularBoton(selector, accion) {
    const boton = document.querySelector(selector);
    if (!boton) return;

    boton.disabled = false;
    boton.addEventListener("click", accion);
  }

  function iniciar() {
    if (controlesActivos) return;
    controlesActivos = true;

    vincularBoton(".direction.up",
      () => ejecutarMovimiento(COMANDOS.avanzar));

    vincularBoton(".direction.down",
      () => ejecutarMovimiento(COMANDOS.retroceder));

    vincularBoton(".direction.left",
      () => ejecutarMovimiento(COMANDOS.giroIzquierda));

    vincularBoton(".direction.right",
      () => ejecutarMovimiento(COMANDOS.giroDerecha));

    vincularBoton(".joystick-center", detenerVehiculo);
    vincularBoton(".emergency-stop", detenerVehiculo);

    const botones = document.querySelectorAll(".movement");

    const movimientos = [
      COMANDOS.diagonalIzquierda,
      COMANDOS.luces,
      COMANDOS.diagonalDerecha,
      COMANDOS.rectoIzquierda,
      COMANDOS.postura,
      COMANDOS.rectoDerecha,
      COMANDOS.musica,
      COMANDOS.giro360
    ];

    botones.forEach((boton, indice) => {
      if (indice >= movimientos.length) return;

      boton.disabled = false;
      boton.addEventListener("click", () => {
        ejecutarMovimiento(movimientos[indice]);
      });
    });

    console.info("SCARLETTE: controles de movimiento preparados.");
  }
  // ==========================================
  // DEMOS DE TERRENEITOR
  // ==========================================

  let demoEnCurso = false;

  async function cargarDemos() {
    const selector = document.getElementById("demo");
    if (!selector) return;

    try {
      const demos = await api.solicitar(
        `/vehiculos/${ID_VEHICULO}/demos`,
        { method: "GET" }
      );

      selector.replaceChildren();

      const opcionInicial = document.createElement("option");
      opcionInicial.value = "";
      opcionInicial.textContent = "Selecciona una DEMO";
      selector.appendChild(opcionInicial);

      demos
        .filter(demo => demo.activo)
        .forEach(demo => {
          const opcion = document.createElement("option");
          opcion.value = String(demo.id_demo);
          opcion.textContent = demo.nombre;
          selector.appendChild(opcion);
        });

      selector.disabled = demos.every(demo => !demo.activo);

      console.info("SCARLETTE: DEMOs cargadas.", demos);
    } catch (error) {
      console.error("Error al cargar DEMOs:", error);
      selector.disabled = true;
    }
  }

  async function ejecutarDemo() {
    if (!controlesActivos || demoEnCurso) return;

    const selector = document.getElementById("demo");
    const idDemo = Number(selector?.value);

    if (!idDemo) {
      alert("Selecciona una DEMO.");
      return;
    }

    demoEnCurso = true;

    try {
      const resultado = await api.solicitar(
        `/vehiculos/${ID_VEHICULO}/demos/${idDemo}/iniciar`,
        { method: "POST" }
      );

      console.info("SCARLETTE: DEMO solicitada.", resultado);
    } catch (error) {
      demoEnCurso = false;
      alert(`No se pudo iniciar la DEMO: ${error.message}`);
    }
  }

  async function cancelarDemo() {
    if (!controlesActivos) return;

    try {
      await api.solicitar(
        `/vehiculos/${ID_VEHICULO}/demos/cancelar`,
        { method: "POST" }
      );

      console.info("SCARLETTE: cancelación solicitada.");
    } catch (error) {
      alert(`No se pudo cancelar la DEMO: ${error.message}`);
    }
  }

  function prepararControlesDemo() {
    const ejecutar = document.querySelector(".demo-card .neon-button");
    const cancelar = document.querySelector(".demo-card .outline-button");

    if (ejecutar) {
      ejecutar.disabled = false;
      ejecutar.addEventListener("click", ejecutarDemo);
    }

    if (cancelar) {
      cancelar.disabled = false;
      cancelar.addEventListener("click", cancelarDemo);
    }

    cargarDemos();
  }

  document.addEventListener("scarlette:sesion-verificada", prepararControlesDemo);

  document.addEventListener("scarlette:evento-ws", evento => {
    const tipo = evento.detail?.tipo;

    if (tipo === "demo_inicio") {
      demoEnCurso = true;
    }

    if (["demo_fin", "demo_cancelada", "demo_error"].includes(tipo)) {
      demoEnCurso = false;
    }
  });

  document.addEventListener("scarlette:sesion-verificada", iniciar);

  return Object.freeze({
    ejecutarMovimiento,
    detenerVehiculo
  });
})();
