"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { track } from "@/components/site/MetaPixel";
import { useProduct } from "@/lib/catalog/context";
import { PREORDER_BALANCE, currentPrice, preorderBalance, preorderDeposit, pricePeriod } from "@/lib/catalog/types";
import { useCurrency } from "@/lib/content/display-currency";
import { createClient } from "@/lib/supabase/client";
import { PhoneInput } from "@/components/ui/phone-input";
import QRCode from "qrcode";
import { site } from "@/config/site";

type CheckoutContextValue = {
  /** Ouvre la fenêtre de paiement d'un produit du catalogue (slug). balance : solde d'une précommande (60 %). */
  openCheckout: (slug: string, opts?: { balance?: boolean }) => void;
};

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error("useCheckout must be used within CheckoutProvider");
  return ctx;
}

export function CheckoutProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<{ slug: string; balance: boolean } | null>(null);
  return (
    <CheckoutContext.Provider value={{ openCheckout: (slug, opts) => setOpen({ slug, balance: !!opts?.balance }) }}>
      {children}
      {open && <CheckoutModal slug={open.slug} balance={open.balance} onClose={() => setOpen(null)} />}
    </CheckoutContext.Provider>
  );
}

type PaymentType = "mobile_money" | "momo_direct" | "wave" | "card" | "paypal" | "crypto";
type Manual = { title: string; lines: string[]; cartId: string; tab?: string; alt?: { tab: string; label: string; address: string; network: string; lines: string[] }; payIdLabel?: string; amount?: string; amountNote?: string; payId?: string; reference?: string; whatsappUrl?: string; accounts?: { operator: string; number: string; holder?: string; ussd?: string }[] };

// PAGE DE PAIEMENT DU KIT — BRIQUE VERROUILLÉE (voir PAIEMENT-VERROUILLE.md) : disposition, moyens de paiement
// et parcours validés une fois pour toutes. Ne pas modifier dans un projet : se règle par site.ts et /admin/keys.
// Fenêtre d'achat : 1) coordonnées (nom, e-mail, WhatsApp, pays) 2) moyen de paiement.
// Le compte du client est créé (ou retrouvé) à partir de son e-mail : il retrouve ensuite son achat dans « Formations ».
function CheckoutModal({ slug, balance = false, onClose }: { slug: string; balance?: boolean; onClose: () => void }) {
  const product = useProduct(slug);
  const base = product ? currentPrice(product) : null;
  // Précommande : réservation de 10 % ; solde : 60 % (le serveur refait le même calcul, c'est lui qui fait foi).
  const price = base == null ? null : product?.preorder ? preorderDeposit(base) : balance ? preorderBalance(base) : base;
  // Prix de référence barré : le prix barré de la fiche, sinon le prix normal (quand une promo ou une précommande s’applique).
  const fullPrice = product ? Math.max(product.compare_at_fcfa ?? 0, product.price_fcfa ?? 0) || null : null;
  const { formatPrice, localPrice, chargedLabel } = useCurrency();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(site.payments.defaultCountry);
  const [loading, setLoading] = useState<PaymentType | null>(null);
  const [manual, setManual] = useState<Manual | null>(null);
  const [altTab, setAltTab] = useState(false);
  const [error, setError] = useState("");
  const [owned, setOwned] = useState(false);

  // Client connecté : nom, e-mail, WhatsApp et pays viennent de son compte, il n'a plus qu'à payer.
  // Sinon, coordonnées gardées d'un achat à l'autre sur ce navigateur (confort uniquement).
  const [me, setMe] = useState<{ avatar: string | null } | null>(null);
  const [editContact, setEditContact] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("checkout_contact") || "null");
      if (saved) {
        setFullName(saved.fullName || "");
        setEmail(saved.email || "");
        setPhone(saved.phone || "");
        setCountry(saved.country || site.payments.defaultCountry);
      }
    } catch {}
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) return;
      const { data: p } = await supabase.from("profiles").select("full_name, first_name, phone, country, avatar_url").eq("id", user.id).maybeSingle();
      const meta = user.user_metadata ?? {};
      const name = p?.full_name || p?.first_name || meta.full_name || meta.name || "";
      setEmail(user.email);
      if (name) setFullName(name);
      if (p?.phone) setPhone(p.phone);
      if (p?.country) setCountry(p.country);
      setMe({ avatar: p?.avatar_url || meta.avatar_url || meta.picture || null });
    });
  }, []);
  const contactReady = !!me && fullName.trim().length >= 2 && phone.replace(/[^\d]/g, "").length >= 8;

  useEffect(() => {
    if (product && price != null) track("InitiateCheckout", { content_name: product.title, content_ids: [slug], value: price, currency: "XAF" });
  }, [product, price, slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  async function pay(paymentType: PaymentType) {
    setError("");
    setOwned(false);
    if (fullName.trim().length < 2) { setEditContact(true); return setError("Indique ton nom."); }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Indique une adresse e-mail valide : c'est là que tu recevras ton accès.");
    if (phone.replace(/[^\d]/g, "").length < 8) { setEditContact(true); return setError(`Indique ton numéro WhatsApp avec l'indicatif (ex. ${site.payments.phoneExample}).`); }
    try {
      localStorage.setItem("checkout_contact", JSON.stringify({ fullName, email, phone, country }));
    } catch {}
    setLoading(paymentType);
    try {
      const res = await fetch("/api/payment/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug: slug, paymentType, fullName, email, phone, country }),
      });
      const data = await res.json();
      if (!data.success) {
        setOwned(!!data.alreadyOwned);
        setError(data.message || "Une erreur est survenue.");
        setLoading(null);
        return;
      }
      if (data.manual) {
        setManual({ ...data.manual, cartId: data.cartId });
        setLoading(null);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setError("Une erreur est survenue. Réessaie.");
      setLoading(null);
    }
  }

  const busy = loading !== null;

  const isCourse = !!product && (product.category === "formation" || product.category === "accompagnement");
  const [method, setMethod] = useState<PaymentType>("mobile_money");
  // Moyens réellement configurés (passerelle et clés posées dans /admin/keys) ; tous affichés en attendant la réponse.
  const [available, setAvailable] = useState<PaymentType[] | null>(null);
  useEffect(() => {
    fetch("/api/payment/methods", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d?.success && Array.isArray(d.methods) && d.methods.length) setAvailable(d.methods);
    }).catch(() => {});
  }, []);
  // Mobile Money : toujours facturé en FCFA (le serveur fait la même règle). Mobile Money direct : en FCFA aussi, le prix
  // affiché ici est converti à l'étape suivante pour un visiteur hors zone FCFA.
  const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n).replace(/[\u202f\u00a0]/g, " ")} FCFA`;
  const money = (n: number) => (method === "mobile_money" ? fcfa(n) : formatPrice(n));
  const local = price != null && method !== "mobile_money" ? localPrice(price) : null;
  const saving = fullPrice != null && price != null && price < fullPrice ? Math.round(((fullPrice - price) / fullPrice) * 100) : 0;
  const allMethods: { id: PaymentType; title: string; text: string; icons: React.ReactNode }[] = [
    { id: "mobile_money", title: "Mobile Money", text: "Orange Money, MTN MoMo, Moov… Tu valides sur ton téléphone.", icons: <><OrangeMoneyIcon /><MtnIcon /><MoovIcon /></> },
    { id: "momo_direct", title: "Mobile Money direct", text: "Orange Money, MTN MoMo… sur nos numéros, en FCFA, depuis n’importe quel pays (un proche peut payer pour toi). Tu envoies, puis la capture sur WhatsApp.", icons: <><OrangeMoneyIcon /><MtnIcon /></> },
    { id: "wave", title: "Wave", text: "Côte d’Ivoire, Sénégal, Togo… Tu envoies avec Wave, puis la capture sur WhatsApp.", icons: <WaveIcon /> },
    { id: "card", title: "Carte bancaire", text: "Visa ou Mastercard, sur la page sécurisée de la passerelle.", icons: <><VisaIcon /><MastercardIcon /></> },
    { id: "paypal", title: "PayPal", text: "Avec ton compte PayPal, ou une carte via PayPal.", icons: <PaypalIcon /> },
    { id: "crypto", title: "Crypto (USDT)", text: "Binance Pay, ou USDT (TRC20) depuis n’importe quel portefeuille. Validée dès réception.", icons: <><BinanceIcon /><TetherIcon /></> },
  ];
  // Dans l'ordre donné par le serveur (ex. Mobile Money direct en premier dans le pays de ses numéros).
  const methods = available
    ? available.map((id) => allMethods.find((m) => m.id === id)).filter((m): m is (typeof allMethods)[number] => !!m)
    : allMethods;
  useEffect(() => {
    if (available && !available.includes(method)) setMethod(available[0]);
  }, [available, method]);

  const summary = product && price != null && (
    <div className="ck-summary">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.logo} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{site.name}</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--white-dim)" }}><LockIcon /> Paiement sécurisé</span>
      </div>
      <p style={{ fontSize: 14, color: "var(--white-muted)" }}>{product.preorder ? "Réserver ma place" : balance ? "Terminer mon inscription" : product.billing === "monthly" ? "S’abonner à" : isCourse ? "S’inscrire à" : "Acheter"}</p>
      <p style={{ fontSize: 17, fontWeight: 600, color: "var(--white)", marginTop: 2 }}>{product.title}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 800, letterSpacing: "-0.035em", color: "var(--white)", lineHeight: 1 }}>{money(price!)}</span>
        {pricePeriod(product) && <span style={{ fontSize: 16, color: "var(--white-muted)" }}>{pricePeriod(product).replace(/^\s*\/\s*/, "par ")}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10, minHeight: 24 }}>
        {saving > 0 && <s style={{ fontSize: 15, color: "var(--white-dim)" }}>{money(fullPrice!)}</s>}
        {saving > 0 && <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "var(--brand)", color: "#fff" }}>−{saving} %</span>}
        {local && <span style={{ fontSize: 13, color: "var(--white-muted)" }}>{local}</span>}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 32, paddingTop: 22, borderTop: "1px solid var(--black-line)" }}>
        {product.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={product.image} alt="" style={{ width: 72, height: 48, objectFit: "cover", borderRadius: 8, border: "1px solid var(--black-line)", flexShrink: 0 }} />
          : <span style={{ width: 72, height: 48, borderRadius: 8, background: "var(--black-mid)", flexShrink: 0 }} />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{product.title}</p>
          <p style={{ fontSize: 12, color: "var(--white-dim)" }}>{product.category === "credits" && product.credits ? `${new Intl.NumberFormat("fr-FR").format(product.credits)} crédits ajoutés à ton solde` : product.billing === "monthly" ? "Renouvelable, sans engagement" : product.preorder ? "Réservation (10 % du prix)" : balance ? "Solde (60 % du prix)" : isCourse ? "Accès à vie" : "Paiement unique"}</p>
          {product.category === "credits" && product.credits ? (
            <p style={{ fontSize: 12, color: "var(--white-muted)", marginTop: 2 }}>
              {product.credits_validity_days ? `Valables ${product.credits_validity_days} jours à partir du paiement.` : "Sans date d’expiration : vos crédits restent jusqu’à ce que vous les utilisiez."}
            </p>
          ) : null}
        </div>
        <span style={{ fontSize: 14, color: "var(--white)" }}>{fullPrice != null && saving > 0 ? money(fullPrice) : money(price!)}</span>
      </div>
      {saving > 0 && <Row label={product.preorder ? "Part réglée plus tard" : balance ? "Réservation déduite" : "Remise de lancement"} value={`− ${money(fullPrice! - price)}`} muted />}
      <Row label="Total dû aujourd’hui" value={money(price!)} strong />
      {product.preorder && base != null && (
        <p style={{ marginTop: 6, padding: "12px 14px", borderRadius: 12, background: "var(--black-card)", border: "1px solid var(--black-line)", fontSize: 13, lineHeight: 1.55, color: "var(--white-muted)" }}>
          <strong style={{ color: "var(--white)" }}>Précommande.</strong> Dès la sortie, tu es prévenu le premier et tu termines avec {Math.round(PREORDER_BALANCE * 100)} % ({money(preorderBalance(base))}) au lieu de 100 %.
        </p>
      )}
      {product.features.length > 0 && (
        <ul style={{ display: "grid", gap: 9, listStyle: "none", margin: "26px 0 0", padding: 0 }}>
          {product.features.slice(0, 5).map((f) => (
            <li key={f} style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--white-muted)", lineHeight: 1.45 }}><CheckIcon />{f}</li>
          ))}
        </ul>
      )}
      <div className="ck-trust">
        <span><ShieldIcon /> Paiement chiffré</span>
        <span><BoltIcon /> Accès immédiat</span>
        <span><ReceiptIcon /> Facture PDF</span>
      </div>
    </div>
  );

  const current = methods.find((m) => m.id === method) ?? methods[0];
  const shownCurrency = method === "mobile_money" || method === "momo_direct" ? "FCFA" : chargedLabel;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Paiement · ${product?.title ?? ""}`} onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(6,6,8,0.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="ck-box"
        style={{ position: "relative", background: "var(--black-card)", border: "1px solid var(--black-line)", borderRadius: 24, width: "100%", maxWidth: product && price != null && !manual ? 1080 : 480, maxHeight: "calc(100dvh - 32px)", overflowY: "auto", boxShadow: "0 50px 120px rgba(0,0,0,0.45)" }}>
        <button onClick={onClose} aria-label="Fermer" className="ck-close">✕</button>

        {!product || price == null ? (
          <div style={{ padding: "28px 24px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--white)", marginBottom: 12, paddingRight: 40 }}>{product?.title ?? "Produit indisponible"}</h3>
            <p style={{ color: "var(--white-muted)", fontSize: 14 }}>Ce produit n&apos;est pas en vente en ligne pour le moment.</p>
          </div>
        ) : manual ? (
          <div style={{ padding: "28px 24px 22px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--white)", marginBottom: 12, paddingRight: 40 }}>{product.title}</h3>
            <ManualPanel>
              <p style={{ fontWeight: 700, color: "var(--white)" }}>{manual.title}</p>
              {manual.amount && (
                <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
                  <p style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--white-dim)" }}>Montant exact à envoyer</p>
                  <CopyValue value={manual.amount.replace(/\s*(USDT|FCFA)$/, "").replace(/\s/g, "")} display={manual.amount} big />
                  {manual.amountNote && <p style={{ fontSize: 13, color: "var(--white-muted)", marginTop: 4 }}>{manual.amountNote}</p>}
                </div>
              )}
              {manual.alt && manual.payId && (
                <div role="tablist" aria-label="Façon de payer" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, borderRadius: 99, background: "var(--black-card)", border: "1px solid var(--black-line)" }}>
                  {[manual.tab || "Binance Pay", manual.alt.tab].map((t, i) => (
                    <button key={t} type="button" role="tab" aria-selected={altTab === (i === 1)} onClick={() => setAltTab(i === 1)}
                      style={{ padding: "9px 10px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: altTab === (i === 1) ? "var(--brand)" : "transparent", color: altTab === (i === 1) ? "#fff" : "var(--white-muted)" }}>{t}</button>
                  ))}
                </div>
              )}
              {manual.accounts && manual.accounts.length > 0 && (
                <div style={{ display: "grid", gap: 10 }}>
                  {manual.accounts.map((account) => <MomoAccountCard key={account.number} account={account} />)}
                </div>
              )}
              {manual.alt && (altTab || !manual.payId) ? (
                <>
                  <QrAddress address={manual.alt.address} />
                  <CopyField label={manual.alt.label} value={manual.alt.address} />
                  {manual.reference && <CopyField label="Référence (à indiquer sur WhatsApp)" value={manual.reference} />}
                  {manual.alt.lines.map((line, i) => <Step key={i} n={i + 1}>{line}</Step>)}
                </>
              ) : (
                <>
                  {manual.payId && <CopyField label={manual.payIdLabel || "Binance Pay ID"} value={manual.payId} />}
                  {manual.reference && <CopyField label={manual.accounts ? "Référence (à indiquer sur WhatsApp)" : "Référence à coller dans la note"} value={manual.reference} />}
                  {manual.lines.map((line, i) => (
                    <Step key={i} n={i + 1}>{line}</Step>
                  ))}
                </>
              )}
              {manual.whatsappUrl && (
                <a href={manual.whatsappUrl} target="_blank" rel="noopener noreferrer" style={primaryLink}>
                  Envoyer ma capture sur WhatsApp
                </a>
              )}
              <a href={`/paiement/succes?cartId=${manual.cartId}`} style={manual.whatsappUrl ? { ...primaryLink, background: "transparent", border: "1px solid var(--black-line)", marginTop: 0 } : primaryLink}>
                J&apos;ai payé : suivre ma commande
              </a>
            </ManualPanel>
          </div>
        ) : (
          <div className="ck-grid">
            {summary}
            <form className="ck-form" onSubmit={(e) => { e.preventDefault(); pay(method); }}>
              <h4 className="ck-h">Coordonnées</h4>
              {contactReady && !editContact ? (
                <div className="ck-group" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                  {me?.avatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={me.avatar} alt="" referrerPolicy="no-referrer" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                    : <span aria-hidden style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--brand)", color: "#fff", fontWeight: 700 }}>{fullName.trim()[0]?.toUpperCase()}</span>}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", color: "var(--white)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</span>
                    <span style={{ display: "block", color: "var(--white-dim)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email} · {phone}</span>
                  </span>
                  <button type="button" onClick={() => setEditContact(true)} style={{ background: "transparent", border: "none", color: "var(--white-muted)", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>Modifier</button>
                </div>
              ) : (
              <div className="ck-group">
                <label className="ck-row"><span>Nom complet</span><input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder="Prénom Nom" /></label>
                <label className="ck-row"><span>E-mail{me ? " · ton compte" : ""}</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={!!me} autoComplete="email" placeholder="toi@exemple.com" /></label>
                <div className="ck-split">
                  <div className="ck-row"><span>WhatsApp</span><PhoneInput bare value={phone} onChange={setPhone} onCountry={setCountry} /></div>
                  <label className="ck-row"><span>Pays</span><input value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country-name" placeholder={site.payments.defaultCountry} /></label>
                </div>
              </div>
              )}
              <p className="ck-note">{me ? "Connecté : ton accès s’ajoute à ton compte, ta facture arrive par e-mail." : "Ton accès et ta facture arrivent à cette adresse e-mail. Ton compte est créé automatiquement."}</p>

              <h4 className="ck-h" style={{ marginTop: 26 }}>Moyen de paiement</h4>
              <div className="ck-group" role="radiogroup" aria-label="Moyen de paiement">
                {methods.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)} className={`ck-method${method === m.id ? " on" : ""}`}>
                    <span className="ck-radio" aria-hidden />
                    <span style={{ flex: 1, textAlign: "left" }}>
                      <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--white)" }}>{m.title}</span>
                      {method === m.id && <span style={{ display: "block", fontSize: 13, color: "var(--white-muted)", marginTop: 3, lineHeight: 1.45 }}>{m.text}</span>}
                    </span>
                    <span style={{ display: "flex", gap: 5, alignItems: "center" }}>{m.icons}</span>
                  </button>
                ))}
              </div>

              {error && (
                <p role="alert" style={{ color: "var(--brand)", fontSize: 13, marginTop: 14 }}>
                  {error} {owned && <a href="/login?next=/mes-achats" style={{ color: "var(--white)", textDecoration: "underline" }}>Me connecter</a>}
                </p>
              )}
              <button type="submit" disabled={busy} className="ck-pay">
                {busy ? <><span className="ck-spin" aria-hidden /> Connexion à la passerelle…</> : <>{product.preorder ? "Réserver" : "Payer"} {money(price!)}{pricePeriod(product)}</>}
              </button>
              <p className="ck-note" style={{ textAlign: "center" }}>
                {current.title} · montant prélevé en {shownCurrency}{local ? ` (${local})` : ""}. En payant, tu acceptes les <a href="/terms" target="_blank" style={{ color: "var(--white-muted)", textDecoration: "underline" }}>conditions de vente</a>.
              </p>
            </form>
          </div>
        )}
        <style>{`
          .ck-grid { display: grid; grid-template-columns: 1fr 1.05fr; min-height: 600px; }
          .ck-summary { padding: 40px 48px 36px; background: var(--black); border-right: 1px solid var(--black-line); border-radius: 24px 0 0 24px; }
          .ck-form { padding: 64px 48px 32px; }
          .ck-close { position: absolute; top: 16px; right: 16px; z-index: 2; width: 34px; height: 34px; border-radius: 50%; background: var(--black-mid); border: none; color: var(--white); font-size: 14px; cursor: pointer; }
          .ck-h { font-size: 15px; font-weight: 600; color: var(--white); margin-bottom: 10px; }
          .ck-group { border: 1px solid var(--black-line); border-radius: 14px; overflow: hidden; background: var(--black-card); }
          .ck-row { display: grid; gap: 2px; padding: 10px 14px; border-bottom: 1px solid var(--black-line); cursor: text; }
          .ck-row:last-child, .ck-split .ck-row { border-bottom: none; }
          .ck-row > span { font-size: 11px; font-weight: 600; letter-spacing: .02em; color: var(--white-dim); text-transform: uppercase; }
          .ck-row input { background: transparent; border: none; outline: none; color: var(--white); font-size: 15px; padding: 2px 0; width: 100%; font-family: inherit; }
          .ck-row input::placeholder { color: var(--white-dim); opacity: .7; }
          .ck-row:focus-within { background: var(--tone-red-bg); }
          .ck-split { display: grid; grid-template-columns: 1fr 1fr; }
          .ck-split .ck-row + .ck-row { border-left: 1px solid var(--black-line); }
          .ck-note { font-size: 12px; color: var(--white-dim); margin-top: 8px; line-height: 1.5; }
          .ck-method { display: flex; align-items: center; gap: 12px; width: 100%; padding: 15px 16px; background: transparent; border: none; border-bottom: 1px solid var(--black-line); cursor: pointer; font-family: inherit; transition: background .15s; }
          .ck-method:last-child { border-bottom: none; }
          .ck-method:hover { background: var(--black-mid); }
          .ck-method.on { background: var(--tone-red-bg); }
          .ck-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--line-strong, var(--black-line)); flex-shrink: 0; }
          .ck-method.on .ck-radio { border: 5px solid var(--brand); }
          .ck-pay { margin-top: 22px; width: 100%; height: 54px; border: none; border-radius: 14px; background: var(--brand); color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: inherit; box-shadow: 0 10px 30px var(--tone-red-line); transition: transform .1s, opacity .15s; }
          .ck-pay:hover { opacity: .94; } .ck-pay:active { transform: scale(.99); } .ck-pay:disabled { opacity: .7; cursor: wait; }
          .ck-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; animation: ckspin .7s linear infinite; }
          @keyframes ckspin { to { transform: rotate(360deg); } }
          .ck-trust { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--black-line); font-size: 12px; color: var(--white-dim); }
          .ck-trust span { display: inline-flex; align-items: center; gap: 6px; }
          @media (max-width: 860px) {
            .ck-grid { grid-template-columns: 1fr; }
            .ck-summary { padding: 26px 22px 22px; border-right: none; border-bottom: 1px solid var(--black-line); border-radius: 24px 24px 0 0; }
            .ck-form { padding: 22px; }
          }
          .ck-dial { display: none !important; }
          @media (max-width: 860px) { .ck-dial { display: inline-flex !important; } }
          @media (max-width: 480px) { .ck-split { grid-template-columns: 1fr; } .ck-split .ck-row + .ck-row { border-left: none; border-top: 1px solid var(--black-line); } }
        `}</style>
      </div>
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: strong ? "16px 0 6px" : "12px 0", borderTop: "1px solid var(--black-line)", fontSize: strong ? 16 : 14, fontWeight: strong ? 700 : 400, color: muted ? "var(--white-muted)" : "var(--white)" }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

const svg = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function LockIcon() { return <svg {...svg}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>; }
function ShieldIcon() { return <svg {...svg}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>; }
function BoltIcon() { return <svg {...svg}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>; }
function ReceiptIcon() { return <svg {...svg}><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4" /></svg>; }
function CheckIcon() { return <svg {...svg} width={16} height={16} style={{ color: "var(--brand)", flexShrink: 0, marginTop: 1 }}><path d="M5 12l5 5L20 7" /></svg>; }

const primaryLink: React.CSSProperties = {
  display: "inline-flex",
  justifyContent: "center",
  padding: "12px 18px",
  borderRadius: 999,
  background: "var(--brand)",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
  marginTop: 6,
};

function ManualPanel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 12, padding: 16, borderRadius: 14, background: "var(--black)", border: "1px dashed var(--black-line)" }}>
      {children}
    </div>
  );
}

// Mobile Money direct : une grande carte par numéro (logo de l'opérateur, numéro copiable, titulaire) et, si l'opérateur
// a un paiement marchand, le code prêt à composer (montant déjà dedans) : copiable, et « Composer » sur téléphone.
function MomoAccountCard({ account }: { account: { operator: string; number: string; holder?: string; ussd?: string } }) {
  const name = account.operator.toLowerCase();
  const icon = name.includes("orange") ? <OrangeMoneyIcon size={34} /> : name.includes("mtn") ? <MtnIcon size={34} /> : name.includes("moov") ? <MoovIcon size={34} /> : name.includes("wave") ? <WaveIcon size={34} /> : null;
  return (
    <div style={{ display: "grid", gap: 8, padding: 14, borderRadius: 14, border: "2px solid var(--brand)", background: "var(--black-card)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon}
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--white)" }}>{account.operator}</span>
          {account.holder && <span style={{ display: "block", fontSize: 12, color: "var(--white-muted)" }}>Au nom de {account.holder}</span>}
        </span>
      </div>
      {account.ussd ? (
        <>
          <CopyField label="Code marchand à composer (montant inclus)" value={account.ussd} />
          <a href={`tel:${account.ussd.replace(/#/g, "%23")}`} className="ck-dial" style={{ ...primaryLink, marginTop: 0 }}>Composer le code</a>
          <CopyField label="Ou transfert au numéro" value={account.number} />
        </>
      ) : (
        <CopyField label="Numéro" value={account.number} />
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--white)", lineHeight: 1.55 }}>
      <span
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--brand)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 800,
          display: "grid",
          placeItems: "center",
          marginTop: 1,
        }}
      >
        {n}
      </span>
      <span>{children}</span>
    </p>
  );
}

// Logos officiels des moyens de paiement (redessinés en SVG d'après les logos des marques, aucune image externe),
// mis à jour le 24/10/2026 : Orange Money, MTN MoMo, Wave, Moov, Visa, Mastercard, PayPal, Binance, Tether.
const SIZE = 26;
const tile: React.CSSProperties = { display: "block", flexShrink: 0, borderRadius: 7 };

function OrangeMoneyIcon({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 448 448" aria-hidden style={tile}>
      <title>Orange Money</title>
      <rect width="448" height="448" rx="72" fill="#000" />
      <g fill="none" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round">
        <path d="M96 182H196V266M196 182L84 294" stroke="#fff" />
        <path d="M252 158V268H352M252 268L366 154" stroke="#FF7900" />
      </g>
    </svg>
  );
}

function MtnIcon({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden style={tile}>
      <title>MTN MoMo</title>
      <defs>
        <linearGradient id="momo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD95A" />
          <stop offset="1" stopColor="#FFC20E" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="96" fill="url(#momo-bg)" />
      <g transform="rotate(16 300 300)">
        <rect x="196" y="120" width="212" height="340" rx="34" fill="#fff" stroke="#000" strokeWidth="18" />
        <path d="M214 250 Q300 210 390 180 V360 H214 Z" fill="#F00000" />
        <rect x="214" y="360" width="176" height="80" fill="#fff" />
        <rect x="230" y="392" width="44" height="22" rx="11" fill="#000" />
        <circle cx="302" cy="403" r="14" fill="#000" />
        <rect x="330" y="392" width="44" height="22" rx="11" fill="#000" />
      </g>
      <g stroke="#fff" strokeWidth="12" strokeLinejoin="round">
        <path d="M150 96 L330 70 Q360 160 330 280 L210 300 Q170 200 150 96 Z" fill="#0B5A84" />
        <path d="M92 150 L290 104 Q320 210 290 330 L170 360 Q130 250 92 150 Z" fill="#0B5A84" />
      </g>
      <circle cx="196" cy="214" r="54" fill="#fff" />
      <text x="196" y="240" textAnchor="middle" fontSize="76" fontWeight="900" fill="#0B5A84" fontFamily="Arial, sans-serif">$</text>
    </svg>
  );
}

function WaveIcon({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 448 448" aria-hidden style={tile}>
      <title>Wave</title>
      <rect width="448" height="448" rx="72" fill="#1DC8FF" />
      <rect x="82" y="128" width="54" height="128" rx="27" transform="rotate(-42 109 192)" fill="#000" />
      <path d="M160 128Q160 50 240 50Q320 50 320 128L326 300Q326 382 240 386Q152 382 152 300Z" fill="#000" />
      <ellipse cx="228" cy="266" rx="50" ry="82" fill="#fff" />
      <circle cx="206" cy="97" r="11" fill="#fff" />
      <circle cx="251" cy="97" r="11" fill="#fff" />
      <path d="M194 124Q228 112 264 124Q244 146 229 146Q212 146 194 124Z" fill="#F7891F" />
      <ellipse cx="180" cy="378" rx="40" ry="22" fill="#F7891F" />
      <ellipse cx="278" cy="378" rx="40" ry="22" fill="#F7891F" />
    </svg>
  );
}

function MoovIcon({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 448 448" aria-hidden style={tile}>
      <title>Moov Africa</title>
      <rect width="448" height="448" rx="72" fill="#0066B3" />
      <text x="224" y="262" textAnchor="middle" fontSize="136" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">moov</text>
      <circle cx="372" cy="120" r="30" fill="#F7941D" />
    </svg>
  );
}

function PaypalIcon({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: "block", flexShrink: 0 }}>
      <title>PayPal</title>
      <path d="M6.2 2H13.6C17.4 2 19.4 4.3 18.8 7.7C18.1 11.5 15.4 13.4 11.6 13.4H9.2L8.1 20.3H3.6Z" fill="#003087" />
      <path d="M8.6 5.4H16C19.8 5.4 21.8 7.7 21.2 11.1C20.5 14.9 17.8 16.8 14 16.8H11.6L10.5 23.6H6Z" fill="#009CDE" />
      <path d="M8.6 5.4H16C17.4 5.4 18.4 5.7 19.1 6.3C18.7 10.9 16 13.4 11.6 13.4H9.2L7.6 13.4Z" fill="#012169" />
    </svg>
  );
}

function BinanceIcon({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-8 0 1290 1280" aria-hidden style={{ display: "block", flexShrink: 0 }}>
      <title>Binance</title>
      <g fill="#F3BA2F">
        <path d="M634 0L1027 393L883 537L634 289L385 537L241 393Z" />
        <path d="M138 495L283 639L138 784L-6 639Z" />
        <path d="M634 493L780 639L634 786L487 639Z" />
        <path d="M1129 495L1274 639L1129 784L985 639Z" />
        <path d="M385 742L634 991L883 742L1027 886L634 1280L241 886Z" />
      </g>
    </svg>
  );
}

function TetherIcon({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={{ display: "block", flexShrink: 0 }}>
      <title>Tether (USDT)</title>
      <circle cx="16" cy="16" r="16" fill="#26A17B" />
      <path d="M17.9 17.4v-.1c-.1 0-.7 0-1.9 0s-2-.1-1.9 0v.1c-3.9-.2-6.8-.8-6.8-1.7s2.9-1.5 6.8-1.7v2.6c.2 0 1 .1 2 .1s1.8-.1 1.9-.1v-2.6c3.9.2 6.8.8 6.8 1.7s-2.9 1.5-6.9 1.7zM17.9 13.8v-2.4h5.4V9.2H8.6v2.2H14v2.4c-4.4.2-7.7 1.1-7.7 2.1S9.6 17.9 14 18v7.6h3.9V18c4.4-.2 7.7-1.1 7.7-2.1s-3.3-1.9-7.7-2.1z" fill="#fff" />
    </svg>
  );
}

function VisaIcon({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size * 1.6} height={size} viewBox="0 0 48 30" aria-hidden style={{ display: "block", flexShrink: 0 }}>
      <title>Visa</title>
      <text x="24" y="21" textAnchor="middle" fontSize="17" fontWeight="900" fontStyle="italic" fill="#1434CB" fontFamily="Arial, sans-serif" letterSpacing="-0.5">VISA</text>
    </svg>
  );
}

function MastercardIcon({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size * 1.3} height={size} viewBox="0 0 38 24" aria-hidden style={{ display: "block", flexShrink: 0 }}>
      <title>Mastercard</title>
      <circle cx="15" cy="12" r="9" fill="#EB001B" />
      <circle cx="23" cy="12" r="9" fill="#F79E1B" />
      <path d="M19 4.84a9 9 0 0 1 0 14.32a9 9 0 0 1 0-14.32z" fill="#FF5F00" />
    </svg>
  );
}

// Valeur copiable d'un clic (ID, référence, montant) : un retour « Copié » dans la page, jamais d'alerte.
function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  };
  return { copied, copy };
}

function CopyValue({ value, display, big = false }: { value: string; display: string; big?: boolean }) {
  const { copied, copy } = useCopy();
  return (
    <button type="button" onClick={() => copy(value)} aria-label={`Copier ${display}`}
      style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--white)", fontSize: big ? 34 : 16, fontWeight: 800, letterSpacing: "-0.02em", display: "inline-flex", alignItems: "center", gap: 10 }}>
      {display}
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0, padding: "4px 10px", borderRadius: 99, background: copied ? "var(--tone-green-bg)" : "var(--black-mid)", color: copied ? "var(--tone-green-text)" : "var(--white-muted)" }}>{copied ? "Copié ✓" : "Copier"}</span>
    </button>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useCopy();
  return (
    <button type="button" onClick={() => copy(value)}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 12, border: `1px solid ${copied ? "var(--tone-green-text)" : "var(--black-line)"}`, background: "var(--black-card)", cursor: "pointer" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--white-dim)" }}>{label}</span>
        <span style={{ display: "block", fontSize: 20, fontWeight: 700, color: "var(--white)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: ".02em", overflowWrap: "anywhere" }}>{value}</span>
      </span>
      <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, padding: "6px 12px", borderRadius: 99, background: copied ? "var(--tone-green-bg)" : "var(--brand)", color: copied ? "var(--tone-green-text)" : "#fff" }}>{copied ? "Copié ✓" : "Copier"}</span>
    </button>
  );
}

// QR code de l'adresse de paiement (généré dans la page, aucune image externe).
function QrAddress({ address }: { address: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(address, { margin: 1, width: 360, color: { dark: "#0B0B0C", light: "#FFFFFF" } }).then(setSrc).catch(() => setSrc("")); }, [address]);
  if (!src) return null;
  return (
    <div style={{ display: "grid", placeItems: "center", gap: 6 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`QR code de l'adresse ${address}`} width={180} height={180} style={{ borderRadius: 12, background: "#fff", padding: 8 }} />
      <span style={{ fontSize: 12, color: "var(--white-dim)" }}>USDT · réseau TRON (TRC20) uniquement</span>
    </div>
  );
}
