import React, { useState, useRef, useEffect } from "react";
import { useSyncedCollection, useSyncedSettings } from "./useSyncedCollection.js";
import { supabase } from "./supabaseClient.js";
import { BLANK_CONTRACT_PDF_BASE64, BLANK_CONTRACT_AIR_EAU_PDF_BASE64, BLANK_CONTRACT_B2B_PDF_BASE64, BLANK_CONTRACT_AIR_EAU_B2B_PDF_BASE64 } from "./contractTemplate.js";
import { pennylaneCreateInvoice, pennylaneCheckStatus } from "./pennylane.js";

/* ---------- Modèles de checklist par défaut (modifiables librement dans chaque rapport) ---------- */

const DEFAULT_MES_CHECKLIST = [
  { id: "mes1", label: "Tirage au vide effectué" },
  { id: "mes2", label: "Charge en fluide frigorigène contrôlée" },
  { id: "mes3", label: "Test d'étanchéité réalisé" },
  { id: "mes4", label: "Paramétrage régulation effectué" },
  { id: "mes5", label: "Essai de fonctionnement (froid / chaud)" },
  { id: "mes6", label: "Explication du fonctionnement au client" },
];

const DEFAULT_ENTRETIEN_CHECKLIST = [
  { id: "ent1", label: "Filtres nettoyés" },
  { id: "ent2", label: "Pression contrôlée" },
  { id: "ent3", label: "Contrôle étanchéité" },
  { id: "ent4", label: "Évacuation des condensats" },
  { id: "ent5", label: "Batterie extérieure nettoyée" },
];

/* ---------- Paramètres généraux (technicien + entreprise) ---------- */

const defaultSettings = {
  technicien: { nom: "" },
  entreprise: { nom: "", adresse: "", codePostalVille: "", telephone: "", email: "", siret: "", attestationCapacite: "", logo: "", clausePied: "" },
  pennylane: { active: false, tvaParDefaut: "FR_200" },
  tableaux: [
    {
      id: "tpl1",
      nom: "Relevés frigorifiques",
      rows: [
        ["Grandeur", "Valeur"],
        ["Pression BP", ""],
        ["Pression HP", ""],
        ["Température départ", ""],
        ["Température retour", ""],
        ["Intensité", ""],
      ],
    },
  ],
  checklists: [
    {
      id: "cktpl1",
      nom: "Entretien standard",
      type: "entretien",
      items: [
        { label: "Filtres nettoyés" },
        { label: "Pression contrôlée" },
        { label: "Contrôle étanchéité" },
        { label: "Évacuation des condensats" },
        { label: "Batterie extérieure nettoyée" },
      ],
    },
    {
      id: "cktpl2",
      nom: "Mise en service standard",
      type: "mise_en_service",
      items: [
        { label: "Tirage au vide effectué" },
        { label: "Charge en fluide frigorigène contrôlée" },
        { label: "Test d'étanchéité réalisé" },
        { label: "Paramétrage régulation effectué" },
        { label: "Essai de fonctionnement (froid / chaud)" },
        { label: "Explication du fonctionnement au client" },
      ],
    },
  ],
};


/* ---------- Données d'exemple ---------- */

const initialClients = [];

const installTypes = [
  "Néant",
  "Climatiseur split",
  "Climatisation gainable",
  "PAC air/eau",
  "PAC air/air",
  "Chauffe-eau thermodynamique",
];

const initialReports = [];

const initialPlanning = [];

const initialDevisAFaire = [];

const initialDevisEnCours = [];

const initialFacturation = [];

/* ---------- Icônes simples (SVG inline, pas de dépendance) ---------- */
const Icon = ({ name, size = 18 }) => {
  const paths = {
    dashboard: "M4 4h7v9H4V4zm9 0h7v5h-7V4zm0 8h7v9h-7v-9zM4 16h7v5H4v-5z",
    report: "M6 2h9l5 5v15H6V2zm8 1.5V8h4.5",
    users: "M17 21v-2a4 4 0 00-3-3.87M9 21v-2a4 4 0 013-3.87m0-8a4 4 0 110 8 4 4 0 010-8zm8 3a4 4 0 010 8",
    calendar: "M8 2v4M16 2v4M3 9h18M4 5h16v16H4V5z",
    quote: "M6 3h12v18l-3-2-3 2-3-2-3 2V3z",
    invoice: "M4 3h16v18l-4-2-4 2-4-2-4 2V3z",
    plus: "M12 5v14M5 12h14",
    bell: "M6 8a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6",
    check: "M5 13l4 4L19 7",
    photo: "M4 5h4l2-2h4l2 2h4v14H4V5zm8 4a3 3 0 100 6 3 3 0 000-6z",
    trash: "M4 7h16M9 7V4h6v3m-8 0v13h10V7",
    edit: "M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z",
    download: "M12 3v12m0 0l-4-4m4 4l4-4M4 21h16",
    settings: "M12 8a4 4 0 100 8 4 4 0 000-8zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
    alert: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
    sync: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
    chevronLeft: "M15 18l-6-6 6-6",
    chevronRight: "M9 18l6-6-6-6",
    chevronDown: "M6 9l6 6 6-6",
    menu: "M3 12h18M3 6h18M3 18h18",
    close: "M18 6L6 18M6 6l12 12",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || ""} />
    </svg>
  );
};

/* ---------- Bouton Supprimer avec confirmation intégrée (pas de window.confirm,
   qui est bloqué dans certains environnements — clic une fois pour armer, une
   seconde fois pour confirmer, ou "Annuler" pour revenir en arrière) ---------- */
function DeleteButton({ onConfirm, label = "Supprimer" }) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <span className="delete-confirm-group" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="btn-small btn-danger-solid"
          onClick={() => { setArmed(false); onConfirm(); }}
        >
          Confirmer
        </button>
        <button type="button" className="btn-ghost small" onClick={() => setArmed(false)}>
          Annuler
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="btn-ghost small btn-danger"
      onClick={(e) => { e.stopPropagation(); setArmed(true); }}
    >
      <Icon name="trash" size={14} /> {label}
    </button>
  );
}

/* ---------- Petit composant Jauge (élément signature) ---------- */
function Jauge({ value, max, label, onClick }) {
  const pct = Math.min(1, value / max);
  const angle = -90 + pct * 180;
  return (
    <div className={"jauge" + (onClick ? " jauge-clickable" : "")} onClick={onClick} role={onClick ? "button" : undefined}>
      <svg viewBox="0 0 120 70" width="120" height="70">
        <path d="M10,65 A50,50 0 0,1 110,65" fill="none" stroke="#DDE4E2" strokeWidth="8" strokeLinecap="round" />
        <path d="M10,65 A50,50 0 0,1 110,65" fill="none" stroke="url(#gaugeGrad)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${pct * 157} 157`} />
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2F6FA3" />
            <stop offset="100%" stopColor="#D9762B" />
          </linearGradient>
        </defs>
        <line x1="60" y1="65" x2={60 + 38 * Math.cos((angle * Math.PI) / 180)} y2={65 + 38 * Math.sin((angle * Math.PI) / 180)} stroke="#1B2733" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="60" cy="65" r="3.5" fill="#1B2733" />
      </svg>
      <div className="jauge-val">{value}</div>
      <div className="jauge-label">{label}</div>
    </div>
  );
}

/* ---------- App principale ---------- */

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { items: clients, upsert: upsertClient, remove: removeClient, loading: loadingClients } = useSyncedCollection("clients", initialClients);
  const { items: reportsRaw, upsert: upsertReport, remove: removeReport, loading: loadingReports } = useSyncedCollection("reports", initialReports);
  const { items: planningRaw, upsert: upsertPlanning, remove: removePlanning, loading: loadingPlanning } = useSyncedCollection("planning", initialPlanning);
  const { items: devisAFaire, upsert: upsertDevisAFaire, remove: removeDevisAFaire, loading: loadingDevisAFaire } = useSyncedCollection("devis_a_faire", initialDevisAFaire);
  const { items: devisEnCours, upsert: upsertDevisEnCours, remove: removeDevisEnCours, loading: loadingDevisEnCours } = useSyncedCollection("devis_en_cours", initialDevisEnCours);
  const { items: facturation, upsert: upsertFacturation, remove: removeFacturation, loading: loadingFacturation } = useSyncedCollection("facturation", initialFacturation);
  const { settings, saveSettings, loading: loadingSettings } = useSyncedSettings(defaultSettings);

  const dataLoading = loadingClients || loadingReports || loadingPlanning || loadingDevisAFaire || loadingDevisEnCours || loadingFacturation || loadingSettings;

  // Tri stable pour un affichage cohérent, indépendant de l'ordre d'arrivée réseau.
  const reports = [...reportsRaw].sort((a, b) => (a.id < b.id ? 1 : -1));
  const planning = [...planningRaw].sort((a, b) => a.date.localeCompare(b.date));

  const [focusReport, setFocusReport] = useState(null);
  const [reportPrefill, setReportPrefill] = useState(null);
  const [focusClient, setFocusClient] = useState(null);
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState(null);

  const [showClientForm, setShowClientForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showRappelForm, setShowRappelForm] = useState(false);
  const [reportType, setReportType] = useState("mise_en_service");

  const upcoming = planning.filter((p) => !p.fait && p.categorie !== "relance").length;
  const relances = devisEnCours.filter((d) => d.statut === "a_relancer").length;
  const aFacturer = facturation.filter((f) => !f.facture).length;
  const facturesNonPayees = facturation.filter((f) => !f.payee).length;
  const rappelsActifs = planning.filter((p) => p.rappel && !p.fait && p.categorie !== "intervention");

  const nav = [
    { id: "dashboard", label: "Tableau de bord", icon: "dashboard" },
    { id: "rapports", label: "Interventions", icon: "report" },
    { id: "clients", label: "Clients", icon: "users" },
    { id: "planning", label: "Planning", icon: "calendar" },
    { id: "rappels", label: "Rappels", icon: "bell" },
    { id: "devis", label: "Devis", icon: "quote" },
    { id: "facturation", label: "Facturation", icon: "invoice" },
    { id: "parametres", label: "Paramètres", icon: "settings" },
  ];

  const shouldAutoFacturer = (r) => {
    if (r.devisAEffectuer && r.devisAEffectuer.trim()) return false;
    if (r.type === "mise_en_service" || r.type === "entretien") return true;
    if (r.type === "diagnostic") return !!r.facturable;
    return false;
  };

  const syncFactureToPennylane = async (facturationEntry, r) => {
    const client = clients.find((c) => c.nom === r.client);
    try {
      const { invoice, pennylaneCustomerId } = await pennylaneCreateInvoice({
        client: {
          nom: client?.nom || r.client,
          email: client?.email || "",
          adresse: client?.adresse || "",
          tel: client?.tel || "",
          siren: client?.siren || "",
          tva: client?.tva || "",
          pennylaneId: client?.pennylaneCustomerId || null,
        },
        montantHT: parseFloat(r.montant),
        label: `${labelType(r.type)} — ${r.date}`,
        vatRate: r.tva || settings.pennylane?.tvaParDefaut || "FR_200",
      });
      upsertFacturation({ ...facturationEntry, facture: true, pennylaneInvoiceId: invoice.id, pennylaneStatus: "envoyée" });
      if (client && pennylaneCustomerId && client.pennylaneCustomerId !== String(pennylaneCustomerId)) {
        upsertClient({ ...client, pennylaneCustomerId: String(pennylaneCustomerId) });
      }
    } catch (e) {
      upsertFacturation({ ...facturationEntry, pennylaneStatus: "erreur", pennylaneError: String(e?.message || e) });
    }
  };

  const syncPlanningTaskFromReport = (r) => {
    if (!r.planningTaskId) return;
    const task = planning.find((p) => p.id === r.planningTaskId);
    if (task && task.fait !== !!r.valide) upsertPlanning({ ...task, fait: !!r.valide });
  };

  const handleAddReport = (r) => {
    upsertReport(r);
    syncPlanningTaskFromReport(r);
    if (r.devisAEffectuer && r.devisAEffectuer.trim()) {
      upsertDevisAFaire({
        id: "df" + Date.now(),
        client: r.client,
        origine: `${labelType(r.type)} du ${r.date} — ${r.devisAEffectuer.trim()}`,
        date: r.date,
      });
    } else if (shouldAutoFacturer(r)) {
      const facturationEntry = {
        id: "f" + Date.now(),
        client: r.client,
        intervention: `${labelType(r.type)} — ${r.date}`,
        montant: r.montant ? `${r.montant} €` : "À chiffrer",
        facture: false,
        payee: false,
        date: r.date,
        reportId: r.id,
      };
      upsertFacturation(facturationEntry);
      if (settings.pennylane?.active && r.montant) {
        syncFactureToPennylane(facturationEntry, r);
      }
    }
  };

  const handleUpdateReport = (r) => {
    upsertReport(r);
    syncPlanningTaskFromReport(r);
  };

  const handleDeleteReport = (r) => {
    removeReport(r.id);
  };

  const handlePrint = (r) => {
    setPdfPreviewHtml(buildReportHtml(r, settings));
  };

  const goToReport = (id) => {
    setTab("rapports");
    setFocusReport({ id, token: Date.now() });
  };

  const startReportFromTask = (task) => {
    setReportPrefill({ client: task.client, reportType: guessReportType(task.titre), planningTaskId: task.id, token: Date.now() });
    setTab("rapports");
  };

  const goToClient = (clientName) => {
    setTab("clients");
    setFocusClient({ name: clientName, token: Date.now() });
  };

  const handleDeleteClient = (client) => {
    removeClient(client.id);
  };

  const togglePlanning = (id) => {
    const item = planning.find((p) => p.id === id);
    if (item) upsertPlanning({ ...item, fait: !item.fait });
  };
  const handleValidateReport = (r) => {
    const updated = { ...r, valide: !r.valide };
    upsertReport(updated);
    syncPlanningTaskFromReport(updated);
  };

  const syncPennylaneStatus = async (item) => {
    if (!item || !item.pennylaneInvoiceId) return;
    try {
      const status = await pennylaneCheckStatus(item.pennylaneInvoiceId);
      if (status.paid && !item.payee) {
        upsertFacturation({ ...item, payee: true, pennylaneStatus: "payée" });
      } else if (!status.paid && item.pennylaneStatus !== "envoyée") {
        upsertFacturation({ ...item, pennylaneStatus: "envoyée" });
      }
    } catch (e) {
      upsertFacturation({ ...item, pennylaneStatus: "erreur", pennylaneError: String(e?.message || e) });
    }
  };

  // Relance manuelle : utile si l'envoi automatique n'a jamais abouti (coupure
  // réseau sur le terrain, etc.) — retrouve le rapport d'origine pour
  // reconstituer les informations nécessaires (montant, TVA...) et retente.
  const handleRetryPennylane = (facturationId) => {
    const item = facturation.find((f) => f.id === facturationId);
    if (!item) return;
    const report = reports.find((r) => r.id === item.reportId);
    if (!report || !report.montant) {
      upsertFacturation({ ...item, pennylaneStatus: "erreur", pennylaneError: "Impossible de retrouver le montant du rapport d'origine — vérifiez-le sur le rapport concerné." });
      return;
    }
    const itemAvecMontantAJour = { ...item, montant: `${report.montant} €` };
    upsertFacturation(itemAvecMontantAJour);
    syncFactureToPennylane(itemAvecMontantAJour, report);
  };

  const handleDeleteFacturation = (id) => {
    removeFacturation(id);
  };

  // Vérification automatique du statut payé/impayé des factures Pennylane à
  // chaque ouverture de l'onglet Facturation, pour éviter de devoir cliquer
  // manuellement sur 🔄 pour chacune.
  useEffect(() => {
    if (tab !== "facturation" || !settings.pennylane?.active) return;
    const aVerifier = facturation.filter((f) => f.facture && !f.payee && f.pennylaneInvoiceId);
    aVerifier.forEach((item) => { syncPennylaneStatus(item); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Crée (ou met à jour) automatiquement un rappel dans Planning pour chaque
  // client sous contrat dont l'échéance d'entretien approche (dans le mois qui
  // précède) ou est dépassée. L'identifiant est stable (basé sur le client et
  // l'année) pour ne jamais créer de doublon d'une vérification à l'autre.
  useEffect(() => {
    clients.forEach((c) => {
      const statut = getEntretienStatus(c, reports);
      if (!statut || !statut.dueDate) return;
      const rappelId = "echeance-" + c.id + "-" + statut.annee;
      const existant = planning.find((p) => p.id === rappelId);

      if (statut.isUrgent && !existant) {
        upsertPlanning({
          id: rappelId,
          date: toLocalISODate(statut.dueDate),
          heure: "—",
          titre: "Entretien contractuel à programmer",
          client: c.nom,
          rappel: true,
          fait: false,
          categorie: "relance",
        });
      } else if (statut.doneThisYear && existant && !existant.fait) {
        upsertPlanning({ ...existant, fait: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, reports]);

  const toggleRappel = (id) => {
    const item = planning.find((p) => p.id === id);
    if (item) upsertPlanning({ ...item, rappel: !item.rappel });
  };

  if (dataLoading) {
    return (
      <div className="app-loading">
        <style>{css}</style>
        <div className="app-loading-box">
          <div className="brand-mark">TP</div>
          <p>Chargement de vos données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <style>{css}</style>

      <header className="mobile-topbar">
        <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="Ouvrir le menu">
          <Icon name="menu" size={22} />
        </button>
        <div className="brand">
          <div className="brand-mark">TP</div>
          <div className="brand-name">TECHNI-PAC</div>
        </div>
      </header>

      {mobileNavOpen && <div className="mobile-nav-overlay" onClick={() => setMobileNavOpen(false)} />}

      <aside className={"sidebar" + (mobileNavOpen ? " open" : "")}>
        <div className="brand">
          <div className="brand-mark">TP</div>
          <div>
            <div className="brand-name">TECHNI-PAC</div>
            <div className="brand-sub">Poste de gestion</div>
          </div>
          <button className="mobile-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="Fermer le menu">
            <Icon name="close" size={20} />
          </button>
        </div>
        <nav>
          {nav.map((n) => (
            <button key={n.id} className={"navbtn" + (tab === n.id ? " active" : "")} onClick={() => { setTab(n.id); setMobileNavOpen(false); }}>
              <Icon name={n.icon} />
              {n.label}
              {n.id === "rappels" && rappelsActifs.length > 0 && <span className="nav-badge">{rappelsActifs.length}</span>}
              {n.id === "devis" && (devisAFaire.length + devisEnCours.length) > 0 && <span className="nav-badge">{devisAFaire.length + devisEnCours.length}</span>}
              {n.id === "facturation" && facturesNonPayees > 0 && <span className="nav-badge">{facturesNonPayees}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          Données synchronisées en temps réel
          <br />
          <button className="logout-link" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
        </div>
      </aside>

      <main className="main">
        {tab === "dashboard" && (
          <Dashboard
            upcoming={upcoming}
            relances={relances}
            aFacturer={aFacturer}
            planning={planning}
            reports={reports}
            rappelsActifs={rappelsActifs}
            onToggle={togglePlanning}
            onNavigate={setTab}
            onOpenReport={goToReport}
          />
        )}

        {tab === "rapports" && (
          <Rapports
            reports={reports}
            clients={clients}
            settings={settings}
            showForm={showReportForm}
            setShowForm={setShowReportForm}
            reportType={reportType}
            setReportType={setReportType}
            onAdd={handleAddReport}
            onUpdate={handleUpdateReport}
            onValidate={handleValidateReport}
            onDelete={handleDeleteReport}
            onPrint={handlePrint}
            focusReport={focusReport}
            reportPrefill={reportPrefill}
          />
        )}

        {tab === "clients" && (
          <Clients
            clients={clients}
            showForm={showClientForm}
            setShowForm={setShowClientForm}
            onAdd={(c) => upsertClient(c)}
            onUpdate={(c) => upsertClient(c)}
            onDelete={handleDeleteClient}
            reports={reports}
            devisAFaire={devisAFaire}
            devisEnCours={devisEnCours}
            facturation={facturation}
            onOpenReport={goToReport}
            onNavigate={setTab}
            focusClient={focusClient}
            onDeleteFacturation={handleDeleteFacturation}
            settings={settings}
          />
        )}

        {tab === "planning" && (
          <Planning
            planning={planning}
            clients={clients}
            showForm={showTaskForm}
            setShowForm={setShowTaskForm}
            onAdd={(t) => upsertPlanning(t)}
            onToggle={togglePlanning}
            onToggleRappel={toggleRappel}
            onCreateReport={startReportFromTask}
            onDelete={removePlanning}
          />
        )}

        {tab === "rappels" && (
          <Rappels
            planning={planning}
            clients={clients}
            showForm={showRappelForm}
            setShowForm={setShowRappelForm}
            onAdd={(p) => upsertPlanning(p)}
            onToggle={togglePlanning}
            onToggleRappel={toggleRappel}
            onDelete={removePlanning}
          />
        )}

        {tab === "devis" && (
          <Devis
            devisAFaire={devisAFaire}
            devisEnCours={devisEnCours}
            onCreated={(id) => removeDevisAFaire(id)}
            onRelance={(id) => {
              const item = devisEnCours.find((d) => d.id === id);
              if (item) upsertDevisEnCours({ ...item, statut: "relance_faite" });
            }}
            onValide={(id) => removeDevisEnCours(id)}
            onOpenClient={goToClient}
          />
        )}

        {tab === "facturation" && (
          <Facturation
            facturation={facturation}
            onFacturer={(id) => {
              const item = facturation.find((f) => f.id === id);
              if (item) upsertFacturation({ ...item, facture: true });
            }}
            onPayer={(id) => {
              const item = facturation.find((f) => f.id === id);
              if (item) upsertFacturation({ ...item, payee: true });
            }}
            onSyncPennylane={(id) => {
              const item = facturation.find((f) => f.id === id);
              syncPennylaneStatus(item);
            }}
            onRetryPennylane={handleRetryPennylane}
            onDeleteFacturation={handleDeleteFacturation}
            onOpenClient={goToClient}
          />
        )}

        {tab === "parametres" && <Parametres settings={settings} setSettings={saveSettings} loading={loadingSettings} />}
      </main>

      {pdfPreviewHtml && <PdfPreviewModal html={pdfPreviewHtml} onClose={() => setPdfPreviewHtml(null)} />}
    </div>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ upcoming, relances, aFacturer, planning, reports, rappelsActifs, onToggle, onNavigate, onOpenReport }) {
  const todayIso = toLocalISODate(new Date());
  const next = planning.filter((p) => !p.fait && p.categorie !== "relance" && p.date === todayIso);

  const now = new Date();
  const moisEnCours = now.getMonth() + 1;
  const anneeEnCours = now.getFullYear();
  const reportsCeMois = reports.filter((r) => {
    const parts = (r.date || "").split("/");
    if (parts.length !== 3) return false;
    return parseInt(parts[1], 10) === moisEnCours && parseInt(parts[2], 10) === anneeEnCours;
  });
  const countMES = reportsCeMois.filter((r) => r.type === "mise_en_service").length;
  const countEntretien = reportsCeMois.filter((r) => r.type === "entretien").length;
  const countDiagnostic = reportsCeMois.filter((r) => r.type === "diagnostic").length;
  const moisLabelBrut = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const moisLabel = moisLabelBrut.charAt(0).toUpperCase() + moisLabelBrut.slice(1);

  return (
    <div>
      <header className="page-head">
        <h1>Tableau de bord</h1>
        <p>Vue d'ensemble de votre activité</p>
      </header>

      <div className="gauges">
        <Jauge value={upcoming} max={10} label="Interventions à venir" onClick={() => onNavigate("planning")} />
        <Jauge value={relances} max={5} label="Devis à relancer" onClick={() => onNavigate("devis")} />
        <Jauge value={aFacturer} max={5} label="À facturer" onClick={() => onNavigate("facturation")} />
        <Jauge value={rappelsActifs.length} max={5} label="Rappels actifs" onClick={() => onNavigate("rappels")} />
      </div>

      <section className="card">
        <h3>Récapitulatif de {moisLabel}</h3>
        <div className="monthly-recap-grid">
          <div className="monthly-recap-item">
            <div className="monthly-recap-value">{countMES}</div>
            <div className="monthly-recap-label">Mise{countMES > 1 ? "s" : ""} en service</div>
          </div>
          <div className="monthly-recap-item">
            <div className="monthly-recap-value">{countEntretien}</div>
            <div className="monthly-recap-label">Entretien{countEntretien > 1 ? "s" : ""}</div>
          </div>
          <div className="monthly-recap-item">
            <div className="monthly-recap-value">{countDiagnostic}</div>
            <div className="monthly-recap-label">Dépannage{countDiagnostic > 1 ? "s" : ""}</div>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <h3>Interventions du jour</h3>
          {next.length === 0 && <p className="empty">Aucune intervention prévue aujourd'hui.</p>}
          <ul className="list">
            {next.map((p) => (
              <li key={p.id} className="row clickable" onClick={() => onNavigate("planning")} title="Voir dans le planning">
                <div>
                  <div className="row-title">{p.titre}</div>
                  <div className="row-sub">{p.client} {p.heure !== "—" ? `· à ${p.heure}` : ""}{p.duree && ` · ${p.duree}`}</div>
                </div>
                {p.rappel && <span className="pill pill-warm"><Icon name="bell" size={13} /> rappel</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>Derniers rapports</h3>
          <ul className="list">
            {reports.slice(0, 4).map((r) => (
              <li key={r.id} className="row clickable" onClick={() => onOpenReport(r.id)} title="Ouvrir le rapport">
                <div>
                  <div className="row-title">{r.client}</div>
                  <div className="row-sub">{labelType(r.type)} · {r.date}</div>
                </div>
                <span className={"pill " + typePillClass(r.type)}>{shortType(r.type)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card">
        <h3>Rappels actifs</h3>
        {rappelsActifs.length === 0 && <p className="empty">Aucun rappel actif.</p>}
        <ul className="list">
          {rappelsActifs.map((p) => (
            <li key={p.id} className="row clickable" onClick={() => onNavigate("rappels")} title="Voir dans les rappels">
              <button className="check-circle" onClick={(e) => { e.stopPropagation(); onToggle(p.id); }}></button>
              <div className="grow">
                <div className="row-title">{p.titre}</div>
                <div className="row-sub">{p.client} · {p.date.split("-").reverse().join("/")} {p.heure !== "—" ? `à ${p.heure}` : ""}</div>
              </div>
              <span className="pill pill-warm"><Icon name="bell" size={13} /> rappel</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function guessReportType(titre) {
  const t = (titre || "").toLowerCase();
  if (t.includes("entretien")) return "entretien";
  if (t.includes("diagnostic") || t.includes("panne") || t.includes("dépannage") || t.includes("depannage") || t.includes("réparation") || t.includes("reparation")) return "diagnostic";
  return "mise_en_service";
}

function labelType(t) {
  return t === "mise_en_service" ? "Mise en service" : t === "entretien" ? "Entretien" : "Diagnostic / dépannage";
}
function shortType(t) {
  return t === "mise_en_service" ? "MES" : t === "entretien" ? "Entretien" : "Diag.";
}
function typePillClass(t) {
  return t === "mise_en_service" ? "pill-cold" : t === "entretien" ? "pill-ok" : "pill-warm";
}

/* ---------- Rappels ---------- */
function Rappels({ planning, clients, showForm, setShowForm, onAdd, onToggle, onToggleRappel, onDelete }) {
  const items = planning.filter((p) => p.rappel && p.categorie !== "intervention");
  const grouped = items.reduce((acc, p) => {
    (acc[p.date] = acc[p.date] || []).push(p);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();
  const [editingTask, setEditingTask] = useState(null);

  const openNewForm = () => { setEditingTask(null); setShowForm(!showForm || !!editingTask); };
  const openEditForm = (task) => { setEditingTask(task); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingTask(null); };

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>Rappels</h1>
          <p>Toutes les tâches avec un rappel actif, jour par jour</p>
        </div>
        <button className="btn-primary" onClick={openNewForm}>
          <Icon name="plus" size={16} /> Nouveau rappel
        </button>
      </header>

      {showForm && (
        <TaskForm
          clients={clients}
          editingTask={editingTask}
          onCancel={closeForm}
          onSubmit={(t) => { onAdd(t); closeForm(); }}
          forceCategorie="relance"
          hideRappelToggle
          submitLabel={editingTask ? "Enregistrer les modifications" : "Ajouter le rappel"}
        />
      )}

      {dates.length === 0 && (
        <section className="card">
          <p className="empty">Aucun rappel programmé.</p>
        </section>
      )}

      {dates.map((date) => (
        <section key={date} className="card planning-day">
          <h3>{new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</h3>
          <ul className="list">
            {grouped[date].map((p) => (
              <li key={p.id} className={"row" + (p.fait ? " done" : "")}>
                <button className={"check-circle" + (p.fait ? " checked" : "")} onClick={() => onToggle(p.id)}>
                  {p.fait && <Icon name="check" size={13} />}
                </button>
                <div className="grow">
                  <div className="row-title">{p.titre}</div>
                  <div className="row-sub">{p.client} {p.heure !== "—" && `· ${p.heure}`}</div>
                </div>
                <button className="icon-btn" onClick={() => openEditForm(p)} title="Modifier ce rappel">
                  <Icon name="edit" size={15} />
                </button>
                <DeleteButton onConfirm={() => onDelete(p.id)} label="" />
                <button className="pill pill-clickable pill-warm" onClick={() => onToggleRappel(p.id)}>
                  <Icon name="bell" size={13} /> Désactiver le rappel
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------- Paramètres ---------- */
function Parametres({ settings, setSettings }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);

  const updateTechnicien = (patch) => { setDraft((s) => ({ ...s, technicien: { ...s.technicien, ...patch } })); setSaved(false); };
  const updateEntreprise = (patch) => { setDraft((s) => ({ ...s, entreprise: { ...s.entreprise, ...patch } })); setSaved(false); };
  const updatePennylane = (patch) => { setDraft((s) => ({ ...s, pennylane: { ...(s.pennylane || {}), ...patch } })); setSaved(false); };

  const addTableau = () => {
    setDraft((s) => ({ ...s, tableaux: [...(s.tableaux || []), { id: "tpl" + Date.now(), nom: "", rows: [["", ""], ["", ""]] }] }));
    setSaved(false);
  };
  const updateTableau = (id, next) => {
    setDraft((s) => ({ ...s, tableaux: s.tableaux.map((t) => (t.id === id ? next : t)) }));
    setSaved(false);
  };
  const removeTableau = (id) => {
    setDraft((s) => ({ ...s, tableaux: s.tableaux.filter((t) => t.id !== id) }));
    setSaved(false);
  };

  const addChecklistTpl = () => {
    setDraft((s) => ({ ...s, checklists: [...(s.checklists || []), { id: "cktpl" + Date.now(), nom: "", type: "entretien", items: [{ label: "" }] }] }));
    setSaved(false);
  };
  const updateChecklistTpl = (id, next) => {
    setDraft((s) => ({ ...s, checklists: s.checklists.map((t) => (t.id === id ? next : t)) }));
    setSaved(false);
  };
  const removeChecklistTpl = (id) => {
    setDraft((s) => ({ ...s, checklists: s.checklists.filter((t) => t.id !== id) }));
    setSaved(false);
  };

  const handleSave = () => {
    setSettings(draft);
    setSaved(true);
  };

  return (
    <div>
      <header className="page-head">
        <h1>Paramètres</h1>
        <p>Informations générales utilisées automatiquement dans vos rapports</p>
      </header>

      <div className="grid-2">
        <section className="card">
          <h3>Technicien</h3>
          <label>Nom du technicien
            <input
              value={draft.technicien.nom}
              onChange={(e) => updateTechnicien({ nom: e.target.value })}
              placeholder="Ex : Julien Martin"
            />
          </label>
          <span className="hint">Ce nom s'affiche automatiquement au-dessus du client dans chaque rapport et sur les PDF.</span>
        </section>

        <section className="card">
          <h3>Informations de l'entreprise</h3>
          <label>Nom de l'entreprise
            <input value={draft.entreprise.nom} onChange={(e) => updateEntreprise({ nom: e.target.value })} placeholder="Ex : TECHNI-PAC SARL" />
          </label>
          <label className="mt">Adresse (rue)
            <input value={draft.entreprise.adresse} onChange={(e) => updateEntreprise({ adresse: e.target.value })} placeholder="Ex : 450 Route des Grottes" />
          </label>
          <label className="mt">Code postal et ville
            <input value={draft.entreprise.codePostalVille} onChange={(e) => updateEntreprise({ codePostalVille: e.target.value })} placeholder="Ex : 64800 Lestelle-Bétharram" />
          </label>
          <div className="form-grid">
            <label>Téléphone
              <input value={draft.entreprise.telephone} onChange={(e) => updateEntreprise({ telephone: e.target.value })} placeholder="05 58 00 00 00" />
            </label>
            <label>Email
              <input value={draft.entreprise.email} onChange={(e) => updateEntreprise({ email: e.target.value })} placeholder="contact@entreprise.fr" />
            </label>
          </div>
          <label>N° Attestation de capacité
            <input value={draft.entreprise.attestationCapacite} onChange={(e) => updateEntreprise({ attestationCapacite: e.target.value })} placeholder="Ex : SQ016665" />
          </label>
          <label>SIRET / n° TVA
            <input value={draft.entreprise.siret} onChange={(e) => updateEntreprise({ siret: e.target.value })} placeholder="Ex : 123 456 789 00012" />
          </label>

          <div className="block mt">
            <SinglePhotoField label="Logo de l'entreprise" value={draft.entreprise.logo} onChange={(logo) => updateEntreprise({ logo })} />
          </div>

          <label className="block mt">Clause de pied de page
            <textarea
              rows={3}
              value={draft.entreprise.clausePied}
              onChange={(e) => updateEntreprise({ clausePied: e.target.value })}
              placeholder="Ex : Garantie pièces et main d'œuvre 2 ans. TVA non applicable, art. 293 B du CGI."
            />
          </label>
          <span className="hint">Le logo et cette clause apparaissent sur les 3 types de rapports exportés en PDF (logo en en-tête, clause en pied de page).</span>
        </section>
      </div>

      <section className="card">
        <h3>Modèles de tableaux</h3>
        <p className="hint">Créez des trames de tableau réutilisables (ex : relevés de pressions). Elles seront proposées lors de la création d'un rapport de mise en service — vous pourrez toujours les modifier librement une fois insérées.</p>
        {(draft.tableaux || []).length === 0 && <p className="empty">Aucun modèle créé pour le moment.</p>}
        {(draft.tableaux || []).map((t) => (
          <div key={t.id} className="card machine-editor-card">
            <TemplateTableEditor template={t} onChange={(next) => updateTableau(t.id, next)} onRemove={() => removeTableau(t.id)} />
          </div>
        ))}
        <button type="button" className="btn-ghost small" onClick={addTableau}><Icon name="plus" size={14} /> Ajouter un modèle de tableau</button>
      </section>

      <section className="card">
        <h3>Modèles de checklist</h3>
        <p className="hint">Créez des checklists réutilisables. Elles seront proposées dans les rapports de mise en service et d'entretien — vous pourrez toujours les modifier librement une fois insérées.</p>
        {(draft.checklists || []).length === 0 && <p className="empty">Aucun modèle créé pour le moment.</p>}
        {(draft.checklists || []).map((t) => (
          <div key={t.id} className="card machine-editor-card">
            <ChecklistTemplateEditor template={t} onChange={(next) => updateChecklistTpl(t.id, next)} onRemove={() => removeChecklistTpl(t.id)} />
          </div>
        ))}
        <button type="button" className="btn-ghost small" onClick={addChecklistTpl}><Icon name="plus" size={14} /> Ajouter un modèle de checklist</button>
      </section>

      <section className="card">
        <h3>Facturation Pennylane</h3>
        <p className="hint">
          Une fois activée, chaque intervention de mise en service ou d'entretien enregistrée <strong>sans devis à effectuer</strong> crée
          automatiquement la facture correspondante dans Pennylane. Le statut payé/impayé se met ensuite à jour automatiquement dans l'onglet
          Facturation. La connexion technique (clé API) est configurée séparément côté Supabase — voir le README du projet.
        </p>
        <label className="check-inline">
          <input type="checkbox" checked={!!draft.pennylane?.active} onChange={(e) => updatePennylane({ active: e.target.checked })} />
          Activer la synchronisation automatique avec Pennylane
        </label>
        {draft.pennylane?.active && (
          <label className="block mt">Taux de TVA par défaut appliqué aux factures
            <select value={draft.pennylane?.tvaParDefaut || "FR_200"} onChange={(e) => updatePennylane({ tvaParDefaut: e.target.value })}>
              <option value="FR_200">20 % (taux normal)</option>
              <option value="FR_100">10 % (taux intermédiaire)</option>
              <option value="FR_055">5,5 % (taux réduit)</option>
              <option value="FR_021">2,1 % (taux particulier)</option>
            </select>
            <span className="hint">Valeur pré-sélectionnée dans chaque rapport — vous pouvez toujours choisir un autre taux directement sur un rapport si besoin.</span>
          </label>
        )}
      </section>

      <div className="form-actions">
        {saved && <span className="pill pill-ok"><Icon name="check" size={13} /> Modifications enregistrées</span>}
        <button className="btn-primary" onClick={handleSave}>Enregistrer les modifications</button>
      </div>
    </div>
  );
}

function TemplateTableEditor({ template, onChange, onRemove }) {
  const updateCell = (r, c, val) => {
    const rows = template.rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? val : cell)) : row));
    onChange({ ...template, rows });
  };
  const addRow = () => {
    const cols = template.rows[0]?.length || 2;
    onChange({ ...template, rows: [...template.rows, Array(cols).fill("")] });
  };
  const addCol = () => onChange({ ...template, rows: template.rows.map((row) => [...row, ""]) });
  const removeRow = (r) => onChange({ ...template, rows: template.rows.filter((_, ri) => ri !== r) });

  return (
    <div className="table-editor">
      <label>Nom du modèle
        <input value={template.nom} onChange={(e) => onChange({ ...template, nom: e.target.value })} placeholder="Ex : Relevés frigorifiques" />
      </label>
      <table className="editable-table">
        <tbody>
          {template.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}><input value={cell} onChange={(e) => updateCell(ri, ci, e.target.value)} /></td>
              ))}
              <td className="table-row-actions">
                <button type="button" className="icon-btn" onClick={() => removeRow(ri)}><Icon name="trash" size={13} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-actions">
        <button type="button" className="btn-ghost small" onClick={addRow}>+ Ligne</button>
        <button type="button" className="btn-ghost small" onClick={addCol}>+ Colonne</button>
        <button type="button" className="btn-ghost small" onClick={onRemove}>Supprimer le modèle</button>
      </div>
    </div>
  );
}

/* ---------- Rapports ---------- */
function Rapports({ reports, clients, settings, showForm, setShowForm, reportType, setReportType, onAdd, onUpdate, onValidate, onDelete, onPrint, focusReport, reportPrefill }) {
  const [filter, setFilter] = useState("tous");
  const [editingReport, setEditingReport] = useState(null);
  const [activePrefillClient, setActivePrefillClient] = useState(null);
  const filtered = filter === "tous" ? reports : reports.filter((r) => r.type === filter);

  const openNew = () => { setEditingReport(null); setActivePrefillClient(null); setShowForm(true); };
  const openEdit = (r) => { setEditingReport(r); setActivePrefillClient(null); setReportType(r.type); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingReport(null); };

  useEffect(() => {
    if (focusReport) {
      setFilter("tous");
      setShowForm(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReport]);

  useEffect(() => {
    if (reportPrefill) {
      setEditingReport(null);
      setActivePrefillClient(reportPrefill.client);
      setReportType(reportPrefill.reportType);
      setShowForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportPrefill]);

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>Rapports d'intervention</h1>
          <p>Mises en service, entretiens et diagnostics / dépannages</p>
        </div>
        <button className="btn-primary" onClick={() => (showForm ? closeForm() : openNew())}>
          <Icon name="plus" size={16} /> Nouveau rapport
        </button>
      </header>

      {showForm && (
        <ReportForm
          key={editingReport ? editingReport.id : "new-" + (reportPrefill ? reportPrefill.token : "0")}
          clients={clients}
          settings={settings}
          reportType={reportType}
          setReportType={setReportType}
          editingReport={editingReport}
          prefillClient={!editingReport ? activePrefillClient : undefined}
          prefillPlanningTaskId={!editingReport ? reportPrefill?.planningTaskId : undefined}
          onCancel={closeForm}
          onSubmit={(r) => { editingReport ? onUpdate(r) : onAdd(r); closeForm(); }}
          onPreview={onPrint}
        />
      )}

      <div className="filters">
        {[
          ["tous", "Tous"],
          ["mise_en_service", "Mise en service"],
          ["entretien", "Entretien"],
          ["diagnostic", "Diagnostic / dépannage"],
        ].map(([id, label]) => (
          <button key={id} className={"filter-btn" + (filter === id ? " active" : "")} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="report-list">
        {groupByMonthAndDay(filtered, "date").map((mg) => (
          <div key={mg.key} className="report-month-group">
            <h2 className="report-month-title">{mg.label}</h2>
            {mg.days.map((dg) => (
              <div key={dg.key} className="report-day-group">
                {dg.label && <h4 className="report-day-title">{dg.label}</h4>}
                {dg.items.map((r) => <ReportCard key={r.id} r={r} onPrint={onPrint} onEdit={openEdit} onValidate={onValidate} onDelete={onDelete} focusReport={focusReport} settings={settings} />)}
              </div>
            ))}
          </div>
        ))}
        {filtered.length === 0 && <p className="empty">Aucun rapport pour ce filtre.</p>}
      </div>
    </div>
  );
}

function ReportCard({ r, onPrint, onEdit, onValidate, onDelete, focusReport, settings }) {
  const [open, setOpen] = useState(false);
  const [viewTab, setViewTab] = useState("details");
  const cardRef = useRef(null);

  useEffect(() => {
    if (focusReport && focusReport.id === r.id) {
      setOpen(true);
      cardRef.current && cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReport]);

  return (
    <div className={"card report-card" + (r.valide ? " report-card-valide" : "")} ref={cardRef}>
      <div className="report-card-head" onClick={() => setOpen(!open)}>
        <span className={"pill " + typePillClass(r.type)}>{shortType(r.type)}</span>
        <div className="report-card-title">
          {settings?.technicien?.nom && <div className="report-tech">Technicien : {settings.technicien.nom}</div>}
          <div className="row-title">{r.client}</div>
          <div className="row-sub">{r.installation} · {r.date}</div>
        </div>
        {r.valide && <span className="pill pill-ok"><Icon name="check" size={13} /> Validé</span>}
        <span className="chevron">{open ? "−" : "+"}</span>
      </div>
      {open && (
        <div className="report-card-body">
          <div className="report-card-actions">
            <button
              className={r.valide ? "btn-ghost small" : "btn-primary small"}
              onClick={(e) => { e.stopPropagation(); onValidate(r); }}
              title={r.planningTaskId ? "Marque aussi la tâche de planning comme effectuée" : "Marque ce rapport comme validé"}
            >
              <Icon name="check" size={14} /> {r.valide ? "Annuler la validation" : "Valider"}
            </button>
            <button className="btn-ghost small" onClick={(e) => { e.stopPropagation(); onEdit(r); }}>
              <Icon name="edit" size={14} /> Modifier
            </button>
            <button className="btn-ghost small" onClick={(e) => { e.stopPropagation(); onPrint(r); }}>
              <Icon name="download" size={14} /> Enregistrer en PDF
            </button>
            <DeleteButton onConfirm={() => onDelete(r)} />
          </div>

          <div className="report-view-tabs" onClick={(e) => e.stopPropagation()}>
            <button className={"report-view-tab" + (viewTab === "details" ? " active" : "")} onClick={() => setViewTab("details")}>
              Détails
            </button>
            <button className={"report-view-tab" + (viewTab === "pdf" ? " active" : "")} onClick={() => setViewTab("pdf")}>
              <Icon name="report" size={13} /> Aperçu PDF
            </button>
          </div>

          {viewTab === "pdf" ? (
            <iframe className="report-pdf-preview" srcDoc={buildReportHtml(r, settings)} title="Aperçu PDF du rapport" />
          ) : (
            <>
              {r.type === "mise_en_service" && (
            <>
              {r.intro && <div className="remarque description-view"><strong>Objet</strong><div className="rte-render" dangerouslySetInnerHTML={{ __html: r.intro }} /></div>}
              <ChecklistsView checklists={normalizeChecklists(r)} tables={r.tables} />
              {r.descriptionLibre && <div className="remarque description-view"><strong>Description</strong><div className="rte-render" dangerouslySetInnerHTML={{ __html: r.descriptionLibre }} /></div>}
              {r.conclusion && (
                <>
                  <div className="section-title">Conclusion</div>
                  <p className="remarque texte-libre">{r.conclusion}</p>
                </>
              )}
              {r.remarques && (
                <>
                  <div className="section-title">Remarques</div>
                  <p className="remarque texte-libre">{r.remarques}</p>
                </>
              )}
              <DevisNote text={r.devisAEffectuer} />
            </>
          )}
          {r.type === "entretien" && (
            <>
              {r.intro && <div className="remarque description-view"><strong>Objet</strong><div className="rte-render" dangerouslySetInnerHTML={{ __html: r.intro }} /></div>}
              <ChecklistsView checklists={normalizeChecklists(r)} tables={r.tables} />
              {r.descriptionLibre && <div className="remarque description-view"><strong>Description</strong><div className="rte-render" dangerouslySetInnerHTML={{ __html: r.descriptionLibre }} /></div>}
              {r.conclusion && (
                <>
                  <div className="section-title">Conclusion</div>
                  <p className="remarque texte-libre">{r.conclusion}</p>
                </>
              )}
              {r.remarques && (
                <>
                  <div className="section-title">Remarques</div>
                  <p className="remarque texte-libre">{r.remarques}</p>
                </>
              )}
              <DevisNote text={r.devisAEffectuer} />
            </>
          )}
          {r.type === "diagnostic" && (
            <>
              {r.intro && <div className="remarque description-view"><strong>Objet</strong><div className="rte-render" dangerouslySetInnerHTML={{ __html: r.intro }} /></div>}
              <div className="remarque rte-render" dangerouslySetInnerHTML={{ __html: r.description }} />
              {r.pieces && <p><strong>Pièces utilisées :</strong> {r.pieces}</p>}
              <p><strong>Facturable :</strong> {r.facturable ? "Oui" : "Non"}</p>
              {tablesAt(r.tables, [], "__end__")}
              {r.conclusion && (
                <>
                  <div className="section-title">Conclusion</div>
                  <p className="remarque texte-libre">{r.conclusion}</p>
                </>
              )}
              {r.remarques && (
                <>
                  <div className="section-title">Remarques</div>
                  <p className="remarque texte-libre">{r.remarques}</p>
                </>
              )}
              <DevisNote text={r.devisAEffectuer} />
            </>
          )}
          {r.photos && r.photos.length > 0 && (
            <div className="photo-strip">
              {r.photos.map((src, i) => <img key={i} src={src} alt="photo intervention" />)}
            </div>
          )}
          {(r.signatureTech || r.signatureClient) && (
            <div className="signatures-view">
              <div className="sig-col">
                <div className="sig-title">Signature technicien</div>
                {r.signatureTech ? <img src={r.signatureTech} className="sig-img" alt="Signature technicien" /> : <div className="sig-empty">Non signée</div>}
              </div>
              <div className="sig-col">
                <div className="sig-title">Signature client</div>
                {r.signatureClient ? <img src={r.signatureClient} className="sig-img" alt="Signature client" /> : <div className="sig-empty">Non signée</div>}
              </div>
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DevisNote({ text }) {
  if (!text) return null;
  return (
    <div className="devis-note">
      <Icon name="quote" size={14} />
      <div><strong>Devis à effectuer</strong><div>{text}</div></div>
    </div>
  );
}

function ChecklistItemView({ it }) {
  return (
    <div className={"cl-row" + (it.checked ? " ok" : " ko")}>
      <span className="check-dot">{it.checked && <Icon name="check" size={12} />}</span>
      <div>
        <div className="cl-label">{it.label}</div>
        {it.detail && <div className="cl-detail">{it.detail}</div>}
      </div>
    </div>
  );
}

function ChecklistView({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="checklist-view">
      {items.map((it) => <ChecklistItemView key={it.id} it={it} />)}
    </div>
  );
}

/* Un rapport peut contenir plusieurs checklists successives, chacune avec son
   propre titre. Les rapports plus anciens n'en avaient qu'une seule, stockée
   dans "checklist" : cette fonction rend les deux formats interchangeables et
   garantit que les anciens rapports restent lisibles. */
function normalizeChecklists(report) {
  if (Array.isArray(report?.checklists)) return report.checklists;
  if (Array.isArray(report?.checklist)) return [{ id: "cl-legacy", nom: "", items: report.checklist }];
  return [];
}

/* Liste à plat de tous les points de contrôle, toutes checklists confondues —
   utilisée pour ancrer les tableaux, dont la position se réfère à l'id d'une
   ligne quelle que soit la checklist à laquelle elle appartient. */
function allChecklistItems(checklists) {
  return (checklists || []).reduce((acc, cl) => acc.concat(cl.items || []), []);
}

function defaultChecklistFor(reportType) {
  const tpl = reportType === "entretien" ? DEFAULT_ENTRETIEN_CHECKLIST : DEFAULT_MES_CHECKLIST;
  return {
    id: "cl" + Date.now(),
    nom: reportType === "entretien" ? "Checklist d'entretien" : "Checklist de mise en service",
    items: tpl.map((t) => ({ id: t.id, label: t.label, checked: true, detail: "" })),
  };
}

/* Affichage (rapport) de l'ensemble des checklists, avec les tableaux ancrés au bon endroit */
function ChecklistsView({ checklists, tables }) {
  const flatItems = allChecklistItems(checklists);
  return (
    <div className="checklist-view">
      {tablesAt(tables, flatItems, "__start__")}
      {checklists.map((cl) => (
        <React.Fragment key={cl.id}>
          {cl.nom && <div className="checklist-group-title">{cl.nom}</div>}
          {(cl.items || []).map((it) => (
            <React.Fragment key={it.id}>
              <ChecklistItemView it={it} />
              {tablesAt(tables, flatItems, it.id)}
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
      {tablesAt(tables, flatItems, "__end__")}
    </div>
  );
}

/* Rend les tableaux ancrés à un point donné (id de ligne de checklist, "__start__" ou "__end__") */
function tablesAt(tables, checklist, anchor) {
  const validIds = new Set((checklist || []).map((it) => it.id));
  const resolve = (t) => {
    const a = t.afterItemId || "__end__";
    if (a === "__start__" || a === "__end__") return a;
    return validIds.has(a) ? a : "__end__";
  };
  return (tables || [])
    .filter((t) => resolve(t) === anchor)
    .map((t) => (
      <div key={t.id} className="mini-table-block">
        {t.nom && <div className="mini-table-title">{t.nom}</div>}
        <table className="mini-table">
          <tbody>
            {t.rows.map((row, ri) => (
              <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    ));
}

/* ---------- Section « Checklists » du formulaire : plusieurs checklists à la
   suite, chacune avec son titre, sur le même principe que les tableaux ---------- */
function ChecklistsSection({ checklists, setChecklists, settings, reportType }) {
  const modeles = (settings.checklists || []).filter((t) => t.type === reportType);

  // On fournit à chaque ChecklistEditor un setter qui ne touche qu'à ses
  // propres lignes, pour pouvoir réutiliser l'éditeur existant tel quel.
  const setItemsFor = (clId) => (updater) => {
    setChecklists((list) =>
      list.map((cl) => (cl.id === clId ? { ...cl, items: typeof updater === "function" ? updater(cl.items || []) : updater } : cl))
    );
  };

  const updateNom = (clId, nom) => setChecklists((list) => list.map((cl) => (cl.id === clId ? { ...cl, nom } : cl)));
  const removeChecklist = (clId) => setChecklists((list) => list.filter((cl) => cl.id !== clId));

  const uid = () => Date.now() + "_" + Math.random().toString(16).slice(2, 8);

  const addEmpty = () => {
    const stamp = uid();
    setChecklists((list) => [...list, { id: "cl" + stamp, nom: "", items: [{ id: "chk" + stamp, label: "", checked: true, detail: "" }] }]);
  };

  const insertTemplate = (templateId) => {
    const tpl = modeles.find((t) => t.id === templateId);
    if (!tpl) return;
    const stamp = uid();
    setChecklists((list) => [
      ...list,
      {
        id: "cl" + stamp,
        nom: tpl.nom || "",
        items: (tpl.items || [])
          .filter((it) => it.label.trim())
          .map((it, i) => ({ id: "ck" + stamp + "_" + i, label: it.label, checked: true, detail: "" })),
      },
    ]);
  };

  return (
    <div className="block">
      <label className="block">Checklists</label>
      {checklists.map((cl, idx) => (
        <div key={cl.id} className="checklist-block">
          <div className="checklist-block-head">
            <input
              className="checklist-block-title"
              value={cl.nom || ""}
              onChange={(e) => updateNom(cl.id, e.target.value)}
              placeholder={`Titre de la checklist ${idx + 1} (facultatif)`}
            />
            <button type="button" className="icon-btn" onClick={() => removeChecklist(cl.id)} title="Supprimer cette checklist">
              <Icon name="trash" size={15} />
            </button>
          </div>
          <ChecklistEditor items={cl.items || []} setItems={setItemsFor(cl.id)} />
        </div>
      ))}
      {checklists.length === 0 && <p className="empty">Aucune checklist dans ce rapport.</p>}
      <div className="table-insert-row">
        <button type="button" className="btn-ghost small" onClick={addEmpty}>
          <Icon name="plus" size={14} /> Ajouter une checklist
        </button>
        {modeles.length > 0 && (
          <select
            className="table-template-select"
            value=""
            onChange={(e) => { if (e.target.value) insertTemplate(e.target.value); }}
          >
            <option value="">Insérer un modèle de checklist...</option>
            {modeles.map((t) => (
              <option key={t.id} value={t.id}>{t.nom || "Modèle sans nom"}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

/* ---------- Éditeur de checklist (formulaire) ---------- */
function ChecklistEditor({ items, setItems }) {
  const updateItem = (id, patch) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addItem = () => setItems((list) => [...list, { id: "chk" + Date.now(), label: "", checked: true, detail: "" }]);
  const removeItem = (id) => setItems((list) => list.filter((it) => it.id !== id));

  return (
    <div>
      <div className="checklist-edit">
        {items.map((it) => (
          <div key={it.id} className="checklist-row">
            <select
              className="checklist-status-select"
              value={it.checked ? "fait" : "non_fait"}
              onChange={(e) => updateItem(it.id, { checked: e.target.value === "fait" })}
            >
              <option value="fait">Fait</option>
              <option value="non_fait">Non fait</option>
            </select>
            <div className="checklist-inputs">
              <input value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })} placeholder="Intitulé du contrôle" />
              <textarea rows={2} value={it.detail} onChange={(e) => updateItem(it.id, { detail: e.target.value })} placeholder="Détail (facultatif) — cliquez-glissez le coin pour agrandir" />
            </div>
            <button type="button" className="icon-btn" onClick={() => removeItem(it.id)}><Icon name="trash" size={15} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-ghost small" onClick={addItem}><Icon name="plus" size={14} /> Ajouter un point de contrôle</button>
    </div>
  );
}

/* ---------- Éditeur de tableau libre ---------- */
function TableEditor({ table, checklist, onChange, onRemove }) {
  const updateCell = (r, c, val) => {
    const rows = table.rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? val : cell)) : row));
    onChange({ ...table, rows });
  };
  const addRow = () => {
    const cols = table.rows[0]?.length || 2;
    onChange({ ...table, rows: [...table.rows, Array(cols).fill("")] });
  };
  const addCol = () => onChange({ ...table, rows: table.rows.map((row) => [...row, ""]) });
  const removeRow = (r) => onChange({ ...table, rows: table.rows.filter((_, ri) => ri !== r) });

  return (
    <div className="table-editor">
      <label className="table-position">
        Titre du tableau (facultatif)
        <input value={table.nom || ""} onChange={(e) => onChange({ ...table, nom: e.target.value })} placeholder="Ex : Relevés électriques" />
      </label>
      {checklist && checklist.length > 0 && (
        <label className="table-position">
          Position du tableau
          <select value={table.afterItemId || "__end__"} onChange={(e) => onChange({ ...table, afterItemId: e.target.value })}>
            <option value="__start__">Avant la checklist</option>
            {checklist.map((it) => (
              <option key={it.id} value={it.id}>Après : {it.label ? it.label : "(ligne sans intitulé)"}</option>
            ))}
            <option value="__end__">Après la checklist (fin)</option>
          </select>
        </label>
      )}
      <table className="editable-table">
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}><input value={cell} onChange={(e) => updateCell(ri, ci, e.target.value)} /></td>
              ))}
              <td className="table-row-actions">
                <button type="button" className="icon-btn" onClick={() => removeRow(ri)}><Icon name="trash" size={13} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-actions">
        <button type="button" className="btn-ghost small" onClick={addRow}>+ Ligne</button>
        <button type="button" className="btn-ghost small" onClick={addCol}>+ Colonne</button>
        <button type="button" className="btn-ghost small" onClick={onRemove}>Supprimer le tableau</button>
      </div>
    </div>
  );
}

function DescriptionSection({ descRef, initialValue, show, setShow }) {
  if (!show) {
    return (
      <button type="button" className="btn-ghost small mt" onClick={() => { descRef.current = ""; setShow(true); }}>
        <Icon name="plus" size={14} /> Ajouter une description
      </button>
    );
  }
  return (
    <div className="block mt field-block">
      <div className="field-caption">Description</div>
      <RichTextEditor initialValue={initialValue || ""} onChange={(html) => { descRef.current = html; }} minHeight={160} />
      <button type="button" className="btn-ghost small mt" onClick={() => { descRef.current = ""; setShow(false); }}>
        <Icon name="trash" size={13} /> Retirer la description
      </button>
    </div>
  );
}

function ChecklistTemplateEditor({ template, onChange, onRemove }) {
  const updateItem = (i, label) => {
    const items = template.items.map((it, idx) => (idx === i ? { ...it, label } : it));
    onChange({ ...template, items });
  };
  const addItem = () => onChange({ ...template, items: [...template.items, { label: "" }] });
  const removeItem = (i) => onChange({ ...template, items: template.items.filter((_, idx) => idx !== i) });

  return (
    <div className="table-editor">
      <div className="form-grid">
        <label>Nom du modèle
          <input value={template.nom} onChange={(e) => onChange({ ...template, nom: e.target.value })} placeholder="Ex : Entretien PAC air/eau" />
        </label>
        <label>Type de rapport
          <select value={template.type || "entretien"} onChange={(e) => onChange({ ...template, type: e.target.value })}>
            <option value="mise_en_service">Mise en service</option>
            <option value="entretien">Entretien</option>
          </select>
        </label>
      </div>
      {template.items.map((it, i) => (
        <div key={i} className="checklist-tpl-row">
          <input value={it.label} onChange={(e) => updateItem(i, e.target.value)} placeholder="Intitulé du point de contrôle" />
          <button type="button" className="icon-btn" onClick={() => removeItem(i)} title="Retirer ce point">
            <Icon name="trash" size={13} />
          </button>
        </div>
      ))}
      <div className="table-actions">
        <button type="button" className="btn-ghost small" onClick={addItem}>+ Point de contrôle</button>
        <button type="button" className="btn-ghost small" onClick={onRemove}>Supprimer le modèle</button>
      </div>
    </div>
  );
}


function TablesSection({ tables, checklist, settings, updateTable, removeTable, addTable, insertTemplateTable }) {
  return (
    <div className="block mt">
      <label className="block">Tableaux</label>
      {tables.map((t) => (
        <TableEditor key={t.id} table={t} checklist={checklist} onChange={(next) => updateTable(t.id, next)} onRemove={() => removeTable(t.id)} />
      ))}
      <div className="table-insert-row">
        <button type="button" className="btn-ghost small" onClick={addTable}><Icon name="plus" size={14} /> Ajouter un tableau vide</button>
        {(settings.tableaux || []).length > 0 && (
          <select
            className="table-template-select"
            value=""
            onChange={(e) => { if (e.target.value) insertTemplateTable(e.target.value); }}
          >
            <option value="">Insérer un modèle de tableau...</option>
            {settings.tableaux.map((t) => (
              <option key={t.id} value={t.id}>{t.nom || "Modèle sans nom"}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

/* ---------- Éditeur de texte enrichi (gras / italique / souligné) ---------- */
function RichTextEditor({ initialValue, onChange, minHeight }) {
  const ref = useRef(null);
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, list: false });

  const updateActiveState = () => {
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      list: document.queryCommandState("insertUnorderedList"),
    });
  };

  const exec = (cmd) => {
    if (cmd === "bold") {
      // Bug connu de certains navigateurs : sur une sélection mélangeant du texte
      // déjà en gras et du texte normal, la commande "bold" retire le gras partout
      // au lieu de tout mettre en gras. On détecte ce cas et on corrige.
      const wasFullyBold = document.queryCommandState("bold");
      document.execCommand("bold", false, null);
      const isFullyBoldNow = document.queryCommandState("bold");
      if (!wasFullyBold && !isFullyBoldNow) {
        document.execCommand("bold", false, null);
      }
    } else {
      document.execCommand(cmd, false, null);
    }
    ref.current && ref.current.focus();
    handleInput();
    updateActiveState();
  };
  const preventFocusLoss = (e) => e.preventDefault();
  const handleInput = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };
  const handleKeyDown = (e) => {
    // Dans une liste à puces, Tab imbrique d'un niveau, Maj+Tab remonte d'un niveau.
    if (e.key === "Tab") {
      const inList = document.queryCommandState("insertUnorderedList") || document.queryCommandState("insertOrderedList");
      if (inList) {
        e.preventDefault();
        document.execCommand(e.shiftKey ? "outdent" : "indent");
        handleInput();
      }
    }
  };
  return (
    <div className="rte">
      <div className="rte-toolbar">
        <button type="button" className={active.bold ? "active" : ""} onMouseDown={preventFocusLoss} onClick={() => exec("bold")} title="Gras"><strong>G</strong></button>
        <button type="button" className={active.italic ? "active" : ""} onMouseDown={preventFocusLoss} onClick={() => exec("italic")} title="Italique"><em>I</em></button>
        <button type="button" className={active.underline ? "active" : ""} onMouseDown={preventFocusLoss} onClick={() => exec("underline")} title="Souligné"><u>S</u></button>
        <span className="rte-sep" />
        <button type="button" className={active.list ? "active" : ""} onMouseDown={preventFocusLoss} onClick={() => exec("insertUnorderedList")} title="Liste à puces (Tab pour imbriquer un niveau)">•≡</button>
      </div>
      <div
        ref={ref}
        className="rte-content"
        style={{ minHeight: minHeight || 160 }}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={updateActiveState}
        onMouseUp={updateActiveState}
        onClick={updateActiveState}
        onFocus={updateActiveState}
        dangerouslySetInnerHTML={{ __html: initialValue || "" }}
      />
    </div>
  );
}

function SignaturePad({ label, value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
  };

  const start = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    lastPos.current = getPos(e);
  };
  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1B2733";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL());
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="signature-block">
      <div className="signature-label">{label}</div>
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        className="signature-canvas"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <button type="button" className="btn-ghost small" onClick={clear}>Effacer</button>
    </div>
  );
}

function ReportForm({ clients, settings, reportType, setReportType, editingReport, prefillClient, prefillPlanningTaskId, onCancel, onSubmit, onPreview }) {
  const isEditing = !!editingReport;
  const initialClient = editingReport?.client || prefillClient || clients[0]?.nom || "";
  const [client, setClient] = useState(initialClient);
  const [installation, setInstallation] = useState(() => {
    if (editingReport?.installation) return editingReport.installation;
    const c = clients.find((cl) => cl.nom === initialClient);
    return c?.machines?.[0]?.type || installTypes[0];
  });
  const [date, setDate] = useState(editingReport?.date || new Date().toLocaleDateString("fr-FR"));
  const [remarques, setRemarques] = useState(editingReport?.remarques || "");
  const [conclusion, setConclusion] = useState(editingReport?.conclusion || "");
  const introRef = useRef(editingReport?.intro || "");
  const descriptionLibreRef = useRef(editingReport?.descriptionLibre || "");
  const [showDescriptionLibre, setShowDescriptionLibre] = useState(!!editingReport?.descriptionLibre); // conservé pour compat (non utilisé)
  const [pieces, setPieces] = useState(editingReport?.pieces || "");
  const [facturable, setFacturable] = useState(editingReport?.facturable ?? true);
  const [montant, setMontant] = useState(editingReport?.montant || "");
  const [tva, setTva] = useState(editingReport?.tva || settings.pennylane?.tvaParDefaut || "FR_200");
  const [marquerEffectue, setMarquerEffectue] = useState(editingReport?.valide ?? true);
  const [devisAEffectuer, setDevisAEffectuer] = useState(editingReport?.devisAEffectuer || "");
  const [photos, setPhotos] = useState(editingReport?.photos || []);
  const [checklists, setChecklists] = useState(() => {
    const existantes = normalizeChecklists(editingReport);
    if (existantes.length > 0) return existantes;
    return [defaultChecklistFor(reportType)];
  });
  const [tables, setTables] = useState(editingReport?.tables || []);
  const [signatureTech, setSignatureTech] = useState(editingReport?.signatureTech || "");
  const [signatureClient, setSignatureClient] = useState(editingReport?.signatureClient || "");
  const descriptionRef = useRef(editingReport?.description || "");
  const fileRef = useRef();

  useEffect(() => {
    if (isEditing) return;
    if (reportType === "mise_en_service" || reportType === "entretien") {
      setChecklists([defaultChecklistFor(reportType)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotos((p) => [...p, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const addTable = () => setTables((t) => [...t, { id: "tbl" + Date.now(), nom: "", rows: [["", ""], ["", ""]], afterItemId: "__end__" }]);
  const updateTable = (id, next) => setTables((list) => list.map((t) => (t.id === id ? next : t)));
  const removeTable = (id) => setTables((list) => list.filter((t) => t.id !== id));
  const insertTemplateTable = (templateId) => {
    const tpl = (settings.tableaux || []).find((t) => t.id === templateId);
    if (!tpl) return;
    setTables((list) => [...list, { id: "tbl" + Date.now(), nom: tpl.nom || "", rows: tpl.rows.map((row) => [...row]), afterItemId: "__end__" }]);
  };

  // On retire les lignes vides et les checklists devenues vides avant l'enregistrement.
  const cleanChecklists = () =>
    checklists
      .map((cl) => ({ ...cl, items: (cl.items || []).filter((it) => it.label.trim()) }))
      .filter((cl) => cl.items.length > 0);

  const buildReport = () => {
    const base = {
      id: isEditing ? editingReport.id : "r" + Date.now(),
      type: reportType, client, date, installation, photos, signatureTech, signatureClient,
      planningTaskId: isEditing ? editingReport.planningTaskId : (prefillPlanningTaskId || undefined),
      valide: marquerEffectue,
    };
    if (reportType === "mise_en_service") {
      return { ...base, intro: introRef.current, checklists: cleanChecklists(), tables, descriptionLibre: descriptionLibreRef.current, conclusion, remarques, montant, tva, devisAEffectuer };
    } else if (reportType === "entretien") {
      return { ...base, intro: introRef.current, checklists: cleanChecklists(), tables, descriptionLibre: descriptionLibreRef.current, conclusion, remarques, montant, tva, devisAEffectuer };
    } else {
      return { ...base, intro: introRef.current, description: descriptionRef.current, tables, pieces, facturable, conclusion, remarques, montant, tva, devisAEffectuer };
    }
  };

  const submit = () => onSubmit(buildReport());
  const preview = () => onPreview(buildReport());

  return (
    <div className="card form-card">
      <div className="type-toggle">
        {isEditing ? (
          <div className="toggle-btn active" style={{ cursor: "default" }}>{labelType(reportType)} <span className="hint-inline">(type non modifiable)</span></div>
        ) : (
          [
            ["mise_en_service", "Mise en service"],
            ["entretien", "Entretien"],
            ["diagnostic", "Diagnostic / dépannage"],
          ].map(([id, label]) => (
            <button key={id} className={"toggle-btn" + (reportType === id ? " active" : "")} onClick={() => setReportType(id)}>
              {label}
            </button>
          ))
        )}
      </div>

      {settings?.technicien?.nom && (
        <div className="form-technicien">
          <span className="report-tech">Technicien : {settings.technicien.nom}</span>
        </div>
      )}

      <div className="form-grid">
        <label>Client
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            {clients.map((c) => <option key={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <label>Type d'installation
          <select value={installation} onChange={(e) => setInstallation(e.target.value)}>
            {installTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>Date
          <input type="date" value={frToIso(date)} onChange={(e) => setDate(isoToFr(e.target.value))} />
        </label>
      </div>

      {reportType === "mise_en_service" && (
        <>
          <div className="block field-block mb-lg">
            <div className="field-caption">Objet</div>
            <RichTextEditor initialValue={editingReport?.intro || ""} onChange={(html) => { introRef.current = html; }} minHeight={100} />
          </div>

          <div className="block field-block">
            <div className="field-caption">Description</div>
            <RichTextEditor initialValue={editingReport?.descriptionLibre || ""} onChange={(html) => { descriptionLibreRef.current = html; }} minHeight={160} />
          </div>

          <ChecklistsSection checklists={checklists} setChecklists={setChecklists} settings={settings} reportType="mise_en_service" />

          <TablesSection tables={tables} checklist={allChecklistItems(checklists)} settings={settings} updateTable={updateTable} removeTable={removeTable} addTable={addTable} insertTemplateTable={insertTemplateTable} />

          <label className="block mt">Conclusion
            <textarea rows={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="Ex : bon fonctionnement général de l'installation, intervention terminée." />
            <span className="hint">Le titre « Conclusion » n'apparaît dans le rapport que si ce champ est rempli.</span>
          </label>

          <label className="block mt">Remarques
            <textarea rows={3} value={remarques} onChange={(e) => setRemarques(e.target.value)} placeholder="Observations, recommandations au client..." />
            <span className="hint">Le titre « Remarques » n'apparaît dans le rapport que si ce champ est rempli.</span>
          </label>

          <div className="form-grid">
            <label>Montant HT de l'intervention (€, facultatif)
              <input type="number" step="0.01" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Ex : 120" />
            </label>
            <label>TVA applicable
              <select value={tva} onChange={(e) => setTva(e.target.value)}>
                <option value="FR_200">20 % (taux normal)</option>
                <option value="FR_100">10 % (taux intermédiaire)</option>
                <option value="FR_055">5,5 % (taux réduit)</option>
                <option value="FR_021">2,1 % (taux particulier)</option>
              </select>
            </label>
          </div>
          <span className="hint">Utilisés pour la facturation. Si la synchronisation Pennylane est activée et qu'aucun devis n'est à effectuer, la facture est créée automatiquement à l'enregistrement avec ce taux.</span>

          <label className="block">Devis à effectuer (facultatif)
            <textarea rows={2} value={devisAEffectuer} onChange={(e) => setDevisAEffectuer(e.target.value)} placeholder="Ex : proposer une extension de garantie, prévoir devis ~120 €" />
            <span className="hint">Renseigné, ce champ crée automatiquement une ligne dans l'onglet Devis → « à faire ».</span>
          </label>
        </>
      )}

      {reportType === "entretien" && (
        <>
          <div className="block field-block mb-lg">
            <div className="field-caption">Objet</div>
            <RichTextEditor initialValue={editingReport?.intro || ""} onChange={(html) => { introRef.current = html; }} minHeight={100} />
          </div>

          <div className="block field-block">
            <div className="field-caption">Description</div>
            <RichTextEditor initialValue={editingReport?.descriptionLibre || ""} onChange={(html) => { descriptionLibreRef.current = html; }} minHeight={160} />
          </div>

          <ChecklistsSection checklists={checklists} setChecklists={setChecklists} settings={settings} reportType="entretien" />

          <TablesSection tables={tables} checklist={allChecklistItems(checklists)} settings={settings} updateTable={updateTable} removeTable={removeTable} addTable={addTable} insertTemplateTable={insertTemplateTable} />

          <label className="block mt">Conclusion
            <textarea rows={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="Ex : bon fonctionnement général de l'installation, intervention terminée." />
            <span className="hint">Le titre « Conclusion » n'apparaît dans le rapport que si ce champ est rempli.</span>
          </label>

          <label className="block mt">Remarques
            <textarea rows={3} value={remarques} onChange={(e) => setRemarques(e.target.value)} placeholder="Observations, recommandations au client..." />
            <span className="hint">Le titre « Remarques » n'apparaît dans le rapport que si ce champ est rempli.</span>
          </label>
          <div className="form-grid">
            <label>Montant HT de l'intervention (€, facultatif)
              <input type="number" step="0.01" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Ex : 120" />
            </label>
            <label>TVA applicable
              <select value={tva} onChange={(e) => setTva(e.target.value)}>
                <option value="FR_200">20 % (taux normal)</option>
                <option value="FR_100">10 % (taux intermédiaire)</option>
                <option value="FR_055">5,5 % (taux réduit)</option>
                <option value="FR_021">2,1 % (taux particulier)</option>
              </select>
            </label>
          </div>
          <span className="hint">Utilisés pour la facturation. Si la synchronisation Pennylane est activée et qu'aucun devis n'est à effectuer, la facture est créée automatiquement à l'enregistrement avec ce taux.</span>
          <label className="block">Devis à effectuer (facultatif)
            <textarea rows={2} value={devisAEffectuer} onChange={(e) => setDevisAEffectuer(e.target.value)} placeholder="Ex : remplacement pièce d'usure constatée, prévoir devis ~90 €" />
            <span className="hint">Renseigné, ce champ crée automatiquement une ligne dans l'onglet Devis → « à faire ».</span>
          </label>
        </>
      )}

      {reportType === "diagnostic" && (
        <>
          <div className="block field-block">
            <div className="field-caption">Objet</div>
            <RichTextEditor initialValue={editingReport?.intro || ""} onChange={(html) => { introRef.current = html; }} minHeight={100} />
          </div>

          <div className="block field-block">
            <div className="field-caption">Description</div>
            <RichTextEditor initialValue={editingReport?.description || ""} onChange={(html) => { descriptionRef.current = html; }} minHeight={200} />
          </div>
          <label className="block">Pièces utilisées
            <input value={pieces} onChange={(e) => setPieces(e.target.value)} placeholder="Ex : raccord flare 1/4 pouce" />
          </label>
          <label className="check-inline">
            <input type="checkbox" checked={facturable} onChange={(e) => setFacturable(e.target.checked)} /> Intervention facturable
          </label>
          {facturable && (
            <>
              <div className="form-grid">
                <label>Montant HT de l'intervention (€, facultatif)
                  <input type="number" step="0.01" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Ex : 90" />
                </label>
                <label>TVA applicable
                  <select value={tva} onChange={(e) => setTva(e.target.value)}>
                    <option value="FR_200">20 % (taux normal)</option>
                    <option value="FR_100">10 % (taux intermédiaire)</option>
                    <option value="FR_055">5,5 % (taux réduit)</option>
                    <option value="FR_021">2,1 % (taux particulier)</option>
                  </select>
                </label>
              </div>
              <span className="hint">Utilisés pour la facturation. Si la synchronisation Pennylane est activée et qu'aucun devis n'est à effectuer, la facture est créée automatiquement à l'enregistrement avec ce taux.</span>
            </>
          )}

          <TablesSection tables={tables} checklist={[]} settings={settings} updateTable={updateTable} removeTable={removeTable} addTable={addTable} insertTemplateTable={insertTemplateTable} />

          <label className="block mt">Conclusion
            <textarea rows={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="Ex : panne résolue, installation remise en service." />
            <span className="hint">Le titre « Conclusion » n'apparaît dans le rapport que si ce champ est rempli.</span>
          </label>

          <label className="block mt">Remarques
            <textarea rows={3} value={remarques} onChange={(e) => setRemarques(e.target.value)} placeholder="Observations, recommandations au client..." />
            <span className="hint">Le titre « Remarques » n'apparaît dans le rapport que si ce champ est rempli.</span>
          </label>

          <label className="block">Devis à effectuer pour la réparation
            <textarea rows={2} value={devisAEffectuer} onChange={(e) => setDevisAEffectuer(e.target.value)} placeholder="Ex : remplacement compresseur, prévoir devis ~450 €" />
            <span className="hint">Renseigné, ce champ crée automatiquement une ligne dans l'onglet Devis → « à faire ».</span>
          </label>
        </>
      )}

      <label className="block mt">
        Photos
        <div className="photo-upload" onClick={() => fileRef.current.click()}>
          <Icon name="photo" /> Ajouter des photos
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handlePhotos} />
        {photos.length > 0 && (
          <div className="photo-strip">
            {photos.map((src, i) => <img key={i} src={src} alt="" />)}
          </div>
        )}
      </label>

      <div className="block mt">
        <label>Signatures</label>
        <div className="signatures-edit">
          <SignaturePad label="Signature du technicien" value={signatureTech} onChange={setSignatureTech} />
          <SignaturePad label="Signature du client" value={signatureClient} onChange={setSignatureClient} />
        </div>
      </div>

      <label className="check-inline mt">
        <input type="checkbox" checked={marquerEffectue} onChange={(e) => setMarquerEffectue(e.target.checked)} />
        Marquer cette intervention comme effectuée
        {" "}
        <span className="hint">
          {editingReport?.planningTaskId || prefillPlanningTaskId
            ? "— coche aussi la tâche correspondante dans le Planning."
            : ""}
        </span>
      </label>

      <div className="form-actions">
        <button className="btn-ghost" onClick={onCancel}>Annuler</button>
        <button className="btn-ghost" onClick={preview}><Icon name="download" size={14} /> Aperçu PDF</button>
        <button className="btn-primary" onClick={submit}>{isEditing ? "Enregistrer les modifications" : "Enregistrer le rapport"}</button>
      </div>
    </div>
  );
}

/* ---------- Clients ---------- */
/* ---------- Bloc matériel (affichage, fiche client) ---------- */
function MachineBlock({ machine }) {
  const extUnits = normalizeUnits(machine.exterieur);
  const intUnits = normalizeUnits(machine.interieur);

  return (
    <div className="machine-block">
      <div className="machine-title">{machine.type} <span className="machine-date">— installée {machine.date}</span></div>
      <table className="mini-table">
        <thead><tr><th></th><th>Marque</th><th>Modèle</th><th>N° série</th></tr></thead>
        <tbody>
          {extUnits.map((u, idx) => (
            <tr key={"e" + idx}><td>Groupe extérieur{extUnits.length > 1 ? ` ${idx + 1}` : ""}</td><td>{u.marque}</td><td>{u.modele}</td><td>{u.serie}</td></tr>
          ))}
          {intUnits.map((u, idx) => (
            <tr key={"i" + idx}><td>Unité intérieure{intUnits.length > 1 ? ` ${idx + 1}` : ""}</td><td>{u.marque}</td><td>{u.modele}</td><td>{u.serie}</td></tr>
          ))}
        </tbody>
      </table>
      {(extUnits.some((u) => u.photo) || intUnits.some((u) => u.photo)) && (
        <div className="machine-photos">
          {extUnits.map((u, idx) => u.photo && (
            <div key={"pe" + idx} className="machine-photo-item">
              <img src={u.photo} alt="Groupe extérieur" />
              <span>Groupe extérieur{extUnits.length > 1 ? ` ${idx + 1}` : ""}</span>
            </div>
          ))}
          {intUnits.map((u, idx) => u.photo && (
            <div key={"pi" + idx} className="machine-photo-item">
              <img src={u.photo} alt="Unité intérieure" />
              <span>Unité intérieure{intUnits.length > 1 ? ` ${idx + 1}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Clients({ clients, showForm, setShowForm, onAdd, onUpdate, onDelete, reports, devisAFaire, devisEnCours, facturation, onOpenReport, onNavigate, focusClient, onDeleteFacturation, settings }) {
  // Liste triée par ordre alphabétique sur le nom, en ignorant la casse et les
  // accents — l'ordre d'arrivée réseau n'a ainsi plus d'effet sur l'affichage.
  const clientsTries = [...clients].sort((a, b) =>
    (a.nom || "").localeCompare(b.nom || "", "fr", { sensitivity: "base" })
  );
  const [selected, setSelected] = useState(clientsTries[0]?.id);
  const [editingClient, setEditingClient] = useState(null);
  const [showContract, setShowContract] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showMachines, setShowMachines] = useState(false);
  const client = clients.find((c) => c.id === selected) || clientsTries[0];

  const formRef = useRef(null);

  const openNew = () => { setEditingClient(null); setShowForm(true); };
  const openEdit = (c) => { setEditingClient(c); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingClient(null); };

  useEffect(() => {
    setShowContract(false);
  }, [selected]);

  // Le formulaire s'ouvre sous la liste des clients : on fait descendre la page
  // automatiquement jusqu'à lui, sinon il apparaît hors de l'écran et donne
  // l'impression que le clic n'a rien fait.
  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showForm, editingClient]);

  useEffect(() => {
    if (focusClient) {
      const match = clients.find((c) => c.nom === focusClient.name);
      if (match) {
        setSelected(match.id);
        setShowForm(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusClient]);

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>Fichier clients</h1>
          <p>{clients.length} clients enregistrés</p>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => setShowMap(!showMap)}>
            <Icon name="calendar" size={16} /> {showMap ? "Masquer la carte" : "Voir la carte des secteurs"}
          </button>
          <button className="btn-primary" onClick={() => (showForm ? closeForm() : openNew())}>
            <Icon name="plus" size={16} /> Nouveau client
          </button>
        </div>
      </header>

      {showMap && <ClientsMap clients={clients} onUpdateClient={onUpdate} onOpenClient={(nom) => { const c = clients.find((cl) => cl.nom === nom); if (c) { setSelected(c.id); setShowMap(false); } }} entrepriseNom={settings?.entreprise?.nom} entrepriseAdresse={[settings?.entreprise?.adresse, settings?.entreprise?.codePostalVille].filter(Boolean).join(", ")} />}

      <section className="card">
        <ul className="list">
          {clientsTries.map((c) => (
            <li key={c.id} className={"row clickable" + (client?.id === c.id ? " selected" : "")} onClick={() => setSelected(c.id)}>
              <div>
                <div className="row-title">
                  {c.nom}
                  {(() => {
                    const statut = getEntretienStatus(c, reports);
                    if (!statut) return null;
                    if (statut.moisNonDefini) {
                      return <span className="contrat-dot neutral" title="Mois d'entretien contractuel non renseigné" />;
                    }
                    const classe = statut.doneThisYear ? "ok" : statut.isOverdue ? "late" : statut.isUrgent ? "todo" : "neutral";
                    const titre = statut.doneThisYear
                      ? `Entretien ${statut.annee} effectué`
                      : statut.isOverdue
                      ? `Entretien ${statut.annee} en retard !`
                      : statut.isUrgent
                      ? `Entretien ${statut.annee} à faire`
                      : `Échéance : ${statut.dueDate.toLocaleDateString("fr-FR", { month: "long" })} ${statut.annee}`;
                    return <span className={"contrat-dot " + classe} title={titre} />;
                  })()}
                </div>
                <div className="row-sub">{c.raisonSociale ? c.raisonSociale + " · " : ""}{c.machines.length} matériel(s) installé{c.machines.length > 1 ? "s" : ""}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {client && !showForm && (
        <ClientFiche
          client={client}
          reports={reports}
          showMachines={showMachines}
          setShowMachines={setShowMachines}
          onEdit={() => openEdit(client)}
          onDelete={() => onDelete(client)}
          onShowContract={() => setShowContract(true)}
        />
      )}

      {showForm && (
        <div ref={formRef}>
          <ClientForm
            key={editingClient ? editingClient.id : "new"}
            editingClient={editingClient}
            onCancel={closeForm}
            onSubmit={(c) => { editingClient ? onUpdate(c) : onAdd(c); closeForm(); setSelected(c.id); }}
          />
        </div>
      )}

      {client && (
        <ClientHistory client={client} reports={reports} devisAFaire={devisAFaire} devisEnCours={devisEnCours} facturation={facturation} onOpenReport={onOpenReport} onNavigate={onNavigate} onDeleteFacturation={onDeleteFacturation} />
      )}

      {showContract && client?.contrat && (
        <PdfFileModal
          base64={client.contrat.data}
          filename={client.contrat.nom || "contrat.pdf"}
          title={"Contrat — " + client.nom}
          onClose={() => setShowContract(false)}
        />
      )}
    </div>
  );
}

/* ---------- Fiche client complète, en lecture seule ----------
   Affiche toutes les informations enregistrées sur le client sans aucun champ
   modifiable : toute modification passe par le bouton « Modifier », qui ouvre
   le formulaire, puis par l'enregistrement de celui-ci. */

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function nomDuMois(numero) {
  const n = parseInt(numero, 10);
  if (!n || n < 1 || n > 12) return "";
  return NOMS_MOIS[n - 1];
}

function FicheLigne({ label, value }) {
  return (
    <div className="fiche-item">
      <div className="fiche-label">{label}</div>
      <div className={"fiche-value" + (value ? "" : " vide")}>{value || "Non renseigné"}</div>
    </div>
  );
}

function ClientFiche({ client, reports, showMachines, setShowMachines, onEdit, onDelete, onShowContract }) {
  const estProfessionnel = !!(client.raisonSociale || client.siren || client.tva);

  return (
    <section className="card">
      <div className="row-between">
        <div>
          <h3>{client.nom}</h3>
          {client.raisonSociale && <div className="client-raison-sociale">{client.raisonSociale}</div>}
        </div>
        <div className="client-detail-actions">
          {client.contrat && (
            <button className="btn-ghost small btn-contrat" onClick={onShowContract}>
              <Icon name="report" size={14} /> Contrat
            </button>
          )}
          <button className="btn-ghost small" onClick={onEdit}>
            <Icon name="edit" size={14} /> Modifier
          </button>
          <DeleteButton onConfirm={onDelete} />
        </div>
      </div>

      {(() => {
        const statut = getEntretienStatus(client, reports);
        if (!statut) return null;
        if (statut.moisNonDefini) {
          return (
            <div className="entretien-annuel-badge neutral">
              <Icon name="calendar" size={14} /> Mois de l'entretien contractuel non renseigné — à définir dans « Modifier »
            </div>
          );
        }
        if (statut.doneThisYear) {
          return (
            <div className="entretien-annuel-badge ok">
              <Icon name="check" size={14} /> Entretien {statut.annee} effectué le {statut.rapportAnnee.date}
            </div>
          );
        }
        if (statut.isOverdue) {
          return (
            <div className="entretien-annuel-badge late">
              <Icon name="alert" size={14} /> Entretien {statut.annee} en retard !{statut.dueDate ? ` (échéance ${statut.dueDate.toLocaleDateString("fr-FR", { month: "long" })})` : ""}
            </div>
          );
        }
        if (statut.isUrgent) {
          return (
            <div className="entretien-annuel-badge todo">
              <Icon name="alert" size={14} /> Entretien {statut.annee} à faire{statut.dueDate ? ` (échéance ${statut.dueDate.toLocaleDateString("fr-FR", { month: "long" })})` : ""}
            </div>
          );
        }
        return (
          <div className="entretien-annuel-badge neutral">
            <Icon name="calendar" size={14} /> Prochain entretien prévu en {statut.dueDate.toLocaleDateString("fr-FR", { month: "long" })} {statut.annee}
          </div>
        );
      })()}

      <div className="fiche-grid">
        <FicheLigne label="Nom et prénom" value={client.nom} />
        <FicheLigne label="Type de client" value={estProfessionnel ? "Professionnel" : "Particulier"} />
        {estProfessionnel && <FicheLigne label="Raison sociale" value={client.raisonSociale} />}
        {estProfessionnel && <FicheLigne label="SIREN" value={client.siren} />}
        {estProfessionnel && <FicheLigne label="N° de TVA intracommunautaire" value={client.tva} />}
        <FicheLigne label="Téléphone" value={client.tel} />
        <FicheLigne label="Email" value={client.email} />
        <FicheLigne label="Adresse" value={client.adresse} />
        <FicheLigne label="Mois de l'entretien contractuel" value={nomDuMois(client.moisEcheance)} />
        <FicheLigne label="Contrat de maintenance" value={client.contrat ? (client.contrat.nom || "Contrat enregistré") : ""} />
      </div>

      <button type="button" className="machine-section-toggle" onClick={() => setShowMachines(!showMachines)}>
        <h4 className="mt">Matériel installé ({client.machines.length})</h4>
        <Icon name={showMachines ? "chevronDown" : "chevronRight"} size={18} />
      </button>
      {showMachines && client.machines.length === 0 && <p className="empty">Aucun matériel enregistré pour ce client.</p>}
      {showMachines && client.machines.map((m, i) => <MachineBlock key={i} machine={m} />)}
    </section>
  );
}

function ClientHistory({ client, reports, devisAFaire, devisEnCours, facturation, onOpenReport, onNavigate, onDeleteFacturation }) {
  const clientReports = reports.filter((r) => r.client === client.nom);
  const clientDevisAFaire = devisAFaire.filter((d) => d.client === client.nom);
  const clientDevisEnCours = devisEnCours.filter((d) => d.client === client.nom);
  const clientFacturation = facturation.filter((f) => f.client === client.nom);
  const hasDevis = clientDevisAFaire.length > 0 || clientDevisEnCours.length > 0;
  const hasHistory = clientReports.length > 0 || hasDevis || clientFacturation.length > 0;

  return (
    <section className="card">
      <h3>Historique — {client.nom}</h3>
      {!hasHistory && <p className="empty">Aucun historique pour ce client.</p>}

      {clientReports.length > 0 && (
        <>
          <h4 className="mt">Rapports d'intervention</h4>
          <ul className="list">
            {clientReports.map((r) => (
              <li key={r.id} className="row clickable" onClick={() => onOpenReport(r.id)} title="Ouvrir le rapport">
                <div>
                  <div className="row-title">{labelType(r.type)}</div>
                  <div className="row-sub">{r.installation} · {r.date}</div>
                </div>
                <span className={"pill " + typePillClass(r.type)}>{shortType(r.type)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {hasDevis && (
        <>
          <h4 className="mt">Devis</h4>
          <ul className="list">
            {clientDevisAFaire.map((d) => (
              <li key={d.id} className="row clickable" onClick={() => onNavigate("devis")} title="Ouvrir dans l'onglet Devis">
                <div>
                  <div className="row-title">{d.origine}</div>
                  <div className="row-sub">Devis à créer</div>
                </div>
                <span className="pill pill-muted">À faire</span>
              </li>
            ))}
            {clientDevisEnCours.map((d) => (
              <li key={d.id} className="row clickable" onClick={() => onNavigate("devis")} title="Ouvrir dans l'onglet Devis">
                <div>
                  <div className="row-title">{d.montant}</div>
                  <div className="row-sub">Envoyé le {d.envoye}</div>
                </div>
                {d.statut === "relance_faite" ? (
                  <span className="pill pill-ok">Relancé</span>
                ) : (
                  <span className={"pill " + (d.statut === "a_relancer" ? "pill-alert" : "pill-warm")}>
                    {d.statut === "a_relancer" ? "À relancer" : "Bientôt"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {clientFacturation.length > 0 && (
        <>
          <h4 className="mt">Facturation</h4>
          <ul className="list">
            {clientFacturation.map((f) => (
              <li key={f.id} className="row clickable" onClick={() => onNavigate("facturation")} title="Ouvrir dans l'onglet Facturation">
                <div>
                  <div className="row-title">{f.intervention}</div>
                  <div className="row-sub">{f.montant}</div>
                </div>
                <div className="row-actions">
                  {!f.facture ? (
                    <span className="pill pill-muted">À facturer</span>
                  ) : f.payee ? (
                    <span className="pill pill-ok">Payée</span>
                  ) : (
                    <span className="pill pill-alert">Impayée</span>
                  )}
                  <span className="row-delete-hover" onClick={(e) => e.stopPropagation()}><DeleteButton onConfirm={() => onDeleteFacturation(f.id)} label="" /></span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function SinglePhotoField({ label, value, onChange }) {
  const fileRef = useRef();
  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <div className="single-photo-field">
      <div className="signature-label">{label}</div>
      {value ? (
        <div className="single-photo-preview">
          <img src={value} alt={label} />
          <button type="button" className="icon-btn" onClick={() => onChange("")}><Icon name="trash" size={14} /></button>
        </div>
      ) : (
        <div className="photo-upload" onClick={() => fileRef.current.click()}>
          <Icon name="photo" size={16} /> Ajouter une photo
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </div>
  );
}

/* ---------- Carte matériel dépliable (formulaire client) ---------- */
function CollapsibleMachineCard({ machine, index, defaultOpen, onChange, onRemove, removable }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const extFirst = normalizeUnits(machine.exterieur)[0];
  const resume = [machine.type, extFirst?.marque].filter(Boolean).join(" — ") || `Matériel ${index + 1}`;

  return (
    <div className="card machine-editor-card">
      <button type="button" className="machine-section-toggle" onClick={() => setOpen(!open)}>
        <span>{resume}</span>
        <Icon name={open ? "chevronDown" : "chevronRight"} size={18} />
      </button>
      {open && <MachineEditor machine={machine} onChange={onChange} onRemove={onRemove} removable={removable} />}
    </div>
  );
}

function MachineEditor({ machine, onChange, onRemove, removable }) {
  const extList = normalizeUnits(machine.exterieur);
  const intList = normalizeUnits(machine.interieur);

  const updateExtAt = (idx, patch) => onChange({ ...machine, exterieur: extList.map((u, i) => (i === idx ? { ...u, ...patch } : u)) });
  const updateIntAt = (idx, patch) => onChange({ ...machine, interieur: intList.map((u, i) => (i === idx ? { ...u, ...patch } : u)) });
  const addExt = () => onChange({ ...machine, exterieur: [...extList, { marque: "", modele: "", serie: "", photo: "" }] });
  const addInt = () => onChange({ ...machine, interieur: [...intList, { marque: "", modele: "", serie: "", photo: "" }] });
  const removeExtAt = (idx) => onChange({ ...machine, exterieur: extList.filter((_, i) => i !== idx) });
  const removeIntAt = (idx) => onChange({ ...machine, interieur: intList.filter((_, i) => i !== idx) });

  return (
    <div className="machine-editor">
      <div className="row-between">
        <label style={{ flex: 1, marginRight: 12 }}>Type d'installation
          <select value={machine.type} onChange={(e) => onChange({ ...machine, type: e.target.value })}>
            {installTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        {removable && (
          <button type="button" className="icon-btn" onClick={onRemove} title="Supprimer ce matériel">
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>

      <h4 className="mt">Groupe extérieur</h4>
      {extList.map((u, idx) => (
        <div key={idx} className="unit-block">
          <div className="form-grid three">
            <label>Marque<input value={u.marque} onChange={(e) => updateExtAt(idx, { marque: e.target.value })} placeholder="Ex : Daikin" /></label>
            <label>Modèle<input value={u.modele} onChange={(e) => updateExtAt(idx, { modele: e.target.value })} placeholder="Ex : Altherma 3" /></label>
            <label>N° de série<input value={u.serie} onChange={(e) => updateExtAt(idx, { serie: e.target.value })} placeholder="N° de série" /></label>
          </div>
          <div className="row-between">
            <SinglePhotoField label="Photo du groupe extérieur" value={u.photo} onChange={(photo) => updateExtAt(idx, { photo })} />
            {extList.length > 1 && (
              <button type="button" className="icon-btn" onClick={() => removeExtAt(idx)} title="Retirer ce groupe extérieur">
                <Icon name="trash" size={15} />
              </button>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="btn-ghost small" onClick={addExt}>
        <Icon name="plus" size={14} /> Ajouter un groupe extérieur
      </button>

      <h4 className="mt">Unité intérieure</h4>
      {intList.map((u, idx) => (
        <div key={idx} className="unit-block">
          <div className="form-grid three">
            <label>Marque<input value={u.marque} onChange={(e) => updateIntAt(idx, { marque: e.target.value })} placeholder="Ex : Daikin" /></label>
            <label>Modèle<input value={u.modele} onChange={(e) => updateIntAt(idx, { modele: e.target.value })} placeholder="Ex : EHVX08S23D6V" /></label>
            <label>N° de série<input value={u.serie} onChange={(e) => updateIntAt(idx, { serie: e.target.value })} placeholder="N° de série" /></label>
          </div>
          <div className="row-between">
            <SinglePhotoField label="Photo de l'unité intérieure" value={u.photo} onChange={(photo) => updateIntAt(idx, { photo })} />
            {intList.length > 1 && (
              <button type="button" className="icon-btn" onClick={() => removeIntAt(idx)} title="Retirer cette unité intérieure">
                <Icon name="trash" size={15} />
              </button>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="btn-ghost small" onClick={addInt}>
        <Icon name="plus" size={14} /> Ajouter une unité intérieure
      </button>
    </div>
  );
}

// Convertit exterieur/interieur en tableau d'unités, quel que soit le format
// stocké : ancien format (un seul objet) ou nouveau format (tableau) —
// garantit la compatibilité avec les clients déjà enregistrés.
function normalizeUnits(u) {
  if (Array.isArray(u)) return u.length > 0 ? u : [{ marque: "", modele: "", serie: "", photo: "" }];
  if (u && typeof u === "object") return [u];
  return [{ marque: "", modele: "", serie: "", photo: "" }];
}

function blankMachine() {
  return {
    id: "m" + Date.now() + Math.random().toString(16).slice(2),
    type: installTypes[0],
    date: new Date().toLocaleDateString("fr-FR"),
    exterieur: [{ marque: "", modele: "", serie: "", photo: "" }],
    interieur: [{ marque: "", modele: "", serie: "", photo: "" }],
  };
}

function ClientForm({ editingClient, onCancel, onSubmit }) {
  const isEditing = !!editingClient;
  const [nom, setNom] = useState(editingClient?.nom || "");
  const [raisonSociale, setRaisonSociale] = useState(editingClient?.raisonSociale || "");
  const [estProfessionnel, setEstProfessionnel] = useState(!!editingClient?.raisonSociale);
  const [siren, setSiren] = useState(editingClient?.siren || "");
  const [tva, setTva] = useState(editingClient?.tva || "");
  const [moisEcheance, setMoisEcheance] = useState(editingClient?.moisEcheance || "");
  const [adresse, setAdresse] = useState(editingClient?.adresse || "");
  const [email, setEmail] = useState(editingClient?.email || "");
  const [tel, setTel] = useState(editingClient?.tel || "");
  const [machines, setMachines] = useState(() => {
    const existing = (editingClient?.machines || []).map((m, i) => ({
      id: "m" + i + "_" + Date.now(),
      type: m.type || installTypes[0],
      date: m.date || new Date().toLocaleDateString("fr-FR"),
      exterieur: normalizeUnits(m.exterieur).map((u) => ({ marque: "", modele: "", serie: "", photo: "", ...u })),
      interieur: normalizeUnits(m.interieur).map((u) => ({ marque: "", modele: "", serie: "", photo: "", ...u })),
    }));
    return existing.length > 0 ? existing : [blankMachine()];
  });
  const [contrat, setContrat] = useState(editingClient?.contrat || null);
  const [blankContractType, setBlankContractType] = useState(null); // "air_air" | "air_eau" | "air_air_b2b" | "air_eau_b2b" | null
  const [showOwnContract, setShowOwnContract] = useState(false);
  const contractFileRef = useRef();

  const addMachine = () => setMachines((list) => [...list, blankMachine()]);
  const updateMachine = (id, next) => setMachines((list) => list.map((m) => (m.id === id ? next : m)));
  const removeMachine = (id) => setMachines((list) => list.filter((m) => m.id !== id));

  const handleContractUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = String(ev.target.result).split(",")[1];
      setContrat({ nom: file.name, data: base64, dateAjout: new Date().toLocaleDateString("fr-FR") });
    };
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!nom) return;
    const cleanedMachines = machines
      .filter((m) =>
        m.exterieur.some((u) => u.marque.trim() || u.serie.trim()) ||
        m.interieur.some((u) => u.marque.trim() || u.serie.trim())
      )
      .map(({ id, ...m }) => m);
    onSubmit({
      id: isEditing ? editingClient.id : "c" + Date.now(),
      nom, raisonSociale, siren, tva, adresse, email, tel, moisEcheance,
      machines: cleanedMachines,
      contrat,
    });
  };

  return (
    <div className="card form-card">
      <div className="form-grid">
        <label>Nom et prénom<input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Martin Jean" /></label>
        <label className="check-inline">
          <input type="checkbox" checked={estProfessionnel} onChange={(e) => { setEstProfessionnel(e.target.checked); if (!e.target.checked) { setRaisonSociale(""); setSiren(""); setTva(""); } }} /> Professionnel
        </label>
        {estProfessionnel && (
          <>
            <label>Raison sociale<input value={raisonSociale} onChange={(e) => setRaisonSociale(e.target.value)} placeholder="Ex : Garcia Bâtiment SARL" /></label>
            <label>SIREN<input value={siren} onChange={(e) => setSiren(e.target.value)} placeholder="Ex : 123 456 789" /></label>
            <label>N° de TVA intracommunautaire<input value={tva} onChange={(e) => setTva(e.target.value)} placeholder="Ex : FR12345678900" /></label>
          </>
        )}
        <label>Téléphone<input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="06 00 00 00 00" /></label>
        <label>Adresse<input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Rue, code postal, ville" /></label>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@email.fr" /></label>
        <label>Mois de l'entretien contractuel (facultatif)
          <select value={moisEcheance} onChange={(e) => setMoisEcheance(e.target.value)}>
            <option value="">Non défini</option>
            <option value="1">Janvier</option>
            <option value="2">Février</option>
            <option value="3">Mars</option>
            <option value="4">Avril</option>
            <option value="5">Mai</option>
            <option value="6">Juin</option>
            <option value="7">Juillet</option>
            <option value="8">Août</option>
            <option value="9">Septembre</option>
            <option value="10">Octobre</option>
            <option value="11">Novembre</option>
            <option value="12">Décembre</option>
          </select>
          <span className="hint">Un rappel est créé automatiquement 1 mois avant, si un contrat est rattaché à ce client.</span>
        </label>
      </div>

      <label className="block">Matériel installé</label>
      {machines.map((m, i) => (
        <CollapsibleMachineCard
          key={m.id}
          machine={m}
          index={i}
          defaultOpen={machines.length === 1}
          onChange={(next) => updateMachine(m.id, next)}
          onRemove={() => removeMachine(m.id)}
          removable={machines.length > 1}
        />
      ))}
      <button type="button" className="btn-ghost small" onClick={addMachine}><Icon name="plus" size={14} /> Ajouter un matériel</button>

      <label className="block mt">Contrat de maintenance</label>
      <div className="contract-box">
        <div className="contract-templates-group">
          <span className="contract-templates-label">Standard</span>
          <div className="contract-templates">
            <button type="button" className="btn-ghost small btn-b2b" onClick={() => setBlankContractType("air_air")}>
              <Icon name="report" size={14} /> PAC air/air
            </button>
            <button type="button" className="btn-ghost small btn-b2b" onClick={() => setBlankContractType("air_eau")}>
              <Icon name="report" size={14} /> PAC air/eau
            </button>
          </div>
        </div>
        <div className="contract-templates-group mt">
          <span className="contract-templates-label">B2B (clients professionnels)</span>
          <div className="contract-templates">
            <button type="button" className="btn-ghost small btn-b2b" onClick={() => setBlankContractType("air_air_b2b")}>
              <Icon name="report" size={14} /> PAC air/air B2B
            </button>
            <button type="button" className="btn-ghost small btn-b2b" onClick={() => setBlankContractType("air_eau_b2b")}>
              <Icon name="report" size={14} /> PAC air/eau B2B
            </button>
          </div>
        </div>
        <span className="hint">Ouvre le modèle de contrat vierge correspondant, à remplir et faire signer.</span>

        <div className="contract-import mt">
          <button type="button" className="btn-ghost small" onClick={() => contractFileRef.current.click()}>
            <Icon name="photo" size={14} /> Importer le contrat signé (PDF)
          </button>
          <input ref={contractFileRef} type="file" accept="application/pdf" hidden onChange={handleContractUpload} />
          {contrat && (
            <span className="contract-status">
              <Icon name="check" size={14} /> {contrat.nom || "Contrat"}
              <button type="button" className="contract-view-link" onClick={() => setShowOwnContract(true)}>Voir</button>
              <button type="button" className="icon-btn" onClick={() => setContrat(null)} title="Retirer le contrat">
                <Icon name="trash" size={13} />
              </button>
            </span>
          )}
        </div>
      </div>

      {blankContractType === "air_air" && (
        <PdfFileModal
          base64={BLANK_CONTRACT_PDF_BASE64}
          filename="Contrat-entretien-PAC-air-air.pdf"
          title="Modèle de contrat — Pompe à chaleur air/air"
          onClose={() => setBlankContractType(null)}
        />
      )}
      {blankContractType === "air_eau" && (
        <PdfFileModal
          base64={BLANK_CONTRACT_AIR_EAU_PDF_BASE64}
          filename="Contrat-entretien-PAC-air-eau.pdf"
          title="Modèle de contrat — Pompe à chaleur air/eau"
          onClose={() => setBlankContractType(null)}
        />
      )}
      {blankContractType === "air_air_b2b" && (
        <PdfFileModal
          base64={BLANK_CONTRACT_B2B_PDF_BASE64}
          filename="Contrat-entretien-PAC-air-air-B2B.pdf"
          title="Modèle de contrat B2B — Pompe à chaleur air/air"
          onClose={() => setBlankContractType(null)}
        />
      )}
      {blankContractType === "air_eau_b2b" && (
        <PdfFileModal
          base64={BLANK_CONTRACT_AIR_EAU_B2B_PDF_BASE64}
          filename="Contrat-entretien-PAC-air-eau-B2B.pdf"
          title="Modèle de contrat B2B — Pompe à chaleur air/eau"
          onClose={() => setBlankContractType(null)}
        />
      )}
      {showOwnContract && contrat && (
        <PdfFileModal
          base64={contrat.data}
          filename={contrat.nom || "contrat.pdf"}
          title={"Contrat — " + nom}
          onClose={() => setShowOwnContract(false)}
        />
      )}

      <div className="form-actions">
        <button className="btn-ghost" onClick={onCancel}>Annuler</button>
        <button className="btn-primary" onClick={submit}>{isEditing ? "Enregistrer les modifications" : "Ajouter le client"}</button>
      </div>
    </div>
  );
}

/* ---------- Planning ---------- */
function Planning({ planning, clients, showForm, setShowForm, onAdd, onToggle, onToggleRappel, onCreateReport, onDelete }) {
  const interventions = planning.filter((p) => p.categorie !== "relance");
  const grouped = interventions.reduce((acc, p) => {
    (acc[p.date] = acc[p.date] || []).push(p);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();
  const dateCounts = {};
  dates.forEach((d) => { dateCounts[d] = grouped[d].length; });
  const [selectedDate, setSelectedDate] = useState(() => dates[0] || toLocalISODate(new Date()));
  const [editingTask, setEditingTask] = useState(null);

  const openNewTaskForm = () => { setEditingTask(null); setShowForm(!showForm || !!editingTask); };
  const openEditTaskForm = (task) => { setEditingTask(task); setShowForm(true); };
  const closeTaskForm = () => { setShowForm(false); setEditingTask(null); };

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>Planning</h1>
          <p>Interventions programmées et rappels — cliquez un jour du calendrier pour voir son détail</p>
        </div>
        <button className="btn-primary" onClick={openNewTaskForm}>
          <Icon name="plus" size={16} /> Nouvelle tâche
        </button>
      </header>

      {showForm && (
        <TaskForm
          clients={clients}
          initialDate={selectedDate}
          editingTask={editingTask}
          onCancel={closeTaskForm}
          onSubmit={(t) => { onAdd(t); closeTaskForm(); }}
        />
      )}

      <MiniCalendar dateCounts={dateCounts} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {selectedDate && (
        <section className="card planning-day">
          <h3>{new Date(selectedDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</h3>
          {grouped[selectedDate] ? (
            <ul className="list">
              {grouped[selectedDate].map((p) => (
                <li
                  key={p.id}
                  className={"row clickable" + (p.fait ? " done" : "")}
                  onClick={() => onCreateReport(p)}
                  title="Créer le rapport pour cette tâche"
                >
                  <button className={"check-circle" + (p.fait ? " checked" : "")} onClick={(e) => { e.stopPropagation(); onToggle(p.id); }}>
                    {p.fait && <Icon name="check" size={13} />}
                  </button>
                  <div className="grow">
                    <div className="row-title">{p.titre}</div>
                    <div className="row-sub">{p.client} {p.heure !== "—" && `· ${p.heure}`}{p.duree && ` · ${p.duree}`}</div>
                  </div>
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEditTaskForm(p); }} title="Modifier cette tâche">
                    <Icon name="edit" size={15} />
                  </button>
                  <span onClick={(e) => e.stopPropagation()}><DeleteButton onConfirm={() => onDelete(p.id)} label="" /></span>
                  <button className={"pill pill-clickable " + (p.rappel ? "pill-warm" : "pill-muted")} onClick={(e) => { e.stopPropagation(); onToggleRappel(p.id); }}>
                    <Icon name="bell" size={13} /> {p.rappel ? "Rappel actif" : "Sans rappel"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Aucune intervention prévue ce jour-là.</p>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------- Mini calendrier mensuel interactif (pastilles sur les jours avec intervention) ---------- */
function MiniCalendar({ dateCounts, selectedDate, onSelectDate }) {
  const todayIso = toLocalISODate(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  // Lundi = 0 ... Dimanche = 6
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const isoFor = (day) => {
    const mm = String(cursor.month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${cursor.year}-${mm}-${dd}`;
  };

  // Code couleur selon le nombre d'interventions du jour : 1 = bleu,
  // 2 = vert, 3 = jaune, 4 ou plus = rouge.
  const colorForCount = (count) => {
    if (count >= 4) return "red";
    if (count === 3) return "yellow";
    if (count === 2) return "green";
    return "blue";
  };

  // Tous les mardis et mercredis sont marqués comme journées DAIKIN.
  const isJourneeDaikin = (day) => {
    const dow = new Date(cursor.year, cursor.month, day).getDay(); // 0=dim ... 2=mar, 3=mer
    return dow === 2 || dow === 3;
  };

  const monthLabel = firstOfMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const prevMonth = () => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  const nextMonth = () => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));

  return (
    <div className="card mini-calendar">
      <div className="mini-calendar-header">
        <button type="button" className="icon-btn" onClick={prevMonth} title="Mois précédent">
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="mini-calendar-title">{monthLabel}</span>
        <button type="button" className="icon-btn" onClick={nextMonth} title="Mois suivant">
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
      <div className="mini-calendar-grid mini-calendar-weekdays">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="mini-calendar-weekday">{d}</div>
        ))}
      </div>
      <div className="mini-calendar-grid">
        {cells.map((day, i) => {
          if (day === null) return <div key={"b" + i} className="mini-calendar-cell empty" />;
          const iso = isoFor(day);
          const count = dateCounts[iso] || 0;
          const hasTask = count > 0;
          const isToday = iso === todayIso;
          return (
            <button
              type="button"
              key={iso}
              className={"mini-calendar-cell clickable-day" + (hasTask ? " has-task" : "") + (isToday ? " is-today" : "") + (iso === selectedDate ? " is-selected" : "")}
              onClick={() => onSelectDate(iso)}
              title={(isJourneeDaikin(day) ? "Journée DAIKIN — " : "") + (hasTask ? `${count} intervention${count > 1 ? "s" : ""} — voir le détail` : "Voir ce jour / ajouter une tâche")}
            >
              {isJourneeDaikin(day) && <span className="mini-calendar-daikin" />}
              {day}
              {hasTask && <span className={"mini-calendar-dot " + colorForCount(count)} />}
            </button>
          );
        })}
      </div>
      <div className="mini-calendar-legend">
        <span><span className="mini-calendar-dot blue" /> 1</span>
        <span><span className="mini-calendar-dot green" /> 2</span>
        <span><span className="mini-calendar-dot yellow" /> 3</span>
        <span><span className="mini-calendar-dot red" /> 4+</span>
        <span><span className="mini-calendar-daikin static" /> Mar/Mer (DAIKIN)</span>
      </div>
    </div>
  );
}

function TaskForm({ clients, onCancel, onSubmit, forceCategorie, hideRappelToggle, submitLabel, initialDate, editingTask }) {
  const [titre, setTitre] = useState(editingTask?.titre || "");
  const [client, setClient] = useState(editingTask?.client || "");
  const [date, setDate] = useState(editingTask?.date || initialDate || toLocalISODate(new Date()));
  const [heure, setHeure] = useState(editingTask?.heure && editingTask.heure !== "—" ? editingTask.heure : "09:00");
  const [duree, setDuree] = useState(editingTask?.duree || "1h");
  const [rappel, setRappel] = useState(editingTask ? !!editingTask.rappel : true);

  const submit = () => {
    if (!titre) return;
    onSubmit({
      id: editingTask?.id || ("p" + Date.now()),
      titre,
      client,
      date,
      heure,
      duree,
      rappel: hideRappelToggle ? true : rappel,
      fait: editingTask?.fait || false,
      categorie: editingTask?.categorie || forceCategorie || "intervention",
    });
  };

  return (
    <div className="card form-card">
      <div className="form-grid">
        <label>Intitulé<input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex : Entretien annuel" /></label>
        <label>Client
          <input
            list="planning-clients-datalist"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Rechercher un client existant, ou en taper un nouveau"
          />
          <datalist id="planning-clients-datalist">
            {clients.map((c) => <option key={c.id} value={c.nom} />)}
          </datalist>
        </label>
        <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Heure
          <select value={heure} onChange={(e) => setHeure(e.target.value)}>
            {["07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
              "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
              "17:00","17:30","18:00","18:30","19:00","19:30"].map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </label>
        <label>Durée
          <select value={duree} onChange={(e) => setDuree(e.target.value)}>
            <option value="30min">30 min</option>
            <option value="1h">1h</option>
            <option value="1h30">1h30</option>
            <option value="2h">2h</option>
            <option value="2h30">2h30</option>
            <option value="3h">3h</option>
            <option value="3h30">3h30</option>
            <option value="4h">4h</option>
            <option value="4h30">4h30</option>
            <option value="5h">5h</option>
            <option value="6h">6h</option>
            <option value="7h">7h</option>
            <option value="8h">Journée complète (8h)</option>
          </select>
        </label>
      </div>
      {!hideRappelToggle && (
        <label className="check-inline"><input type="checkbox" checked={rappel} onChange={(e) => setRappel(e.target.checked)} /> Activer un rappel</label>
      )}
      <div className="form-actions">
        <button className="btn-ghost" onClick={onCancel}>Annuler</button>
        <button className="btn-primary" onClick={submit}>{submitLabel || (editingTask ? "Enregistrer les modifications" : "Ajouter au planning")}</button>
      </div>
    </div>
  );
}

/* ---------- Devis ---------- */
/* ---------- Regroupement par mois (Devis / Facturation) ---------- */
function parseFrDate(str) {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

// Comme groupByMonth, mais avec un second niveau de regroupement par jour à
// l'intérieur de chaque mois (chaque mois "repart de zéro").
function groupByMonthAndDay(items, dateField) {
  const monthGroups = {};
  const sansDate = [];
  items.forEach((it) => {
    const d = parseFrDate(it[dateField]);
    if (!d) { sansDate.push(it); return; }
    const monthKey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const dayKey = monthKey + "-" + String(d.getDate()).padStart(2, "0");
    if (!monthGroups[monthKey]) monthGroups[monthKey] = { year: d.getFullYear(), month: d.getMonth(), days: {} };
    if (!monthGroups[monthKey].days[dayKey]) monthGroups[monthKey].days[dayKey] = { date: d, items: [] };
    monthGroups[monthKey].days[dayKey].items.push(it);
  });
  const monthKeys = Object.keys(monthGroups).sort().reverse();
  const result = monthKeys.map((mk) => {
    const g = monthGroups[mk];
    const dayKeys = Object.keys(g.days).sort().reverse();
    return {
      key: mk,
      label: monthLabel(g.year, g.month),
      days: dayKeys.map((dk) => {
        const dayLabelRaw = g.days[dk].date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        return {
          key: dk,
          label: dayLabelRaw.charAt(0).toUpperCase() + dayLabelRaw.slice(1),
          items: g.days[dk].items,
        };
      }),
    };
  });
  if (sansDate.length > 0) result.push({ key: "sans-date", label: "Sans date", days: [{ key: "sans-date-j", label: "", items: sansDate }] });
  return result;
}

function monthLabel(year, month) {
  const d = new Date(year, month, 1);
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupByMonth(items, dateField) {
  const groups = {};
  const sansDate = [];
  items.forEach((it) => {
    const d = parseFrDate(it[dateField]);
    if (!d) { sansDate.push(it); return; }
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    (groups[key] = groups[key] || { year: d.getFullYear(), month: d.getMonth(), items: [] }).items.push(it);
  });
  const sortedKeys = Object.keys(groups).sort();
  const result = sortedKeys.map((key) => ({
    key,
    label: monthLabel(groups[key].year, groups[key].month),
    items: groups[key].items,
  }));
  if (sansDate.length > 0) result.push({ key: "sans-date", label: "Sans date", items: sansDate });
  return result;
}

function MonthGroupedList({ items, dateField, renderItem, emptyLabel }) {
  const groups = groupByMonth(items, dateField);
  if (groups.length === 0) return <p className="empty">{emptyLabel}</p>;
  return (
    <>
      {groups.map((g) => (
        <div key={g.key} className="month-group">
          <h4 className="month-heading">{g.label}</h4>
          <ul className="list">{g.items.map(renderItem)}</ul>
        </div>
      ))}
    </>
  );
}

function Devis({ devisAFaire, devisEnCours, onCreated, onRelance, onValide, onOpenClient }) {
  return (
    <div>
      <header className="page-head">
        <h1>Devis</h1>
        <p>Devis à réaliser et devis en attente de réponse — cliquez une ligne pour voir le client</p>
      </header>

      <div className="grid-2">
        <section className="card">
          <h3>À faire — liés à une intervention</h3>
          <MonthGroupedList
            items={devisAFaire}
            dateField="date"
            emptyLabel="Aucun devis en attente de création."
            renderItem={(d) => (
              <li key={d.id} className="row clickable" onClick={() => onOpenClient(d.client)} title="Voir la fiche client">
                <div>
                  <div className="row-title">{d.client}</div>
                  <div className="row-sub">{d.origine}</div>
                </div>
                <button className="btn-small" onClick={(e) => { e.stopPropagation(); onCreated(d.id); }}>Marquer créé</button>
              </li>
            )}
          />
        </section>

        <section className="card">
          <h3>En cours — à relancer</h3>
          <MonthGroupedList
            items={devisEnCours}
            dateField="envoye"
            emptyLabel="Aucun devis en cours."
            renderItem={(d) => (
              <li key={d.id} className="row clickable" onClick={() => onOpenClient(d.client)} title="Voir la fiche client">
                <div>
                  <div className="row-title">{d.client} · {d.montant}</div>
                  <div className="row-sub">Envoyé le {d.envoye}</div>
                </div>
                <div className="devis-actions">
                  {d.statut === "relance_faite" ? (
                    <span className="pill pill-ok"><Icon name="check" size={13} /> Relancé</span>
                  ) : (
                    <button className={"pill pill-clickable " + (d.statut === "a_relancer" ? "pill-alert" : "pill-warm")} onClick={(e) => { e.stopPropagation(); onRelance(d.id); }}>
                      {d.statut === "a_relancer" ? "À relancer" : "Bientôt"}
                    </button>
                  )}
                  <button className="btn-small btn-valide" onClick={(e) => { e.stopPropagation(); onValide(d.id); }} title="Le devis est accepté par le client">
                    Validé
                  </button>
                </div>
              </li>
            )}
          />
        </section>
      </div>
    </div>
  );
}

/* ---------- Facturation ---------- */
function Facturation({ facturation, onFacturer, onPayer, onSyncPennylane, onRetryPennylane, onDeleteFacturation, onOpenClient }) {
  const aFacturer = facturation.filter((f) => !f.facture);
  const impayees = facturation.filter((f) => f.facture && !f.payee);
  const payees = facturation.filter((f) => f.facture && f.payee);

  return (
    <div>
      <header className="page-head">
        <h1>Facturation</h1>
        <p>Interventions terminées à facturer, factures impayées et payées — cliquez une ligne pour voir le client</p>
      </header>

      <section className="card">
        <h3>À facturer</h3>
        <MonthGroupedList
          items={aFacturer}
          dateField="date"
          emptyLabel="Tout est facturé."
          renderItem={(f) => (
            <li key={f.id} className="row clickable" onClick={() => onOpenClient(f.client)} title="Voir la fiche client">
              <div>
                <div className="row-title">{f.client} · {f.montant}</div>
                <div className="row-sub">
                  {f.intervention}
                  {f.pennylaneStatus === "erreur" && (
                    <span className="pill pill-alert pennylane-error-pill" title={f.pennylaneError}>
                      <Icon name="alert" size={11} /> Échec envoi Pennylane
                    </span>
                  )}
                </div>
              </div>
              <div className="row-actions">
                {!f.pennylaneInvoiceId && (
                  <button className="btn-ghost small" onClick={(e) => { e.stopPropagation(); onRetryPennylane(f.id); }} title="Retenter l'envoi automatique vers Pennylane">
                    <Icon name="sync" size={13} /> Réessayer Pennylane
                  </button>
                )}
                <button className="btn-small" onClick={(e) => { e.stopPropagation(); onFacturer(f.id); }}>Marquer facturé</button>
                <span className="row-delete-hover" onClick={(e) => e.stopPropagation()}><DeleteButton onConfirm={() => onDeleteFacturation(f.id)} label="" /></span>
              </div>
            </li>
          )}
        />
      </section>

      <section className="card">
        <h3>Facturées — impayées</h3>
        <MonthGroupedList
          items={impayees}
          dateField="date"
          emptyLabel="Aucune facture en attente de paiement."
          renderItem={(f) => (
            <li key={f.id} className="row clickable" onClick={() => onOpenClient(f.client)} title="Voir la fiche client">
              <div>
                <div className="row-title">{f.client} · {f.montant}</div>
                <div className="row-sub">
                  {f.intervention}
                  {f.pennylaneInvoiceId && <span className="pill pill-pennylane">Pennylane</span>}
                </div>
              </div>
              <div className="row-actions">
                {f.pennylaneInvoiceId && (
                  <button className="icon-btn" title="Vérifier le statut sur Pennylane" onClick={(e) => { e.stopPropagation(); onSyncPennylane(f.id); }}>
                    <Icon name="sync" size={14} />
                  </button>
                )}
                {!f.pennylaneInvoiceId && (
                  <button className="btn-ghost small" onClick={(e) => { e.stopPropagation(); onRetryPennylane(f.id); }} title="Retenter l'envoi automatique vers Pennylane">
                    <Icon name="sync" size={13} /> Réessayer Pennylane
                  </button>
                )}
                <button className="pill pill-clickable pill-alert" onClick={(e) => { e.stopPropagation(); onPayer(f.id); }}>Marquer payée</button>
                <span className="row-delete-hover" onClick={(e) => e.stopPropagation()}><DeleteButton onConfirm={() => onDeleteFacturation(f.id)} label="" /></span>
              </div>
            </li>
          )}
        />
      </section>

      {payees.length > 0 && (
        <section className="card">
          <h3>Facturées — payées</h3>
          <MonthGroupedList
            items={payees}
            dateField="date"
            emptyLabel=""
            renderItem={(f) => (
              <li key={f.id} className="row clickable" onClick={() => onOpenClient(f.client)} title="Voir la fiche client">
                <div>
                  <div className="row-title">{f.client} · {f.montant}</div>
                  <div className="row-sub">
                    {f.intervention}
                    {f.pennylaneInvoiceId && <span className="pill pill-pennylane">Pennylane</span>}
                  </div>
                </div>
                <div className="row-actions">
                  <span className="pill pill-ok"><Icon name="check" size={13} /> Payée</span>
                  <span className="row-delete-hover" onClick={(e) => e.stopPropagation()}><DeleteButton onConfirm={() => onDeleteFacturation(f.id)} label="" /></span>
                </div>
              </li>
            )}
          />
        </section>
      )}
    </div>
  );
}

/* ---------- Génération du document HTML pour l'aperçu PDF (nouvel onglet) ---------- */
// Calcule le statut de l'entretien contractuel annuel d'un client :
// - doneThisYear : un entretien a déjà été fait depuis l'échéance de l'an dernier
// - dueDate : échéance de CETTE année (même si elle est déjà passée — dans ce
//   cas, le statut reste "à faire" tant que l'entretien n'est pas réalisé,
//   il ne se réinitialise jamais tout seul en l'absence d'action)
// - isUrgent : on est à moins d'un mois de l'échéance (ou après, en retard) et ce n'est pas encore fait
function getEntretienStatus(client, reports) {
  if (!client.contrat) return null;
  const today = new Date();
  const mois = parseInt(client.moisEcheance, 10);
  const anneeEnCours = today.getFullYear();

  if (!mois || mois < 1 || mois > 12) {
    // Pas de mois d'échéance défini (ex : contrat tout juste ajouté, avant
    // d'avoir choisi le mois) : on ne signale jamais "à faire" dans ce cas,
    // pour éviter une fausse alerte immédiate — on invite juste à le renseigner.
    const rapportAnnee = reports.find((r) => {
      if (r.type !== "entretien" || r.client !== client.nom) return false;
      const parts = (r.date || "").split("/");
      return parts.length === 3 && parseInt(parts[2], 10) === anneeEnCours;
    });
    return { doneThisYear: !!rapportAnnee, rapportAnnee, dueDate: null, isUrgent: false, moisNonDefini: true, annee: anneeEnCours };
  }

  // Un client est considéré "nouveau" s'il n'a jamais eu le moindre rapport
  // d'entretien enregistré dans l'app — dans ce cas, on évite de viser une
  // échéance déjà dans le mois qui vient (ou déjà passée), pour ne pas
  // déclencher une alerte immédiate juste après la signature du contrat : on
  // la reporte alors à l'année suivante. Pour un client déjà suivi, l'échéance
  // reste toujours celle de l'année en cours, y compris si elle est dépassée
  // (le statut reste "à faire" tant que l'entretien n'est pas réalisé, il ne
  // se réinitialise jamais tout seul).
  const aDejaUnHistorique = reports.some((r) => r.type === "entretien" && r.client === client.nom);

  let anneeEcheance = anneeEnCours;
  if (!aDejaUnHistorique) {
    const dueDateTest = new Date(anneeEnCours, mois - 1, 1);
    const unMoisAvantTest = new Date(dueDateTest);
    unMoisAvantTest.setMonth(unMoisAvantTest.getMonth() - 1);
    if (today >= unMoisAvantTest) {
      anneeEcheance = anneeEnCours + 1;
    }
  }

  const dueDate = new Date(anneeEcheance, mois - 1, 1);

  const rapportAnnee = reports.find((r) => {
    if (r.type !== "entretien" || r.client !== client.nom) return false;
    const parts = (r.date || "").split("/");
    return parts.length === 3 && parseInt(parts[2], 10) === anneeEcheance;
  });
  const doneThisYear = !!rapportAnnee;

  const unMoisAvant = new Date(dueDate);
  unMoisAvant.setMonth(unMoisAvant.getMonth() - 1);
  const isUrgent = !doneThisYear && today >= unMoisAvant;
  const isOverdue = !doneThisYear && today > dueDate;

  return { doneThisYear, rapportAnnee, dueDate, isUrgent, isOverdue, annee: anneeEcheance };
}

// Formate une date en "YYYY-MM-DD" à partir de ses composants LOCAUX (jour,
// mois, année) — contrairement à toISOString() qui convertit en UTC et peut
// décaler la date d'un jour selon le fuseau horaire de l'utilisateur.
// Convertit une adresse en coordonnées (latitude/longitude) via l'API Adresse
// du gouvernement français (gratuite, sans clé, données officielles BAN).
// Retourne null si l'adresse est vide ou n'a pas pu être localisée.
async function geocodeAddress(adresse) {
  if (!adresse || !adresse.trim()) return null;
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.geometry.coordinates;
    return { lat, lng };
  } catch (_e) {
    return null;
  }
}

/* ---------- Carte interactive des secteurs clients (Leaflet, chargé via CDN) ---------- */
function ClientsMap({ clients, onUpdateClient, onOpenClient, entrepriseNom, entrepriseAdresse }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const [geocoding, setGeocoding] = useState(false);
  const geocodedOnce = useRef(false);
  const [companyCoords, setCompanyCoords] = useState(null);
  const companyGeocodedOnce = useRef(false);

  // Géocode une seule fois votre propre adresse d'entreprise, pour l'afficher
  // en repère rouge distinct sur la carte (repère visuel de distance).
  useEffect(() => {
    if (companyGeocodedOnce.current || !entrepriseAdresse || !entrepriseAdresse.trim()) return;
    companyGeocodedOnce.current = true;
    geocodeAddress(entrepriseAdresse).then((coords) => { if (coords) setCompanyCoords(coords); });
  }, [entrepriseAdresse]);

  // Géocode une fois (au premier affichage de la carte) tous les clients qui
  // ont une adresse mais pas encore de coordonnées enregistrées — puis les
  // sauvegarde sur la fiche client pour ne plus refaire cet appel ensuite.
  useEffect(() => {
    if (geocodedOnce.current) return;
    geocodedOnce.current = true;
    const aGeocoder = clients.filter((c) => c.adresse && c.adresse.trim() && (c.lat === undefined || c.lat === null));
    if (aGeocoder.length === 0) return;

    (async () => {
      setGeocoding(true);
      for (const c of aGeocoder) {
        const coords = await geocodeAddress(c.adresse);
        onUpdateClient({ ...c, lat: coords ? coords.lat : null, lng: coords ? coords.lng : null });
        // Petite pause pour rester respectueux de l'API publique et gratuite.
        await new Promise((r) => setTimeout(r, 200));
      }
      setGeocoding(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialise la carte une seule fois.
  useEffect(() => {
    if (!mapRef.current || mapInstance.current || !window.L) return;
    mapInstance.current = window.L.map(mapRef.current).setView([46.6, 2.4], 6); // Centre France
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapInstance.current);
    markersLayer.current = window.L.layerGroup().addTo(mapInstance.current);
  }, []);

  // Met à jour les marqueurs à chaque changement de la liste des clients géocodés.
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current || !window.L) return;
    markersLayer.current.clearLayers();
    const points = [];

    if (companyCoords) {
      const monIcone = window.L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
        shadowUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      const monMarqueur = window.L.marker([companyCoords.lat, companyCoords.lng], { icon: monIcone, zIndexOffset: 1000 }).addTo(markersLayer.current);
      monMarqueur.bindTooltip(`<div class="map-hover-card"><strong>${escapeHtml(entrepriseNom || "Mon entreprise")}</strong><br/>Votre adresse</div>`, { direction: "top", offset: [0, -40] });
      monMarqueur.bindPopup(`<strong>${escapeHtml(entrepriseNom || "Mon entreprise")}</strong><br/>Votre adresse`);
      points.push([companyCoords.lat, companyCoords.lng]);
    }

    clients.forEach((c) => {
      if (typeof c.lat === "number" && typeof c.lng === "number") {
        const nomAffiche = (c.raisonSociale && c.raisonSociale.trim()) ? c.raisonSociale : c.nom;
        const marker = window.L.marker([c.lat, c.lng]).addTo(markersLayer.current);
        marker.bindTooltip(
          `<div class="map-hover-card"><strong>${escapeHtml(nomAffiche)}</strong><br/>${escapeHtml(c.adresse || "Adresse non renseignée")}</div>`,
          { direction: "top", offset: [0, -34] }
        );
        marker.bindPopup(
          `<strong>${escapeHtml(nomAffiche)}</strong><br/>${escapeHtml(c.adresse || "")}<br/><a href="#" class="map-popup-link">Ouvrir la fiche</a>`
        );
        // On cible précisément la bulle de CE marqueur (via e.popup), plutôt
        // qu'une recherche globale dans la page qui pouvait, à tort, cibler
        // la bulle d'un autre client si plusieurs avaient déjà été ouvertes.
        marker.on("popupopen", (e) => {
          const el = e.popup.getElement();
          const link = el ? el.querySelector(".map-popup-link") : null;
          if (link) link.onclick = (ev) => { ev.preventDefault(); onOpenClient(c.nom); };
        });
        points.push([c.lat, c.lng]);
      }
    });
    if (points.length > 0) {
      mapInstance.current.fitBounds(points, { padding: [30, 30], maxZoom: 12 });
    }
  }, [clients, companyCoords]);

  const nonLocalises = clients.filter((c) => c.adresse && c.adresse.trim() && (c.lat === null));

  return (
    <section className="card">
      <div className="row-between">
        <h3>Carte des secteurs clients</h3>
        {geocoding && <span className="map-geocoding-note">Localisation des adresses en cours…</span>}
      </div>
      <div ref={mapRef} className="clients-map" />
      {nonLocalises.length > 0 && (
        <p className="map-warning">
          <Icon name="alert" size={13} /> {nonLocalises.length} adresse{nonLocalises.length > 1 ? "s" : ""} n'a{nonLocalises.length > 1 ? "ont" : ""} pas pu être localisée{nonLocalises.length > 1 ? "s" : ""} sur la carte (vérifiez leur orthographe dans la fiche client).
        </p>
      )}
    </section>
  );
}

function toLocalISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Les dates de rapport sont stockées au format français "JJ/MM/AAAA" partout
// dans l'app (facturation, échéances, PDF...). Ces deux fonctions permettent
// d'utiliser un vrai sélecteur <input type="date"> (qui exige du "AAAA-MM-JJ")
// sans rien changer au format de stockage existant.
function frToIso(fr) {
  const parts = (fr || "").split("/");
  if (parts.length !== 3) return "";
  const [j, m, a] = parts;
  return `${a}-${m.padStart(2, "0")}-${j.padStart(2, "0")}`;
}
function isoToFr(iso) {
  const parts = (iso || "").split("-");
  if (parts.length !== 3) return "";
  const [a, m, j] = parts;
  return `${j}/${m}/${a}`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, "<br/>");
}

function tableRowsToHtml(t) {
  const titre = t.nom ? `<h3 class="pdf-table-title">${escapeHtml(t.nom)}</h3>` : "";
  return `${titre}<table class="pdf-table"><tbody>${t.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function tablesAtHtml(tables, checklist, anchor) {
  const validIds = new Set((checklist || []).map((it) => it.id));
  const resolve = (t) => {
    const a = t.afterItemId || "__end__";
    if (a === "__start__" || a === "__end__") return a;
    return validIds.has(a) ? a : "__end__";
  };
  return (tables || []).filter((t) => resolve(t) === anchor).map(tableRowsToHtml).join("");
}

// Rend toutes les checklists du rapport (titre + lignes) avec les tableaux
// ancrés au bon endroit, quel que soit le format de stockage du rapport.
function checklistsToHtml(report) {
  const listes = normalizeChecklists(report);
  const flat = allChecklistItems(listes);
  let html = tablesAtHtml(report.tables, flat, "__start__");
  listes.forEach((cl) => {
    if (cl.nom) html += `<h3 class="pdf-checklist-title">${escapeHtml(cl.nom)}</h3>`;
    html += `<ul class="pdf-checklist">`;
    (cl.items || []).forEach((it) => {
      html += `<li><strong>${escapeHtml(it.label)}</strong> — ${it.checked ? "fait" : "non fait"}`;
      if (it.detail) html += `<div class="pdf-detail">${nl2br(it.detail)}</div>`;
      html += `</li>`;
      html += tablesAtHtml(report.tables, flat, it.id);
    });
    html += `</ul>`;
  });
  html += tablesAtHtml(report.tables, flat, "__end__");
  return html;
}

function checklistToHtml(items) {
  if (!items || items.length === 0) return "";
  return `<ul class="pdf-checklist">${items
    .map(
      (it) => `<li><strong>${escapeHtml(it.label)}</strong> — ${it.checked ? "fait" : "non fait"}${
        it.detail ? `<div class="pdf-detail">${nl2br(it.detail)}</div>` : ""
      }</li>`
    )
    .join("")}</ul>`;
}

function base64ToBlob(base64, mime) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mime });
}

function PdfFileModal({ base64, filename, title, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    const blob = base64ToBlob(base64, "application/pdf");
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [base64]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename || "document.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenTab = () => {
    if (!blobUrl) return;
    window.open(blobUrl, "_blank");
  };

  return (
    <div className="pdf-modal-overlay" onClick={onClose}>
      <div className="pdf-modal-box pdf-modal-box-compact" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-modal-toolbar">
          <span className="pdf-modal-title"><Icon name="report" size={16} /> {title || "Document PDF"}</span>
          <button className="btn-ghost small" onClick={onClose}>Fermer</button>
        </div>
        <div className="pdf-modal-fallback">
          <Icon name="report" size={32} />
          <p>{filename || "document.pdf"}</p>
          <p className="pdf-modal-hint">L'aperçu dans la fenêtre n'est pas fiable selon les navigateurs. Téléchargez ou ouvrez le fichier pour le remplir avec votre lecteur PDF habituel.</p>
          <div className="pdf-modal-fallback-actions">
            <button className="btn-primary" onClick={handleDownload} disabled={!blobUrl}>
              <Icon name="download" size={14} /> Télécharger le PDF
            </button>
            <button className="btn-ghost" onClick={handleOpenTab} disabled={!blobUrl}>
              Ouvrir dans un nouvel onglet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function PdfPreviewModal({ html, onClose }) {
  const iframeRef = useRef(null);

  const handlePrintClick = () => {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
  };

  return (
    <div className="pdf-modal-overlay" onClick={onClose}>
      <div className="pdf-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-modal-toolbar">
          <span className="pdf-modal-title"><Icon name="report" size={16} /> Aperçu du rapport</span>
          <div className="pdf-modal-actions">
            <button className="btn-ghost small" onClick={handlePrintClick}>
              <Icon name="download" size={14} /> Imprimer / Enregistrer en PDF
            </button>
            <button className="btn-ghost small" onClick={onClose}>Fermer</button>
          </div>
        </div>
        <iframe ref={iframeRef} title="Aperçu PDF du rapport" srcDoc={html} className="pdf-modal-iframe" />
      </div>
    </div>
  );
}

function buildReportHtml(report, settings) {
  const entreprise = settings?.entreprise || {};
  const hasLetterhead = entreprise.nom || entreprise.adresse || entreprise.codePostalVille || entreprise.telephone || entreprise.email || entreprise.siret || entreprise.logo;

  let body = "";

  if (hasLetterhead) {
    body += `<div class="pdf-letterhead">
      ${entreprise.logo ? `<img class="pdf-logo" src="${entreprise.logo}" alt="Logo" />` : ""}
      <div class="pdf-letterhead-text">
        ${entreprise.nom ? `<div class="pdf-company-name">${escapeHtml(entreprise.nom)}</div>` : ""}
        ${entreprise.adresse ? `<div>${escapeHtml(entreprise.adresse)}</div>` : ""}
        ${entreprise.codePostalVille ? `<div>${escapeHtml(entreprise.codePostalVille)}</div>` : ""}
        ${entreprise.telephone ? `<div>${escapeHtml(entreprise.telephone)}</div>` : ""}
        ${entreprise.email ? `<div>${escapeHtml(entreprise.email)}</div>` : ""}
        ${entreprise.siret ? `<div>SIRET : ${escapeHtml(entreprise.siret)}</div>` : ""}
        ${entreprise.attestationCapacite ? `<div>Attestation de capacité n° ${escapeHtml(entreprise.attestationCapacite)}</div>` : ""}
      </div>
    </div>`;
  }

  body += `<h1>${escapeHtml(labelType(report.type))}</h1>`;
  if (settings?.technicien?.nom) body += `<p><strong>Technicien :</strong> ${escapeHtml(settings.technicien.nom)}</p>`;
  body += `<p><strong>Client :</strong> ${escapeHtml(report.client)}</p>`;
  body += `<p><strong>Date :</strong> ${escapeHtml(report.date)}</p>`;
  body += `<p><strong>Installation :</strong> ${escapeHtml(report.installation)}</p>`;

  if (report.type === "mise_en_service") {
    if (report.intro) body += `<p class="pdf-field-label"><strong>Objet :</strong></p><div class="pdf-description">${report.intro}</div>`;
    if (report.descriptionLibre) body += `<p class="pdf-field-label"><strong>Description :</strong></p><div class="pdf-description">${report.descriptionLibre}</div>`;
    body += checklistsToHtml(report);
    if (report.conclusion) body += `<h3 class="pdf-section-title">Conclusion</h3><p class="pdf-texte-libre">${nl2br(report.conclusion)}</p>`;
    if (report.remarques) body += `<h3 class="pdf-section-title">Remarques</h3><p class="pdf-texte-libre">${nl2br(report.remarques)}</p>`;
    if (report.devisAEffectuer) body += `<p><strong>Devis à effectuer :</strong> ${escapeHtml(report.devisAEffectuer)}</p>`;
  } else if (report.type === "entretien") {
    if (report.intro) body += `<p class="pdf-field-label"><strong>Objet :</strong></p><div class="pdf-description">${report.intro}</div>`;
    if (report.descriptionLibre) body += `<p class="pdf-field-label"><strong>Description :</strong></p><div class="pdf-description">${report.descriptionLibre}</div>`;
    body += checklistsToHtml(report);
    if (report.conclusion) body += `<h3 class="pdf-section-title">Conclusion</h3><p class="pdf-texte-libre">${nl2br(report.conclusion)}</p>`;
    if (report.remarques) body += `<h3 class="pdf-section-title">Remarques</h3><p class="pdf-texte-libre">${nl2br(report.remarques)}</p>`;
    if (report.devisAEffectuer) body += `<p><strong>Devis à effectuer :</strong> ${escapeHtml(report.devisAEffectuer)}</p>`;
  } else {
    // Le contenu vient de l'éditeur riche interne (gras/italique/souligné), déjà en HTML de confiance.
    if (report.intro) body += `<p class="pdf-field-label"><strong>Objet :</strong></p><div class="pdf-description">${report.intro}</div>`;
    if (report.description) body += `<p class="pdf-field-label"><strong>Description :</strong></p><div class="pdf-description">${report.description}</div>`;
    if (report.pieces) body += `<p><strong>Pièces utilisées :</strong> ${escapeHtml(report.pieces)}</p>`;
    body += tablesAtHtml(report.tables, [], "__end__");
    if (report.conclusion) body += `<h3 class="pdf-section-title">Conclusion</h3><p class="pdf-texte-libre">${nl2br(report.conclusion)}</p>`;
    if (report.remarques) body += `<h3 class="pdf-section-title">Remarques</h3><p class="pdf-texte-libre">${nl2br(report.remarques)}</p>`;
    if (report.devisAEffectuer) body += `<p><strong>Devis à effectuer :</strong> ${escapeHtml(report.devisAEffectuer)}</p>`;
  }

  if (report.signatureTech || report.signatureClient) {
    body += `<div class="pdf-signatures">
      <div><strong>Signature technicien</strong><br/>${report.signatureTech ? `<img class="pdf-sig" src="${report.signatureTech}" />` : "Non signée"}</div>
      <div><strong>Signature client</strong><br/>${report.signatureClient ? `<img class="pdf-sig" src="${report.signatureClient}" />` : "Non signée"}</div>
    </div>`;
  }

  if (entreprise.clausePied && entreprise.clausePied.trim()) {
    body += `<div class="pdf-footer-clause">${nl2br(entreprise.clausePied.trim())}</div>`;
  }

  if (report.photos && report.photos.length > 0) {
    body += `<div class="pdf-photo-annex">
      <h2 class="pdf-annex-title">Annexe — Photos de l'intervention</h2>
      <div class="pdf-photos-grid">
        ${report.photos.map((src) => `<div class="pdf-photo-item"><img src="${src}" /></div>`).join("")}
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(labelType(report.type))} — ${escapeHtml(report.client)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; color: #1B2733; margin: 0; background: #EEF2F1; }
  .pdf-toolbar { position: sticky; top: 0; background: #fff; padding: 14px 24px; border-bottom: 1px solid #D7DEDD; display: flex; justify-content: flex-end; z-index: 10; }
  .pdf-toolbar button { display: inline-flex; align-items: center; gap: 6px; background: #2F6FA3; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; }
  .pdf-toolbar button:hover { background: #285f8c; }
  .pdf-page { max-width: 760px; margin: 30px auto; background: #fff; padding: 48px; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  h1 { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 700; margin: 0 0 12px; }
  p { font-size: 14px; line-height: 1.55; margin: 0 0 10px; }
  .pdf-field-label { margin: 10px 0 2px; }
  .pdf-letterhead { display: flex; align-items: center; gap: 24px; margin-bottom: 30px; padding-bottom: 28px; border-bottom: 2px solid #1B2733; font-size: 12.5px; color: #4A5860; }
  .pdf-logo { width: 230px; height: 180px; object-fit: contain; object-position: left center; border-radius: 8px; flex-shrink: 0; }
  .pdf-letterhead-text { flex: 1; }
  .pdf-company-name { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; color: #1B2733; margin-bottom: 2px; }
  .pdf-checklist-title { font-family: 'Barlow Condensed', sans-serif; font-size: 17px; font-weight: 700; color: #1B2733; margin: 18px 0 2px; text-decoration: underline; text-underline-offset: 3px; }
  .pdf-checklist { list-style: none; padding: 0; margin: 14px 0; }
  .pdf-checklist li { margin-bottom: 10px; font-size: 14px; }
  .pdf-checklist strong { }
  .pdf-detail { font-size: 12.5px; color: #6D7A80; white-space: pre-wrap; margin-top: 2px; }
  .pdf-section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; color: #1B2733; margin: 18px 0 4px; text-decoration: underline; text-underline-offset: 3px; }
  .pdf-texte-libre { white-space: pre-wrap; }
  .pdf-table-title { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; color: #1B2733; margin: 16px 0 -4px; text-decoration: underline; text-underline-offset: 3px; }
  .pdf-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; border: 1px solid #C7D0CE; }
  .pdf-table td { border: 1px solid #C7D0CE; padding: 7px 9px; }
  .pdf-description strong { font-weight: 700; }
  .pdf-description u { text-decoration: underline; }
  .pdf-description em { font-style: italic; }
  .pdf-photo-annex { page-break-before: always; padding-top: 8px; }
  .pdf-annex-title { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 700; color: #1B2733; margin-bottom: 18px; }
  .pdf-photos-grid { display: block; }
  .pdf-photo-item { break-inside: avoid; margin-bottom: 20px; }
  .pdf-photo-item:nth-child(2n) { page-break-after: always; margin-bottom: 0; }
  .pdf-photo-item img { width: 100%; height: 430px; object-fit: contain; background: #F4F6F5; border-radius: 8px; border: 1px solid #D7DEDD; display: block; }
  .pdf-signatures { display: flex; gap: 40px; margin-top: 34px; padding-top: 18px; border-top: 1px solid #EAEDEC; }
  .pdf-sig { max-width: 210px; max-height: 85px; display: block; margin-top: 6px; }
  .pdf-footer-clause { margin-top: 28px; padding-top: 14px; border-top: 1px solid #EAEDEC; font-size: 11px; line-height: 1.5; color: #8A959A; white-space: pre-wrap; }
  @media print {
    .pdf-toolbar { display: none; }
    body { background: #fff; }
    .pdf-page { box-shadow: none; margin: 0; max-width: 100%; padding: 0; }
  }
</style>
</head>
<body>
  <div class="pdf-toolbar"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>
  <div class="pdf-page">${body}</div>
</body>
</html>`;
}

/* ---------- CSS ---------- */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; }
.app {
  display: flex;
  min-height: 100vh;
  background: #EEF2F1;
  font-family: 'Inter', -apple-system, sans-serif;
  color: #1B2733;
}

.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #1B2733;
  color: #E7ECEB;
  display: flex;
  flex-direction: column;
  padding: 20px 14px;
}
.brand { display: flex; align-items: center; gap: 10px; padding: 4px 6px 22px; }
.brand-mark {
  width: 36px; height: 36px; border-radius: 8px;
  background: linear-gradient(135deg, #2F6FA3, #D9762B);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 15px; color: white;
}
.brand-name { font-family: 'Barlow Condensed', sans-serif; font-weight: 600; font-size: 17px; letter-spacing: 0.3px; }
.brand-sub { font-size: 11px; color: #8FA0A8; margin-top: -1px; }

nav { display: flex; flex-direction: column; gap: 2px; }
.navbtn {
  display: flex; align-items: center; gap: 10px;
  background: transparent; border: none; color: #B8C4C7;
  padding: 10px 12px; border-radius: 7px; font-size: 14px; font-weight: 500;
  cursor: pointer; text-align: left; transition: background 0.15s, color 0.15s; position: relative;
}
.navbtn:hover { background: #263341; color: #fff; }
.navbtn.active { background: #2F6FA3; color: #fff; }
.nav-badge { margin-left: auto; background: #D9762B; color: #fff; font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 10px; }
.sidebar-foot { margin-top: auto; font-size: 11px; color: #5E7078; padding: 10px 6px 0; }
.logout-link { background: none; border: none; color: #8FA0A8; font-size: 11px; text-decoration: underline; cursor: pointer; padding: 0; margin-top: 6px; }
.logout-link:hover { color: #fff; }

.app-loading { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #EEF2F1; }
.app-loading-box { display: flex; flex-direction: column; align-items: center; gap: 14px; color: #6D7A80; font-family: 'Inter', sans-serif; font-size: 14px; }
.app-loading-box .brand-mark { width: 48px; height: 48px; font-size: 18px; }

.main { flex: 1; padding: 32px 40px; max-width: 1100px; min-width: 0; }

.mobile-topbar { display: none; }
.mobile-menu-btn, .mobile-close-btn { background: transparent; border: none; color: inherit; cursor: pointer; padding: 4px; display: flex; }
.mobile-close-btn { margin-left: auto; }
.mobile-nav-overlay { display: none; }

.page-head { margin-bottom: 22px; }
.header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.clients-map { width: 100%; height: 480px; border-radius: 10px; margin-top: 12px; z-index: 1; }
.map-geocoding-note { font-size: 12.5px; color: #6C7A80; font-style: italic; }
.map-warning { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #B45F1D; margin-top: 10px; }
.map-popup-link { color: #2F6FA3; font-weight: 600; }
.map-hover-card { font-size: 12.5px; line-height: 1.4; }
.page-head h1 { font-family: 'Barlow Condensed', sans-serif; font-size: 30px; font-weight: 700; margin: 0 0 4px; letter-spacing: 0.2px; }
.page-head p { margin: 0; color: #5E7078; font-size: 14px; }
.row-between { display: flex; justify-content: space-between; align-items: flex-end; }

.gauges { display: flex; gap: 20px; margin-bottom: 26px; flex-wrap: wrap; }
.monthly-recap-grid { display: flex; gap: 16px; flex-wrap: wrap; }
.monthly-recap-item { flex: 1; min-width: 130px; text-align: center; padding: 16px 10px; background: #F4F6F5; border-radius: 10px; }
.monthly-recap-value { font-family: 'Barlow Condensed', sans-serif; font-size: 34px; font-weight: 700; color: #1B2733; line-height: 1; }
.monthly-recap-label { font-size: 12.5px; color: #5E7078; margin-top: 4px; }
.jauge { background: #fff; border: 1px solid #D7DEDD; border-radius: 12px; padding: 14px 20px 16px; flex: 1; min-width: 140px; text-align: center; }
.jauge-clickable { cursor: pointer; transition: border-color 0.15s, transform 0.1s; }
.jauge-clickable:hover { border-color: #2F6FA3; }
.jauge-clickable:active { transform: scale(0.98); }
.jauge-val { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 700; margin-top: -6px; }
.jauge-label { font-size: 12.5px; color: #5E7078; margin-top: 2px; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

.card { background: #fff; border: 1px solid #D7DEDD; border-radius: 12px; padding: 20px 22px; margin-bottom: 20px; }
.card h3 { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 600; margin: 0 0 14px; }
.card h4 { font-size: 13px; font-weight: 600; margin: 0 0 8px; color: #4A5860; text-transform: uppercase; letter-spacing: 0.4px; }
.month-group { margin-bottom: 18px; }
.month-group:last-child { margin-bottom: 0; }
.month-heading { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 600; color: #2F6FA3; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1px solid #EAEDEC; text-transform: none; letter-spacing: 0; }
.report-month-group { margin-bottom: 28px; }
.report-month-title { font-family: 'Barlow Condensed', sans-serif; font-size: 24px; font-weight: 700; color: #1B2733; margin: 0 0 14px; padding-bottom: 6px; border-bottom: 2px solid #1B2733; }
.report-day-group { margin-bottom: 16px; }
.report-day-title { font-size: 13px; font-weight: 600; color: #5E7078; text-transform: capitalize; margin: 0 0 8px; }
.mt { margin-top: 18px; }

.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.row { display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-radius: 8px; }
.row.clickable { cursor: pointer; }
.row.clickable:hover { background: #F3F6F5; }
.row.selected { background: #EAF1F7; }
.row.done .row-title { text-decoration: line-through; color: #97A3A7; }
.row-title { font-size: 14.5px; font-weight: 600; }
.report-tech { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: #2F6FA3; margin-bottom: 3px; }
.form-technicien { margin-bottom: 14px; }
.row-sub { font-size: 12.5px; color: #6D7A80; margin-top: 1px; }
.grow { flex: 1; }

.pill { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; padding: 4px 9px; border-radius: 20px; border: none; white-space: nowrap; }
.pill-cold { background: #E3EEF6; color: #2F6FA3; }
.pill-warm { background: #FBEADB; color: #B45F1D; }
.pill-ok { background: #E2F1E7; color: #2E7048; }
.pill-alert { background: #FBE3E1; color: #B33128; }
.pill-pennylane { background: #E9F0FB; color: #2F6FA3; font-size: 11px; margin-left: 8px; padding: 2px 8px; }
.pennylane-error-pill { margin-left: 8px; font-size: 11px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px; cursor: help; }
.row-actions { display: flex; align-items: center; gap: 8px; }
.row-delete-hover { margin-left: auto; opacity: 0; transition: opacity 0.15s ease; flex-shrink: 0; }
.row:hover .row-delete-hover { opacity: 1; }
.pill-muted { background: #EDEFEE; color: #7C878B; }
.pill-clickable { cursor: pointer; }

.check-circle {
  width: 22px; height: 22px; border-radius: 50%; border: 2px solid #C6D0D0; background: #fff;
  display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; color: white;
}
.check-circle.checked { background: #3F8F5F; border-color: #3F8F5F; }
.check-circle.small { width: 20px; height: 20px; }

.btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  background: #2F6FA3; color: #fff; border: none; padding: 10px 16px;
  border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-primary:hover { background: #285f8c; }
.btn-primary.small { padding: 6px 12px; font-size: 12.5px; margin-top: 8px; margin-right: 8px; }
.report-card-valide { border-left: 3px solid #3F8F5F; }
.btn-ghost { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: 1px solid #D7DEDD; padding: 9px 15px; border-radius: 8px; font-size: 14px; cursor: pointer; color: #4A5860; }
.btn-ghost.small { padding: 6px 12px; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; margin-right: 8px; }
.btn-small { background: #1B2733; color: #fff; border: none; padding: 7px 12px; border-radius: 7px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.devis-actions { display: flex; align-items: center; gap: 8px; }
.btn-valide { background: #3F8F5F; }
.btn-valide:hover { background: #357a51; }
.icon-btn { background: transparent; border: none; color: #B3413A; cursor: pointer; padding: 6px; flex-shrink: 0; }

.mini-calendar { margin-bottom: 20px; max-width: 300px; padding: 14px; }
.mini-calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.mini-calendar-header .icon-btn { color: #2F6FA3; padding: 3px; }
.mini-calendar-title { font-family: 'Barlow Condensed', sans-serif; font-weight: 600; font-size: 14.5px; color: #1B2733; text-transform: capitalize; }
.mini-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.mini-calendar-weekdays { margin-bottom: 2px; }
.mini-calendar-weekday { text-align: center; font-size: 9.5px; font-weight: 600; color: #8A959A; text-transform: uppercase; padding: 2px 0; }
.mini-calendar-cell { position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border: none; background: transparent; border-radius: 6px; font-size: 11.5px; color: #4A5860; cursor: default; }
.mini-calendar-cell.clickable-day { cursor: pointer; }
.mini-calendar-cell.clickable-day:hover { background: #EEF1F0; }
.mini-calendar-cell.empty { visibility: hidden; }
.mini-calendar-cell.is-today { font-weight: 700; color: #1B2733; box-shadow: inset 0 0 0 1.5px #2F6FA3; }
.mini-calendar-cell.has-task { cursor: pointer; background: #EAF1F7; color: #1B2733; font-weight: 600; }
.mini-calendar-cell.has-task:hover { background: #D9E6F0; }
.mini-calendar-cell.is-selected { background: #2F6FA3; color: #fff; }
.mini-calendar-dot { position: absolute; bottom: 2px; width: 4px; height: 4px; border-radius: 50%; background: #D9762B; }
.mini-calendar-dot.blue { background: #2F6FA3; }
.mini-calendar-dot.green { background: #3F8F5F; }
.mini-calendar-dot.yellow { background: #D9A62B; }
.mini-calendar-dot.red { background: #C0392B; }
.mini-calendar-cell.is-selected .mini-calendar-dot { box-shadow: 0 0 0 1.5px #fff; }
.mini-calendar-daikin { position: absolute; top: 3px; right: 4px; width: 5px; height: 5px; border-radius: 50%; background: #2F6FA3; }
.mini-calendar-daikin.static { position: static; }
.mini-calendar-cell.is-selected .mini-calendar-daikin { box-shadow: 0 0 0 1.5px #fff; }
.mini-calendar-legend { display: flex; gap: 12px; justify-content: center; margin-top: 10px; font-size: 10.5px; color: #6C7A80; flex-wrap: wrap; }
.mini-calendar-legend span { display: inline-flex; align-items: center; gap: 4px; }
.mini-calendar-legend .mini-calendar-dot { position: static; }
.planning-day-flash { animation: planningFlash 1.4s ease; }
@keyframes planningFlash {
  0% { box-shadow: 0 0 0 3px #2F6FA3; }
  100% { box-shadow: 0 0 0 0px transparent; }
}

.filters { display: flex; gap: 8px; margin-bottom: 16px; }
.filter-btn { background: #fff; border: 1px solid #D7DEDD; padding: 7px 13px; border-radius: 20px; font-size: 13px; cursor: pointer; color: #4A5860; }
.filter-btn.active { background: #1B2733; color: #fff; border-color: #1B2733; }

.report-card-head { display: flex; align-items: center; gap: 12px; cursor: pointer; }
.report-card-title { flex: 1; }
.chevron { font-size: 20px; color: #97A3A7; width: 20px; text-align: center; }
.report-card-body { margin-top: 16px; padding-top: 16px; border-top: 1px solid #EAEDEC; }
.report-card-actions { display: flex; justify-content: flex-end; margin-bottom: 10px; }
.report-view-tabs { display: flex; gap: 4px; border-bottom: 1px solid #E4E9E8; margin-bottom: 16px; }
.report-view-tab { background: transparent; border: none; border-bottom: 2px solid transparent; padding: 8px 4px; margin-right: 18px; font-size: 13.5px; font-weight: 600; color: #6C7A80; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.report-view-tab.active { color: #2F6FA3; border-bottom-color: #2F6FA3; }
.report-pdf-preview { width: 100%; height: 720px; border: 1px solid #E4E9E8; border-radius: 8px; background: #fff; }
.remarque { font-size: 13.5px; color: #3D484D; line-height: 1.5; background: #F6F8F7; padding: 10px 12px; border-radius: 8px; }
.rte-render strong { font-weight: 700; }
.rte-render u { text-decoration: underline; }
.rte-render em { font-style: italic; }

.section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 600; color: #2F6FA3; margin: 14px 0 4px; text-decoration: underline; text-underline-offset: 3px; }
.texte-libre { white-space: pre-wrap; }
.mini-table-block { margin-bottom: 12px; }
.mini-table-title { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 600; color: #2F6FA3; margin-bottom: 3px; text-decoration: underline; text-underline-offset: 3px; }
.mini-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px; }
.mini-table td, .mini-table th { padding: 6px 8px; border-bottom: 1px solid #EEF1F0; text-align: left; }
.mini-table td:first-child, .mini-table th:first-child { color: #6D7A80; }
.mini-table th { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.3px; color: #8A959A; }

.machine-block { margin-bottom: 16px; padding: 12px; border: 1px solid #E4E9E8; border-radius: 8px; }
.machine-section-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; background: transparent; border: none; padding: 0; cursor: pointer; color: #1B2733; }
.machine-title { font-size: 13.5px; font-weight: 600; margin-bottom: 6px; color: #1B2733; }
.machine-date { font-weight: 400; color: #6D7A80; }
.machine-editor-card { background: #F9FBFC; border-color: #E1E6E5; margin-bottom: 12px; }
.machine-editor-card .machine-section-toggle { font-size: 14px; font-weight: 600; }
.machine-editor-card .machine-editor { margin-top: 14px; }
.unit-block { padding: 12px; background: #fff; border: 1px solid #E4E9E8; border-radius: 8px; margin-bottom: 10px; }

.client-detail-actions { display: flex; gap: 8px; }
.fiche-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px 22px; margin: 14px 0 4px; }
.fiche-item { display: flex; flex-direction: column; gap: 2px; padding-bottom: 8px; border-bottom: 1px solid #EEF1F0; }
.fiche-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: #8A959A; }
.fiche-value { font-size: 14px; color: #1B2733; word-break: break-word; }
.fiche-value.vide { color: #A2ACAF; font-style: italic; }
.client-raison-sociale { font-size: 13px; color: #6C7A80; margin-top: 2px; }
.entretien-annuel-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 8px; margin: 10px 0; }
.entretien-annuel-badge.ok { background: #E3F1E8; color: #2E6B45; }
.entretien-annuel-badge.todo { background: #FBEADB; color: #B45F1D; }
.entretien-annuel-badge.neutral { background: #EEF1F0; color: #5E7078; }
.entretien-annuel-badge.late { background: #FBE3E1; color: #B33128; }
.contrat-dot.late { background: #C0392B; }
.contrat-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 8px; vertical-align: middle; }
.contrat-dot.ok { background: #3F8F5F; }
.contrat-dot.todo { background: #D9762B; }
.contrat-dot.neutral { background: #B7C1C3; }
.btn-contrat { border-color: #2F6FA3; color: #2F6FA3; }
.btn-danger { border-color: #D9776C; color: #B33128; }
.btn-danger:hover { background: #FBE3E1; }
.delete-confirm-group { display: inline-flex; gap: 6px; align-items: center; }
.btn-danger-solid { background: #B33128; color: #fff; border: none; }
.btn-danger-solid:hover { background: #942920; }
.contract-box { background: #F6F8F7; border: 1px solid #E1E6E5; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
.contract-templates { display: flex; gap: 8px; flex-wrap: wrap; }
.contract-templates-group { display: flex; flex-direction: column; gap: 6px; }
.contract-templates-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: #8A959A; }
.btn-b2b { border-color: #D9762B; color: #B45F1D; }
.btn-b2b:hover { background: #FBEADB; }
.contract-import { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.contract-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #2E7048; background: #E2F1E7; padding: 5px 10px; border-radius: 20px; }
.contract-view-link { background: none; border: none; color: #2F6FA3; text-decoration: underline; font-size: 12.5px; cursor: pointer; padding: 0; margin-left: 4px; }
.machine-photos { display: flex; gap: 16px; margin-top: 10px; flex-wrap: wrap; }
.machine-photo-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.machine-photo-item img { width: 110px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid #D7DEDD; }
.machine-photo-item span { font-size: 11px; color: #6D7A80; }

.single-photo-field { margin-bottom: 16px; }
.single-photo-preview { position: relative; display: inline-block; }
.single-photo-preview img { width: 140px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid #D7DEDD; display: block; }
.single-photo-preview .icon-btn { position: absolute; top: 4px; right: 4px; background: rgba(255,255,255,0.9); border-radius: 50%; padding: 4px; }

.checklist-view { margin: 0 0 12px; display: flex; flex-direction: column; gap: 8px; }
.cl-row { display: flex; align-items: flex-start; gap: 10px; }
.check-dot { width: 18px; height: 18px; border-radius: 50%; background: #3F8F5F; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
.cl-row.ko .check-dot { background: #D7DEDD; }
.cl-label { font-size: 13.5px; font-weight: 700; }
.cl-detail { font-size: 12.5px; color: #6D7A80; margin-top: 1px; white-space: pre-wrap; }
.print-detail { white-space: pre-wrap; font-size: 12.5px; margin: 2px 0 4px 0; }
.table-position { margin-bottom: 10px; }
.table-position select { width: auto; min-width: 220px; }

.checklist-group-title { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 600; color: #2F6FA3; margin: 6px 0 2px; text-decoration: underline; text-underline-offset: 3px; }
.checklist-block { background: #F6F8F7; border: 1px solid #E1E6E5; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.checklist-block-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.checklist-block-title { flex: 1; font-weight: 600; font-size: 13.5px; }
.checklist-edit { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; margin-bottom: 8px; }
.checklist-row { display: flex; align-items: center; gap: 8px; }
.checklist-status-select { width: auto; min-width: 100px; flex-shrink: 0; font-weight: 600; font-size: 12.5px; padding: 6px 8px; border-radius: 6px; }
.checklist-inputs { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.checklist-inputs input { width: 100%; }

.table-editor { margin-bottom: 14px; padding: 12px; background: #F6F8F7; border-radius: 8px; }
.table-insert-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.table-template-select { width: auto; min-width: 220px; }
.checklist-header-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.checklist-header-row label.block { margin-bottom: 0; }
.checklist-tpl-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.checklist-tpl-row input { flex: 1; }
.editable-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.editable-table td { padding: 3px; }
.editable-table input { width: 100%; font-size: 13px; padding: 6px 8px; }
.table-row-actions { width: 30px; }
.table-actions { display: flex; gap: 4px; }

.rte { border: 1px solid #D7DEDD; border-radius: 8px; overflow: hidden; background: #fff; }
.rte-toolbar { display: flex; align-items: center; gap: 2px; padding: 6px 8px; background: #F6F8F7; border-bottom: 1px solid #EAEDEC; }
.rte-toolbar button { min-width: 28px; width: 28px; height: 28px; border: none; background: #fff; border-radius: 5px; cursor: pointer; font-size: 13px; color: #1B2733; border: 1px solid #E1E6E5; }
.rte-toolbar button:hover { background: #EAF1F7; border-color: #2F6FA3; }
.rte-toolbar button.active { border-color: #2F6FA3; background: #EAF1F7; color: #2F6FA3; box-shadow: inset 0 0 0 1px #2F6FA3; }
.rte-sep { width: 1px; height: 20px; background: #D7DEDD; margin: 0 4px; }
.rte-content { padding: 10px 12px; font-size: 14px; line-height: 1.5; outline: none; }
.rte-content:empty:before { content: attr(data-placeholder); color: #A2ACAF; }
.rte-content ul, .rte-render ul, .pdf-description ul { margin: 4px 0 4px 20px; padding: 0; }
.rte-content ul ul, .rte-render ul ul, .pdf-description ul ul { list-style-type: circle; }
.rte-content ul ul ul, .rte-render ul ul ul, .pdf-description ul ul ul { list-style-type: square; }

.field-block { display: flex; flex-direction: column; gap: 5px; }
.field-caption { font-size: 12.5px; font-weight: 600; color: #4A5860; }
.mb-lg { margin-bottom: 30px; }

.photo-strip { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.photo-strip img { width: 84px; height: 84px; object-fit: cover; border-radius: 8px; border: 1px solid #D7DEDD; }

.devis-note { display: flex; gap: 10px; background: #FBEADB; color: #8A4A15; padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-top: 8px; }
.devis-note svg { flex-shrink: 0; margin-top: 2px; }

.hint-inline { font-weight: 400; font-size: 12px; opacity: 0.8; }

.signatures-edit { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 4px; }
.signature-block { display: flex; flex-direction: column; gap: 6px; }
.signature-label { font-size: 12.5px; font-weight: 600; color: #4A5860; }
.signature-canvas { border: 1.5px dashed #C6D0D0; border-radius: 8px; background: #fff; touch-action: none; cursor: crosshair; width: 260px; height: 100px; }

.signatures-view { display: flex; gap: 30px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #EAEDEC; flex-wrap: wrap; }
.sig-col { flex: 1; min-width: 180px; }
.sig-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: #8A959A; margin-bottom: 6px; }
.sig-img { max-width: 220px; max-height: 90px; border: 1px solid #D7DEDD; border-radius: 6px; background: #fff; }
.sig-empty { font-size: 12.5px; color: #A2ACAF; font-style: italic; }

.print-signatures { display: flex; gap: 40px; margin-top: 30px; }
.sig-img-print { max-width: 200px; max-height: 80px; display: block; margin-top: 4px; }

.form-card { border: 1px solid #2F6FA3; background: #F9FBFC; }
.type-toggle { display: flex; gap: 8px; margin-bottom: 18px; }
.toggle-btn { flex: 1; background: #fff; border: 1px solid #D7DEDD; padding: 9px; border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 500; }
.toggle-btn.active { background: #2F6FA3; color: #fff; border-color: #2F6FA3; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.form-grid.three { grid-template-columns: 1fr 1fr 1fr; }
label { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: #4A5860; }
.block { margin-bottom: 14px; }
input, select, textarea {
  font-family: inherit; font-size: 14px; font-weight: 400; color: #1B2733;
  border: 1px solid #D7DEDD; border-radius: 7px; padding: 9px 10px; background: #fff;
}
textarea { resize: vertical; }
.description-textarea { min-height: 110px; resize: vertical; }
.description-view p { white-space: pre-wrap; margin: 4px 0 0; }
.check-inline { flex-direction: row; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 14px; }
.check-inline input { width: auto; }
.hint { font-size: 11.5px; font-weight: 400; color: #8A959A; margin-top: 2px; }

.photo-upload {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  border: 1.5px dashed #C6D0D0; border-radius: 8px; padding: 14px; cursor: pointer;
  font-size: 13px; color: #5E7078; background: #fff;
}
.photo-upload:hover { border-color: #2F6FA3; color: #2F6FA3; }

.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }

.detail-line { font-size: 13.5px; color: #4A5860; margin-bottom: 3px; }
.empty { font-size: 13px; color: #97A3A7; font-style: italic; }

.pdf-modal-overlay {
  position: fixed; inset: 0; background: rgba(27, 39, 51, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 24px;
}
.pdf-modal-box {
  background: #fff; border-radius: 12px; width: 100%; max-width: 900px; height: 90vh;
  display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.25);
}
.pdf-modal-box-compact { height: auto; max-width: 460px; }
.pdf-modal-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #D7DEDD; flex-shrink: 0; }
.pdf-modal-title { display: inline-flex; align-items: center; gap: 8px; font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 600; color: #1B2733; }
.pdf-modal-actions { display: flex; gap: 8px; }
.pdf-modal-iframe { flex: 1; border: none; width: 100%; background: #EEF2F1; }
.pdf-modal-fallback { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #6D7A80; background: #fff; padding: 32px 28px; text-align: center; }
.pdf-modal-fallback p { font-size: 14px; max-width: 360px; margin: 0; color: #1B2733; font-weight: 600; }
.pdf-modal-hint { font-size: 12.5px !important; font-weight: 400 !important; color: #6D7A80 !important; }
.pdf-modal-fallback-actions { display: flex; gap: 10px; margin-top: 8px; }

.print-only { display: none; }
.print-letterhead { margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #1B2733; font-size: 12.5px; color: #4A5860; }
.print-company-name { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; color: #1B2733; margin-bottom: 2px; }
.print-checklist { padding-left: 18px; }
@media print {
  body * { visibility: hidden; }
  .print-only, .print-only * { visibility: visible; }
  .print-only { position: absolute; left: 0; top: 0; width: 100%; display: block; padding: 20px; font-family: 'Inter', sans-serif; }
  .print-only h1 { font-family: 'Barlow Condensed', sans-serif; }
}

@media (max-width: 860px) {
  .grid-2 { grid-template-columns: 1fr; }
  .form-grid, .form-grid.three { grid-template-columns: 1fr; }
  .checklist-inputs { grid-template-columns: 1fr; }
  .gauges { flex-direction: column; }
}

.mobile-nav-overlay {
  position: fixed; inset: 0; background: rgba(15, 22, 28, 0.55);
  z-index: 60;
}

@media (max-width: 780px) {
  .row-delete-hover { opacity: 1; }
  .mobile-topbar {
    display: flex; align-items: center; gap: 12px;
    position: sticky; top: 0; z-index: 30;
    background: #1B2733; color: #E7ECEB;
    padding: 12px 16px;
  }
  .mobile-topbar .brand { padding: 0; gap: 8px; }
  .mobile-topbar .brand-mark { width: 30px; height: 30px; font-size: 13px; }
  .mobile-topbar .brand-name { font-size: 15px; }

  .app { flex-direction: column; min-height: 100vh; }

  .sidebar {
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 70;
    width: 78vw; max-width: 300px;
    transform: translateX(-100%);
    transition: transform 0.22s ease;
    box-shadow: 2px 0 18px rgba(0,0,0,0.25);
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar .mobile-close-btn { display: flex; }
  .sidebar .brand { position: relative; }

  .main { padding: 18px 14px 90px; max-width: 100%; }

  .page-head { flex-direction: column; align-items: flex-start; gap: 12px; }
  .page-head.row-between .btn-primary { width: 100%; justify-content: center; }

  .card { padding: 16px; }

  .row { flex-wrap: wrap; row-gap: 8px; }
  .row-actions, .report-card-actions, .client-detail-actions { flex-wrap: wrap; }

  table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }

  .form-actions { flex-direction: column-reverse; }
  .form-actions button { width: 100%; justify-content: center; }

  .mini-calendar { max-width: 100%; }

  input, select, textarea, button { font-size: 16px; }
}

@media (min-width: 781px) {
  .mobile-close-btn { display: none; }
}
`;
