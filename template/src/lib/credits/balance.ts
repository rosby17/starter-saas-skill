import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isFreeAt, readFreeWindow } from "@/lib/credits/settings";

/**
 * Solde = somme du registre, calculée DANS la base (fonction credits_balance, migration 20261026120100) : l'API de
 * données ne renvoie que 1 000 lignes par défaut, un client actif dépassait ce nombre et son solde devenait faux.
 * Repli sur l'ancienne addition si la fonction n'existe pas encore.
 */
export async function getCreditsBalance(admin: SupabaseClient, userId: string): Promise<number> {
  const { data: sum, error: rpcError } = await admin.rpc("credits_balance", { p_user_id: userId });
  if (!rpcError && sum !== null && sum !== undefined) return Number(sum);
  const { data, error } = await admin.from("credits").select("amount").eq("user_id", userId);
  if (error) throw error;
  return (data || []).reduce((sum: number, row: { amount: number }) => sum + (row.amount || 0), 0);
}

/**
 * Débite `amount` crédits AVANT le travail payant (IA, SMS…). Atomique : contrôle du solde et débit dans la même
 * transaction, sous un verrou par client (migration 0009) ; deux demandes simultanées ne dépensent jamais deux fois.
 * Lève `InsufficientCreditsError` si le solde est insuffisant : la route la transforme en réponse 403 standard avec
 * `creditsErrorResponse(error)`, ce qui ouvre la fenêtre « Recharger mes crédits » partout (InsufficientCreditsGate).
 * Fenêtre de gratuité (Administration › Crédits) : si `reason` (le service) y figure et que l'heure de fin n'est pas
 * passée, rien n'est débité ; la facturation normale revient seule à l'heure de fin. Renvoie le nombre débité.
 */
export async function debitCredits(
  admin: SupabaseClient,
  userId: string,
  amount: number,
  reason: string
): Promise<number> {
  if (isFreeAt(await readFreeWindow(admin), reason)) return 0;
  const { data: debited, error } = await admin.rpc("debit_credits", { p_user_id: userId, p_amount: amount, p_reason: reason });
  if (error) throw error;
  if (!debited) throw new InsufficientCreditsError();
  return amount;
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
  }
}

/** Réponse standard « crédits insuffisants » (403 + error_code), ou null si l'erreur est autre chose. */
export function creditsErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof InsufficientCreditsError)) return null;
  return NextResponse.json(
    { success: false, error_code: "insufficient_credits", message: "Crédits insuffisants : rechargez votre compte pour continuer." },
    { status: 403 }
  );
}
