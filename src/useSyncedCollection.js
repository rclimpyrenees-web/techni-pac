import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";

/**
 * Une ligne sans contenu (ou sans identifiant) ne doit jamais entrer dans une
 * liste : le reste de l'application suppose que chaque élément a un « id ».
 * Les lignes de la base sont toujours ramenées à { ...data, id }.
 */
function elementValide(row) {
  const d = row && row.data;
  if (!d || typeof d !== "object") return null;
  const id = d.id ?? row.id;
  return id === undefined || id === null ? null : { ...d, id };
}
const sansVides = (liste) => (liste || []).filter((it) => it && it.id !== undefined && it.id !== null);

/**
 * Attend que la session de connexion soit restaurée avant toute lecture.
 *
 * C'était l'origine du bug « plus aucun client au démarrage » : au lancement,
 * la lecture partait AVANT que Supabase ait fini de restaurer la session
 * enregistrée sur l'appareil. Les règles de sécurité filtrant sur
 * l'utilisateur connecté, la base répondait alors « aucune ligne » — réponse
 * parfaitement valide, donc jamais réessayée.
 */
async function sessionPrete() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

/* ---------------------------------------------------------------------------
   Cache sur l'appareil (IndexedDB)
   ---------------------------------------------------------------------------
   Les données (rapports avec leurs photos compris) sont gardées sur
   l'appareil. À l'ouverture, l'appli les affiche tout de suite, puis ne
   demande à Supabase que la liste des « versions » (id + date de
   modification, quelques Ko) et ne télécharge que les lignes qui ont changé.
   Avant, chaque ouverture et chaque retour dans l'appli rechargeait TOUTE la
   base, photos comprises : c'était l'essentiel du trafic (« Egress »).
   Si IndexedDB n'est pas disponible, tout fonctionne comme avant, sans cache.
--------------------------------------------------------------------------- */
const NOM_BASE = "techni-pac-cache";
const VERSION_BASE = 1;
let baseOuverte = null;

function ouvrirBase() {
  if (baseOuverte) return baseOuverte;
  baseOuverte = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const req = indexedDB.open(NOM_BASE, VERSION_BASE);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("tables")) db.createObjectStore("tables");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch (_e) {
      resolve(null);
    }
  });
  return baseOuverte;
}

async function lireCache(cle) {
  const db = await ouvrirBase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction("tables", "readonly").objectStore("tables").get(cle);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (_e) {
      resolve(null);
    }
  });
}

async function ecrireCache(cle, valeur) {
  const db = await ouvrirBase();
  if (!db) return;
  try {
    db.transaction("tables", "readwrite").objectStore("tables").put(valeur, cle);
  } catch (_e) {
    // Cache plein ou indisponible : sans conséquence, on relira la base.
  }
}

// Le compte connecté fait partie de la clé : un autre compte sur le même
// appareil ne verrait jamais les données en cache du premier.
async function cleCache(nom) {
  const session = await sessionPrete();
  const uid = session?.user?.id;
  return uid ? `${uid}:${nom}` : null;
}

// Retour au premier plan : on ne resynchronise pas plus d'une fois par minute
// (le retour déclenche souvent deux événements, « focus » et « visibilité »).
const DELAI_MIN_RESYNCHRO_MS = 60 * 1000;
// Sans colonne de version exploitable, on ne relit tout qu'au plus toutes les
// 30 minutes au retour dans l'appli.
const DELAI_RELECTURE_COMPLETE_MS = 30 * 60 * 1000;
const TAILLE_LOT = 40;

/**
 * Synchronise une collection (clients, rapports, planning, devis, facturation...)
 * avec une table Supabase : id (text) + data (jsonb) + updated_at (mis à jour
 * par la base à chaque modification).
 * - Affiche d'abord le cache de l'appareil, puis ne télécharge que ce qui a
 *   changé (ou toute la table s'il n'y a pas encore de cache).
 * - Resynchronise au retour de l'appli au premier plan (le système coupe la
 *   connexion temps réel en arrière-plan), au plus une fois par minute.
 * - Écoute les changements en temps réel pour que tous les appareils restent
 *   synchronisés.
 * - Expose upsert() et remove() qui mettent à jour l'état local immédiatement
 *   (affichage instantané) puis écrivent en base.
 */
export function useSyncedCollection(table, seed) {
  const [items, setItemsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seeded = useRef(false);
  const chargementEnCours = useRef(false);
  const rechargementDemande = useRef(false);
  const essais = useRef(0);
  const itemsRef = useRef([]);
  const versions = useRef(new Map()); // id → updated_at
  const derniereSynchro = useRef(0);
  const derniereLectureComplete = useRef(0);
  const sansVersions = useRef(false);
  const minuterieCache = useRef(null);

  // Toute modification de la liste passe par ici : état, référence et cache.
  const setItems = useCallback((maj) => {
    setItemsState((prev) => {
      const suivant = typeof maj === "function" ? maj(prev) : maj;
      itemsRef.current = suivant;
      return suivant;
    });
    clearTimeout(minuterieCache.current);
    minuterieCache.current = setTimeout(async () => {
      const cle = await cleCache(table);
      if (cle) ecrireCache(cle, { items: itemsRef.current, versions: Object.fromEntries(versions.current) });
    }, 800);
  }, [table]);

  useEffect(() => {
    let active = true;

    // Lecture complète de la table (premier lancement, ou base sans versions).
    const lectureComplete = async () => {
      let res = await supabase.from(table).select("id, data, updated_at");
      if (res.error && !sansVersions.current) {
        // Table sans colonne updated_at : on lit sans les versions.
        sansVersions.current = true;
        res = await supabase.from(table).select("id, data");
      }
      if (res.error) return res;
      versions.current = new Map((res.data || []).map((r) => [String(r.id), r.updated_at || ""]));
      derniereLectureComplete.current = Date.now();
      return res;
    };

    // Lecture partielle : seulement les lignes nouvelles ou modifiées depuis
    // la dernière fois, et retrait de celles supprimées ailleurs.
    const lectureDifferentielle = async () => {
      const res = await supabase.from(table).select("id, updated_at");
      if (res.error) return { erreur: res.error };
      const distantes = new Map((res.data || []).map((r) => [String(r.id), r.updated_at || ""]));
      const aLire = [...distantes].filter(([id, v]) => !v || versions.current.get(id) !== v).map(([id]) => id);
      const supprimees = [...versions.current.keys()].filter((id) => !distantes.has(id));
      const lues = [];
      for (let i = 0; i < aLire.length; i += TAILLE_LOT) {
        const lot = aLire.slice(i, i + TAILLE_LOT);
        const r = await supabase.from(table).select("id, data, updated_at").in("id", lot);
        if (r.error) return { erreur: r.error };
        lues.push(...(r.data || []));
      }
      return { lues, supprimees, distantes };
    };

    // Démarrage : le cache de l'appareil est lu AVANT toute synchronisation
    // (sinon un événement de connexion très rapide relisait toute la table).
    const cacheRestaure = (async () => {
      const cle = await cleCache(table);
      const cache = cle ? await lireCache(cle) : null;
      if (!active) return;
      if (cache && Array.isArray(cache.items) && cache.versions) {
        versions.current = new Map(Object.entries(cache.versions));
        itemsRef.current = sansVides(cache.items);
        setItemsState(itemsRef.current);
        setLoading(false);
      }
    })();

    const load = async ({ force = false } = {}) => {
      // Évite les lectures simultanées quand plusieurs déclencheurs se
      // superposent. Une demande ignorée est rejouée à la fin de la lecture.
      if (chargementEnCours.current) {
        rechargementDemande.current = true;
        return;
      }
      chargementEnCours.current = true;

      try {
        await cacheRestaure;
        const session = await sessionPrete();
        if (!active) return;

        if (!session) {
          // Session pas encore restaurée depuis le stockage de l'appareil : on
          // réessaie quelques fois avant d'abandonner.
          if (essais.current < 5) {
            essais.current += 1;
            setTimeout(() => { if (active) load({ force }); }, 600 * essais.current);
            return;
          }
          setLoading(false);
          return;
        }
        essais.current = 0;
        derniereSynchro.current = Date.now();

        // Différentiel dès qu'on connaît des versions ; sinon lecture complète
        // (au plus toutes les 30 min si la table n'a pas de versions).
        const differentiel = versions.current.size > 0 && !sansVersions.current;
        if (!differentiel && sansVersions.current && !force && Date.now() - derniereLectureComplete.current < DELAI_RELECTURE_COMPLETE_MS) {
          return;
        }

        if (differentiel) {
          const r = await lectureDifferentielle();
          if (!active) return;
          if (r.erreur) {
            // En cas d'erreur réseau, on conserve les données déjà affichées.
            setError(r.erreur.message);
            setLoading(false);
            return;
          }
          if (r.lues.length > 0 || r.supprimees.length > 0) {
            r.lues.forEach((row) => versions.current.set(String(row.id), row.updated_at || ""));
            r.supprimees.forEach((id) => versions.current.delete(id));
            const parId = new Map(r.lues.map((row) => [String(row.id), elementValide(row)]));
            const retirer = new Set(r.supprimees);
            setItems((prev) => {
              const liste = sansVides(prev)
                .filter((it) => !retirer.has(String(it.id)))
                .map((it) => (parId.has(String(it.id)) ? parId.get(String(it.id)) : it))
                .filter(Boolean);
              const connus = new Set(liste.map((it) => String(it.id)));
              parId.forEach((it, id) => { if (it && !connus.has(id)) liste.push(it); });
              return liste;
            });
          }
          setError(null);
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await lectureComplete();
        if (!active) return;

        if (fetchError) {
          setError(fetchError.message);
          setLoading(false);
          return;
        }

        if (data.length === 0 && seed && seed.length > 0 && !seeded.current) {
          seeded.current = true;
          const rows = seed.map((item) => ({ id: item.id, data: item }));
          const { error: insertError } = await supabase.from(table).insert(rows);
          if (insertError) setError(insertError.message);
          setItems(sansVides(seed));
        } else {
          setItems((data || []).map(elementValide).filter(Boolean));
          setError(null);
        }
        setLoading(false);
      } finally {
        chargementEnCours.current = false;
        if (rechargementDemande.current) {
          rechargementDemande.current = false;
          load();
        }
      }
    };

    load();

    // Connexion (ou reconnexion) : synchronisation. Le simple renouvellement
    // du jeton, chaque heure, ne déclenche plus rien.
    const { data: souscriptionAuth } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") load();
    });

    // Retour de l'application au premier plan : les messages temps réel
    // manqués pendant la veille ne sont pas rejoués, on resynchronise.
    const rechargerSiVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - derniereSynchro.current < DELAI_MIN_RESYNCHRO_MS) return;
      load();
    };
    document.addEventListener("visibilitychange", rechargerSiVisible);
    window.addEventListener("focus", rechargerSiVisible);

    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = payload.old && payload.old.id;
            if (id !== undefined && id !== null) {
              versions.current.delete(String(id));
              setItems((prev) => sansVides(prev).filter((it) => String(it.id) !== String(id)));
            } else load();
            return;
          }
          // Pour une ligne volumineuse (rapport avec photos…), l'avis de
          // changement peut arriver sans son contenu : la synchronisation
          // différentielle va alors chercher cette seule ligne.
          const incoming = elementValide(payload.new);
          if (!incoming) { load(); return; }
          if (payload.new?.updated_at) versions.current.set(String(incoming.id), payload.new.updated_at);
          setItems((prev) => {
            const liste = sansVides(prev);
            const exists = liste.some((it) => it.id === incoming.id);
            return exists ? liste.map((it) => (it.id === incoming.id ? incoming : it)) : [...liste, incoming];
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      souscriptionAuth?.subscription?.unsubscribe();
      document.removeEventListener("visibilitychange", rechargerSiVisible);
      window.removeEventListener("focus", rechargerSiVisible);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const upsert = useCallback(
    async (item) => {
      if (!item || item.id === undefined || item.id === null) return;
      setItems((prev) => {
        const liste = sansVides(prev);
        const exists = liste.some((it) => it.id === item.id);
        return exists ? liste.map((it) => (it.id === item.id ? item : it)) : [...liste, item];
      });
      // On récupère la nouvelle version (quelques octets) pour ne pas
      // retélécharger cette ligne à la prochaine synchronisation.
      const { data, error: upsertError } = await supabase.from(table).upsert({ id: item.id, data: item }).select("updated_at");
      if (upsertError) setError(upsertError.message);
      else if (data && data[0]?.updated_at) versions.current.set(String(item.id), data[0].updated_at);
    },
    [table, setItems]
  );

  const remove = useCallback(
    async (id) => {
      versions.current.delete(String(id));
      setItems((prev) => sansVides(prev).filter((it) => it.id !== id));
      const { error: deleteError } = await supabase.from(table).delete().eq("id", id);
      if (deleteError) setError(deleteError.message);
    },
    [table, setItems]
  );

  return { items, upsert, remove, loading, error };
}

/**
 * Même principe pour les paramètres (technicien, entreprise, modèles de tableaux) :
 * une seule ligne partagée par toute l'entreprise (id fixe = 1). Elle contient
 * le logo : on ne la retélécharge que si sa version a changé.
 */
export function useSyncedSettings(defaultValue) {
  const [settings, setSettingsState] = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seeded = useRef(false);
  const chargementEnCours = useRef(false);
  const rechargementDemande = useRef(false);
  const essais = useRef(0);
  const version = useRef("");
  const derniereSynchro = useRef(0);

  const memoriser = async (data, v) => {
    const cle = await cleCache("settings");
    if (cle) ecrireCache(cle, { data, version: v || "" });
  };

  useEffect(() => {
    let active = true;

    const cacheRestaure = (async () => {
      const cle = await cleCache("settings");
      const cache = cle ? await lireCache(cle) : null;
      if (!active) return;
      if (cache && cache.data) {
        version.current = cache.version || "";
        setSettingsState(cache.data);
        setLoading(false);
      }
    })();

    const load = async () => {
      if (chargementEnCours.current) {
        rechargementDemande.current = true;
        return;
      }
      chargementEnCours.current = true;

      try {
        await cacheRestaure;
        const session = await sessionPrete();
        if (!active) return;

        if (!session) {
          if (essais.current < 5) {
            essais.current += 1;
            setTimeout(() => { if (active) load(); }, 600 * essais.current);
            return;
          }
          setLoading(false);
          return;
        }
        essais.current = 0;
        derniereSynchro.current = Date.now();

        // Version seulement d'abord : si elle n'a pas changé, rien à télécharger.
        if (version.current) {
          const { data: v, error: errV } = await supabase.from("settings").select("updated_at").eq("id", 1).maybeSingle();
          if (!active) return;
          if (!errV && v && v.updated_at === version.current) { setLoading(false); return; }
        }

        const { data, error: fetchError } = await supabase
          .from("settings")
          .select("data, updated_at")
          .eq("id", 1)
          .maybeSingle();
        if (!active) return;

        if (fetchError) {
          setError(fetchError.message);
          setLoading(false);
          return;
        }

        if (!data && !seeded.current) {
          seeded.current = true;
          const { error: insertError } = await supabase.from("settings").insert({ id: 1, data: defaultValue });
          if (insertError) setError(insertError.message);
          setSettingsState(defaultValue);
        } else if (data) {
          version.current = data.updated_at || "";
          setSettingsState(data.data);
          memoriser(data.data, version.current);
          setError(null);
        }
        setLoading(false);
      } finally {
        chargementEnCours.current = false;
        if (rechargementDemande.current) {
          rechargementDemande.current = false;
          load();
        }
      }
    };

    load();

    const { data: souscriptionAuth } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") load();
    });

    const rechargerSiVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - derniereSynchro.current < DELAI_MIN_RESYNCHRO_MS) return;
      load();
    };
    document.addEventListener("visibilitychange", rechargerSiVisible);
    window.addEventListener("focus", rechargerSiVisible);

    const channel = supabase
      .channel("realtime-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, (payload) => {
        if (payload.new && payload.new.data) {
          version.current = payload.new.updated_at || "";
          setSettingsState(payload.new.data);
          memoriser(payload.new.data, version.current);
        } else {
          version.current = "";
          load();
        }
      })
      .subscribe();

    return () => {
      active = false;
      souscriptionAuth?.subscription?.unsubscribe();
      document.removeEventListener("visibilitychange", rechargerSiVisible);
      window.removeEventListener("focus", rechargerSiVisible);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = useCallback(async (next) => {
    setSettingsState(next);
    const { data, error: upsertError } = await supabase.from("settings").upsert({ id: 1, data: next }).select("updated_at");
    if (upsertError) setError(upsertError.message);
    else {
      version.current = (data && data[0]?.updated_at) || "";
      memoriser(next, version.current);
    }
  }, []);

  return { settings, saveSettings, loading, error };
}
