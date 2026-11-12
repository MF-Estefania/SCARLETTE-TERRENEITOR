"use strict";

// La navegación se crea solo después de recibir el rol verificado por /auth/me.
document.addEventListener("scarlette:sesion-verificada", evento => {
  if (evento.detail?.usuario?.rol !== "usuario" || document.getElementById("user-panel-tabs")) return;

  const shell = document.querySelector(".app-shell");
  const navigation = document.createElement("div");
  navigation.id = "user-panel-tabs";
  navigation.className = "user-panel-tabs";
  navigation.setAttribute("role", "tablist");
  navigation.setAttribute("aria-label", "Panel del vehículo");
  const panels = ["control", "monitoring"].map(name => {
    const panel = document.createElement("section");
    panel.id = `user-${name}-panel`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `user-${name}-tab`);
    return panel;
  });
  panels[0].className = "user-control-panel";
  panels[1].className = "user-monitoring-panel glass-card";
  panels[1].tabIndex = 0;
  const message = document.createElement("p");
  message.textContent = "El monitoreo estará disponible próximamente";
  panels[1].append(message);
  panels[1].hidden = true;

  const layout = shell.querySelector(".control-layout");
  shell.insertBefore(navigation, layout);
  shell.insertBefore(panels[0], layout);
  // Mover conserva identidad, estado y manejadores de todos los controles.
  panels[0].append(layout, shell.querySelector(".stop-band"), shell.querySelector(".events-disclosure"));
  panels[0].after(panels[1]);
  document.body.classList.add("user-navigation");

  let selected = 0;
  let switching = false;
  const tabs = ["CONTROL", "MONITOREO"].map((label, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = panels[index].getAttribute("aria-labelledby");
    tab.textContent = label;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panels[index].id);
    tab.setAttribute("aria-selected", String(index === 0));
    tab.tabIndex = index === 0 ? 0 : -1;
    navigation.append(tab);
    tab.addEventListener("click", async () => {
      if (switching || selected === index) return;
      switching = true;
      try {
        if (index === 1 && !(await window.SCARLETTE_CONTROLS.prepararOcultacion())) {
          tabs[selected].focus();
          return;
        }
        panels[selected].hidden = true;
        selected = index;
        panels[selected].hidden = false;
        tabs.forEach((button, i) => {
          button.setAttribute("aria-selected", String(i === selected));
          button.tabIndex = i === selected ? 0 : -1;
        });
        tab.focus();
      } finally {
        switching = false;
      }
    });
    // Activación manual: las flechas mueven foco, Enter/espacio activan.
    tab.addEventListener("keydown", event => {
      const target = { ArrowRight: (index + 1) % 2, ArrowLeft: (index + 1) % 2, Home: 0, End: 1 }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      tabs[target].focus();
    });
    return tab;
  });
});
