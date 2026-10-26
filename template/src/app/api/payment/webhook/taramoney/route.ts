import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { creditPaidOrder, paidAmountCoversOrder } from "@/lib/orders/credit-order";

// Comparaison en temps constant : empêche de deviner le secret caractère par caractère via le temps de réponse.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

const FAILURE_STATUSES = ["FAILED", "FAIL", "CANCELLED", "CANCELED", "EXPIRED", "ERROR", "DECLINED"];
const REVERSAL_STATUSES = ["REFUND", "REFUNDED", "CHARGEBACK", "DISPUTED", "REVERSED"];

export async function POST(request: Request) {
  try {
    // TaraMoney ne signe pas ses webhooks : le secret glissé dans l'URL de rappel (voir gateways/taramoney.ts) est la seule
    // preuve que l'appel vient bien de la passerelle. Sans lui, quiconque connaît l'identifiant d'une commande pourrait
    // envoyer un faux « SUCCESS » et être crédité sans payer.
    const expectedSecret = process.env.TARA_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error("TARA_WEBHOOK_SECRET non défini : tous les webhooks TaraMoney sont refusés.");
      return NextResponse.json({ success: false, message: "Webhook misconfigured" }, { status: 500 });
    }
    const providedKey = new URL(request.url).searchParams.get("key") || "";
    if (!safeEqual(providedKey, expectedSecret)) {
      console.error("Webhook TaraMoney refusé : clé invalide ou absente.");
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { status, productId, amount, paymentId } = await request.json();
    const normalizedStatus = String(status || "").toUpperCase();
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Remboursement / litige : jamais de reprise automatique des crédits (décision commerciale), mais on bloque la commande
    // pour qu'aucun passage ultérieur ne la re-crédite, et on laisse une trace à examiner.
    if (REVERSAL_STATUSES.includes(normalizedStatus) && productId) {
      const { data: reversed } = await supabase.from("orders").select("id, user_id, credits, status").eq("id", productId).maybeSingle();
      if (reversed?.status === "success") {
        console.error(`[ACTION REQUIRED] TaraMoney signale « ${status} » pour la commande ${productId} (utilisateur ${reversed.user_id}, ${reversed.credits} crédits déjà accordés). À examiner à la main.`);
        await supabase.from("orders").update({ status: "flagged_reversal" }).eq("id", productId).eq("status", "success");
      }
      return NextResponse.json({ success: true, message: "Reversal flagged for manual review." });
    }

    if (normalizedStatus !== "SUCCESS") {
      if (productId && FAILURE_STATUSES.includes(normalizedStatus)) {
        await supabase.from("orders").update({ status: "failed" }).eq("id", productId).eq("status", "pending");
      }
      return NextResponse.json({ success: true, message: "Payment not successful, ignoring." });
    }
    if (!productId) return NextResponse.json({ success: false, message: "Missing productId" }, { status: 400 });

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, plan_name, credits, amount_local, amount_fcfa, currency, status")
      .eq("id", productId)
      .maybeSingle();
    // Commande introuvable : 500 pour que Tara Money REJOUE le webhook, au lieu d'acquitter un paiement jamais livré.
    if (!order) {
      console.error(`[ACTION REQUISE] Webhook TaraMoney : commande ${productId} introuvable, rejeu demandé.`);
      return NextResponse.json({ success: false, message: "Order not linked yet, retry" }, { status: 500 });
    }

    // Le montant encaissé doit couvrir le montant dû AVANT de créditer (bug de conversion, panier trafiqué…).
    if (!paidAmountCoversOrder(amount, order.amount_fcfa ?? order.amount_local)) {
      console.error(`[ACTION REQUIRED] TaraMoney confirme « SUCCESS » pour ${productId} mais le montant reçu (${amount}) est inférieur au dû (${order.amount_fcfa ?? order.amount_local}). Crédits NON accordés.`);
      await supabase.from("orders").update({ status: "flagged_underpaid" }).eq("id", productId).eq("status", "pending");
      return NextResponse.json({ success: true, message: "Amount mismatch, flagged for manual review." });
    }

    // Crédit atomique : jamais deux fois, même si TaraMoney renvoie le webhook plusieurs fois.
    const credited = await creditPaidOrder(supabase, order, paymentId || productId);
    return NextResponse.json({ success: true, credited });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
