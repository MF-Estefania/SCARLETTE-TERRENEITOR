"use strict";

document.addEventListener("scarlette:sesion-verificada", evento => {
  if (evento.detail?.usuario?.rol !== "usuario" || document.getElementById("movement-history")) return;
  const panel = document.getElementById("user-monitoring-panel");
  if (!panel) return;

  const section = document.createElement("section");
  section.id = "movement-history";
  section.className = "movement-history";
  section.setAttribute("aria-labelledby", "movement-history-title");
  const heading = document.createElement("h2");
  heading.id = "movement-history-title";
  heading.className = "card-heading";
  heading.textContent = "Historial de movimientos";
  const note = document.createElement("p");
  note.className = "history-note";
  note.textContent = "Hasta diez movimientos individuales recientes. Fechas del backend, sin conversión de zona horaria.";
  const status = document.createElement("p");
  status.className = "history-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.textContent = "El historial se consultará al abrir MONITOREO.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "outline-button history-retry";
  retry.textContent = "Reintentar consulta";
  retry.hidden = true;
  const scroll = document.createElement("div");
  scroll.className = "history-table-scroll";
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", "Tabla de movimientos; desplazamiento horizontal disponible");
  scroll.hidden = true;
  const table = document.createElement("table");
  table.className = "history-table";
  const caption = document.createElement("caption");
  caption.className = "visually-hidden";
  caption.textContent = "Movimientos individuales, del más reciente al más antiguo";
  const header = table.createTHead().insertRow();
  ["Movimiento", "Código", "Fecha y hora", "Origen"].forEach(label => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    header.append(th);
  });
  table.prepend(caption);
  const body = table.createTBody();
  scroll.append(table);
  section.append(heading, note, status, retry, scroll);
  panel.prepend(section);

  let visited = false;
  let active = true;
  let inFlight = false;
  let dirty = false;
  let timer = null;
  const GROUP_DELAY = 500;

  function schedule() {
    dirty = true;
    if (!active || !visited || inFlight || timer !== null) return;
    // Ventana fija: una ráfaga no crea peticiones por cada evento.
    timer = setTimeout(() => {
      timer = null;
      void load();
    }, GROUP_DELAY);
  }

  async function load() {
    if (!active || inFlight) return;
    inFlight = true;
    dirty = false;
    retry.hidden = true;
    status.textContent = "Consultando historial…";
    scroll.setAttribute("aria-busy", "true");
    try {
      const records = await window.SCARLETTE_API.solicitar(
        `/vehiculos/${window.SCARLETTE_CONFIG.VEHICLE_ID}/historial`,
        { method: "GET" }
      );
      if (!active) return;
      if (!Array.isArray(records) || records.some(record => !record || typeof record !== "object" || Array.isArray(record))) {
        throw new Error("Formato de historial no válido.");
      }
      const rows = document.createDocumentFragment();
      // El orden y la exclusión de pasos DEMO corresponden al contrato REST.
      records.slice(0, 10).forEach(record => {
        const row = document.createElement("tr");
        const date = String(record.fecha_hora ?? "—").replace(/^(\d{4}-\d{2}-\d{2})T(?=\d{2}:)/, "$1 ");
        [record.comando, record.codigo, date, record.origen].forEach(value => {
          const cell = document.createElement("td");
          cell.textContent = String(value ?? "—");
          row.append(cell);
        });
        rows.append(row);
      });
      body.replaceChildren(rows);
      scroll.hidden = body.rows.length === 0;
      status.textContent = body.rows.length ? `${body.rows.length} movimientos recientes.` : "No hay movimientos individuales registrados.";
    } catch (error) {
      if (!active) return;
      status.textContent = `No se pudo consultar el historial${error.status ? ` (HTTP ${error.status})` : ""}.` +
        (body.rows.length ? " Los datos visibles corresponden a la consulta anterior." : "");
      retry.hidden = false;
    } finally {
      inFlight = false;
      scroll.setAttribute("aria-busy", "false");
      if (active && dirty) schedule();
    }
  }

  retry.addEventListener("click", () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    void load();
  });
  document.addEventListener("scarlette:panel-cambiado", event => {
    if (event.detail?.panel !== "monitoring" || visited) return;
    visited = true;
    void load();
  });
  document.addEventListener("scarlette:evento-ws", event => {
    if (event.detail?.tipo === "movimiento_individual") schedule();
  });
  window.addEventListener("pagehide", () => {
    active = false;
    if (timer !== null) clearTimeout(timer);
  });
});
