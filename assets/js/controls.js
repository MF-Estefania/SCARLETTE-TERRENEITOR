
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
  let movimientoEnCurso = null;
  let movimientoPendiente = null;
  let comandoEnCurso = null;
  let paradasPendientes = 0;
  let paradaFallida = false;
  let reiniciarJoystick = () => {};

  // Solo una petici?n de movimiento en vuelo; se conserva la intenci?n m?s reciente.
  function ejecutarMovimiento(idComando) {
    if (!controlesActivos || paradaFallida) return;
    if (idComando === COMANDOS.luces) {
      // Cada pulsacion cuenta: no encolar, combinar ni repetir el comando 28.
      if (lucesEnCurso || movimientoEnCurso || movimientoPendiente !== null || paradasPendientes) return;
      lucesEnCurso = true;
      mostrarLuces(true);
    }
    movimientoPendiente = idComando === comandoEnCurso && !paradasPendientes ? null : idComando;
    return procesarMovimiento();
  }

  async function procesarMovimiento() {
    if (movimientoEnCurso || paradasPendientes || movimientoPendiente === null) return;
    const idComando = movimientoPendiente;
    const revisionSolicitudLuces = revisionLuces;
    movimientoPendiente = null;
    const peticion = api.solicitar(`/vehiculos/${ID_VEHICULO}/movimientos`, {
      method: "POST",
      body: JSON.stringify({ id_comando: idComando, origen: "scarlette_web" })
    });
    movimientoEnCurso = peticion;
    comandoEnCurso = idComando;
    try {
      const resultado = await peticion;
      if (idComando === COMANDOS.luces && revisionSolicitudLuces === revisionLuces) {
        // No hay telemetria documentada de luces: HTTP confirma la solicitud,
        // no la ejecucion fisica. No se infiere un ciclo tras la tercera pulsacion.
        // Tras perder la referencia, una nueva solicitud inicia otra estimacion
        // local (no una sincronizacion fisica). La cuarta queda fuera de secuencia.
        pasoLuces = pasoLuces === null ? 1 : Math.min(pasoLuces + 1, 4);
      }
      return resultado;
    } catch (error) {
      if (idComando === COMANDOS.luces) invalidarEstimacionLuces();
      console.error("SCARLETTE: error de movimiento", error);
      // Un timeout no demuestra que el veh?culo est? detenido.
      void detenerVehiculo();
    } finally {
      if (idComando === COMANDOS.luces) {
        lucesEnCurso = false;
        mostrarLuces();
      }
      movimientoEnCurso = null;
      comandoEnCurso = null;
      void procesarMovimiento();
    }
  }

  async function detenerVehiculo() {
    if (!controlesActivos) return;
    reiniciarJoystick();
    movimientoPendiente = null;
    paradasPendientes += 1;
    const anterior = movimientoEnCurso;
    const solicitarStop = () => api.solicitar(
      `/vehiculos/${ID_VEHICULO}/detener`, { method: "POST" }
    );
    let fallo = null;
    try {
      // No esperar al movimiento para enviar la parada prioritaria.
      try { await solicitarStop(); } catch (error) { fallo = error; }
      if (anterior) {
        await anterior.catch(() => {});
        // Reafirmar STOP despu?s de la petici?n antigua, incluso si fall?.
        try { await solicitarStop(); fallo = null; } catch (error) { fallo = error; }
      }
      if (fallo) throw fallo;
      paradaFallida = false;
    } catch (error) {
      paradaFallida = true;
      movimientoPendiente = null;
      console.error("SCARLETTE: error de STOP", error);
      alert(`No se pudo confirmar STOP. Reintenta DETENER: ${error.message}`);
    } finally {
      paradasPendientes -= 1;
      if (!paradaFallida) void procesarMovimiento();
    }
    // El backend debe ordenar comandos tambi?n en el veh?culo: una respuesta HTTP
    // no garantiza que una orden publicada en AWS ya se haya aplicado f?sicamente.
  }

  function prepararJoystick() {
    const centro = document.querySelector(".joystick-center");
    const joystick = document.querySelector(".joystick");
    if (!centro || !joystick) return;
    centro.disabled = false;
    centro.setAttribute("aria-label", "Palanca: arrastra o usa las flechas para seleccionar movimiento. Pulsa sin arrastrar, Enter, espacio o Escape para STOP");
    joystick.setAttribute("aria-label", "Joystick de cuatro direcciones");
    const direcciones = {
      up: COMANDOS.avanzar, down: COMANDOS.retroceder,
      left: COMANDOS.giroIzquierda, right: COMANDOS.giroDerecha
    };
    const teclas = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    let puntero = null;
    let tecla = null;
    let activa = null;
    let arrastrado = false;
    let inicioX = 0;
    let inicioY = 0;
    const recorrido = () => Math.max(0,
      (joystick.clientWidth - centro.offsetWidth) / 2 - 4);

    function dibujar(x = 0, y = 0, direccion = null) {
      centro.style.setProperty("--joystick-x", `${x}px`);
      centro.style.setProperty("--joystick-y", `${y}px`);
      joystick.querySelectorAll(".direction").forEach(boton => {
        boton.classList.toggle("is-active", Boolean(direccion && boton.classList.contains(direccion)));
      });
    }

    reiniciarJoystick = () => {
      const previo = puntero;
      puntero = null;
      tecla = null;
      activa = null;
      arrastrado = false;
      centro.classList.remove("is-dragging");
      dibujar();
      if (previo !== null && centro.hasPointerCapture(previo)) centro.releasePointerCapture(previo);
    };

    function cambiar(direccion, x, y) {
      dibujar(x, y, direccion);
      // El centro solo es visual: conserva la ultima seleccion del gesto.
      if (!direccion || direccion === activa) return;
      activa = direccion;
      ejecutarMovimiento(direcciones[direccion]);
    }

    centro.addEventListener("pointerdown", evento => {
      if (!evento.isPrimary || evento.button !== 0 || puntero !== null || tecla) return;
      evento.preventDefault();
      centro.focus({ preventScroll: true });
      puntero = evento.pointerId;
      arrastrado = false;
      inicioX = evento.clientX;
      inicioY = evento.clientY;
      centro.classList.add("is-dragging");
      centro.setPointerCapture(puntero);
    });
    centro.addEventListener("pointermove", evento => {
      if (evento.pointerId !== puntero) return;
      const dx = evento.clientX - inicioX;
      const dy = evento.clientY - inicioY;
      const distancia = Math.hypot(dx, dy);
      const limite = recorrido();
      const escala = distancia ? Math.min(1, limite / distancia) : 0;
      const direccion = distancia <= Math.max(8, limite * 0.24) ? null :
        Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
      if (direccion) arrastrado = true;
      cambiar(direccion, dx * escala, dy * escala);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(tipo => {
      centro.addEventListener(tipo, evento => {
        if (evento.pointerId !== puntero) return;
        const pulsacionStop = tipo === "pointerup" && !arrastrado;
        reiniciarJoystick();
        if (pulsacionStop) void detenerVehiculo();
      });
    });
    centro.addEventListener("keydown", evento => {
      if (["Escape", " ", "Enter"].includes(evento.key)) {
        evento.preventDefault();
        if (!evento.repeat) void detenerVehiculo();
        return;
      }
      const direccion = teclas[evento.key];
      if (!direccion) return;
      evento.preventDefault();
      if (evento.repeat || puntero !== null) return;
      tecla = evento.key;
      const r = recorrido();
      cambiar(direccion, direccion === "left" ? -r : direccion === "right" ? r : 0,
        direccion === "up" ? -r : direccion === "down" ? r : 0);
    });
    centro.addEventListener("keyup", evento => {
      if (teclas[evento.key]) evento.preventDefault();
      if (evento.key === tecla) reiniciarJoystick();
    });
    // El puntero ya se procesa en pointerup; solo aceptar activacion asistiva aqui.
    centro.addEventListener("click", evento => {
      if (evento.detail === 0 && !evento.pointerType && !tecla && puntero === null) void detenerVehiculo();
    });
    const perderControl = () => {
      if (puntero !== null || tecla || activa) reiniciarJoystick();
    };
    centro.addEventListener("blur", perderControl);
    window.addEventListener("blur", perderControl);
    window.addEventListener("resize", perderControl);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) perderControl();
    });
  }

  // Contador local no persistido; nunca representa confirmacion fisica.
  // 0: sin referencia; 1: control activado; 2: encendidas; 3: apagadas.
  // null: referencia perdida; 4: pulsaciones fuera de la secuencia conocida.
  let pasoLuces = 0;
  let lucesEnCurso = false;
  let revisionLuces = 0;

  function invalidarEstimacionLuces() {
    pasoLuces = null;
    revisionLuces += 1;
  }

  function mostrarLuces(pendiente = false) {
    const boton = document.querySelector('[data-command="28"]');
    const estado = document.getElementById("lights-status");
    if (!boton) return;
    const estados = {
      0: ["desconocido", "Luces<br>sin confirmar", "Estado físico de luces desconocido. La secuencia local solo es estimada y supone que el vehículo parte del estado inicial."],
      1: ["control", "Control<br>estimado", "Control activado, estimado tras la primera solicitud aceptada; luces físicas sin confirmar."],
      2: ["encendidas", "Luces<br>ON estimado", "Luces encendidas, estado estimado tras la segunda solicitud aceptada; sin confirmación física."],
      3: ["apagadas", "Luces<br>OFF estimado", "Luces apagadas, estado estimado tras la tercera solicitud aceptada; sin confirmación física."],
      null: ["desconocido", "Luces<br>sin confirmar", "Estado de luces desconocido tras un error o reanudacion. Las proximas solicitudes reinician solo una estimacion local de tres pasos, suponiendo el estado inicial del vehiculo; no hay sincronizacion fisica."],
      4: ["desconocido", "Luces<br>sin confirmar", "Estado desconocido: se superaron las tres pulsaciones conocidas. No se presupone un ciclo adicional ni un cuarto estado fisico."]
    };
    const [fase, etiqueta, descripcion] = estados[pasoLuces];
    boton.dataset.lightsState = fase;
    boton.classList.toggle("lights-active", fase === "encendidas");
    // aria-pressed se reserva para un estado fisico conocido, no una estimacion.
    boton.removeAttribute("aria-pressed");
    boton.setAttribute("aria-busy", String(pendiente));
    boton.disabled = pendiente;
    boton.title = pendiente ? "Solicitud de luces pendiente; espera antes de volver a pulsar." : descripcion;
    const texto = boton.querySelector("[data-lights-label]");
    if (texto) texto.innerHTML = etiqueta;
    if (estado) estado.textContent = pendiente ? "Solicitud de luces pendiente. " + descripcion : descripcion;
  }

  function prepararLuces() {
    const boton = document.querySelector('[data-command="28"]');
    if (!boton) return;
    mostrarLuces();
    boton.addEventListener("click", () => ejecutarMovimiento(COMANDOS.luces));
    // Volver desde bfcache no permite asumir que el estado del vehiculo siga igual.
    window.addEventListener("pagehide", () => {
      invalidarEstimacionLuces();
      mostrarLuces(lucesEnCurso);
    });
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

    prepararJoystick();
    vincularBoton(".emergency-stop", detenerVehiculo);

    prepararLuces();
    const botones = document.querySelectorAll('.movement:not([data-command="28"])');

    const movimientos = [
      COMANDOS.diagonalIzquierda,
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
