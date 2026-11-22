"use strict";

window.SCARLETTE_DEMOS_EDITOR = (() => {
  const api = window.SCARLETTE_API;

  async function renderizarEn(contenedor, idVehiculo) {
    contenedor.innerHTML = `
      <div class="glass-card p-4">
        <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
          <h2 class="card-heading m-0" style="border:none">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m7 3 14 9-14 9Z"/></svg>
            Editor de Demos del Vehículo #${idVehiculo}
          </h2>
          <button id="btn-crear-demo-modal" class="neon-button py-2 px-3" style="width:auto; font-size:14px">+ Crear DEMO</button>
        </div>

        <!-- Formulario Crear Demo -->
        <div id="form-crear-demo" class="p-3 border rounded mb-3 bg-dark" style="display:none">
          <h4 class="fs-6 mb-2">Nueva Secuencia DEMO</h4>
          <div class="row g-2">
            <div class="col-md-5"><input id="demo-nombre" class="form-control form-control-sm" placeholder="Nombre (ej. DEMO ZIG-ZAG)"></div>
            <div class="col-md-5"><input id="demo-desc" class="form-control form-control-sm" placeholder="Descripción de la secuencia"></div>
            <div class="col-md-2 d-flex gap-2">
              <button id="btn-guardar-demo" class="neon-button py-1 px-3" style="font-size:13px">Crear</button>
              <button id="btn-cancelar-demo" class="outline-button m-0 py-1 px-3" style="font-size:13px">Cancelar</button>
            </div>
          </div>
        </div>

        <div class="row g-4">
          <!-- Columna Izquierda: Lista de Demos -->
          <div class="col-12 col-md-5">
            <h3 class="fs-6 mb-2 text-muted">Secuencias Registradas</h3>
            <div id="lista-demos" class="list-group">
              <div class="text-center p-3 text-muted">Cargando secuencias...</div>
            </div>
          </div>

          <!-- Columna Derecha: Pasos de la Demo Seleccionada -->
          <div class="col-12 col-md-7">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h3 id="titulo-pasos-demo" class="fs-6 m-0 text-muted">Pasos de la Secuencia</h3>
              <div class="d-flex gap-2">
                <button id="btn-ejecutar-demo-editor" class="neon-button py-1 px-3" style="width:auto; font-size:13px" disabled>▶ Ejecutar</button>
                <button id="btn-detener-demo-editor" class="outline-button m-0 py-1 px-3" style="width:auto; font-size:13px" disabled>■ Detener</button>
              </div>
            </div>

            <!-- Formulario agregar paso -->
            <div id="form-agregar-paso" class="p-3 border rounded mb-3 bg-dark" style="display:none">
              <h4 class="fs-6 mb-2">Agregar Paso a la DEMO</h4>
              <div class="row g-2 align-items-center">
                <div class="col-md-4">
                  <select id="paso-comando" class="form-select form-select-sm">
                    <option value="1">AVANZAR</option>
                    <option value="2">RETROCEDER</option>
                    <option value="3">DIAGONAL IZQ</option>
                    <option value="4">LUCES</option>
                    <option value="5">DIAGONAL DER</option>
                    <option value="6">RECTO IZQ</option>
                    <option value="7">ENDEREZAR</option>
                    <option value="8">RECTO DER</option>
                    <option value="10">MÚSICA</option>
                    <option value="11">GIRO 360°</option>
                  </select>
                </div>
                <div class="col-md-3">
                  <input id="paso-duracion" type="number" class="form-control form-control-sm" placeholder="Duración (ms)" value="1500" min="200" max="10000">
                </div>
                <div class="col-md-3">
                  <input id="paso-pausa" type="number" class="form-control form-control-sm" placeholder="Pausa (ms)" value="500" min="0" max="5000">
                </div>
                <div class="col-md-2">
                  <button id="btn-guardar-paso" class="neon-button py-1 px-2" style="font-size:12px">Agregar</button>
                </div>
              </div>
            </div>

            <button id="btn-mostrar-form-paso" class="btn btn-sm btn-outline-light mb-3" style="display:none">+ Agregar Movimiento</button>

            <!-- Tabla de Pasos -->
            <div class="table-responsive">
              <table class="table table-dark table-sm align-middle">
                <thead><tr><th>Orden</th><th>Comando</th><th>Duración</th><th>Pausa</th><th>Acción</th></tr></thead>
                <tbody id="tbody-pasos-demo"><tr><td colspan="5" class="text-center text-muted">Selecciona una DEMO a la izquierda</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    let demoSeleccionada = null;

    async function cargarDemos() {
      const lista = contenedor.querySelector("#lista-demos");
      try {
        const demos = await api.solicitar(`/vehiculos/${idVehiculo}/demos`, { method: "GET" });
        if (!demos || demos.length === 0) {
          lista.innerHTML = '<div class="p-3 text-center text-muted">No hay secuencias DEMO registradas.</div>';
          return;
        }

        lista.innerHTML = demos.map(d => `
          <button type="button" class="list-group-item list-group-item-action bg-dark text-white border-secondary item-demo ${demoSeleccionada === d.id_demo ? 'active' : ''}" data-id="${d.id_demo}">
            <div class="d-flex w-100 justify-content-between">
              <h5 class="mb-1 fs-6">${d.nombre}</h5>
              <small class="badge bg-secondary">${d.tipo_demo || 'Fábrica'}</small>
            </div>
            <p class="mb-1 small text-muted">${d.descripcion || 'Sin descripción'}</p>
          </button>
        `).join("");

        lista.querySelectorAll(".item-demo").forEach(btn => {
          btn.addEventListener("click", () => {
            demoSeleccionada = parseInt(btn.getAttribute("data-id"), 10);
            cargarDemos();
            cargarPasos(demoSeleccionada);
          });
        });

      } catch (e) {
        lista.innerHTML = '<div class="p-3 text-center text-danger">Error al cargar secuencias.</div>';
      }
    }

    async function cargarPasos(idDemo) {
      const tbody = contenedor.querySelector("#tbody-pasos-demo");
      const btnEjecutar = contenedor.querySelector("#btn-ejecutar-demo-editor");
      const btnDetener = contenedor.querySelector("#btn-detener-demo-editor");
      const btnMostrarForm = contenedor.querySelector("#btn-mostrar-form-paso");

      btnEjecutar.disabled = false;
      btnDetener.disabled = false;
      btnMostrarForm.style.display = "inline-block";
      contenedor.querySelector("#titulo-pasos-demo").textContent = `Pasos de la DEMO #${idDemo}`;

      try {
        const pasos = await api.solicitar(`/vehiculos/${idVehiculo}/demos/${idDemo}/movimientos`, { method: "GET" });
        if (!pasos || pasos.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Esta DEMO no tiene movimientos agregados aún.</td></tr>';
          return;
        }

        tbody.innerHTML = pasos.map(p => `
          <tr>
            <td><strong>#${p.orden}</strong></td>
            <td><span class="badge bg-secondary">${p.comando || 'Comando ' + p.id_comando}</span></td>
            <td>${p.duracion_ms} ms</td>
            <td>${p.pausa_ms} ms</td>
            <td>
              <button class="btn btn-sm btn-outline-danger py-0 btn-eliminar-paso" data-id="${p.id_demo_movimiento}">X</button>
            </td>
          </tr>
        `).join("");

        tbody.querySelectorAll(".btn-eliminar-paso").forEach(btn => {
          btn.addEventListener("click", async () => {
            const idMov = btn.getAttribute("data-id");
            if (!confirm(`¿Eliminar paso #${idMov}?`)) return;
            try {
              await api.solicitar(`/vehiculos/${idVehiculo}/demos/${idDemo}/movimientos/${idMov}/eliminar`, {
                method: "POST"
              });
              await cargarPasos(idDemo);
            } catch (e) {
              alert("Error al eliminar paso: " + (e.message || "desconocido"));
            }
          });
        });

      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar los pasos.</td></tr>';
      }
    }

    // Handlers
    const formCrear = contenedor.querySelector("#form-crear-demo");
    contenedor.querySelector("#btn-crear-demo-modal")?.addEventListener("click", () => {
      formCrear.style.display = formCrear.style.display === "none" ? "block" : "none";
    });
    contenedor.querySelector("#btn-cancelar-demo")?.addEventListener("click", () => {
      formCrear.style.display = "none";
    });
    contenedor.querySelector("#btn-guardar-demo")?.addEventListener("click", async () => {
      const nombre = contenedor.querySelector("#demo-nombre").value.trim();
      const desc = contenedor.querySelector("#demo-desc").value.trim();
      if (!nombre) {
        alert("Ingresa un nombre para la secuencia");
        return;
      }
      try {
        const nueva = await api.solicitar(`/vehiculos/${idVehiculo}/demos`, {
          method: "POST",
          body: JSON.stringify({ nombre, descripcion: desc, activo: true })
        });
        formCrear.style.display = "none";
        demoSeleccionada = nueva.id_demo;
        await cargarDemos();
        await cargarPasos(demoSeleccionada);
      } catch (e) {
        alert("Error al crear DEMO: " + (e.message || "desconocido"));
      }
    });

    const formPaso = contenedor.querySelector("#form-agregar-paso");
    contenedor.querySelector("#btn-mostrar-form-paso")?.addEventListener("click", () => {
      formPaso.style.display = formPaso.style.display === "none" ? "block" : "none";
    });
    contenedor.querySelector("#btn-guardar-paso")?.addEventListener("click", async () => {
      if (!demoSeleccionada) return;
      const idComando = parseInt(contenedor.querySelector("#paso-comando").value, 10);
      const duracion = parseInt(contenedor.querySelector("#paso-duracion").value, 10) || 1500;
      const pausa = parseInt(contenedor.querySelector("#paso-pausa").value, 10) || 500;

      // Calcular siguiente orden
      const filas = contenedor.querySelectorAll("#tbody-pasos-demo tr");
      let orden = 1;
      if (filas.length > 0 && !filas[0].querySelector("td[colspan]")) {
        orden = filas.length + 1;
      }

      try {
        await api.solicitar(`/vehiculos/${idVehiculo}/demos/${demoSeleccionada}/movimientos`, {
          method: "POST",
          body: JSON.stringify({
            id_comando: idComando,
            orden: orden,
            duracion_ms: duracion,
            pausa_ms: pausa
          })
        });
        formPaso.style.display = "none";
        await cargarPasos(demoSeleccionada);
      } catch (e) {
        alert("Error al agregar paso: " + (e.message || "desconocido"));
      }
    });

    contenedor.querySelector("#btn-ejecutar-demo-editor")?.addEventListener("click", async () => {
      if (!demoSeleccionada) return;
      try {
        await api.solicitar(`/vehiculos/${idVehiculo}/demos/${demoSeleccionada}/iniciar`, { method: "POST" });
        alert(`Secuencia DEMO #${demoSeleccionada} enviada a ejecución`);
      } catch (e) {
        alert("Error al ejecutar DEMO: " + (e.message || "desconocido"));
      }
    });

    contenedor.querySelector("#btn-detener-demo-editor")?.addEventListener("click", async () => {
      try {
        await api.solicitar(`/vehiculos/${idVehiculo}/detener`, { method: "POST" });
        alert("Solicitud de detención enviada");
      } catch (e) {
        alert("Error al detener: " + (e.message || "desconocido"));
      }
    });

    await cargarDemos();
  }

  return Object.freeze({
    renderizarEn
  });
})();
