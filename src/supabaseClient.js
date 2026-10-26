import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes. " +
    "Voir le README pour la configuration."
  );
}

// Clé utilisée pour retenir le choix "Rester connecté" de la personne, avant même
// que la session existe. Stockée en clair dans localStorage (ce n'est pas une donnée
// sensible, juste une préférence d'affichage).
const REMEMBER_KEY = "techni-pac-remember-me";

export function setRememberMe(remember) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
  } catch (e) {
    // Stockage indisponible (navigation privée très restrictive) : on ignore,
    // le comportement retombera simplement sur "ne pas rester connecté".
  }
}

function rememberMeEnabled() {
  try {
    // Par défaut (avant tout choix explicite), on reste connecté — c'est le
    // comportement le plus pratique pour un usage quotidien au bureau/terrain.
    const v = localStorage.getItem(REMEMBER_KEY);
    return v === null ? true : v === "true";
  } catch (e) {
    return true;
  }
}

// Adaptateur de stockage : écrit dans localStorage (persiste après fermeture du
// navigateur) si "Rester connecté" est coché, sinon dans sessionStorage (la
// session est oubliée à la fermeture de l'onglet/du navigateur).
const dynamicStorage = {
  getItem: (key) => {
    try {
      return rememberMeEnabled() ? localStorage.getItem(key) : sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      if (rememberMeEnabled()) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    } catch (e) {
      // Ignoré : au pire la session ne persiste pas.
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (e) {
      // Ignoré.
    }
  },
};

/* Délai maximum des requêtes vers la base et vers la connexion.
   Sur iPad / iPhone, après une mise en veille, une requête peut rester bloquée
   indéfiniment (connexion réseau morte que le système ne signale pas). Une
   seule demande de renouvellement du jeton bloquée suffisait à geler TOUTES
   les écritures suivantes, qui l'attendent : impossible d'enregistrer un
   rapport tant qu'on n'avait pas fermé et rouvert l'appli. Passé le délai, la
   requête est abandonnée et l'enregistrement est réessayé automatiquement.
   Le délai grandit avec la taille de l'envoi (rapport avec photos) pour ne
   pas couper un envoi lent mais réel. Les fonctions (assistant…) et les
   photos rangées à part ne sont pas concernées. */
const DELAI_BASE_MS = 30 * 1000;
const DELAI_CONNEXION_MS = 20 * 1000;
const OCTETS_PAR_MS = 25; // ≈ 25 Ko/s : débit d'un mauvais réseau mobile

function fetchAvecDelai(entree, options = {}) {
  const url = typeof entree === "string" ? entree : (entree && entree.url) || "";
  let delai = 0;
  if (url.includes("/rest/v1/")) {
    const taille = typeof options.body === "string" ? options.body.length : 0;
    delai = DELAI_BASE_MS + Math.round(taille / OCTETS_PAR_MS);
  } else if (url.includes("/auth/v1/")) {
    delai = DELAI_CONNEXION_MS;
  }
  if (!delai || typeof AbortController === "undefined") return fetch(entree, options);
  const controle = new AbortController();
  const signalAppelant = options.signal;
  if (signalAppelant) {
    if (signalAppelant.aborted) controle.abort();
    else signalAppelant.addEventListener("abort", () => controle.abort(), { once: true });
  }
  const minuterie = setTimeout(() => controle.abort(), delai);
  return fetch(entree, { ...options, signal: controle.signal }).finally(() => clearTimeout(minuterie));
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: dynamicStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: { fetch: fetchAvecDelai },
});
