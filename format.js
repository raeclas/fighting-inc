// format.js — number/time formatting shared by every renderer (ui, battle).
// Leaf module: settings arrive via an injected getter (main.js binds it at
// boot) because load() replaces the settings object wholesale.
let getSettings = () => ({});
export const bindFormatSettings = fn => (getSettings = fn);

// 1234567 -> "1.23M" (or "1,234,567" with the full-numbers setting, up to 1e15)
export function fmt(n) {
  if (n < 1e4) return Math.floor(n).toString();
  if (getSettings().fullNumbers && n < 1e15) return Math.floor(n).toLocaleString("en-US");
  const units = ["", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  const tier = Math.min(units.length - 1, Math.floor(Math.log10(n) / 3));
  return (n / 10 ** (tier * 3)).toFixed(2) + units[tier];
}

export function fmtCountdown(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
