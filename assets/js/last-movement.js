"use strict";

document.addEventListener("scarlette:sesion-verificada", evento => {
  if (evento.detail?.usuario?.rol !== "usuario" || document.getElementById("last-movement")) return;
  const panel = document.getElementById("user-monitoring-panel");
  if (!panel) return;
  const card = document.createElement("section");
  card.id = "last-movement";
  card.className = "last-movement";
  card.setAttribute("aria-labelledby", "last-movement-title");
  const title = document.createElement("h2");
  title.id = "last-movement-title";
  title.className = "card-heading";
  title.textContent = "Último movimiento registrado";
  const status = document.createElement("p");
  status.className = "last-movement-status";
  status.setAttribute("role", "status");
  const fields = document.createElement("dl");
  fields.className = "last-movement-fields";
  const values = ["Comando", "Código", "Fecha y hora de actualización"].map(label => {
    const group = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const value = document.createElement("dd");
    group.append(term, value);
    fields.append(group);
    return value;
  });
  const note = document.createElement("p");
  note.className = "last-movement-note";
  note.textContent = "Registro de la API; no confirma ejecución física";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "outline-button last-movement-retry";
  retry.textContent = "Reintentar estado";
  retry.addEventListener("click", () => window.SCARLETTE_CONNECTIONS.solicitarActualizacion());
  card.append(title, status, fields, note, retry);
  panel.prepend(card);

  function render(snapshot) {
    const data = snapshot.datos;
    const hasMovement = Boolean(data && (data.comando || data.codigo || data.fecha_actualizacion));
    fields.hidden = !hasMovement;
    values[0].textContent = data?.comando || "—";
    values[1].textContent = data?.codigo || "—";
    values[2].textContent = (data?.fecha_actualizacion || "—").replace(/^(\d{4}-\d{2}-\d{2})T(?=\d{2}:)/, "$1 ");
    retry.hidden = snapshot.estado !== "error";
    card.dataset.state = snapshot.estado;
    status.textContent = snapshot.estado === "loading" ?
      (hasMovement ? "Actualizando registro…" : "Consultando estado…") :
      snapshot.estado === "error" ?
        (hasMovement ? "Registro no actualizado. Se conserva el último dato válido." : "No se pudo obtener el estado.") +
          (snapshot.http ? ` HTTP ${snapshot.http}.` : "") :
      snapshot.estado === "empty" ? "No hay un movimiento registrado." : "Último registro obtenido de la API.";
  }

  document.addEventListener("scarlette:estado-actualizado", event => render(event.detail));
  document.addEventListener("scarlette:evento-ws", event => {
    if (event.detail?.tipo === "movimiento_individual") {
      window.SCARLETTE_CONNECTIONS.solicitarActualizacion();
    }
  });
  // La consulta compartida puede haber comenzado antes de crear la tarjeta.
  render(window.SCARLETTE_CONNECTIONS.obtenerEstado());
});
