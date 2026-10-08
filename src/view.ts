import { debounce, ItemView, TFile, WorkspaceLeaf } from "obsidian";
import {
  forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY,
  Simulation, SimulationNodeDatum,
} from "d3-force";
import { t } from "./i18n";
import type EmberBrainPlugin from "./main";

export const VIEW_TYPE_EMBER = "ember-brain-view";

type Heat = "hot" | "warm" | "cold";

interface EmberNode extends SimulationNodeDatum {
  path: string;
  name: string;
  group: string;
  heat: Heat;
  score: number;
  born: number;    // file creation time (ms)
  shownAt: number; // when it appeared during the intro (performance.now)
  deg: number;
  r: number;
  color: string;
  phase: number;
  file: TFile;
}

interface EmberLink {
  source: EmberNode;
  target: EmberNode;
  from: EmberNode;
  to: EmberNode; // the hotter end: particles flow towards it
}

interface Particle { link: EmberLink; t: number; v: number; color: string }

const HOT = "#ffd400";
const ROOT_COLOR = "#8fa3bf";
const PALETTE = ["#4dd0e1", "#ff5c7a", "#69f0ae", "#b388ff", "#ff9e40", "#64b5f6", "#f06292", "#aed581", "#ffb74d"];
const DAY = 86400000;

function isHeat(value: unknown): value is Heat {
  return value === "hot" || value === "warm" || value === "cold";
}

export class EmberBrainView extends ItemView {
  private plugin: EmberBrainPlugin;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private tip!: HTMLElement;
  private clock!: HTMLElement;
  private stats!: HTMLElement;
  private legend!: HTMLElement;
  private title!: HTMLElement;

  private nodes: EmberNode[] = [];
  private links: EmberLink[] = [];
  private byPath = new Map<string, EmberNode>();
  private groups: Record<string, { label: string; color: string }> = {};
  private sim: Simulation<EmberNode, undefined> | null = null;
  private particles: Particle[] = [];
  private glowCache: Record<string, HTMLCanvasElement> = {};
  private stars = Array.from({ length: 220 }, () => ({
    x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + .2, p: Math.random() * 6.28, s: Math.random() * .8 + .2,
  }));

  private W = 0;
  private H = 0;
  private DPR = 1;
  private tf = { k: 1, x: 0, y: 0 };
  private autoCam = true;
  private hover: EmberNode | null = null;
  private drag: { x: number; y: number; tx: number; ty: number; moved: boolean } | null = null;

  private introOn = false;
  private introPending = false; // the intro clock starts on the first frame actually drawn
  private introStart = 0;
  private order: EmberNode[] = [];
  private raf = 0;
  private resizeObs: ResizeObserver | null = null;
  private drawFailed = false;

  constructor(leaf: WorkspaceLeaf, plugin: EmberBrainPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE_EMBER; }
  getDisplayText() { return "Ember Brain"; }
  getIcon() { return "flame"; }

  /** The window this view lives in (differs from `window` in popout windows). */
  private get win(): Window { return this.contentEl.win; }

  async onOpen() {
    try {
      this.build();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("Ember Brain: failed to open", err);
      this.contentEl.createDiv({ cls: "ember-hud ember-error", text: `${t().openFailed} ${err.message}` });
    }
    return Promise.resolve();
  }

  async onClose() {
    this.win.cancelAnimationFrame(this.raf);
    this.sim?.stop();
    this.resizeObs?.disconnect();
    if (this.contentEl.doc.fullscreenElement) await this.contentEl.doc.exitFullscreen();
  }

  /** Called when settings change. */
  refresh() {
    this.loadGraph();
  }

  private build() {
    const s = t();
    const root = this.contentEl;
    root.empty();
    root.addClass("ember-brain-view");
    root.tabIndex = 0;

    this.canvas = root.createEl("canvas", { cls: "ember-canvas", attr: { "aria-label": "Ember Brain" } });
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
    const head = root.createDiv({ cls: "ember-hud ember-title" });
    this.title = head.createEl("h1");
    this.stats = head.createEl("p");
    root.createDiv({ cls: "ember-hud ember-hint", text: s.hint });
    this.clock = root.createDiv({ cls: "ember-hud ember-clock" });
    this.legend = root.createDiv({ cls: "ember-hud ember-legend" });
    this.tip = root.createDiv({ cls: "ember-hud ember-tip" });

    this.addAction("rotate-ccw", s.replayIntro, () => this.startIntro());
    this.addAction("maximize", s.fullscreen, () => void this.toggleFullscreen());

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(root);
    this.resize();
    this.bindInput();

    const reload = debounce(() => this.loadGraph(), 1500, true);
    this.registerEvent(this.app.metadataCache.on("resolved", reload));
    this.registerEvent(this.app.metadataCache.on("changed", reload));
    this.registerEvent(this.app.vault.on("delete", reload));
    this.registerEvent(this.app.vault.on("rename", reload));

    this.loadGraph();
    this.startIntro();
    this.raf = this.win.requestAnimationFrame(time => this.frame(time));
  }

  // ---------- data ----------

  private loadGraph() {
    const s = t();
    const root = this.plugin.rootFolder();
    const files = this.app.vault.getMarkdownFiles().filter(f => !root || f.path.startsWith(root + "/"));
    const now = Date.now();
    const prev = this.byPath;
    this.byPath = new Map();

    this.nodes = files.map(f => {
      const rel = root ? f.path.slice(root.length + 1) : f.path;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter as Record<string, unknown> | undefined;
      const raw = fm?.["heat"];
      let heat: Heat;
      if (isHeat(raw)) heat = raw;
      else { // no heat property: use the last edit
        const age = now - f.stat.mtime;
        heat = age < DAY ? "hot" : age < 7 * DAY ? "warm" : "cold";
      }
      const old = prev.get(f.path);
      const n: EmberNode = Object.assign(old ?? {
        x: (Math.random() - .5) * 40, y: (Math.random() - .5) * 40, shownAt: 0, phase: Math.random() * 6.28,
      }, {
        path: f.path,
        name: f.basename,
        group: rel.includes("/") ? rel.split("/")[0] : "",
        heat,
        score: heat === "hot" ? 2 : heat === "warm" ? 1 : 0,
        born: f.stat.ctime,
        deg: 0, r: 0, color: "",
        file: f,
      });
      this.byPath.set(f.path, n);
      return n;
    });

    const seen = new Set<string>();
    this.links = [];
    const resolved = this.app.metadataCache.resolvedLinks;
    for (const src of Object.keys(resolved)) {
      const a = this.byPath.get(src);
      if (!a) continue;
      for (const dst of Object.keys(resolved[src])) {
        const b = this.byPath.get(dst);
        if (!b || a === b) continue;
        const key = a.path < b.path ? a.path + "\0" + b.path : b.path + "\0" + a.path;
        if (seen.has(key)) continue;
        seen.add(key);
        const to = a.score >= b.score ? a : b;
        this.links.push({ source: a, target: b, to, from: to === a ? b : a });
      }
    }
    this.links.forEach(l => { l.source.deg++; l.target.deg++; });

    this.buildGroups(this.plugin.settings.groupColors, s.root);
    this.nodes.forEach(n => {
      n.r = 2.2 + Math.sqrt(n.deg) * 1.6 + (n.heat === "hot" ? 3 : 0);
      n.color = n.heat === "hot" ? HOT : (this.groups[n.group] ?? this.groups[""]).color;
    });

    const hot = this.nodes.filter(n => n.heat === "hot").length;
    const warm = this.nodes.filter(n => n.heat === "warm").length;
    this.title.empty();
    this.title.appendText((root.split("/").pop() || this.app.vault.getName()) + " · ");
    this.title.createSpan({ text: "Ember Brain" });
    this.stats.setText(`${this.nodes.length} ${s.notes} · ${this.links.length} ${s.links} · ${hot} ${s.heatHot} · ${warm} ${s.heatWarm}`);
    this.legend.empty();
    const row = (label: string, color: string, glow = false) => {
      const d = this.legend.createDiv({ text: label });
      const dot = d.createEl("i", { cls: glow ? "is-glowing" : "" });
      dot.setCssProps({ "--ember-dot-color": color });
    };
    row(s.heatHot, HOT, true);
    const used = new Set(this.nodes.map(n => this.groups[n.group] ? n.group : ""));
    for (const g of used) row(this.groups[g].label, this.groups[g].color);

    this.sim?.stop();
    this.sim = forceSimulation<EmberNode>(this.nodes)
      .force("link", forceLink<EmberNode, EmberLink>(this.links)
        .distance(l => 26 + Math.min(l.source.deg, l.target.deg) * 1.5).strength(.6))
      .force("charge", forceManyBody<EmberNode>().strength(n => -28 - n.deg * 5))
      .force("collide", forceCollide<EmberNode>(n => n.r + 2))
      .force("x", forceX<EmberNode>().strength(.035))
      .force("y", forceY<EmberNode>().strength(.035))
      .alphaDecay(.012)
      .alphaTarget(.004); // never fully settles: the brain "breathes"
    if (prev.size) this.sim.alpha(.3);
  }

  private buildGroups(fixedText: string, rootLabel: string) {
    const fixed: Record<string, string> = {};
    for (const line of fixedText.split("\n")) { // "Folder: #rrggbb"
      const m = line.match(/^\s*(.*?)\s*[:=]\s*(#[0-9a-f]{6})\s*$/i);
      if (m) fixed[m[1]] = m[2].toLowerCase();
    }
    const count: Record<string, number> = {};
    this.nodes.forEach(n => (count[n.group] = (count[n.group] || 0) + 1));
    const free = PALETTE.filter(c => !Object.values(fixed).includes(c));
    let i = 0;
    this.groups = { "": { label: rootLabel, color: fixed[""] || ROOT_COLOR } };
    Object.keys(count).filter(g => g).sort((a, b) => count[b] - count[a]).forEach(g => {
      this.groups[g] = { label: g.replace(/^\d+\s+/, ""), color: fixed[g] || free[i++ % free.length] };
    });
  }

  // ---------- intro ----------

  private startIntro() {
    this.order = [...this.nodes].sort((a, b) => a.born - b.born);
    this.nodes.forEach(n => (n.shownAt = Infinity));
    this.introPending = true;
    this.introOn = true;
    this.autoCam = true;
    this.clock.removeClass("is-hidden");
    this.sim?.alpha(1);
  }

  private updateIntro(now: number) {
    if (!this.introOn) return;
    if (this.introPending) { this.introStart = now; this.introPending = false; }
    const dur = Math.max(1, this.plugin.settings.introSeconds) * 1000;
    const p = Math.min(1, (now - this.introStart) / dur);
    const eased = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const k = Math.floor(eased * this.order.length);
    for (let i = 0; i < k; i++) if (this.order[i].shownAt === Infinity) this.order[i].shownAt = now;
    const cur = this.order[Math.max(0, k - 1)];
    if (cur) this.clock.setText(new Date(cur.born).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }));
    if (p >= 1) {
      this.introOn = false;
      this.win.setTimeout(() => this.clock.addClass("is-hidden"), 2500);
    }
  }

  private visible(n: EmberNode, now: number) { return n.shownAt <= now; }

  // ---------- camera and input ----------

  private resize() {
    this.DPR = Math.min(this.win.devicePixelRatio || 1, 2);
    this.W = this.contentEl.clientWidth;
    this.H = this.contentEl.clientHeight;
    this.canvas.width = Math.max(1, this.W * this.DPR);
    this.canvas.height = Math.max(1, this.H * this.DPR);
  }

  private updateCam(now: number) {
    if (!this.autoCam) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of this.nodes) {
      if (!this.visible(n, now) || n.x === undefined || n.y === undefined) continue;
      x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y);
    }
    if (x0 === Infinity) return;
    const pad = 140;
    const k = Math.min(4, (this.W - pad) / Math.max(x1 - x0, 60), (this.H - pad) / Math.max(y1 - y0, 60));
    const tx = this.W / 2 - k * (x0 + x1) / 2, ty = this.H / 2 - k * (y0 + y1) / 2;
    const a = .04;
    this.tf = { k: this.tf.k + (k - this.tf.k) * a, x: this.tf.x + (tx - this.tf.x) * a, y: this.tf.y + (ty - this.tf.y) * a };
  }

  private toWorld(cx: number, cy: number) {
    return [(cx - this.tf.x) / this.tf.k, (cy - this.tf.y) / this.tf.k];
  }

  private pick(ev: MouseEvent): EmberNode | null {
    const rect = this.canvas.getBoundingClientRect();
    const [x, y] = this.toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
    let best: EmberNode | null = null, bd = 14 / this.tf.k;
    const now = performance.now();
    for (const n of this.nodes) {
      if (!this.visible(n, now)) continue;
      const d = Math.hypot((n.x ?? 0) - x, (n.y ?? 0) - y);
      if (d < bd + n.r) { bd = d; best = n; }
    }
    return best;
  }

  private bindInput() {
    const c = this.canvas;
    const s = t();
    const heatLabel: Record<Heat, string> = { hot: s.heatHot, warm: s.heatWarm, cold: s.heatCold };
    this.registerDomEvent(c, "wheel", ev => {
      ev.preventDefault();
      this.autoCam = false;
      const rect = c.getBoundingClientRect();
      const cx = ev.clientX - rect.left, cy = ev.clientY - rect.top;
      const k = Math.min(8, Math.max(.05, this.tf.k * Math.exp(-ev.deltaY * .0015)));
      const [wx, wy] = this.toWorld(cx, cy);
      this.tf = { k, x: cx - wx * k, y: cy - wy * k };
    }, { passive: false });
    this.registerDomEvent(c, "mousedown", ev => {
      this.drag = { x: ev.clientX, y: ev.clientY, tx: this.tf.x, ty: this.tf.y, moved: false };
    });
    this.registerDomEvent(this.win, "mouseup", () => this.win.setTimeout(() => (this.drag = null), 0));
    this.registerDomEvent(c, "mousemove", ev => {
      if (this.drag && (ev.buttons & 1)) {
        const dx = ev.clientX - this.drag.x, dy = ev.clientY - this.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) { this.drag.moved = true; this.autoCam = false; }
        this.tf = { ...this.tf, x: this.drag.tx + dx, y: this.drag.ty + dy };
        return;
      }
      this.hover = this.pick(ev);
      const rect = this.contentEl.getBoundingClientRect();
      c.toggleClass("is-pointing", !!this.hover);
      this.tip.toggleClass("is-visible", !!this.hover);
      if (!this.hover) return;
      const h = this.hover;
      this.tip.empty();
      this.tip.createDiv({ text: h.name });
      this.tip.createEl("small", { text: `${h.path.replace(/\.md$/, "")} · ${h.deg} ${s.links} · ${heatLabel[h.heat]}` });
      this.tip.setCssProps({
        "--ember-tip-x": `${ev.clientX - rect.left + 14}px`,
        "--ember-tip-y": `${ev.clientY - rect.top + 14}px`,
      });
    });
    this.registerDomEvent(c, "click", ev => {
      if (this.drag?.moved) return;
      const n = this.pick(ev);
      if (!n) return;
      const leaf = this.app.workspace.getLeaf(ev.metaKey || ev.ctrlKey ? "split" : "tab");
      void leaf.openFile(n.file);
    });
    this.registerDomEvent(this.contentEl, "keydown", ev => {
      if (ev.key === "r" || ev.key === "R") this.startIntro();
    });
  }

  private async toggleFullscreen() {
    const doc = this.contentEl.doc;
    if (doc.fullscreenElement) await doc.exitFullscreen();
    else await this.contentEl.requestFullscreen();
  }

  // ---------- drawing ----------

  private glow(color: string) {
    const cached = this.glowCache[color];
    if (cached) return cached;
    const size = 128;
    const c = createEl("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    if (g) {
      const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grd.addColorStop(0, color); grd.addColorStop(.18, color + "cc");
      grd.addColorStop(.45, color + "33"); grd.addColorStop(1, color + "00");
      g.fillStyle = grd; g.fillRect(0, 0, size, size);
    }
    return (this.glowCache[color] = c);
  }

  private spawnParticles(now: number) {
    for (const l of this.links) {
      if (!this.visible(l.source, now) || !this.visible(l.target, now)) continue;
      const rate = l.to.heat === "hot" ? .05 : l.to.heat === "warm" ? .006 : .0007;
      if (Math.random() < rate && this.particles.length < 900)
        this.particles.push({ link: l, t: 0, v: .006 + Math.random() * .01, color: l.to.heat === "hot" ? HOT : l.from.color });
    }
  }

  private frame(now: number) {
    this.raf = this.win.requestAnimationFrame(time => this.frame(time));
    if (!this.W || !this.H || !this.contentEl.isShown()) return; // hidden tab: skip drawing
    try {
      this.draw(now);
    } catch (e) {
      if (!this.drawFailed) console.error("Ember Brain: drawing failed", e);
      this.drawFailed = true;
    }
  }

  private draw(now: number) {
    this.updateIntro(now);
    this.updateCam(now);
    this.spawnParticles(now);
    const ctx = this.ctx, W = this.W, H = this.H, tf = this.tf, time = now / 1000;

    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .7);
    bg.addColorStop(0, "#0b1226"); bg.addColorStop(1, "#04060d");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#cfd8ff";
    for (const s of this.stars) {
      ctx.globalAlpha = .25 + .35 * Math.sin(time * s.s + s.p) ** 2;
      ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    ctx.setTransform(this.DPR * tf.k, 0, 0, this.DPR * tf.k, this.DPR * tf.x, this.DPR * tf.y);
    ctx.globalCompositeOperation = "lighter";

    ctx.lineWidth = .6 / Math.sqrt(tf.k);
    for (const l of this.links) {
      if (!this.visible(l.source, now) || !this.visible(l.target, now)) continue;
      ctx.strokeStyle = l.to.heat === "hot" ? "rgba(255,212,0,.22)" : l.to.heat === "warm" ? "rgba(140,170,255,.13)" : "rgba(140,170,255,.06)";
      ctx.beginPath(); ctx.moveTo(l.source.x ?? 0, l.source.y ?? 0); ctx.lineTo(l.target.x ?? 0, l.target.y ?? 0); ctx.stroke();
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += p.v;
      if (p.t >= 1) { this.particles.splice(i, 1); continue; }
      const a = p.link.from, b = p.link.to;
      const ax = a.x ?? 0, ay = a.y ?? 0;
      const x = ax + ((b.x ?? 0) - ax) * p.t, y = ay + ((b.y ?? 0) - ay) * p.t;
      const r = 5 * Math.sin(Math.PI * p.t) + 1;
      ctx.globalAlpha = .9;
      ctx.drawImage(this.glow(p.color), x - r, y - r, r * 2, r * 2);
    }

    for (const n of this.nodes) {
      if (!this.visible(n, now)) continue;
      const nx = n.x ?? 0, ny = n.y ?? 0;
      const age = (now - n.shownAt) / 1000;
      const birth = age < 1.2 ? 1 + 2.5 * (1 - age / 1.2) : 1; // flash when born
      let pulse = 1, alpha: number;
      if (n.heat === "hot") { pulse = 1 + .35 * Math.sin(time * 3 + n.phase); alpha = 1; }
      else if (n.heat === "warm") { pulse = 1 + .15 * Math.sin(time * 1.6 + n.phase); alpha = .85; }
      else alpha = .35 + .2 * Math.sin(time * .7 + n.phase) ** 2;
      const gr = n.r * (n.heat === "hot" ? 7 : n.heat === "warm" ? 3.4 : 3) * pulse * birth;
      ctx.globalAlpha = alpha * (n.heat === "hot" ? .8 : n.heat === "warm" ? .32 : .4);
      ctx.drawImage(this.glow(n.color), nx - gr, ny - gr, gr * 2, gr * 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = n.heat === "hot" ? "#fffbe6" : n.color;
      ctx.beginPath(); ctx.arc(nx, ny, n.r * (n.heat === "hot" ? pulse : 1) * .7, 0, 6.283); ctx.fill();
      if (n.heat === "hot") { // sonar rings
        ctx.strokeStyle = HOT; ctx.lineWidth = 1.4 / tf.k;
        for (let k = 0; k < 3; k++) {
          const ph = (time * .45 + k / 3 + n.phase) % 1;
          ctx.globalAlpha = (1 - ph) * .55;
          ctx.beginPath(); ctx.arc(nx, ny, n.r + ph * 70, 0, 6.283); ctx.stroke();
        }
      }
    }

    // labels: hot notes and hubs always; the rest when zoomed in or hovered
    ctx.globalCompositeOperation = "source-over";
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    for (const n of this.nodes) {
      if (!this.visible(n, now)) continue;
      if (!(n.heat === "hot" || n.deg >= 8 || tf.k > 2.2 || n === this.hover)) continue;
      const nx = n.x ?? 0, ny = n.y ?? 0;
      const size = (n.heat === "hot" ? 14 : 11) / Math.max(tf.k, .8);
      ctx.font = `${n.heat === "hot" ? 600 : 400} ${size}px -apple-system, "Segoe UI", sans-serif`;
      ctx.globalAlpha = n.heat === "hot" || n === this.hover ? 1 : .7;
      const ty = ny + n.r + size + 3;
      ctx.lineWidth = size / 3.5; ctx.strokeStyle = "rgba(4,6,13,.85)";
      ctx.strokeText(n.name, nx, ty);
      ctx.fillStyle = n.heat === "hot" ? "#fff3b0" : "#c9d3ea";
      ctx.shadowColor = n.heat === "hot" ? HOT : "transparent"; ctx.shadowBlur = n.heat === "hot" ? 12 : 0;
      ctx.fillText(n.name, nx, ty);
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
}
