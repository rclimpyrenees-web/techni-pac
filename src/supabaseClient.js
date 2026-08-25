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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: dynamicStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
