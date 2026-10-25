import { HONEYPOT_FIELD } from "@/lib/honeypot";

// Champ piège anti-spam (voir lib/honeypot.ts) : hors écran, ignoré par les
// lecteurs d'écran et la navigation au clavier, jamais rempli par un humain.
export function HoneypotField() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
      <label htmlFor={HONEYPOT_FIELD}>Ne pas remplir ce champ</label>
      <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}
