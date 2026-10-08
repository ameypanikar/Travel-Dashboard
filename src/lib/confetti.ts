/**
 * Lightweight DOM-based confetti burst. No external library needed.
 * Spawns ~70 colored particles that fly outward and fall with gravity.
 * Auto-cleans up after the animation.
 */

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#f97316", "#14b8a6",
  "#e879f9", "#facc15",
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function triggerConfetti(originX?: number, originY?: number) {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
  document.body.appendChild(container);

  const cx = originX ?? window.innerWidth / 2;
  const cy = originY ?? window.innerHeight * 0.6;
  const count = 72;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const isCircle = Math.random() > 0.4;
    const size = rand(5, 11);
    const angle = rand(0, 360);
    const speed = rand(120, 320);
    const vx = Math.cos((angle * Math.PI) / 180) * speed;
    const vy = Math.sin((angle * Math.PI) / 180) * speed - rand(80, 200); // upward bias
    const rotSpeed = rand(-720, 720);
    const duration = rand(0.9, 1.6);

    el.style.cssText = `
      position:absolute;
      left:${cx}px;
      top:${cy}px;
      width:${size}px;
      height:${isCircle ? size : size * rand(0.4, 0.8)}px;
      background:${color};
      border-radius:${isCircle ? "50%" : "2px"};
      transform-origin:center;
    `;

    container.appendChild(el);

    const startTime = performance.now();

    function tick(now: number) {
      const t = (now - startTime) / 1000;
      if (t > duration) {
        el.remove();
        if (container.childElementCount === 0) container.remove();
        return;
      }
      const gravity = 380;
      const x = cx + vx * t;
      const y = cy + vy * t + 0.5 * gravity * t * t;
      const opacity = 1 - t / duration;
      const rotate = rotSpeed * t;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.opacity = String(opacity);
      el.style.transform = `rotate(${rotate}deg)`;
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }
}
