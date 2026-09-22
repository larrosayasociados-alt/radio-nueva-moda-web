(function () {
  const C = window.RNM;
  const audio = document.getElementById("stream");
  const playBtns = document.querySelectorAll("[data-play]");
  const playerCard = document.getElementById("playerCard");
  const vol = document.getElementById("vol");
  const statusEl = document.getElementById("status");
  const clockEl = document.getElementById("clock");
  const progName = document.getElementById("progName");
  const progMeta = document.getElementById("progMeta");
  const dockLabel = document.getElementById("dockLabel");
  const requestForm = document.getElementById("requestForm");
  const requestBanner = document.getElementById("requestBanner");
  const sendWa = document.getElementById("sendWa");
  const queueEl = document.getElementById("queue");
  const skedEl = document.getElementById("sked");
  const shareText = document.getElementById("shareText");
  let playing = false;
  let current = null;
  function nowCanary() {
    const fmt = new Intl.DateTimeFormat("es-ES", { timeZone: C.timezone, hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false });
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: C.timezone, hour: "numeric", minute: "numeric", weekday: "short", hour12: false, hourCycle: "h23" }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = map[parts.weekday] ?? new Date().getDay();
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    return { day, minutes, label: fmt.format(new Date()) };
  }
  function findProgram(t) {
    return C.schedule.find((p) => p.days.includes(t.day) && t.minutes >= p.start && t.minutes < p.end) || C.schedule[0];
  }
  function hhmm(mins) {
    return String(Math.floor(mins / 60) % 24).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
  }
  function setPlaying(on) {
    playing = on;
    playerCard.classList.toggle("is-on", on);
    playBtns.forEach((b) => {
      b.textContent = on ? "❚❚" : "▶";
      if (b.dataset.play === "dock") b.textContent = on ? "Pausa" : "Escuchar";
    });
    statusEl.textContent = on ? "En directo · conectado al estudio" : "Listo para sintonizar";
  }
  async function toggle() {
    if (playing) { audio.pause(); setPlaying(false); return; }
    statusEl.textContent = "Conectando con el estudio…";
    try {
      if (!audio.src) audio.src = C.stream;
      await audio.play();
      setPlaying(true);
      if (navigator.mediaSession) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: current ? current.name : C.name, artist: C.name, album: C.frequencies });
      }
    } catch (err) {
      statusEl.textContent = "No se pudo iniciar el audio. Pulsa de nuevo o abre la app.";
      setPlaying(false);
    }
  }
  function buildShare(extra) {
    const p = current;
    return [`Estoy escuchando ${C.name} ${C.frequencies}`, p ? `Ahora: ${p.name} con ${p.host}` : "", extra || "", C.site].filter(Boolean).join("\n");
  }
  function waLink(text) { return "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(text); }
  function saveRequest(item) {
    const list = JSON.parse(localStorage.getItem("rnm-requests") || "[]");
    list.unshift(item);
    localStorage.setItem("rnm-requests", JSON.stringify(list.slice(0, 12)));
    renderQueue();
  }
  function renderQueue() {
    const list = JSON.parse(localStorage.getItem("rnm-requests") || "[]");
    if (!list.length) { queueEl.innerHTML = '<p class="hint">Aún no has enviado peticiones en este dispositivo.</p>'; return; }
    queueEl.innerHTML = list.map((r) => `<div class="q-item"><div><b>${r.song}</b> — ${r.artist}<br><small>${r.name} · ${r.program}</small></div><small>${r.when}</small></div>`).join("");
  }
  function refreshProgram() {
    const t = nowCanary();
    current = findProgram(t);
    clockEl.textContent = t.label + " · Canarias";
    progName.textContent = current.name;
    progMeta.textContent = `${current.host} · ${hhmm(current.start)}–${hhmm(current.end)} · ${current.requests ? "Se aceptan peticiones" : "Sin peticiones en antena"}`;
    dockLabel.textContent = `${current.name} · ${C.frequencies}`;
    shareText.value = buildShare("Únete al directo.");
    const open = !!current.requests;
    requestBanner.className = "banner" + (open ? "" : " off");
    requestBanner.textContent = open
      ? `Ahora mismo está ${current.name}. Tu petición llega al WhatsApp de cabina con el nombre del programa.`
      : `Ahora mismo está ${current.name}. Este tramo no admite temas en directo. Puedes dejar un saludo para el siguiente programa.`;
    sendWa.textContent = open ? "Pedir tema por WhatsApp" : "Enviar saludo por WhatsApp";
  }
  function renderSchedule() {
    const t = nowCanary();
    const today = C.schedule.filter((p) => p.days.includes(t.day));
    skedEl.innerHTML = today.map((p) => {
      const on = current && p.id === current.id;
      return `<article class="${on ? "on" : ""}"><time>${hhmm(p.start)} – ${hhmm(p.end)}</time><h4>${p.name}</h4><p>${p.host}</p><p>${p.desc}</p><p>${p.requests ? "Peticiones abiertas" : "Música continua"}</p></article>`;
    }).join("");
  }
  playBtns.forEach((b) => b.addEventListener("click", toggle));
  audio.addEventListener("playing", () => setPlaying(true));
  audio.addEventListener("pause", () => setPlaying(false));
  audio.addEventListener("error", () => { statusEl.textContent = "El stream no respondió. Reintenta en unos segundos."; setPlaying(false); });
  vol.addEventListener("input", () => { audio.volume = Number(vol.value); });
  audio.volume = Number(vol.value);
  requestForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(requestForm).entries());
    const open = current && current.requests;
    const msg = [
      "Hola Radio Nueva Moda",
      "Programa: " + (current ? current.name : "en directo"),
      "Soy " + (data.name || "un oyente") + " desde " + (data.place || "Canarias") + ".",
      data.song ? "Quiero pedir: " + data.song + (data.artist ? " — " + data.artist : "") : "Les dejo un saludo.",
      data.note ? "Dedicatoria: " + data.note : "",
      open ? "¿Me la pueden poner en antena?" : "Si no entra ahora, para el siguiente programa."
    ].filter(Boolean).join("\n");
    saveRequest({ name: data.name || "Oyente", song: data.song || "Saludo", artist: data.artist || "—", program: current ? current.name : "Directo", when: nowCanary().label });
    window.open(waLink(msg), "_blank", "noopener");
  });
  document.getElementById("sendShare").addEventListener("click", async () => {
    const text = buildShare(current && current.requests ? "Estoy pidiendo un tema. ¿Te unes?" : "Sintonízala conmigo.");
    if (navigator.share) { try { await navigator.share({ title: C.name, text, url: C.site }); return; } catch (_) {} }
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
  });
  document.getElementById("copyShare").addEventListener("click", async () => {
    shareText.select();
    try { await navigator.clipboard.writeText(shareText.value); document.getElementById("copyShare").textContent = "Copiado"; setTimeout(() => (document.getElementById("copyShare").textContent = "Copiar texto"), 1500); } catch (_) {}
  });
  document.getElementById("fbShare").href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(C.site);
  document.getElementById("waSocial").href = waLink("Hola " + C.name + ", les escribo desde la web.");
  refreshProgram(); renderSchedule(); renderQueue();
  setInterval(() => { refreshProgram(); renderSchedule(); }, 30000);
})();
