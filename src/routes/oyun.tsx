import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import inventory from "@/lib/herbarium-data.json";
import paths from "@/lib/province-paths.json";
import { judge, pickQuestions, ROUND_SIZES, MAX_TRIES, type Outcome, type RoundSize } from "@/lib/quiz";

export const Route = createFileRoute("/oyun")({
  head: () => ({ meta: [
    { title: "Bitki Harita Oyunu - Etnoherba" },
    { name: "description", content: "Anadolu bitkilerinin yetiştiği illeri Türkiye haritasında bul: rastgele sorularla bilgini test et." },
    { property: "og:title", content: "Bitki Harita Oyunu - Etnoherba" },
    { property: "og:description", content: "Seterra tarzı Türkiye harita oyunu: bitkinin ilini bul." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Game,
});

type Q = { id: string; name: string; sci: string; province: string; provinceName: string };
const pool: Q[] = (inventory.plants as { id: string; turkishName: string; scientificName: string; provinceId?: string; provinceName?: string }[])
  .filter(p => p.provinceId && (paths as Record<string, unknown>)[p.provinceId])
  .map(p => ({ id: p.id, name: p.turkishName, sci: p.scientificName, province: p.provinceId!, provinceName: p.provinceName ?? p.provinceId! }));
const provincePaths = paths as Record<string, { name: string; d: string }>;

function beep(kind: "ok" | "bad" | "fail" | "end") {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx(); const notes = { ok: [660, 880], bad: [220], fail: [300, 200, 140], end: [523, 659, 784, 1047] }[kind];
    notes.forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = kind === "bad" ? "square" : "sine"; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.12; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.2); });
    setTimeout(() => ctx.close(), 1200);
  } catch { /* no audio */ }
}
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Game() {
  const [size, setSize] = useState<RoundSize | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [misses, setMisses] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, Outcome>>({});
  const [reveal, setReveal] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const [secs, setSecs] = useState(0);
  const [streak, setStreak] = useState(0); const [best, setBest] = useState(0);
  const lock = useRef(false);
  const done = size !== null && i >= qs.length;
  useEffect(() => { if (size === null || done) return; const t = setInterval(() => setSecs(s => s + 1), 1000); return () => clearInterval(t); }, [size, done]);
  const q = qs[i];
  const play = (k: Parameters<typeof beep>[0]) => sound && beep(k);

  const start = (s: RoundSize) => { setSize(s); setQs(pickQuestions(pool, s)); setI(0); setMisses(0); setWrong([]); setResults({}); setReveal(null); setSecs(0); setStreak(0); setBest(0); lock.current = false; };
  const next = (out: Outcome) => {
    if (!q) return; lock.current = true;
    setResults(r => ({ ...r, [q.id]: out }));
    const ns = out === "green" ? streak + 1 : 0; setStreak(ns); setBest(b => Math.max(b, ns));
    setTimeout(() => { setI(n => { if (n + 1 >= qs.length) play("end"); return n + 1; }); setMisses(0); setWrong([]); setReveal(null); lock.current = false; }, out === "red" ? 1800 : 900);
  };
  const click = (pid: string) => {
    if (!q || lock.current || wrong.includes(pid)) return;
    const out = judge(pid === q.province, misses);
    if (out === null) { play("bad"); setMisses(m => m + 1); setWrong(w => [...w, pid]); return; }
    if (out === "red") { play("fail"); setWrong(w => [...w, pid]); setReveal(q.province); } else play("ok");
    next(out);
  };
  // province color = outcome of latest question answered there
  const colors = useMemo(() => { const c: Record<string, Outcome> = {}; qs.slice(0, i).forEach(x => { const r = results[x.id]; if (r) c[x.province] = r; }); if (q && results[q.id]) c[q.province] = results[q.id]!; return c; }, [qs, i, results, q]);
  const count = (o: Outcome) => Object.values(results).filter(r => r === o).length;
  const score = Math.round(((count("green") + count("yellow") * 0.5) / Math.max(qs.length, 1)) * 100);

  return (
    <main className="game">
      <header className="game-top">
        <Link to="/" className="game-back">← Haritaya dön</Link>
        <h1>Bitki Harita Oyunu</h1>
        <button className="game-chip" onClick={() => setSound(s => !s)} aria-label="Ses">{sound ? "🔊 Ses açık" : "🔇 Ses kapalı"}</button>
      </header>

      {size === null ? (
        <section className="game-card game-start">
          <p>Sana rastgele bir bitki soracağız; yetiştiği ili haritada bul. İlk denemede doğruysa <b className="t-green">yeşil</b>, 2. veya 3. denemede <b className="t-yellow">sarı</b>, {MAX_TRIES} yanlışta <b className="t-red">kırmızı</b> yanar ve doğru il gösterilir.</p>
          <p>Kaç soru olsun? (Toplam {pool.length} bitki)</p>
          <div className="game-sizes">{ROUND_SIZES.map(s => <button key={s} className="game-btn" onClick={() => start(s)}>{s === "all" ? `Tüm bitkiler (${pool.length})` : `${s} soru`}</button>)}</div>
        </section>
      ) : done ? (
        <section className="game-card game-start">
          <h2>Tur bitti! Skor: %{score}</h2>
          <div className="game-stats"><span className="t-green">✔ {count("green")} ilk denemede</span><span className="t-yellow">● {count("yellow")} sonradan</span><span className="t-red">✖ {count("red")} bilinemedi</span><span>⏱ {fmt(secs)}</span><span>🔥 En uzun seri: {best}</span></div>
          <div className="game-sizes"><button className="game-btn" onClick={() => start(size)}>Tekrar oyna</button><button className="game-chip" onClick={() => setSize(null)}>Soru sayısını değiştir</button></div>
          <ul className="game-review">{qs.map(x => <li key={x.id} className={`r-${results[x.id]}`}><b>{x.name}</b> — {x.provinceName}</li>)}</ul>
        </section>
      ) : q && (
        <section className="game-card game-q" aria-live="polite">
          <div><small>Soru {i + 1}/{qs.length} · Kalan hak {MAX_TRIES - misses} · ⏱ {fmt(secs)} · 🔥 {streak}</small>
            <h2>{q.name}</h2><i>{q.sci}</i>
            {reveal && <p className="t-red">Doğru il: {q.provinceName}</p>}</div>
          <button className="game-chip" onClick={() => { if (!lock.current) { setReveal(q.province); play("fail"); next("red"); } }}>Pas geç</button>
        </section>
      )}

      <div className="game-map">
        <svg viewBox="0 0 1566 783" role="img" aria-label="Türkiye illeri haritası">
          {Object.entries(provincePaths).map(([id, p]) => (
            <path key={id} d={p.d} onClick={() => click(id)}
              className={["prov", colors[id] ? `p-${colors[id]}` : "", wrong.includes(id) && reveal === null ? "p-wrong" : "", reveal === id ? "p-reveal" : ""].join(" ")}>
              <title>{size === null || done ? p.name : ""}</title>
            </path>))}
        </svg>
      </div>
    </main>
  );
}
