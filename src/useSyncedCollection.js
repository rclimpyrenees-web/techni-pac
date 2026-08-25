import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";

/**
 * Synchronise une collection (clients, rapports, planning, devis, facturation...)
 * avec une table Supabase à deux colonnes : id (text) + data (jsonb).
 * - Charge les données au montage (et les pré-remplit avec les données d'exemple
 *   si la table est vide, au tout premier lancement).
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

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data, error: fetchError } = await supabase.from(table).select("id, data");
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
        setItems(seed);
      } else {
        setItems(data.map((row) => row.data));
      }
      setLoading(false);
    };

    load();

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

  useEffect(() => {
    let active = true;

    const load = async () => {
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
      }
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("realtime-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, (payload) => {
        if (payload.new && payload.new.data) setSettingsState(payload.new.data);
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const saveSettings = useCallback(async (next) => {
    setSettingsState(next);
    const { error: upsertError } = await supabase.from("settings").upsert({ id: 1, data: next });
    if (upsertError) setError(upsertError.message);
  }, []);

  return { settings, saveSettings, loading, error };
}
