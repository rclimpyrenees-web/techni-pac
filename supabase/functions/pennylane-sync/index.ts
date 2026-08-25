// ---------------------------------------------------------------------------
// pennylane-sync — relais sécurisé entre TECHNI-PAC et l'API Pennylane
// ---------------------------------------------------------------------------
// Cette fonction tourne côté serveur (jamais dans le navigateur). Elle est la
// SEULE à connaître la clé API Pennylane, stockée comme secret Supabase
// (variable d'environnement PENNYLANE_API_KEY) — voir le README pour la
// configurer.
//
// Le logiciel l'appelle ainsi (voir src/pennylane.js) :
//   supabase.functions.invoke("pennylane-sync", { body: { action, payload } })
//
// Actions supportées :
//   - "create_invoice"          : crée (ou retrouve) le client Pennylane puis
//                                  crée une facture avec une seule ligne.
//   - "check_status"            : renvoie le statut payé/impayé d'une facture.
//   - "find_or_create_customer" : crée/retrouve un client Pennylane seul.
// ---------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const PENNYLANE_BASE = "https://app.pennylane.com/api/external/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function pennylaneFetch(path: string, options: RequestInit = {}) {
  const apiKey = Deno.env.get("PENNYLANE_API_KEY");
  if (!apiKey) {
    throw new Error(
      "PENNYLANE_API_KEY absente des secrets Supabase. Configurez-la avec : " +
        "supabase secrets set PENNYLANE_API_KEY=votre_cle (voir README)."
    );
  }
  const res = await fetch(`${PENNYLANE_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Pennylane a répondu ${res.status} : ${JSON.stringify(data)}`);
  }
  return data;
}

type ClientPayload = {
  nom: string;
  email?: string;
  adresse?: string;
  tel?: string;
  pennylaneId?: string | number | null;
};

// Retrouve le client Pennylane déjà lié (via son id stocké côté app), sinon le
// recherche par nom exact, sinon le crée.
async function findOrCreateCustomer(client: ClientPayload) {
  if (client.pennylaneId) {
    try {
      return await pennylaneFetch(`/customers/${client.pennylaneId}`);
    } catch (_e) {
      // L'id stocké n'existe plus côté Pennylane (supprimé manuellement) : on
      // retombe sur la recherche/création ci-dessous plutôt que d'échouer.
    }
  }

  const filter = encodeURIComponent(JSON.stringify([{ field: "name", operator: "eq", value: client.nom }]));
  const search = await pennylaneFetch(`/customers?filter=${filter}`);
  if (search?.items?.length) return search.items[0];

  const payload: Record<string, unknown> = {
    name: client.nom,
    customer_type: "company",
  };
  if (client.email) payload.emails = [client.email];
  if (client.adresse) payload.billing_address = { address: client.adresse };
  if (client.tel) payload.phone = client.tel;

  return await pennylaneFetch(`/customers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function createInvoice(payload: {
  client: ClientPayload;
  montantHT: number;
  label: string;
  vatRate?: string;
}) {
  const customer = await findOrCreateCustomer(payload.client);

  const invoicePayload = {
    customer_id: customer.id,
    date: new Date().toISOString().slice(0, 10),
    invoice_lines: [
      {
        label: payload.label || "Intervention",
        quantity: 1,
        raw_currency_unit_price: payload.montantHT,
        vat_rate: payload.vatRate || "FR_200",
      },
    ],
  };

  const invoice = await pennylaneFetch(`/customer_invoices`, {
    method: "POST",
    body: JSON.stringify(invoicePayload),
  });

  return { invoice, pennylaneCustomerId: customer.id };
}

async function checkStatus(invoiceId: string | number) {
  const invoice = await pennylaneFetch(`/customer_invoices/${invoiceId}`);
  const remaining = Number(invoice.remaining_amount ?? invoice.currency_amount ?? 0);
  return {
    id: invoice.id,
    status: invoice.status,
    paid: invoice.paid === true || remaining <= 0,
    remaining_amount: invoice.remaining_amount,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Méthode non supportée, utilisez POST." }, 405);
  }

  try {
    const { action, payload } = await req.json();
    let result;

    if (action === "create_invoice") {
      result = await createInvoice(payload);
    } else if (action === "check_status") {
      result = await checkStatus(payload.invoiceId);
    } else if (action === "find_or_create_customer") {
      result = await findOrCreateCustomer(payload.client);
    } else {
      return jsonResponse({ ok: false, error: `Action inconnue : ${action}` }, 400);
    }

    return jsonResponse({ ok: true, result });
  } catch (err) {
    return jsonResponse({ ok: false, error: String((err as Error)?.message || err) }, 400);
  }
});
