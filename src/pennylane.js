import { supabase } from "./supabaseClient.js";

// Appelle la fonction Supabase "pennylane-sync" (voir supabase/functions/pennylane-sync).
// Ne contient jamais la clé API Pennylane — elle reste côté serveur.
async function callPennylane(action, payload) {
  const { data, error } = await supabase.functions.invoke("pennylane-sync", {
    body: { action, payload },
  });
  if (error) throw new Error(error.message || "Erreur de connexion à la fonction Pennylane.");
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
