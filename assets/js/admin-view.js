"use strict";

window.SCARLETTE_ADMIN = (() => {
  const api = window.SCARLETTE_API;

  async function cargarDashboard() {
    try {
      return await api.solicitar("/admin/dashboard", { method: "GET" });
    } catch (e) {
      console.error("Error al cargar dashboard admin:", e);
      return null;
    }
  }

  async function cargarUnidades() {
    try {
      return await api.solicitar("/admin/unidades", { method: "GET" });
    } catch (e) {
      console.error("Error al cargar unidades:", e);
      return [];
    }
  }

  async function cargarModelos() {
    try {
      return await api.solicitar("/admin/modelos", { method: "GET" });
    } catch (e) {
      console.error("Error al cargar modelos:", e);
      return [];
    }
  }

  async function cargarClientes() {
    try {
      return await api.solicitar("/admin/clientes", { method: "GET" });
    } catch (e) {
      console.error("Error al cargar clientes:", e);
      return [];
    }
  }

  async function cargarAuditoria() {
    try {
      return await api.solicitar("/admin/auditoria?limite=25", { method: "GET" });
    } catch (e) {
      console.error("Error al cargar auditoria:", e);
      return [];
    }
  }

  async function renderizarEn(contenedor) {
    contenedor.innerHTML = `
      <div class="admin-panel-content">
        <!-- Encabezado de métricas -->
        <div class="glass-card mb-4 p-4">
          <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
            <h2 class="card-heading m-0" style="border:none">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              Dashboard Comercial & Métricas Reales
            </h2>
            <button id="btn-refrescar-admin" class="neon-button py-2 px-3" style="width:auto; font-size:14px">Actualizar</button>
          </div>
          <div id="admin-metrics-row" class="row g-3">
            <div class="col-6 col-md-3"><div class="metric-box p-3 border rounded"><small class="text-muted">Modelos</small><h3 id="metric-modelos">-</h3></div></div>
            <div class="col-6 col-md-3"><div class="metric-box p-3 border rounded"><small class="text-muted">Unidades Físicas</small><h3 id="metric-unidades">-</h3></div></div>
            <div class="col-6 col-md-3"><div class="metric-box p-3 border rounded"><small class="text-muted">En Exhibición</small><h3 id="metric-exhibicion">-</h3></div></div>
            <div class="col-6 col-md-3"><div class="metric-box p-3 border rounded"><small class="text-muted">Clientes</small><h3 id="metric-clientes">-</h3></div></div>
          </div>
        </div>

        <!-- Secciones con sub-pestañas -->
        <div class="glass-card p-4">
          <ul class="nav nav-pills mb-3 gap-2" id="admin-subtabs" role="tablist">
            <li class="nav-item"><button class="nav-link active" data-bs-target="#tab-unidades" data-bs-toggle="pill">Inventario de Unidades</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-target="#tab-modelos" data-bs-toggle="pill">Modelos Comerciales</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-target="#tab-clientes" data-bs-toggle="pill">Clientes</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-target="#tab-auditoria" data-bs-toggle="pill">Bitácora de Auditoría</button></li>
          </ul>

          <div class="tab-content" id="admin-tab-content">
            <!-- 1. Inventario -->
            <div class="tab-pane fade show active" id="tab-unidades">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h3 class="m-0 fs-5">Unidades Físicas Registradas</h3>
                <button id="btn-nueva-unidad" class="neon-button py-2 px-3" style="width:auto; font-size:14px">+ Nueva Unidad</button>
              </div>

              <!-- Formulario de alta rápido -->
              <div id="form-nueva-unidad" class="p-3 border rounded mb-3 bg-dark" style="display:none">
                <h4 class="fs-6 mb-2">Registrar Nueva Unidad Física</h4>
                <div class="row g-2">
                  <div class="col-md-3"><input id="new-u-nombre" class="form-control form-control-sm" placeholder="Nombre (ej. Terreneitor 3)"></div>
                  <div class="col-md-3"><input id="new-u-serie" class="form-control form-control-sm" placeholder="Número de Serie (ej. TR01-SN-003)"></div>
                  <div class="col-md-3">
                    <select id="new-u-estado" class="form-select form-select-sm">
                      <option value="disponible">Disponible (Stock)</option>
                      <option value="exhibicion">Exhibición (Demo)</option>
                      <option value="mantenimiento">Mantenimiento</option>
                    </select>
                  </div>
                  <div class="col-md-3 d-flex gap-2">
                    <button id="btn-guardar-unidad" class="neon-button py-1 px-3" style="font-size:13px">Guardar</button>
                    <button id="btn-cancelar-unidad" class="outline-button m-0 py-1 px-3" style="font-size:13px">Cancelar</button>
                  </div>
                </div>
              </div>

              <div class="table-responsive">
                <table class="table table-dark table-hover align-middle">
                  <thead>
                    <tr><th>ID</th><th>Nombre</th><th>Modelo</th><th>Número de Serie</th><th>Estado</th><th>Propietario</th><th>Acción</th></tr>
                  </thead>
                  <tbody id="tbody-unidades"><tr><td colspan="7" class="text-center">Cargando unidades...</td></tr></tbody>
                </table>
              </div>
            </div>

            <!-- 2. Modelos -->
            <div class="tab-pane fade" id="tab-modelos">
              <h3 class="fs-5 mb-3">Catálogo de Modelos</h3>
              <div class="table-responsive">
                <table class="table table-dark table-hover align-middle">
                  <thead><tr><th>ID</th><th>Nombre Modelo</th><th>Microcontrolador</th><th>Descripción</th></tr></thead>
                  <tbody id="tbody-modelos"><tr><td colspan="4" class="text-center">Cargando modelos...</td></tr></tbody>
                </table>
              </div>
            </div>

            <!-- 3. Clientes -->
            <div class="tab-pane fade" id="tab-clientes">
              <h3 class="fs-5 mb-3">Clientes y Asignaciones</h3>
              <div class="table-responsive">
                <table class="table table-dark table-hover align-middle">
                  <thead><tr><th>ID</th><th>Usuario</th><th>Rol</th><th>Unidades Asignadas</th></tr></thead>
                  <tbody id="tbody-clientes"><tr><td colspan="4" class="text-center">Cargando clientes...</td></tr></tbody>
                </table>
              </div>
            </div>

            <!-- 4. Auditoría -->
            <div class="tab-pane fade" id="tab-auditoria">
              <h3 class="fs-5 mb-3">Bitácora de Auditoría en Tiempo Real</h3>
              <div class="table-responsive">
                <table class="table table-dark table-sm table-striped">
                  <thead><tr><th>Fecha/Hora</th><th>Usuario</th><th>Acción</th><th>Recurso</th><th>Detalle</th><th>Resultado</th></tr></thead>
                  <tbody id="tbody-auditoria"><tr><td colspan="6" class="text-center">Cargando auditoría...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Eventos
    contenedor.querySelector("#btn-refrescar-admin")?.addEventListener("click", () => recargarDatos(contenedor));
    const formNueva = contenedor.querySelector("#form-nueva-unidad");
    contenedor.querySelector("#btn-nueva-unidad")?.addEventListener("click", () => {
      formNueva.style.display = formNueva.style.display === "none" ? "block" : "none";
    });
    contenedor.querySelector("#btn-cancelar-unidad")?.addEventListener("click", () => {
      formNueva.style.display = "none";
    });
    contenedor.querySelector("#btn-guardar-unidad")?.addEventListener("click", async () => {
      const nombre = contenedor.querySelector("#new-u-nombre").value.trim();
      const serie = contenedor.querySelector("#new-u-serie").value.trim();
      const estado = contenedor.querySelector("#new-u-estado").value;
      if (!nombre || !serie) {
        alert("Completa el nombre y número de serie");
        return;
      }
      try {
        await api.solicitar("/admin/unidades", {
          method: "POST",
          body: JSON.stringify({
            id_modelo: 1,
            nombre: nombre,
            modelo: "TR-01",
            numero_serie: serie,
            descripcion: "Unidad registrada desde panel de administración",
            microcontrolador: "ESP8266",
            estado_comercial: estado,
            activo: true
          })
        });
        formNueva.style.display = "none";
        await recargarDatos(contenedor);
      } catch (e) {
        alert("Error al registrar unidad: " + (e.message || "desconocido"));
      }
    });

    await recargarDatos(contenedor);
  }

  async function recargarDatos(contenedor) {
    const metricas = await cargarDashboard();
    if (metricas) {
      contenedor.querySelector("#metric-modelos").textContent = metricas.modelos;
      contenedor.querySelector("#metric-unidades").textContent = metricas.unidades_totales;
      contenedor.querySelector("#metric-exhibicion").textContent = metricas.exhibicion;
      contenedor.querySelector("#metric-clientes").textContent = metricas.clientes;
    }

    // Unidades
    const unidades = await cargarUnidades();
    const tbodyU = contenedor.querySelector("#tbody-unidades");
    if (tbodyU) {
      tbodyU.innerHTML = unidades.map(u => `
        <tr>
          <td><strong>#${u.id_vehiculo}</strong></td>
          <td>${u.nombre}</td>
          <td><span class="badge bg-secondary">${u.modelo || 'TR-01'}</span></td>
          <td><code>${u.numero_serie || 'S/N'}</code></td>
          <td>
            <span class="badge ${u.estado_comercial === 'vendido' ? 'bg-success' : u.estado_comercial === 'exhibicion' ? 'bg-warning text-dark' : 'bg-info'}">
              ${u.estado_comercial.toUpperCase()}
            </span>
          </td>
          <td>${u.propietario ? `<span class="badge bg-primary">${u.propietario}</span>` : '<em class="text-muted">Stock Empresa</em>'}</td>
          <td>
            <button class="btn btn-sm btn-outline-light py-0 btn-asignar" data-id="${u.id_vehiculo}">
              ${u.id_propietario ? 'Reasignar' : 'Asignar'}
            </button>
          </td>
        </tr>
      `).join("");

      tbodyU.querySelectorAll(".btn-asignar").forEach(btn => {
        btn.addEventListener("click", async () => {
          const idV = btn.getAttribute("data-id");
          const usuarioId = prompt("Ingresa el ID del cliente al que deseas asignar esta unidad (o déjalo vacío para devolver a stock):", "2");
          if (usuarioId === null) return;
          try {
            await api.solicitar("/admin/asignaciones", {
              method: "POST",
              body: JSON.stringify({
                id_vehiculo: parseInt(idV, 10),
                id_usuario: usuarioId.trim() ? parseInt(usuarioId.trim(), 10) : null,
                estado_comercial: usuarioId.trim() ? "vendido" : "disponible"
              })
            });
            await recargarDatos(contenedor);
          } catch (e) {
            alert("Error al asignar unidad: " + (e.message || "desconocido"));
          }
        });
      });
    }

    // Modelos
    const modelos = await cargarModelos();
    const tbodyM = contenedor.querySelector("#tbody-modelos");
    if (tbodyM) {
      tbodyM.innerHTML = modelos.map(m => `
        <tr>
          <td>#${m.id_modelo}</td>
          <td><strong>${m.nombre_modelo}</strong></td>
          <td><span class="badge bg-dark border">${m.microcontrolador}</span></td>
          <td class="text-muted small">${m.descripcion || '-'}</td>
        </tr>
      `).join("");
    }

    // Clientes
    const clientes = await cargarClientes();
    const tbodyC = contenedor.querySelector("#tbody-clientes");
    if (tbodyC) {
      tbodyC.innerHTML = clientes.map(c => `
        <tr>
          <td>#${c.id_usuario}</td>
          <td><strong>${c.nombre_usuario}</strong></td>
          <td><span class="badge bg-info text-dark">${c.rol}</span></td>
          <td><span class="badge bg-success">${c.unidades_asignadas} unidad(es)</span></td>
        </tr>
      `).join("");
    }

    // Auditoría
    const auditoria = await cargarAuditoria();
    const tbodyA = contenedor.querySelector("#tbody-auditoria");
    if (tbodyA) {
      tbodyA.innerHTML = auditoria.map(a => `
        <tr>
          <td class="small">${a.fecha_hora ? a.fecha_hora.replace('T', ' ').substring(0, 19) : '-'}</td>
          <td><strong>${a.nombre_usuario || 'sistema'}</strong></td>
          <td><span class="badge bg-secondary">${a.accion}</span></td>
          <td class="small text-muted">${a.recurso}</td>
          <td class="small">${a.detalle || ''}</td>
          <td><span class="badge ${a.resultado === 'EXITO' ? 'bg-success' : 'bg-danger'}">${a.resultado}</span></td>
        </tr>
      `).join("");
    }
  }

  return Object.freeze({
    renderizarEn,
    recargarDatos
  });
})();
