import { supabase } from "./supabaseClient.js";

// Appelle la fonction Supabase "pennylane-sync" (voir supabase/functions/pennylane-sync).
// Ne contient jamais la clé API Pennylane — elle reste côté serveur.
async function callPennylane(action, payload) {
  const { data, error } = await supabase.functions.invoke("pennylane-sync", {
    body: { action, payload },
  });
  if (error) {
    // Quand la fonction répond avec un statut d'erreur (400 par ex.), le client
    // Supabase ne remonte qu'un message générique ("non-2xx status code") — le
    // vrai détail est dans le corps de la réponse, qu'il faut lire séparément.
    let detail = error.message;
    try {
      if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        if (body?.error) detail = body.error;
      }
    } catch (_e) {
      // Corps non lisible en JSON : on garde le message générique.
    }
    throw new Error(detail || "Erreur de connexion à la fonction Pennylane.");
  }
  if (!data?.ok) throw new Error(data?.error || "Réponse inattendue de la fonction Pennylane.");
  return data.result;
}

// Crée une facture Pennylane pour ce client (créé/retrouvé automatiquement côté
// Pennylane) et cette intervention. Retourne { invoice, pennylaneCustomerId }.
export function pennylaneCreateInvoice({ client, montantHT, label, vatRate }) {
  return callPennylane("create_invoice", { client, montantHT, label, vatRate });
}

// Retourne { id, status, paid, remaining_amount } pour une facture Pennylane.
export function pennylaneCheckStatus(invoiceId) {
  return callPennylane("check_status", { invoiceId });
}

export function pennylaneFindOrCreateCustomer(client) {
  return callPennylane("find_or_create_customer", { client });
}
