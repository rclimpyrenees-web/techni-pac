import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";

/**
 * Attend que la session de connexion soit restaurée avant toute lecture.
 *
 * C'était l'origine du bug « plus aucun client au démarrage » : au lancement,
 * la lecture partait AVANT que Supabase ait fini de restaurer la session
 * enregistrée sur l'appareil. Les règles de sécurité filtrant sur
 * l'utilisateur connecté, la base répondait alors « aucune ligne » — réponse
 * parfaitement valide, donc jamais réessayée. En fermant complètement
 * l'application, tout repartait dans le bon ordre : d'où le côté aléatoire.
 */
async function sessionPrete() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

/**
 * Synchronise une collection (clients, rapports, planning, devis, facturation...)
 * avec une table Supabase à deux colonnes : id (text) + data (jsonb).
 * - Charge les données une fois la session prête (et les pré-remplit avec les
 *   données d'exemple si la table est vide, au tout premier lancement).
 * - Recharge à la connexion, au rafraîchissement du jeton, et au retour de
 *   l'application au premier plan (le système coupe la connexion temps réel
 *   quand elle passe en arrière-plan sur téléphone).
 * - Écoute les changements en temps réel (Postgres Realtime) pour que tous les
 *   appareils connectés restent synchronisés automatiquement.
 * - Expose upsert() et remove() qui mettent à jour l'état local immédiatement
 *   (affichage instantané) puis écrivent en base.
 */
export function useSyncedCollection(table, seed) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seeded = useRef(false);
  const chargementEnCours = useRef(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      // Évite les lectures simultanées quand plusieurs déclencheurs se
      // superposent (retour au premier plan + rafraîchissement du jeton...).
      if (chargementEnCours.current) return;
      chargementEnCours.current = true;

      try {
        const session = await sessionPrete();
        if (!active) return;

        if (!session) {
          // Personne n'est connecté : on n'efface surtout pas ce qui est déjà
          // affiché, et on attend l'événement de connexion pour recharger.
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase.from(table).select("id, data");
        if (!active) return;

        if (fetchError) {
          // En cas d'erreur réseau, on conserve les données déjà chargées
          // plutôt que d'afficher une liste vide trompeuse.
          setError(fetchError.message);
          setLoading(false);
          return;
        }

        if (data.length === 0 && seed && seed.length > 0 && !seeded.current) {
          seeded.current = true;
          const rows = seed.map((item) => ({ id: item.id, data: item }));
          const { error: insertError } = await supabase.from(table).insert(rows);
          if (insertError) setError(insertError.message);
          setItems(seed);
        } else {
          setItems(data.map((row) => row.data));
          setError(null);
        }
        setLoading(false);
      } finally {
        chargementEnCours.current = false;
      }
    };

    load();

    // Rechargement dès que l'état de connexion évolue : c'est ce qui rattrape
    // le cas où la session n'était pas encore prête au tout premier essai.
    const { data: souscriptionAuth } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        load();
      }
    });

    // Retour de l'application au premier plan : on resynchronise, car les
    // messages temps réel manqués pendant la mise en veille ne sont pas rejoués.
    const rechargerSiVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", rechargerSiVisible);
    window.addEventListener("focus", rechargerSiVisible);

    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((it) => it.id !== payload.old.id);
            }
            const incoming = payload.new.data;
            const exists = prev.some((it) => it.id === incoming.id);
            return exists ? prev.map((it) => (it.id === incoming.id ? incoming : it)) : [...prev, incoming];
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
  }, [table]);

  const upsert = useCallback(
    async (item) => {
      setItems((prev) => {
        const exists = prev.some((it) => it.id === item.id);
        return exists ? prev.map((it) => (it.id === item.id ? item : it)) : [...prev, item];
      });
      const { error: upsertError } = await supabase.from(table).upsert({ id: item.id, data: item });
      if (upsertError) setError(upsertError.message);
    },
    [table]
  );

  const remove = useCallback(
    async (id) => {
      setItems((prev) => prev.filter((it) => it.id !== id));
      const { error: deleteError } = await supabase.from(table).delete().eq("id", id);
      if (deleteError) setError(deleteError.message);
    },
    [table]
  );

  return { items, upsert, remove, loading, error };
}

/**
 * Même principe pour les paramètres (technicien, entreprise, modèles de tableaux) :
 * une seule ligne partagée par toute l'entreprise (id fixe = 1).
 */
export function useSyncedSettings(defaultValue) {
  const [settings, setSettingsState] = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const seeded = useRef(false);
  const chargementEnCours = useRef(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (chargementEnCours.current) return;
      chargementEnCours.current = true;

      try {
        const session = await sessionPrete();
        if (!active) return;

        if (!session) {
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("settings")
          .select("data")
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
          setSettingsState(data.data);
          setError(null);
        }
        setLoading(false);
      } finally {
        chargementEnCours.current = false;
      }
    };

    load();

    const { data: souscriptionAuth } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        load();
      }
    });

    const rechargerSiVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", rechargerSiVisible);
    window.addEventListener("focus", rechargerSiVisible);

    const channel = supabase
      .channel("realtime-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, (payload) => {
        if (payload.new && payload.new.data) setSettingsState(payload.new.data);
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
    const { error: upsertError } = await supabase.from("settings").upsert({ id: 1, data: next });
    if (upsertError) setError(upsertError.message);
  }, []);

  return { settings, saveSettings, loading, error };
}
