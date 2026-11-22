"use strict";

document.addEventListener("scarlette:sesion-verificada", async evento => {
  const usuario = evento.detail?.usuario;
  if (!usuario || document.getElementById("user-panel-tabs")) return;

  const rol = usuario.rol;
  const shell = document.querySelector(".app-shell");

  // Si es invitado, mostrar barra de sesión de demostración temporal
  if (rol === "invitado") {
    configurarModoInvitado(shell);
    return;
  }

  // Contenedor principal de pestañas
  const navigation = document.createElement("div");
  navigation.id = "user-panel-tabs";
  navigation.className = "user-panel-tabs";
  navigation.setAttribute("role", "tablist");
  navigation.setAttribute("aria-label", "Navegación del sistema");

  // Definición de pestañas según rol
  let tabConfigs = [];
  if (rol === "administradora" || rol === "administrador") {
    tabConfigs = [
      { id: "admin", label: "ADMINISTRACIÓN", className: "user-admin-panel" },
      { id: "control", label: "CONTROL", className: "user-control-panel" },
      { id: "monitoring", label: "MONITOREO", className: "user-monitoring-panel glass-card" }
    ];
  } else {
    // Rol usuario comprador
    tabConfigs = [
      { id: "control", label: "CONTROL", className: "user-control-panel" },
      { id: "monitoring", label: "MONITOREO", className: "user-monitoring-panel glass-card" },
      { id: "demos", label: "MIS DEMOS", className: "user-demos-panel" }
    ];
  }

  const panels = tabConfigs.map(cfg => {
    const p = document.createElement("section");
    p.id = `panel-${cfg.id}`;
    p.className = cfg.className;
    p.setAttribute("role", "tabpanel");
    p.setAttribute("aria-labelledby", `tab-${cfg.id}`);
    p.tabIndex = 0;
    p.hidden = true;
    return p;
  });

  const layout = shell.querySelector(".control-layout");
  const stopBand = shell.querySelector(".stop-band");
  const events = shell.querySelector(".events-disclosure");

  shell.insertBefore(navigation, layout);

  // Ubicar paneles
  panels.forEach(p => shell.insertBefore(p, layout));

  // El panel de control contiene el joystick, layout y parada
  const controlPanel = panels.find(p => p.id === "panel-control");
  if (controlPanel && layout) {
    controlPanel.append(layout, stopBand);
  }

  // El panel de monitoreo contiene los eventos y actividad
  const monitorPanel = panels.find(p => p.id === "panel-monitoring");
  if (monitorPanel && events) {
    const heading = document.createElement("h2");
    heading.className = "card-heading";
    heading.textContent = "Actividad en tiempo real";
    events.querySelector(".events-toggle")?.replaceChildren(heading);
    monitorPanel.append(events);
    events.open = false;
  }

  // Selector de mis vehículos para usuarios compradores
  if (rol === "usuario") {
    await configurarSelectorVehiculos(shell, usuario);
  }

  let selectedIndex = 0;
  let switching = false;

  const buttons = tabConfigs.map((cfg, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = `tab-${cfg.id}`;
    tab.textContent = cfg.label;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panels[index].id);
    tab.setAttribute("aria-selected", String(index === 0));
    tab.tabIndex = index === 0 ? 0 : -1;
    navigation.append(tab);

    tab.addEventListener("click", async () => {
      if (switching || selectedIndex === index) return;
      switching = true;
      try {
        if (cfg.id !== "control" && window.SCARLETTE_CONTROLS?.prepararOcultacion) {
          await window.SCARLETTE_CONTROLS.prepararOcultacion();
        }

        panels[selectedIndex].hidden = true;
        selectedIndex = index;
        panels[selectedIndex].hidden = false;

        buttons.forEach((b, i) => {
          b.setAttribute("aria-selected", String(i === selectedIndex));
          b.tabIndex = i === selectedIndex ? 0 : -1;
        });

        tab.focus();

        // Renderizado perezoso de paneles dinámicos
        if (cfg.id === "admin" && window.SCARLETTE_ADMIN) {
          await window.SCARLETTE_ADMIN.renderizarEn(panels[index]);
        } else if (cfg.id === "demos" && window.SCARLETTE_DEMOS_EDITOR) {
          const vId = window.SCARLETTE_CONFIG?.VEHICLE_ID || 1;
          await window.SCARLETTE_DEMOS_EDITOR.renderizarEn(panels[index], vId);
        }

        document.dispatchEvent(new CustomEvent("scarlette:panel-cambiado", {
          detail: { panel: cfg.id }
        }));
      } finally {
        switching = false;
      }
    });

    return tab;
  });

  // Mostrar el panel inicial
  panels[0].hidden = false;
  if (tabConfigs[0].id === "admin" && window.SCARLETTE_ADMIN) {
    await window.SCARLETTE_ADMIN.renderizarEn(panels[0]);
  }
});

async function configurarSelectorVehiculos(shell, usuario) {
  try {
    const vehiculos = await window.SCARLETTE_API.solicitar("/mis-vehiculos", { method: "GET" });
    if (!vehiculos || vehiculos.length === 0) return;

    const banner = document.createElement("div");
    banner.className = "d-flex align-items-center justify-content-between p-2 px-3 mb-3 border rounded bg-dark";
    banner.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <span class="badge bg-primary">Mis Vehículos</span>
        <select id="select-mis-vehiculos" class="form-select form-select-sm py-1" style="width:auto">
          ${vehiculos.map(v => `<option value="${v.id_vehiculo}" ${v.id_vehiculo === window.SCARLETTE_CONFIG.VEHICLE_ID ? 'selected' : ''}>${v.nombre} (${v.numero_serie || 'TR-01'})</option>`).join("")}
        </select>
      </div>
      <small class="text-muted">Propietario: <strong>${usuario.nombre_usuario}</strong></small>
    `;

    const tabs = document.getElementById("user-panel-tabs");
    if (tabs) {
      shell.insertBefore(banner, tabs);
    }

    const select = banner.querySelector("#select-mis-vehiculos");
    select?.addEventListener("change", () => {
      const nuevoId = parseInt(select.value, 10);
      window.SCARLETTE_CONFIG = Object.assign({}, window.SCARLETTE_CONFIG, { VEHICLE_ID: nuevoId });
      alert(`Vehículo seleccionado: #${nuevoId}. Reconectando telemetría...`);
      window.location.reload();
    });
  } catch (e) {
    console.error("No se pudo cargar selector de vehículos:", e);
  }
}

function configurarModoInvitado(shell) {
  // Ajustar vehículo al de exhibición (Unidad 2)
  window.SCARLETTE_CONFIG = Object.assign({}, window.SCARLETTE_CONFIG, {
    VEHICLE_ID: window.SCARLETTE_CONFIG.EXHIBITION_VEHICLE_ID || 2
  });

  let segundosRestantes = 180;
  const banner = document.createElement("div");
  banner.className = "alert alert-warning d-flex align-items-center justify-content-between py-2 px-3 mb-3";
  banner.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <span class="badge bg-danger">DEMOSTRACIÓN PÚBLICA</span>
      <span>Unidad de exhibición <strong>#${window.SCARLETTE_CONFIG.VEHICLE_ID}</strong> · Tiempo restante: <strong id="timer-invitado">03:00</strong></span>
    </div>
    <button id="btn-finalizar-demo-invitado" class="btn btn-sm btn-outline-danger">Finalizar Prueba</button>
  `;

  shell.insertBefore(banner, shell.firstChild);

  const timerElem = banner.querySelector("#timer-invitado");
  const intervalo = setInterval(() => {
    segundosRestantes--;
    if (segundosRestantes <= 0) {
      clearInterval(intervalo);
      alert("Tu tiempo de demostración ha concluido. El vehículo se detuvo con seguridad.");
      window.SCARLETTE_API.solicitar(`/vehiculos/${window.SCARLETTE_CONFIG.VEHICLE_ID}/detener`, { method: "POST" }).finally(() => {
        window.location.replace("index.html");
      });
      return;
    }
    const mins = String(Math.floor(segundosRestantes / 60)).padStart(2, "0");
    const secs = String(segundosRestantes % 60).padStart(2, "0");
    if (timerElem) timerElem.textContent = `${mins}:${secs}`;
  }, 1000);

  banner.querySelector("#btn-finalizar-demo-invitado")?.addEventListener("click", async () => {
    clearInterval(intervalo);
    await window.SCARLETTE_API.solicitar(`/vehiculos/${window.SCARLETTE_CONFIG.VEHICLE_ID}/detener`, { method: "POST" });
    window.location.replace("index.html");
  });
}
