import React, { useState, useRef, useEffect } from "react";
import { useSyncedCollection, useSyncedSettings } from "./useSyncedCollection.js";
import { supabase } from "./supabaseClient.js";
import { BLANK_CONTRACT_PDF_BASE64, BLANK_CONTRACT_AIR_EAU_PDF_BASE64, BLANK_CONTRACT_B2B_PDF_BASE64, BLANK_CONTRACT_AIR_EAU_B2B_PDF_BASE64 } from "./contractTemplate.js";
import { pennylaneCreateInvoice, pennylaneUpdateInvoice, pennylaneCheckStatus } from "./pennylane.js";

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

const initialFournisseurs = [];

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
    pin: "M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11zM12 11.5a2 2 0 100-4 2 2 0 000 4z",
    phone: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L8.1 9.7a16 16 0 006 6l1.2-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.9 2.2z",
    close: "M18 6L6 18M6 6l12 12",
    assistant: "M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z",
    mic: "M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8",
    volume: "M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14",
    volumeOff: "M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6",
    send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
    mail: "M3 5h18v14H3V5zm0 0l9 7 9-7",
    folder: "M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V6z",
    truck: "M1 4h14v12H1V4zm14 4h4l4 4v4h-8V8zM5.5 19a2 2 0 100-4 2 2 0 000 4zm13 0a2 2 0 100-4 2 2 0 000 4z",
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

/* ---------- Adresse cliquable : ouvre l'application de navigation ----------
   Sur iPhone/iPad on passe par maps.apple.com, qui ouvre directement Plans ;
   ailleurs (Android, ordinateur) par Google Maps, qui propose l'application
   installée — Waze compris — ou bascule dans le navigateur. */
function lienNavigation(adresse) {
  const q = encodeURIComponent(adresse || "");
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const estApple = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return estApple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function AdresseLien({ adresse, className }) {
  if (!adresse || !adresse.trim()) return null;
  return (
    <a
      className={"adresse-lien" + (className ? " " + className : "")}
      href={lienNavigation(adresse)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Ouvrir dans votre application de navigation"
    >
      <Icon name="pin" size={13} />
      <span>{adresse}</span>
    </a>
  );
}

/* Pour un client professionnel, on affiche partout sa raison sociale plutôt
   que le nom du contact. En base, c'est toujours le nom de la fiche qui est
   enregistré sur les rapports, tâches, devis et factures : lui seul fait le
   lien entre les modules, l'affichage est donc résolu à la volée. */
function libelleClient(c) {
  if (!c) return "";
  return c.raisonSociale && c.raisonSociale.trim() ? c.raisonSociale : c.nom;
}

// Adresse à faire figurer sur un rapport : celle du lieu d'intervention quand
// elle a été saisie (chantier du client d'un client, résidence secondaire...),
// sinon celle de la fiche client.
function adresseDuRapport(report, clients) {
  if (report?.adresseSite && report.adresseSite.trim()) return report.adresseSite.trim();
  const fiche = (clients || []).find((c) => c.nom === report?.client);
  return (fiche && fiche.adresse) || "";
}

// Durée d'une tâche en heures ("30min", "1h30", "8h"...). Sert à savoir si une
// journée est remplie, et non seulement combien d'interventions s'y trouvent.
function dureeEnHeures(duree) {
  const t = String(duree || "").trim().toLowerCase();
  if (!t) return 0;
  const min = t.match(/^(\d+)\s*min$/);
  if (min) return Number(min[1]) / 60;
  const hm = t.match(/^(\d+)\s*h\s*(\d+)?$/);
  if (hm) return Number(hm[1]) + (hm[2] ? Number(hm[2]) / 60 : 0);
  return 0;
}

// Une journée est considérée pleine à partir de 7 heures d'intervention : une
// seule intervention à la journée suffit donc à la marquer comme telle.
const HEURES_JOURNEE_PLEINE = 7;

function nomAffiche(nomStocke, clients) {
  const c = (clients || []).find((cl) => cl.nom === nomStocke);
  return c ? libelleClient(c) : nomStocke;
}

// Met en forme un numéro par groupes de deux chiffres, à la saisie comme à
// l'affichage : "0637123456" devient "06 37 12 34 56". Pour un numéro français
// écrit à l'international, le chiffre qui suit l'indicatif reste isolé, comme
// le veut l'usage : "+33 6 37 12 34 56".
function formaterTelephone(valeur) {
  const brut = String(valeur || "");
  const international = brut.trim().startsWith("+");
  const chiffres = brut.replace(/\D/g, "").slice(0, 15);
  if (!chiffres) return international ? "+" : "";

  if (international) {
    const indicatif = chiffres.slice(0, 2);
    let reste = chiffres.slice(2);
    let premier = "";
    if (indicatif === "33") {
      premier = reste.slice(0, 1);
      reste = reste.slice(1);
    }
    const groupes = (reste.match(/.{1,2}/g) || []).join(" ");
    return ["+" + indicatif, premier, groupes].filter(Boolean).join(" ");
  }

  return (chiffres.match(/.{1,2}/g) || []).join(" ");
}

/* ---------- Téléphone cliquable : lance l'appel ----------
   Espaces, points et tirets sont retirés du numéro composé, sinon certains
   téléphones refusent le lien ; l'affichage, lui, reste tel que saisi. */
function TelephoneLien({ numero, className }) {
  if (!numero || !String(numero).trim()) return null;
  const compose = String(numero).replace(/[^\d+]/g, "");
  return (
    <a
      className={"telephone-lien" + (className ? " " + className : "")}
      href={`tel:${compose}`}
      onClick={(e) => e.stopPropagation()}
      title="Appeler ce numéro"
    >
      <Icon name="phone" size={13} />
      <span>{formaterTelephone(numero)}</span>
    </a>
  );
}

/* ---------- Petit composant Jauge (élément signature) ---------- */
function Jauge({ value, max, label, onClick }) {
  const pct = Math.min(1, value / max);
  // L'arc part de la gauche (180°) et tourne jusqu'à la droite (360°) : l'aiguille
  // doit suivre exactement le même repère, sinon elle est décalée d'un quart de tour.
  const angle = 180 + pct * 180;
  return (
    <div className={"jauge" + (onClick ? " jauge-clickable" : "")} onClick={onClick} role={onClick ? "button" : undefined}>
      <svg viewBox="0 0 120 70" width="120" height="70">
        <path className="jauge-piste" d="M10,65 A50,50 0 0,1 110,65" fill="none" strokeWidth="8" strokeLinecap="round" />
        <path d="M10,65 A50,50 0 0,1 110,65" fill="none" stroke="url(#gaugeGrad)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${pct * 157} 157`} />
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop className="jauge-grad-debut" offset="0%" />
            <stop className="jauge-grad-fin" offset="100%" />
          </linearGradient>
        </defs>
        <line x1="60" y1="65" x2={60 + 38 * Math.cos((angle * Math.PI) / 180)} y2={65 + 38 * Math.sin((angle * Math.PI) / 180)} className="jauge-aiguille" strokeWidth="2.5" strokeLinecap="round" />
        <circle className="jauge-pivot" cx="60" cy="65" r="3.5" />
      </svg>
      <div className="jauge-val">{value}</div>
      <div className="jauge-label">{label}</div>
    </div>
  );
}

/* ---------- App principale ---------- */

export default function App() {
  const [tab, setTab] = useState(ongletDepuisAdresse);
  const [theme, setTheme] = useState(themeEnregistre);

  useEffect(() => { appliquerTheme(theme); }, [theme]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { items: clients, upsert: upsertClient, remove: removeClient, loading: loadingClients } = useSyncedCollection("clients", initialClients);
  const { items: reportsRaw, upsert: upsertReport, remove: removeReport, loading: loadingReports } = useSyncedCollection("reports", initialReports);
  const { items: planningRaw, upsert: upsertPlanning, remove: removePlanning, loading: loadingPlanning } = useSyncedCollection("planning", initialPlanning);
  const { items: devisAFaire, upsert: upsertDevisAFaire, remove: removeDevisAFaire, loading: loadingDevisAFaire } = useSyncedCollection("devis_a_faire", initialDevisAFaire);
  const { items: devisEnCours, upsert: upsertDevisEnCours, remove: removeDevisEnCours, loading: loadingDevisEnCours } = useSyncedCollection("devis_en_cours", initialDevisEnCours);
  const { items: facturation, upsert: upsertFacturation, remove: removeFacturation, loading: loadingFacturation } = useSyncedCollection("facturation", initialFacturation);
  const { settings, saveSettings, loading: loadingSettings } = useSyncedSettings(defaultSettings);
  // Hors du chargement initial : tant que la table n'existe pas (script SQL
  // pas encore lancé), le reste de l'application fonctionne normalement.
  const { items: fournisseurs, upsert: upsertFournisseur, remove: removeFournisseur, error: erreurFournisseurs } = useSyncedCollection("fournisseurs", initialFournisseurs);
  // Rangement automatique des rapports validés et des contrats dans OneDrive.
  const oneDrive = useRangementOneDrive({ reports: reportsRaw, clients, settings, upsertReport, upsertClient });

  const dataLoading = loadingClients || loadingReports || loadingPlanning || loadingDevisAFaire || loadingDevisEnCours || loadingFacturation || loadingSettings;

  // Tri stable pour un affichage cohérent, indépendant de l'ordre d'arrivée réseau.
  const reports = [...reportsRaw].sort((a, b) => (a.id < b.id ? 1 : -1));
  // Tri par date, puis par heure à l'intérieur d'une même journée : sans le
  // second critère, les interventions s'affichaient dans leur ordre de saisie.
  // Les tâches sans heure précise ("—", typiquement les rappels) ferment la marche.
  const planning = [...planningRaw].sort((a, b) => {
    const parDate = (a.date || "").localeCompare(b.date || "");
    if (parDate !== 0) return parDate;
    const heureA = a.heure && a.heure !== "—" ? a.heure : "99:99";
    const heureB = b.heure && b.heure !== "—" ? b.heure : "99:99";
    return heureA.localeCompare(heureB);
  });

  const [focusReport, setFocusReport] = useState(null);
  const [reportPrefill, setReportPrefill] = useState(null);
  const [focusClient, setFocusClient] = useState(null);
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState(null);
  const [correctionPennylane, setCorrectionPennylane] = useState(null);

  const [showClientForm, setShowClientForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showRappelForm, setShowRappelForm] = useState(false);
  const [reportType, setReportType] = useState("mise_en_service");

  // Conversation avec l'assistant, conservée ici pour ne pas être perdue
  // quand on passe d'un onglet à l'autre.
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [assistantActions, setAssistantActions] = useState([]);
  const [assistantTexteAEnvoyer, setAssistantTexteAEnvoyer] = useState(null);

  // Enregistre une action proposée par l'assistant, une fois validée par
  // l'utilisateur. On passe par les mêmes fonctions que les formulaires, donc
  // tout se synchronise comme une saisie à la main.
  const appliquerActionAssistant = (action) => {
    if (action.type === "planning" && action.item) {
      upsertPlanning(action.item);
      return true;
    }
    if (action.type === "planning_fait" && action.planningId) {
      const tache = planningRaw.find((p) => p.id === action.planningId);
      if (!tache) return false;
      upsertPlanning({ ...tache, fait: true });
      return true;
    }
    if ((action.type === "devis_a_faire" || action.type === "devis_a_faire_maj") && action.item) {
      upsertDevisAFaire(action.item);
      return true;
    }
    // L'envoi d'un e-mail se fait côté serveur, là où se trouve l'accès Gmail.
    if (action.type === "email" && action.item) {
      return appelerAssistantExecution(action).then(() => true);
    }
    return false;
  };

  // Interventions de la semaine en cours (du lundi au dimanche) restant à faire,
  // plutôt que l'ensemble des interventions non effectuées.
  const debutSemaine = new Date();
  debutSemaine.setDate(debutSemaine.getDate() - ((debutSemaine.getDay() + 6) % 7));
  const finSemaine = new Date(debutSemaine);
  finSemaine.setDate(finSemaine.getDate() + 6);
  const isoDebutSemaine = toLocalISODate(debutSemaine);
  const isoFinSemaine = toLocalISODate(finSemaine);
  const upcoming = planning.filter(
    (p) => !p.fait && p.categorie !== "relance" && p.date >= isoDebutSemaine && p.date <= isoFinSemaine
  ).length;
  const devisAFaireCount = devisAFaire.length;
  const aFacturer = facturation.filter((f) => !f.facture).length;
  const facturesNonPayees = facturation.filter((f) => !f.payee).length;
  const rappelsActifs = planning.filter((p) => p.rappel && !p.fait && p.categorie !== "intervention");

  const nav = [
    { id: "dashboard", label: "Tableau de bord", icon: "dashboard" },
    { id: "assistant", label: "Assistant", icon: "assistant" },
    { id: "rapports", label: "Interventions", icon: "report" },
    { id: "clients", label: "Clients", icon: "users" },
    { id: "planning", label: "Planning", icon: "calendar" },
    { id: "rappels", label: "Rappels", icon: "bell" },
    { id: "devis", label: "Devis", icon: "quote" },
    { id: "fournisseurs", label: "Fournisseurs", icon: "truck" },
    { id: "facturation", label: "Facturation", icon: "invoice" },
    { id: "parametres", label: "Paramètres", icon: "settings" },
  ];

  // Une intervention est facturable selon son type, indépendamment d'un
  // éventuel devis à effectuer : les deux cohabitent très bien, par exemple un
  // dépannage facturé aujourd'hui et un devis à établir pour la réparation.
  const estFacturable = (r) => {
    if (r.type === "mise_en_service" || r.type === "entretien") return true;
    if (r.type === "diagnostic") return !!r.facturable;
    return false;
  };

  // Retrouve la fiche client rattachée à un rapport. La correspondance exacte
  // suffit presque toujours ; les deux suivantes rattrapent un nom saisi à la
  // main, avec une casse ou des accents différents, ou la raison sociale tapée
  // à la place du nom. Sans cela, la facture partait dans Pennylane avec le
  // seul nom du rapport : ni SIREN, ni TVA, ni adresse.
  const ficheDuRapport = (nomRapport) => {
    const sansAccent = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cible = sansAccent(nomRapport);
    if (!cible) return undefined;
    return (
      clients.find((c) => c.nom === nomRapport) ||
      clients.find((c) => sansAccent(c.nom) === cible) ||
      clients.find((c) => c.raisonSociale && sansAccent(c.raisonSociale) === cible)
    );
  };

  const syncFactureToPennylane = async (facturationEntry, r) => {
    const client = ficheDuRapport(r.client);
    try {
      const { invoice, pennylaneCustomerId } = await pennylaneCreateInvoice({
        client: {
          // Facture établie au nom de l'entreprise pour un client
          // professionnel, et au nom du particulier sinon.
          nom: libelleClient(client) || r.client,
          contact: client?.nom || r.client,
          email: client?.email || "",
          adresse: client?.adresse || "",
          tel: client?.tel || "",
          siren: client?.siren || "",
          tva: client?.tva || "",
          // Nature de la fiche créée dans Pennylane : c'est la case
          // « Professionnel » de la fiche client qui décide. Pour les fiches
          // antérieures à cette case, on retombe sur les informations légales.
          professionnel:
            typeof client?.professionnel === "boolean"
              ? client.professionnel
              : !!(client?.raisonSociale || client?.siren || client?.tva),
          pennylaneId: client?.pennylaneCustomerId || null,
        },
        montantHT: parseFloat(r.montant),
        // Libellé de la ligne de facture dans Pennylane : formulation commune à
        // tous les types d'intervention, plutôt que "Entretien — 08/09/2026".
        label: `Suivant rapport d'intervention du ${r.date}`,
        vatRate: r.tva || settings.pennylane?.tvaParDefaut || "FR_200",
      });
      upsertFacturation({
        ...facturationEntry,
        facture: true,
        pennylaneInvoiceId: invoice.id,
        pennylaneStatus: "envoyée",
        pennylaneError: null,
        // Facture émise sans fiche client : Pennylane n'a reçu que le nom, donc
        // ni adresse, ni SIREN, ni TVA. On le signale plutôt que de le laisser
        // passer inaperçu.
        pennylaneAvertissement: client
          ? null
          : "Aucune fiche client ne correspond à ce nom : la facture est partie sans adresse ni informations légales.",
      });
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

    const aUnDevisAFaire = !!(r.devisAEffectuer && r.devisAEffectuer.trim());
    const montantRenseigne = r.montant !== undefined && r.montant !== null && String(r.montant).trim() !== "";

    if (aUnDevisAFaire) {
      upsertDevisAFaire({
        id: "df" + Date.now(),
        client: r.client,
        origine: `${labelType(r.type)} du ${r.date} — ${r.devisAEffectuer.trim()}`,
        date: r.date,
        reportId: r.id,
      });
    }

    // Le devis à effectuer n'est qu'un pense-bête : il n'a aucune influence sur
    // la facturation. Toute intervention facturable crée donc sa ligne, avec ou
    // sans devis en attente.
    if (estFacturable(r)) {
      const facturationEntry = {
        id: "f" + Date.now(),
        client: r.client,
        intervention: `${labelType(r.type)} — ${r.date}`,
        montant: montantRenseigne ? `${r.montant} €` : "À chiffrer",
        facture: false,
        payee: false,
        date: r.date,
        reportId: r.id,
      };
      upsertFacturation(facturationEntry);
      if (settings.pennylane?.active && montantRenseigne) {
        syncFactureToPennylane(facturationEntry, r);
      }
    }
  };

  const handleUpdateReport = (r) => {
    const ancien = reports.find((x) => x.id === r.id);
    upsertReport(r);
    syncPlanningTaskFromReport(r);

    // Devis à effectuer ajouté, modifié ou retiré après coup : la ligne de
    // l'onglet Devis suit. On n'agit que si le texte a réellement changé, pour
    // ne pas ressusciter une ligne déjà marquée comme créée.
    const ancienDevis = ((ancien && ancien.devisAEffectuer) || "").trim();
    const nouveauDevis = (r.devisAEffectuer || "").trim();
    if (nouveauDevis !== ancienDevis) {
      const ligneDevis = devisAFaire.find((d) => d.reportId === r.id);
      if (nouveauDevis) {
        upsertDevisAFaire({
          id: ligneDevis ? ligneDevis.id : "df" + Date.now(),
          client: r.client,
          origine: `${labelType(r.type)} du ${r.date} — ${nouveauDevis}`,
          date: r.date,
          reportId: r.id,
        });
      } else if (ligneDevis) {
        removeDevisAFaire(ligneDevis.id);
      }
    }

    // Si le montant change alors que l'intervention est déjà passée en
    // facturation, la ligne correspondante est corrigée immédiatement. La
    // facture Pennylane, elle, n'est jamais modifiée sans accord explicite.
    const ligne = facturation.find((f) => f.reportId === r.id);
    const montantModifie = ancien && String(ancien.montant || "") !== String(r.montant || "");
    if (ligne && montantModifie) {
      const ligneAJour = { ...ligne, montant: r.montant ? `${r.montant} €` : "À chiffrer" };
      upsertFacturation(ligneAJour);
      if (ligne.pennylaneInvoiceId && r.montant) {
        setCorrectionPennylane({ ligne: ligneAJour, report: r, ancienMontant: ancien.montant });
      }
    }
  };

  const appliquerCorrectionPennylane = async () => {
    const demande = correctionPennylane;
    setCorrectionPennylane(null);
    if (!demande) return;
    const { ligne, report } = demande;
    try {
      await pennylaneUpdateInvoice({
        invoiceId: ligne.pennylaneInvoiceId,
        montantHT: parseFloat(report.montant),
        label: `Suivant rapport d'intervention du ${report.date}`,
        vatRate: report.tva || settings.pennylane?.tvaParDefaut || "FR_200",
      });
      upsertFacturation({ ...ligne, pennylaneStatus: "envoyée", pennylaneError: null });
    } catch (e) {
      upsertFacturation({ ...ligne, pennylaneStatus: "erreur", pennylaneError: String(e?.message || e) });
    }
  };

  const handleDeleteReport = (r) => {
    removeReport(r.id);
  };

  const handlePrint = (r) => {
    setPdfPreviewHtml(buildReportHtml(r, settings, clients));
  };

  // Passer d'un onglet à l'autre referme les formulaires de saisie : sans cela,
  // un formulaire laissé ouvert réapparaissait tel quel au retour sur l'onglet,
  // donnant l'impression d'un rapport vide en haut de la liste.
  const allerAOnglet = (id) => {
    setShowReportForm(false);
    setShowClientForm(false);
    setShowTaskForm(false);
    setShowRappelForm(false);
    setTab(id);
    // Sans cela, la page conserve la position de défilement de l'onglet
    // précédent et s'ouvre au milieu du contenu.
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };

  const goToReport = (id) => {
    setTab("rapports");
    setFocusReport({ id, token: Date.now() });
  };

  const startReportFromTask = (task) => {
    setReportPrefill({
      client: task.client,
      reportType: guessReportType(task.titre),
      planningTaskId: task.id,
      // L'adresse du site saisie sur la tâche suit jusque dans le rapport :
      // inutile de la ressaisir pour une intervention sur un chantier.
      adresseSite: task.adresse || "",
      token: Date.now(),
    });
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

  // Relance automatique des envois Pennylane qui ont échoué, typiquement à
  // cause d'une coupure réseau sur le terrain. On retente au retour de la
  // connexion et au retour de l'application au premier plan.
  const relanceEnCours = useRef(false);
  const derniereRelance = useRef(0);

  useEffect(() => {
    if (!settings.pennylane?.active) return;

    const relancerEnvoisEchoues = async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (relanceEnCours.current) return;
      // Une tentative par minute au maximum, pour ne pas boucler si Pennylane
      // refuse la facture pour une raison qui n'a rien à voir avec le réseau.
      if (Date.now() - derniereRelance.current < 60000) return;

      const aRelancer = facturation.filter(
        (f) => f.pennylaneStatus === "erreur" && !f.pennylaneInvoiceId && f.reportId && (f.pennylaneTentatives || 0) < 5
      );
      if (aRelancer.length === 0) return;

      relanceEnCours.current = true;
      derniereRelance.current = Date.now();
      for (const item of aRelancer) {
        const report = reports.find((r) => r.id === item.reportId);
        if (!report || !report.montant) continue;
        await syncFactureToPennylane(
          { ...item, montant: `${report.montant} €`, pennylaneTentatives: (item.pennylaneTentatives || 0) + 1 },
          report
        );
      }
      relanceEnCours.current = false;
    };

    const auRetourAuPremierPlan = () => {
      if (document.visibilityState === "visible") relancerEnvoisEchoues();
    };

    window.addEventListener("online", relancerEnvoisEchoues);
    document.addEventListener("visibilitychange", auRetourAuPremierPlan);
    relancerEnvoisEchoues();

    return () => {
      window.removeEventListener("online", relancerEnvoisEchoues);
      document.removeEventListener("visibilitychange", auRetourAuPremierPlan);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturation, reports, settings.pennylane?.active]);

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
            <button key={n.id} className={"navbtn" + (tab === n.id ? " active" : "")} onClick={() => { allerAOnglet(n.id); setMobileNavOpen(false); }}>
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
            clients={clients}
            upcoming={upcoming}
            devisAFaireCount={devisAFaireCount}
            aFacturer={aFacturer}
            planning={planning}
            reports={reports}
            rappelsActifs={rappelsActifs}
            onToggle={togglePlanning}
            onNavigate={allerAOnglet}
            onOpenReport={goToReport}
          />
        )}

        {tab === "assistant" && (
          <Assistant
            messages={assistantMessages}
            setMessages={setAssistantMessages}
            actions={assistantActions}
            setActions={setAssistantActions}
            onAppliquerAction={appliquerActionAssistant}
            texteAEnvoyer={assistantTexteAEnvoyer}
            onTexteEnvoye={() => setAssistantTexteAEnvoyer(null)}
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
            onPrefillConsomme={() => setReportPrefill(null)}
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
            onNavigate={allerAOnglet}
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
            clients={clients}
            onAjoutAFaire={(d) => upsertDevisAFaire(d)}
            onAjoutEnCours={(d) => upsertDevisEnCours(d)}
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

        {tab === "fournisseurs" && (
          <Fournisseurs
            fournisseurs={fournisseurs}
            erreur={erreurFournisseurs}
            onSave={(f) => upsertFournisseur(f)}
            onDelete={(id) => removeFournisseur(id)}
          />
        )}

        {tab === "facturation" && (
          <Facturation
            clients={clients}
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

        {tab === "parametres" && <Parametres settings={settings} setSettings={saveSettings} loading={loadingSettings} theme={theme} setTheme={setTheme} oneDrive={oneDrive} />}
      </main>

      {tab !== "assistant" && (
        <BoutonMicroFlottant
          onTexte={(texte) => {
            setAssistantTexteAEnvoyer({ texte, id: Date.now() });
            allerAOnglet("assistant");
          }}
          onOuvrir={() => allerAOnglet("assistant")}
        />
      )}

      {pdfPreviewHtml && <PdfPreviewModal html={pdfPreviewHtml} onClose={() => setPdfPreviewHtml(null)} />}

      {correctionPennylane && (
        <ConfirmationModal
          titre="Corriger aussi la facture Pennylane ?"
          onConfirmer={appliquerCorrectionPennylane}
          onAnnuler={() => setCorrectionPennylane(null)}
          libelleConfirmer="Corriger dans Pennylane"
        >
          <p>
            Le montant est passé de <strong>{correctionPennylane.ancienMontant || "—"} €</strong> à{" "}
            <strong>{correctionPennylane.report.montant} €</strong> HT. La ligne de l'onglet Facturation a déjà
            été mise à jour.
          </p>
          <p className="hint">
            La correction n'est possible que si la facture est encore à l'état de brouillon dans Pennylane.
            Si elle a déjà été finalisée, un message vous l'indiquera et il faudra la traiter directement
            dans Pennylane.
          </p>
        </ConfirmationModal>
      )}
    </div>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ clients, upcoming, devisAFaireCount, aFacturer, planning, reports, rappelsActifs, onToggle, onNavigate, onOpenReport }) {
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
        <Jauge value={upcoming} max={10} label="Interventions cette semaine" onClick={() => onNavigate("planning")} />
        <Jauge value={devisAFaireCount} max={5} label="Devis à faire" onClick={() => onNavigate("devis")} />
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
                  <div className="row-sub">{nomAffiche(p.client, clients)} {p.heure !== "—" ? `· à ${p.heure}` : ""}{p.duree && ` · ${p.duree}`}</div>
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
                  <div className="row-title">{nomAffiche(r.client, clients)}</div>
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
                <div className="row-sub">{nomAffiche(p.client, clients)} · {p.date.split("-").reverse().join("/")} {p.heure !== "—" ? `à ${p.heure}` : ""}</div>
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

/* ---------- Assistant IA ----------
   L'onglet Assistant envoie la conversation à la fonction Supabase
   "assistant" (voir supabase/functions/assistant), qui interroge Claude et
   lui donne accès aux données du logiciel. Les créations et modifications
   reviennent sous forme de propositions, enregistrées seulement après
   validation (bouton ou réponse « oui »). */

async function appelerAssistant(messages) {
  const { data, error } = await supabase.functions.invoke("assistant", { body: { messages } });
  if (error) {
    let detail = error.message;
    try {
      if (error.context && typeof error.context.json === "function") {
        if (error.context.status === 404) {
          detail = "La fonction « assistant » n'est pas encore déployée dans Supabase.";
        } else {
          const body = await error.context.json();
          if (body?.error) detail = body.error;
        }
      }
    } catch (_e) {
      // Corps illisible : on garde le message générique.
    }
    if (error.name === "FunctionsFetchError") detail = "Impossible de joindre l'assistant : vérifie la connexion internet.";
    throw new Error(detail || "Erreur de connexion à l'assistant.");
  }
  if (!data?.ok) throw new Error(data?.error || "Réponse inattendue de l'assistant.");
  return data;
}

// Exécute côté serveur une action validée (envoi d'un e-mail).
async function appelerAssistantExecution(action) {
  const { data, error } = await supabase.functions.invoke("assistant", { body: { executer: action } });
  if (error) {
    let detail = error.message;
    try {
      if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        if (body?.error) detail = body.error;
      }
    } catch (_e) { /* message générique */ }
    throw new Error(detail || "Envoi impossible.");
  }
  if (!data?.ok) throw new Error(data?.error || "Envoi impossible.");
  return data;
}

const ASSISTANT_VOIX_KEY = "techni-pac-assistant-voix";

function voixActiveEnregistree() {
  try {
    return localStorage.getItem(ASSISTANT_VOIX_KEY) !== "false";
  } catch (e) {
    return true;
  }
}

// Texte prêt à être lu : sans symboles de mise en forme, et avec des heures
// prononcées naturellement (« 14h30 » plutôt que « 14 h 30 min »).
function textepourVoix(texte) {
  return String(texte || "")
    .replace(/[*_#`>]/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/(\d{1,2})h(\d{2})/g, "$1 heures $2")
    .replace(/(\d{1,2})h\b/g, "$1 heures")
    .replace(/€/g, " euros")
    .replace(/\bHT\b/g, "hors taxes")
    .replace(/\n+/g, ". ");
}

function choisirVoixFrancaise() {
  const voix = (window.speechSynthesis?.getVoices() || []).filter((v) => (v.lang || "").toLowerCase().startsWith("fr"));
  if (voix.length === 0) return null;
  const preferees = ["Amélie", "Audrey", "Thomas", "Google français", "Denise", "Henri", "Marie"];
  for (const nom of preferees) {
    const v = voix.find((x) => x.name.includes(nom));
    if (v) return v;
  }
  return voix.find((v) => v.lang === "fr-FR") || voix[0];
}

const REPONSE_OUI = /^(oui|ouais|ok|okay|d'accord|je valide|valide|valider|vas-y|vas y|go|confirme|confirmer|c'est bon|parfait|exact|c'est ça|yes|tu peux y aller|enregistre|enregistre-le)\b/i;
// « Envoie » n'est une validation que s'il constitue toute la réponse :
// « envoie un mail à Julien » est une nouvelle demande, pas un oui.
const REPONSE_ENVOI = /^(oui,? )?(envoie|envoies|envoyer|envoie-le|envoie-la|envoie le|envoie la|tu peux envoyer|tu peux l'envoyer|tu peux l'envoyer maintenant|envoie maintenant)$/i;
const estUnOui = (t) => REPONSE_OUI.test(t) || REPONSE_ENVOI.test(t);
const REPONSE_NON = /^(non|annule|annuler|laisse tomber|stop|pas maintenant)\b/i;

/* ---------- Lecture à voix haute ----------
   Les navigateurs (Safari sur iPhone surtout, mais aussi Chrome) refusent de
   parler tant que la synthèse vocale n'a pas été lancée une première fois
   pendant un geste de l'utilisateur. La réponse de l'assistant arrivant
   plusieurs secondes après l'appui, on « réveille » la voix au moment du
   geste avec une phrase muette, et on recommence à chaque geste tant que le
   navigateur n'a pas confirmé qu'elle a bien démarré. */
let syntheseVocaleDebloquee = false;
// Références conservées pendant la lecture : sans cela, Chrome peut
// abandonner une phrase en cours de route.
let phrasesEnCours = [];

function syntheseVocaleDisponible() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function debloquerSyntheseVocale() {
  if (syntheseVocaleDebloquee || !syntheseVocaleDisponible()) return;
  try {
    const u = new SpeechSynthesisUtterance(".");
    u.volume = 0;
    u.rate = 2;
    u.lang = "fr-FR";
    u.onstart = () => { syntheseVocaleDebloquee = true; };
    u.onend = () => { syntheseVocaleDebloquee = true; };
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(u);
  } catch (e) {
    // Sans conséquence : la réponse s'affichera simplement à l'écran.
  }
}

// Numéro de la lecture en cours : une lecture interrompue ne doit pas
// déclencher la suite prévue (reprise de l'écoute, par exemple).
let numeroLecture = 0;

function arreterLecture() {
  numeroLecture += 1;
  if (!syntheseVocaleDisponible()) return;
  phrasesEnCours = [];
  try { window.speechSynthesis.cancel(); } catch (e) { /* ignoré */ }
}

// Découpe en phrases courtes : Chrome coupe les lectures trop longues au bout
// d'une quinzaine de secondes.
function decouperPourLecture(texte) {
  const morceaux = [];
  textepourVoix(texte).split(/(?<=[.!?;])\s+/).forEach((phrase) => {
    let reste = phrase.trim();
    while (reste.length > 180) {
      const coupe = reste.lastIndexOf(",", 180) > 60 ? reste.lastIndexOf(",", 180) + 1 : reste.lastIndexOf(" ", 180);
      morceaux.push(reste.slice(0, coupe > 0 ? coupe : 180).trim());
      reste = reste.slice(coupe > 0 ? coupe : 180).trim();
    }
    if (reste) morceaux.push(reste);
  });
  return morceaux;
}

// onFin est appelé une seule fois, quand la lecture est terminée (jamais si
// elle a été interrompue). Certains navigateurs oublient de signaler la fin
// d'une lecture : une minuterie de secours, calée sur la longueur du texte,
// prend alors le relais.
function lireAVoixHaute(texte, onFin) {
  const morceaux = syntheseVocaleDisponible() && texte ? decouperPourLecture(texte) : [];
  if (morceaux.length === 0) { if (onFin) setTimeout(onFin, 0); return; }
  const synth = window.speechSynthesis;
  const pretPourAnnuler = synth.speaking || synth.pending;
  if (pretPourAnnuler) arreterLecture();
  numeroLecture += 1;
  const numero = numeroLecture;
  let termine = false;
  const terminer = () => {
    if (termine || numero !== numeroLecture) return;
    termine = true;
    if (onFin) onFin();
  };
  const lancer = () => {
    if (numero !== numeroLecture) return;
    try {
      synth.resume();
      const voix = choisirVoixFrancaise();
      phrasesEnCours = morceaux.map((m) => {
        const u = new SpeechSynthesisUtterance(m);
        u.lang = "fr-FR";
        if (voix) u.voice = voix;
        u.rate = 1.05;
        u.volume = 1;
        return u;
      });
      const derniere = phrasesEnCours[phrasesEnCours.length - 1];
      derniere.onend = terminer;
      derniere.onerror = terminer;
      phrasesEnCours.forEach((u) => synth.speak(u));
      const dureeEstimee = morceaux.join(" ").length * 85 + 2500;
      setTimeout(terminer, dureeEstimee);
    } catch (e) {
      terminer();
    }
  };
  // Une lecture lancée juste après une annulation est parfois ignorée par
  // Chrome et Safari : on laisse un court délai.
  if (pretPourAnnuler) setTimeout(lancer, 150);
  else lancer();
}

// Onglet d'ouverture demandé dans l'adresse, par exemple par un raccourci
// Siri : techni-pac.vercel.app/?onglet=assistant
const ONGLETS_VALIDES = ["dashboard", "assistant", "rapports", "clients", "planning", "rappels", "devis", "fournisseurs", "facturation", "parametres"];
function ongletDepuisAdresse() {
  try {
    const demande = new URLSearchParams(window.location.search).get("onglet");
    if (demande && ONGLETS_VALIDES.includes(demande)) {
      // On retire le paramètre de l'adresse : un rechargement de la page ne
      // doit pas ramener sur l'assistant.
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
      return demande;
    }
  } catch (e) {
    // Adresse illisible : on ouvre le tableau de bord.
  }
  return "dashboard";
}

/* Bouton micro flottant, présent sur tous les onglets sauf l'assistant : un
   appui, on parle, et la question part vers l'assistant. L'écoute démarre
   dans le geste lui-même, condition imposée par Safari pour accéder au micro.
   Sans reconnaissance vocale sur l'appareil, le bouton ouvre simplement
   l'onglet Assistant. */
function BoutonMicroFlottant({ onTexte, onOuvrir }) {
  const [ecoute, setEcoute] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [info, setInfo] = useState("");
  const recRef = useRef(null);
  const texteRef = useRef("");

  useEffect(() => () => recRef.current?.abort?.(), []);

  const Reconnaissance = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

  const appuyer = () => {
    // D'abord couper une éventuelle lecture, puis réveiller la voix pendant le
    // geste (l'inverse annulerait aussitôt le réveil).
    arreterLecture();
    debloquerSyntheseVocale();
    if (!Reconnaissance) { onOuvrir(); return; }
    if (ecoute) { recRef.current?.stop(); return; }

    setInfo("");
    setTranscription("");
    texteRef.current = "";
    const rec = new Reconnaissance();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev) => {
      let texte = "";
      for (let i = 0; i < ev.results.length; i++) texte += ev.results[i][0].transcript;
      texteRef.current = texte;
      setTranscription(texte);
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setInfo("Micro bloqué : autorise-le dans les réglages du navigateur.");
      } else if (ev.error === "no-speech") {
        setInfo("Je n'ai rien entendu.");
      }
    };
    rec.onend = () => {
      setEcoute(false);
      const texte = texteRef.current.trim();
      texteRef.current = "";
      setTranscription("");
      if (texte) onTexte(texte);
    };
    recRef.current = rec;
    try {
      rec.start();
      setEcoute(true);
    } catch (e) {
      setEcoute(false);
      onOuvrir();
    }
  };

  // Le message d'erreur disparaît de lui-même après quelques secondes.
  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => setInfo(""), 4000);
    return () => clearTimeout(t);
  }, [info]);

  return (
    <div className="micro-flottant">
      {(ecoute || info) && (
        <div className="micro-flottant-bulle">
          {info || transcription || "Je t'écoute…"}
        </div>
      )}
      <button
        className={"micro-flottant-btn" + (ecoute ? " en-ecoute" : "")}
        onClick={appuyer}
        aria-label={ecoute ? "Arrêter l'écoute" : "Parler à l'assistant"}
        title={ecoute ? "Arrêter l'écoute" : "Parler à l'assistant"}
      >
        <Icon name="mic" size={26} />
      </button>
    </div>
  );
}

const SUGGESTIONS_ASSISTANT = [
  "Fais-moi mon briefing du jour",
  "Qu'est-ce que j'ai demain ?",
  "Quels devis je dois relancer ?",
  "Qu'est-ce qui reste à facturer ?",
];

const ASSISTANT_MODE_KEY = "techni-pac-assistant-mode";

function modeTexteEnregistre() {
  try {
    return localStorage.getItem(ASSISTANT_MODE_KEY) === "texte";
  } catch (e) {
    return false;
  }
}

/* L'assistant a deux présentations :
   - le mode vocal (par défaut) : un grand bouton, on parle, il répond à voix
     haute puis se remet à écouter quelques secondes (mode conversation) ;
   - le mode texte : le fil de la conversation, avec saisie au clavier.
   Les propositions à valider s'affichent dans les deux modes. */
function Assistant({ messages, setMessages, actions, setActions, onAppliquerAction, texteAEnvoyer, onTexteEnvoye }) {
  const [saisie, setSaisie] = useState("");
  const [chargement, setChargement] = useState(false);
  const [ecoute, setEcoute] = useState(false);
  const [parle, setParle] = useState(false);
  const [voixActive, setVoixActive] = useState(voixActiveEnregistree);
  const [modeTexte, setModeTexte] = useState(modeTexteEnregistre);
  const [infoMicro, setInfoMicro] = useState("");
  const [transcription, setTranscription] = useState("");
  const [derniereQuestion, setDerniereQuestion] = useState("");
  const [conversation, setConversation] = useState(false);
  const [attenteAppui, setAttenteAppui] = useState(false);
  const reconnaissanceRef = useRef(null);
  const transcriptionRef = useRef("");
  const finRef = useRef(null);
  const envoyerRef = useRef(null);
  const ecouterRef = useRef(null);
  const ecouteRef = useRef(false);
  const conversationRef = useRef(false);
  const modeTexteRef = useRef(modeTexte);
  modeTexteRef.current = modeTexte;

  const Reconnaissance = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const syntheseDispo = syntheseVocaleDisponible();

  const changerConversation = (active) => {
    conversationRef.current = active;
    setConversation(active);
  };

  useEffect(() => {
    if (modeTexte) finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, actions, chargement, modeTexte]);

  // La liste des voix se charge en différé sur certains navigateurs.
  useEffect(() => {
    if (!syntheseDispo) return;
    window.speechSynthesis.getVoices();
    const recharger = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", recharger);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", recharger);
      arreterLecture();
      conversationRef.current = false;
      reconnaissanceRef.current?.abort?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lit une réponse. En mode vocal, si la conversation est en cours, l'écoute
  // reprend toute seule à la fin de la lecture.
  const parler = (texte, { relancer = true } = {}) => {
    const reprendre = () => {
      setParle(false);
      if (relancer && conversationRef.current && !modeTexteRef.current) {
        setTimeout(() => ecouterRef.current?.({ auto: true }), 350);
      }
    };
    if (!voixActive || !syntheseDispo) {
      // Sans voix, l'écoute ne reprend pas toute seule : rien ne
      // signalerait à l'utilisateur qu'il peut répondre.
      changerConversation(false);
      return;
    }
    setParle(true);
    // Le micro vient parfois de se libérer : sur iPhone, parler tout de suite
    // après l'écoute peut rester muet.
    setTimeout(() => lireAVoixHaute(texte, reprendre), 250);
  };

  const basculerVoix = () => {
    const nouvelle = !voixActive;
    setVoixActive(nouvelle);
    try { localStorage.setItem(ASSISTANT_VOIX_KEY, nouvelle ? "true" : "false"); } catch (e) { /* ignoré */ }
    if (!nouvelle) { arreterLecture(); setParle(false); changerConversation(false); }
    else { debloquerSyntheseVocale(); lireAVoixHaute("Voix activée."); }
  };

  const basculerMode = () => {
    const texte = !modeTexte;
    setModeTexte(texte);
    try { localStorage.setItem(ASSISTANT_MODE_KEY, texte ? "texte" : "vocal"); } catch (e) { /* ignoré */ }
    changerConversation(false);
    setAttenteAppui(false);
    if (texte) setSaisie("");
  };

  const ajouterMessage = (role, content, extra = {}) => {
    setMessages((liste) => [...liste, { id: "m" + Date.now() + Math.random().toString(16).slice(2, 6), role, content, ...extra }]);
  };

  // Une action peut être immédiate (planning, devis) ou passer par le
  // serveur (e-mail) : on attend le résultat dans les deux cas.
  const executerAction = async (action) => {
    try {
      return !!(await onAppliquerAction(action));
    } catch (e) {
      ajouterMessage("assistant", `${action.type === "email" ? "L'e-mail n'a pas pu partir" : "Enregistrement impossible"} : ${e?.message || e}`, { erreur: true });
      return false;
    }
  };

  const [actionsEnCours, setActionsEnCours] = useState(false);

  const validerAction = async (action) => {
    setActionsEnCours(true);
    const ok = await executerAction(action);
    setActionsEnCours(false);
    setActions((liste) => liste.filter((a) => a.id !== action.id));
    if (ok && action.type === "email") ajouterMessage("assistant", "E-mail envoyé.");
    return ok;
  };

  const annulerAction = (action) => {
    setActions((liste) => liste.filter((a) => a.id !== action.id));
  };

  const validerTout = async () => {
    const aFaire = actions;
    setActionsEnCours(true);
    let nb = 0;
    for (const a of aFaire) if (await executerAction(a)) nb++;
    setActionsEnCours(false);
    setActions([]);
    const avecEmail = aFaire.some((a) => a.type === "email");
    const texte = nb === 0
      ? "Je n'ai rien pu enregistrer."
      : nb < aFaire.length
        ? `C'est fait pour ${nb} sur ${aFaire.length}. Le détail du problème est affiché.`
        : avecEmail && aFaire.length === 1 ? "C'est envoyé." : nb > 1 ? `C'est fait, ${nb} éléments traités.` : "C'est enregistré.";
    ajouterMessage("assistant", texte);
    parler(texte);
  };

  const annulerTout = () => {
    setActions([]);
    const texte = "D'accord, j'annule.";
    ajouterMessage("assistant", texte);
    parler(texte);
  };

  const signalerErreur = (message) => {
    ajouterMessage("assistant", message, { erreur: true });
    changerConversation(false);
    if (!modeTexteRef.current) parler("Désolé, je n'ai pas pu te répondre. Le détail est affiché à l'écran.", { relancer: false });
  };

  const envoyer = async (texteBrut) => {
    const texte = String(texteBrut ?? saisie).trim();
    if (!texte || chargement) return;
    debloquerSyntheseVocale();
    setSaisie("");
    setDerniereQuestion(texte);

    // Réponse courte à une proposition en attente : traitée sur place, sans
    // repasser par l'assistant.
    if (actions.length > 0 && texte.split(/\s+/).length <= 4) {
      // La dictée de l'iPhone écrit souvent « d’accord » avec une apostrophe courbe.
      const reponse = texte.replace(/[’‘]/g, "'").replace(/[.!,]+$/, "");
      if (estUnOui(reponse)) { ajouterMessage("user", texte); validerTout(); return; }
      if (REPONSE_NON.test(reponse)) { ajouterMessage("user", texte); annulerTout(); return; }
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      ajouterMessage("user", texte);
      signalerErreur("Pas de connexion internet pour le moment : l'assistant a besoin du réseau pour répondre.");
      return;
    }

    const historique = [...messages.filter((m) => !m.erreur), { role: "user", content: texte }]
      .map((m) => ({ role: m.role, content: m.content }));
    ajouterMessage("user", texte);
    setChargement(true);
    try {
      const { reply, actions: nouvelles } = await appelerAssistant(historique);
      ajouterMessage("assistant", reply);
      if (Array.isArray(nouvelles) && nouvelles.length > 0) setActions((liste) => [...liste, ...nouvelles]);
      setChargement(false);
      parler(reply);
    } catch (e) {
      setChargement(false);
      signalerErreur(String(e?.message || e));
    }
  };
  envoyerRef.current = envoyer;

  // Question dictée avec le bouton micro flottant, depuis un autre onglet.
  // Le numéro de la demande évite de l'envoyer deux fois. En mode vocal, la
  // conversation continue ensuite à la voix.
  const demandeTraitee = useRef(null);
  useEffect(() => {
    if (!texteAEnvoyer || demandeTraitee.current === texteAEnvoyer.id) return;
    demandeTraitee.current = texteAEnvoyer.id;
    onTexteEnvoye?.();
    if (!modeTexteRef.current) changerConversation(true);
    envoyerRef.current?.(texteAEnvoyer.texte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texteAEnvoyer]);

  // Lance l'écoute. auto = reprise automatique après une réponse (sans geste
  // de l'utilisateur) : si le navigateur la refuse, le bouton clignote pour
  // inviter à appuyer, et le silence met fin à la conversation sans message.
  const ecouter = ({ auto = false } = {}) => {
    if (!Reconnaissance) return;
    if (!auto) {
      arreterLecture();
      setParle(false);
      debloquerSyntheseVocale();
      setAttenteAppui(false);
      if (ecouteRef.current) {
        reconnaissanceRef.current?.stop();
        return;
      }
      if (!modeTexteRef.current) changerConversation(true);
    } else if (!conversationRef.current || ecouteRef.current) {
      return;
    }

    setInfoMicro("");
    setTranscription("");
    transcriptionRef.current = "";
    let refusee = false;
    const rec = new Reconnaissance();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev) => {
      let texte = "";
      for (let i = 0; i < ev.results.length; i++) texte += ev.results[i][0].transcript;
      transcriptionRef.current = texte;
      setTranscription(texte);
      if (modeTexteRef.current) setSaisie(texte);
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        if (auto) {
          refusee = true;
        } else {
          setInfoMicro("Le micro est bloqué : autorise-le pour ce site dans les réglages du navigateur.");
          changerConversation(false);
        }
      } else if (ev.error === "no-speech" && !auto) {
        setInfoMicro("Je n'ai rien entendu, réessaie.");
      }
    };
    rec.onend = () => {
      ecouteRef.current = false;
      setEcoute(false);
      const texte = transcriptionRef.current.trim();
      transcriptionRef.current = "";
      if (texte) {
        envoyerRef.current?.(texte);
      } else if (refusee) {
        setAttenteAppui(true);
      } else {
        // Silence : la conversation se met en veille.
        changerConversation(false);
      }
    };
    reconnaissanceRef.current = rec;
    try {
      rec.start();
      ecouteRef.current = true;
      setEcoute(true);
    } catch (e) {
      ecouteRef.current = false;
      setEcoute(false);
      if (auto) setAttenteAppui(true);
    }
  };
  ecouterRef.current = ecouter;

  const terminerConversation = () => {
    changerConversation(false);
    setAttenteAppui(false);
    arreterLecture();
    setParle(false);
    reconnaissanceRef.current?.abort?.();
  };

  const nouvelleConversation = () => {
    terminerConversation();
    setMessages([]);
    setActions([]);
    setDerniereQuestion("");
  };

  // Appui sur le grand bouton du mode vocal : pendant une réponse, on coupe
  // la parole et on écoute aussitôt.
  const appuiGrandBouton = () => {
    if (chargement) return;
    ecouter();
  };

  const etat = ecoute ? "ecoute" : chargement ? "reflexion" : parle ? "parole" : attenteAppui ? "attente" : "veille";
  const libelleEtat = {
    ecoute: "Je t'écoute…",
    reflexion: "Je réfléchis…",
    parole: "Je te réponds…",
    attente: "Appuie pour répondre",
    veille: Reconnaissance ? "Appuie pour parler" : "La reconnaissance vocale n'est pas disponible sur ce navigateur",
  }[etat];
  const derniereReponse = [...messages].reverse().find((m) => m.role === "assistant");
  const derniereErreur = derniereReponse && derniereReponse.erreur ? derniereReponse.content : "";

  const carteActions = actions.length > 0 && (
    <div className="card assistant-actions">
      <div className="assistant-actions-titre">À valider</div>
      {actions.map((a) => (
        <div key={a.id} className="assistant-action">
          <div className="assistant-action-texte">
            {a.resume}
            {a.apercu && <div className="assistant-action-apercu">{a.apercu}</div>}
          </div>
          <div className="assistant-action-boutons">
            <button className="btn-ghost small" onClick={() => annulerAction(a)} disabled={actionsEnCours}>Annuler</button>
            <button className="btn-small btn-valide" onClick={() => validerAction(a)} disabled={actionsEnCours}>
              <Icon name={a.type === "email" ? "send" : "check"} size={13} /> {a.type === "email" ? (actionsEnCours ? "Envoi…" : "Envoyer") : "Valider"}
            </button>
          </div>
        </div>
      ))}
      {actions.length > 1 && (
        <button className="btn-primary assistant-tout-valider" onClick={validerTout} disabled={actionsEnCours}>Tout valider</button>
      )}
    </div>
  );

  return (
    <div className={"assistant" + (modeTexte ? "" : " assistant-mode-vocal")}>
      <header className="page-head row-between">
        <div>
          <h1>Assistant</h1>
          <p>{modeTexte ? "Pose une question ou donne une consigne, à l'écrit ou à la voix" : "Parle-lui comme à ta secrétaire"}</p>
        </div>
        <div className="assistant-head-actions">
          <button className="btn-ghost small" onClick={basculerMode}>
            {modeTexte ? <><Icon name="mic" size={15} /> Mode vocal</> : "Afficher la conversation"}
          </button>
          {syntheseDispo && (
            <button className="btn-ghost small" onClick={basculerVoix} title={voixActive ? "Couper la voix" : "Activer la voix"}>
              <Icon name={voixActive ? "volume" : "volumeOff"} size={16} /> {voixActive ? "Voix activée" : "Voix coupée"}
            </button>
          )}
          {modeTexte && messages.length > 0 && (
            <button className="btn-ghost small" onClick={nouvelleConversation}>Nouvelle conversation</button>
          )}
        </div>
      </header>

      {!modeTexte && (
        <div className="vocal">
          <div className="vocal-zone">
            <div className={"vocal-etat vocal-etat-" + etat}>{libelleEtat}</div>
            <div className="vocal-texte">
              {etat === "ecoute" ? transcription : derniereQuestion ? `« ${derniereQuestion} »` : ""}
            </div>
            <button
              className={"vocal-bouton vocal-bouton-" + etat}
              onClick={appuiGrandBouton}
              disabled={!Reconnaissance || chargement}
              aria-label={etat === "ecoute" ? "Arrêter l'écoute" : "Parler à l'assistant"}
            >
              <span className="vocal-onde" />
              <Icon name={etat === "parole" ? "volume" : "mic"} size={52} />
            </button>
            <div className="vocal-sous-bouton">
              {conversation || etat === "attente" ? (
                <button className="vocal-lien" onClick={terminerConversation}>Terminer la conversation</button>
              ) : messages.length === 0 ? (
                <button className="vocal-lien" onClick={() => { changerConversation(true); envoyer(SUGGESTIONS_ASSISTANT[0]); }}>
                  Ou appuie ici pour ton briefing du jour
                </button>
              ) : (
                <button className="vocal-lien" onClick={nouvelleConversation}>Nouvelle conversation</button>
              )}
            </div>
            {infoMicro && <div className="vocal-info">{infoMicro}</div>}
            {derniereErreur && etat !== "reflexion" && (
              <div className="vocal-erreur"><Icon name="alert" size={14} /> {derniereErreur}</div>
            )}
            {!voixActive && derniereReponse && !derniereReponse.erreur && etat !== "reflexion" && (
              <div className="vocal-reponse-ecrite">{derniereReponse.content}</div>
            )}
          </div>
          {carteActions}
        </div>
      )}

      {modeTexte && (
        <>
          <div className="assistant-fil">
            {messages.length === 0 && (
              <div className="card assistant-accueil">
                <p>Je peux consulter ton planning, tes rappels, tes clients, tes rapports, tes devis et ta facturation, et ajouter des rappels, des interventions ou des devis à faire après ta validation.</p>
                <div className="assistant-suggestions">
                  {SUGGESTIONS_ASSISTANT.map((s) => (
                    <button key={s} className="assistant-suggestion" onClick={() => envoyer(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={"assistant-bulle " + (m.role === "user" ? "bulle-moi" : "bulle-assistant") + (m.erreur ? " bulle-erreur" : "")}>
                {m.erreur && <span className="bulle-icone"><Icon name="alert" size={14} /></span>}{m.content}
                {m.role === "assistant" && !m.erreur && syntheseDispo && (
                  <button className="bulle-ecouter" onClick={() => { syntheseVocaleDebloquee = true; lireAVoixHaute(m.content); }} title="Écouter cette réponse">
                    <Icon name="volume" size={13} /> Écouter
                  </button>
                )}
              </div>
            ))}

            {chargement && <div className="assistant-bulle bulle-assistant assistant-attente"><span /><span /><span /></div>}
            {carteActions}
            <div ref={finRef} />
          </div>

          <div className="assistant-saisie">
            {infoMicro && <div className="hint assistant-info-micro">{infoMicro}</div>}
            <div className="assistant-saisie-ligne">
              <textarea
                rows={1}
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); }
                }}
                placeholder={ecoute ? "Je t'écoute…" : "Écris ou parle…"}
              />
              {Reconnaissance && (
                <button
                  className={"assistant-micro" + (ecoute ? " en-ecoute" : "")}
                  onClick={() => ecouter()}
                  disabled={chargement}
                  aria-label={ecoute ? "Arrêter l'écoute" : "Parler à l'assistant"}
                  title={ecoute ? "Arrêter l'écoute" : "Parler à l'assistant"}
                >
                  <Icon name="mic" size={22} />
                </button>
              )}
              <button className="assistant-envoyer" onClick={() => envoyer()} disabled={chargement || !saisie.trim()} aria-label="Envoyer" title="Envoyer">
                <Icon name="send" size={20} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
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
                  <div className="row-sub">{nomAffiche(p.client, clients)} {p.heure !== "—" && `· ${p.heure}`}</div>
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

/* ---------- Notifications push ----------
   Deux envois par jour (9h et 19h) rappelant les rappels du jour et les devis
   à faire. Techniquement : le navigateur crée un abonnement auprès de son
   propre service de notification, et on enregistre cet abonnement dans
   Supabase pour que la fonction planifiée puisse envoyer le message. */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

// La clé publique est transmise au format base64 « URL-safe » : le navigateur
// exige, lui, un tableau d'octets.
function base64UrlEnOctets(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalise = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const brut = window.atob(normalise);
  return Uint8Array.from([...brut].map((c) => c.charCodeAt(0)));
}

// Sur iPhone, les notifications n'existent que si l'application a été ajoutée
// à l'écran d'accueil puis lancée depuis son icône : dans un onglet Safari,
// l'interface de notification n'est tout simplement pas disponible.
function estSurIphoneHorsEcranAccueil() {
  const ua = navigator.userAgent || "";
  const estApple = /iPad|iPhone|iPod/.test(ua);
  const estInstallee = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  return estApple && !estInstallee;
}

function notificationsDisponibles() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function activerNotifications() {
  if (estSurIphoneHorsEcranAccueil()) {
    throw new Error("Sur iPhone, ajoutez d'abord TECHNI-PAC à l'écran d'accueil (bouton Partager → « Sur l'écran d'accueil »), puis rouvrez l'application depuis son icône.");
  }
  if (!notificationsDisponibles()) {
    throw new Error("Cet appareil ou ce navigateur ne gère pas les notifications.");
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Clé de notification absente : ajoutez la variable VITE_VAPID_PUBLIC_KEY dans Vercel, puis redéployez.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications refusées. Vous pouvez les réautoriser dans les réglages de votre téléphone.");
  }

  let abonnement = await registration.pushManager.getSubscription();
  if (!abonnement) {
    abonnement = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlEnOctets(VAPID_PUBLIC_KEY),
    });
  }

  const infos = abonnement.toJSON();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: auth?.user?.id || null,
      endpoint: infos.endpoint,
      p256dh: infos.keys.p256dh,
      auth: infos.keys.auth,
      appareil: navigator.userAgent.slice(0, 120),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw new Error(error.message);
}

async function desactiverNotifications() {
  const registration = await navigator.serviceWorker.getRegistration();
  const abonnement = registration ? await registration.pushManager.getSubscription() : null;
  if (abonnement) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", abonnement.endpoint);
    await abonnement.unsubscribe();
  }
}

async function abonnementActif() {
  if (!notificationsDisponibles()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  const abonnement = await registration.pushManager.getSubscription();
  return !!abonnement;
}

function NotificationsSection() {
  const [actif, setActif] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    abonnementActif().then(setActif).catch(() => setActif(false));
  }, []);

  const activer = async () => {
    setEnCours(true);
    setMessage(null);
    try {
      await activerNotifications();
      setActif(true);
      setMessage({ type: "ok", texte: "Notifications activées sur cet appareil." });
    } catch (e) {
      setMessage({ type: "erreur", texte: String(e.message || e) });
    }
    setEnCours(false);
  };

  const desactiver = async () => {
    setEnCours(true);
    setMessage(null);
    try {
      await desactiverNotifications();
      setActif(false);
      setMessage({ type: "ok", texte: "Notifications désactivées sur cet appareil." });
    } catch (e) {
      setMessage({ type: "erreur", texte: String(e.message || e) });
    }
    setEnCours(false);
  };

  return (
    <section className="card">
      <h3>Notifications sur le téléphone</h3>
      <p className="hint">
        Deux fois par jour, à 9h et à 19h, vous recevez un résumé de vos rappels du jour et de vos devis à faire.
        L'activation se fait appareil par appareil : refaites-la sur chaque téléphone ou ordinateur concerné.
        Sur iPhone, l'application doit d'abord être ajoutée à l'écran d'accueil, puis ouverte depuis son icône.
      </p>

      {message && (
        <div className={"entretien-annuel-badge " + (message.type === "ok" ? "ok" : "late")}>
          <Icon name={message.type === "ok" ? "check" : "alert"} size={14} /> {message.texte}
        </div>
      )}

      <div className="notif-actions">
        {actif ? (
          <>
            <span className="pill pill-ok"><Icon name="check" size={13} /> Activées sur cet appareil</span>
            <button className="btn-ghost small" onClick={desactiver} disabled={enCours}>Désactiver</button>
          </>
        ) : (
          <button className="btn-primary" onClick={activer} disabled={enCours}>
            <Icon name="bell" size={16} /> {enCours ? "Activation en cours..." : "Activer les notifications"}
          </button>
        )}
      </div>
    </section>
  );
}

/* ---------- Connexion Gmail (Paramètres) ----------
   La connexion passe par la fonction Supabase « gmail-connexion » : Google
   renvoie vers elle, elle enregistre l'accès côté serveur, puis ramène ici.
   Le code d'accès n'est jamais visible dans le navigateur. */
async function appelerGmailConnexion(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke("gmail-connexion", { body: { action, ...extra } });
  if (error) {
    let detail = error.message;
    try {
      if (error.context?.status === 404) detail = "La fonction « gmail-connexion » n'est pas encore déployée dans Supabase.";
      else if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        if (body?.error) detail = body.error;
      }
    } catch (_e) {
      // Corps illisible : message générique.
    }
    throw new Error(detail || "Erreur de connexion à la fonction Gmail.");
  }
  if (!data?.ok) throw new Error(data?.error || "Réponse inattendue de la fonction Gmail.");
  return data;
}

function GmailSection() {
  const [etat, setEtat] = useState(null); // null = chargement
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  const charger = () => {
    appelerGmailConnexion("etat")
      .then((d) => setEtat(d))
      .catch((e) => { setEtat({ connecte: false }); setMessage({ type: "erreur", texte: String(e.message || e) }); });
  };
  useEffect(charger, []);

  const connecter = async () => {
    setEnCours(true);
    setMessage(null);
    try {
      const { url } = await appelerGmailConnexion("lien", { retour: window.location.origin });
      window.location.href = url;
    } catch (e) {
      setMessage({ type: "erreur", texte: String(e.message || e) });
      setEnCours(false);
    }
  };

  const deconnecter = async () => {
    setEnCours(true);
    setMessage(null);
    try {
      await appelerGmailConnexion("deconnecter");
      setEtat({ connecte: false });
      setMessage({ type: "ok", texte: "Gmail est déconnecté : l'assistant n'a plus accès à la boîte." });
    } catch (e) {
      setMessage({ type: "erreur", texte: String(e.message || e) });
    }
    setEnCours(false);
  };

  return (
    <section className="card">
      <h3>Gmail</h3>
      <p className="hint">
        Reliez la boîte Gmail de l'entreprise à l'assistant : il pourra faire le point sur les mails, lire les devis
        fournisseurs en pièce jointe et préparer des e-mails, toujours envoyés après votre validation. Une seule connexion
        suffit pour tous les appareils : faites-la de préférence depuis l'ordinateur.
      </p>

      {message && (
        <div className={"entretien-annuel-badge " + (message.type === "ok" ? "ok" : "late")}>
          <Icon name={message.type === "ok" ? "check" : "alert"} size={14} /> {message.texte}
        </div>
      )}

      <div className="notif-actions">
        {etat === null ? (
          <span className="hint">Vérification…</span>
        ) : etat.connecte ? (
          <>
            <span className="pill pill-ok"><Icon name="check" size={13} /> Connecté{etat.email ? ` : ${etat.email}` : ""}</span>
            <DeleteButton label="Déconnecter" onConfirm={deconnecter} />
          </>
        ) : (
          <button className="btn-primary" onClick={connecter} disabled={enCours}>
            <Icon name="mail" size={16} /> {enCours ? "Ouverture de Google…" : "Connecter Gmail"}
          </button>
        )}
      </div>
    </section>
  );
}

/* ---------- Fournisseurs ----------
   Utilisés par l'assistant pour les demandes de prix : à qui écrire, et
   quelles marques chaque fournisseur distribue. */
function FournisseurForm({ initial, onCancel, onSubmit }) {
  const [nom, setNom] = useState(initial?.nom || "");
  const [contact, setContact] = useState(initial?.contact || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [tel, setTel] = useState(initial?.tel || "");
  const [marques, setMarques] = useState(initial?.marques || "");
  const [notes, setNotes] = useState(initial?.notes || "");

  const emailValide = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const enregistrer = () => {
    if (!nom.trim() || !emailValide) return;
    onSubmit({
      id: initial?.id || "fo" + Date.now(),
      nom: nom.trim(),
      contact: contact.trim(),
      email: email.trim(),
      tel,
      marques: marques.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <div className="card form-card">
      <div className="form-grid">
        <label>Nom du fournisseur<input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Clim Distribution Perpignan" /></label>
        <label>Contact<input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Ex : Julien, comptoir" /></label>
        <label>E-mail pour les devis
          <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="devis@fournisseur.fr" />
          {!emailValide && <span className="hint alerte"><Icon name="alert" size={13} /> Adresse e-mail invalide</span>}
        </label>
        <label>Téléphone
          <input value={tel} onChange={(e) => setTel(formaterTelephone(e.target.value))} inputMode="tel" placeholder="04 00 00 00 00" />
        </label>
        <label className="grid-full">Marques et produits
          <input value={marques} onChange={(e) => setMarques(e.target.value)} placeholder="Ex : Daikin, Mitsubishi, pièces détachées, fluides" />
          <span className="hint">L'assistant s'en sert pour choisir à qui demander un prix.</span>
        </label>
        <label className="grid-full">Notes
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : compte client n° 1234, livraison le lendemain avant 10h" />
        </label>
      </div>
      <div className="form-actions">
        <button className="btn-ghost" onClick={onCancel}>Annuler</button>
        <button className="btn-primary" onClick={enregistrer} disabled={!nom.trim() || !emailValide}>
          {initial ? "Enregistrer les modifications" : "Ajouter le fournisseur"}
        </button>
      </div>
    </div>
  );
}

function Fournisseurs({ fournisseurs, erreur, onSave, onDelete }) {
  const [edition, setEdition] = useState(null); // null, "nouveau" ou le fournisseur modifié
  const [recherche, setRecherche] = useState("");

  const sansAccent = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const mots = sansAccent(recherche).split(/\s+/).filter(Boolean);
  const affiches = [...fournisseurs]
    .sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || ""), "fr"))
    .filter((f) => {
      const botte = sansAccent([f.nom, f.contact, f.email, f.tel, f.marques, f.notes].join(" "));
      return mots.every((m) => botte.includes(m));
    });

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>Fournisseurs</h1>
          <p>Vos fournisseurs habituels : l'assistant s'en sert pour les demandes de prix</p>
        </div>
        <button className="btn-primary" onClick={() => setEdition(edition === "nouveau" ? null : "nouveau")}>
          <Icon name="plus" size={16} /> Nouveau fournisseur
        </button>
      </header>

      {erreur && (
        <div className="card">
          <p className="hint alerte"><Icon name="alert" size={13} /> La liste des fournisseurs n'est pas encore disponible : le script SQL de création de la table « fournisseurs » doit être lancé dans Supabase.</p>
        </div>
      )}

      {edition && (
        <FournisseurForm
          key={edition === "nouveau" ? "nouveau" : edition.id}
          initial={edition === "nouveau" ? null : edition}
          onCancel={() => setEdition(null)}
          onSubmit={(f) => { onSave(f); setEdition(null); }}
        />
      )}

      <section className="card">
        {fournisseurs.length > 3 && (
          <div className="recherche-client">
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher : nom, marque, produit..." />
            {recherche && (
              <button type="button" className="icon-btn" onClick={() => setRecherche("")} title="Effacer la recherche">
                <Icon name="close" size={15} />
              </button>
            )}
          </div>
        )}
        <ul className="list">
          {fournisseurs.length === 0 && <li className="empty">Aucun fournisseur pour l'instant. Ajoutez ceux à qui vous demandez des prix.</li>}
          {fournisseurs.length > 0 && affiches.length === 0 && <li className="empty">Aucun fournisseur ne correspond à cette recherche.</li>}
          {affiches.map((f) => (
            <li key={f.id} className="row">
              <div className="fournisseur-infos">
                <div className="row-title">{f.nom}{f.contact ? <span className="fournisseur-contact"> · {f.contact}</span> : null}</div>
                {f.marques && <div className="row-sub">{f.marques}</div>}
                <div className="fournisseur-liens">
                  {f.email && <a className="telephone-lien" href={`mailto:${f.email}`}><Icon name="mail" size={13} /><span>{f.email}</span></a>}
                  <TelephoneLien numero={f.tel} />
                </div>
                {f.notes && <div className="row-sub fournisseur-notes">{f.notes}</div>}
              </div>
              <div className="fournisseur-actions">
                <button className="icon-btn" onClick={() => setEdition(f)} title="Modifier ce fournisseur"><Icon name="edit" size={15} /></button>
                <DeleteButton onConfirm={() => onDelete(f.id)} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- OneDrive : rangement automatique des documents ----------
   Chaque rapport validé est converti en PDF dans l'application, puis envoyé
   par la fonction Supabase « onedrive-connexion » dans le dossier du client :
   CLIENTS/<NOM Prénom>/RAPPORTS/<NOM JJ.MM.AA TYPE>.pdf. Les contrats ajoutés
   à une fiche client vont dans CLIENTS/<NOM Prénom>/CONTRAT/.
   N'importe quel appareil ouvert (téléphone ou ordinateur) s'en charge : un
   rapport fait hors connexion part dès que le réseau revient. */
async function appelerOneDrive(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke("onedrive-connexion", { body: { action, ...extra } });
  if (error) {
    let detail = error.message;
    try {
      if (error.context?.status === 404) detail = "La fonction « onedrive-connexion » n'est pas encore déployée dans Supabase.";
      else if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        if (body?.error) detail = body.error;
      }
    } catch (_e) {
      // Corps illisible : message générique.
    }
    throw new Error(detail || "Erreur de connexion à la fonction OneDrive.");
  }
  if (!data?.ok) throw new Error(data?.error || "Réponse inattendue de la fonction OneDrive.");
  return data;
}

// Empreinte d'un document : sert à savoir s'il a changé depuis son envoi.
function empreinte(valeur) {
  const texte = JSON.stringify(valeur);
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36) + "-" + texte.length.toString(36);
}

function empreinteRapport(r) {
  const { onedrive, ...reste } = r; // eslint-disable-line no-unused-vars
  return empreinte(reste);
}

function empreinteContrat(contrat) {
  return empreinte([contrat?.nom, contrat?.dateAjout, contrat?.ajouteLe, String(contrat?.data || "").length, String(contrat?.data || "").slice(-64)]);
}

// « 03/10/2026 » ou « 2026-10-03 » → « 03.10.26 », comme dans tes fichiers.
function datePourFichier(date) {
  const t = String(date || "");
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[3].slice(2)}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1].slice(2)}`;
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
}

const TYPE_POUR_FICHIER = { mise_en_service: "MISE EN SERVICE", entretien: "ENTRETIEN", diagnostic: "DEPANNAGE" };

// Variante du rapport imprimable, mise en page pour un PDF A4 : les règles
// générales (corps de page, titres) sont limitées au rapport, pour ne pas
// déteindre sur l'application pendant la conversion.
function htmlRapportPourPdf(html) {
  const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
  const corps = (html.match(/<div class="pdf-page">([\s\S]*)<\/div>\s*<\/body>/) || [])[1] || "";
  const styleCible = style
    .replace(/@import[^;]+;/g, "")
    .replace(/@media print\s*\{[\s\S]*?\}\s*\}/, "")
    .replace(/(^|\})\s*\*\s*\{/g, "$1 .pdf-rendu * {")
    .replace(/(^|\})\s*body\s*\{/g, "$1 .pdf-rendu {")
    .replace(/(^|\})\s*h1\s*\{/g, "$1 .pdf-rendu h1 {")
    .replace(/(^|\})\s*p\s*\{/g, "$1 .pdf-rendu p {");
  return `<style>${styleCible}
    .pdf-rendu { background: #fff; width: 700px; }
    .pdf-rendu .pdf-page { box-shadow: none; margin: 0; max-width: none; padding: 0; border-radius: 0; }
    /* Photos : jamais coupées, deux par page naturellement ; pas de saut de
       page forcé (mal compté par la conversion, il isolait des photos et
       laissait une page blanche à la fin). */
    .pdf-rendu .pdf-photo-item, .pdf-rendu .pdf-photo-item:nth-child(2n) { page-break-after: auto; break-after: auto; margin-bottom: 20px; }
  </style><div class="pdf-page">${corps}</div>`;
}

async function genererPdfBase64(html) {
  const { default: html2pdf } = await import("html2pdf.js");
  // L'enveloppe est placée hors de l'écran pour que la conversion ne se voie
  // pas ; seul son contenu est converti (le décalage n'est pas recopié).
  const enveloppe = document.createElement("div");
  enveloppe.style.cssText = "position:fixed;left:-10000px;top:0;width:700px;";
  const conteneur = document.createElement("div");
  conteneur.className = "pdf-rendu";
  conteneur.innerHTML = htmlRapportPourPdf(html);
  enveloppe.appendChild(conteneur);
  document.body.appendChild(enveloppe);
  try {
    await Promise.all([...conteneur.querySelectorAll("img")].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = ok; img.onerror = ok; }))));
    if (document.fonts?.ready) await document.fonts.ready;
    const uri = await html2pdf()
      .set({
        margin: [12, 12, 14, 12],
        image: { type: "jpeg", quality: 0.85 },
        html2canvas: { scale: 1.6, useCORS: true, backgroundColor: "#ffffff", logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".pdf-bloc-insecable", ".pdf-checklist li", ".pdf-table tr", ".pdf-photo-item", ".pdf-signatures"] },
      })
      .from(conteneur)
      .outputPdf("datauristring");
    return String(uri).split(",")[1];
  } finally {
    enveloppe.remove();
  }
}

// Identifiant de cet appareil, pour qu'un téléphone et l'ordinateur ouverts
// en même temps n'envoient pas deux fois le même document.
const ID_APPAREIL = "ap" + Math.random().toString(36).slice(2, 10);

function useRangementOneDrive({ reports, clients, settings, upsertReport, upsertClient }) {
  const [etat, setEtat] = useState(null);
  const enCours = useRef(false);
  const echecs = useRef({}); // id → { nb, prochain }

  // Nouvel essai régulier des envois qui ont échoué (réseau, OneDrive occupé…).
  const [tic, setTic] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTic((x) => x + 1), 2 * 60000);
    return () => clearInterval(t);
  }, []);

  const rafraichir = () => appelerOneDrive("etat").then(setEtat).catch(() => setEtat(null));
  useEffect(() => { rafraichir(); }, []);

  useEffect(() => {
    if (!etat?.connecte || !etat?.dossier) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    if (enCours.current) return;
    const depuis = Date.parse(etat.depuis || "") || Date.now();
    const maintenant = Date.now();
    const disponible = (cle) => {
      const e = echecs.current[cle];
      return !e || (e.nb < 5 && e.prochain <= maintenant);
    };
    const reserveAilleurs = (o) => o?.parAppareil && o.parAppareil !== ID_APPAREIL && maintenant - (o.reserveLe || 0) < 3 * 60000;

    const rapports = reports.filter((r) => {
      if (!r.valide || !r.client) return false;
      const cree = Number(String(r.id || "").slice(1));
      const nouveau = Number.isFinite(cree) && cree >= depuis;
      if (!nouveau && !r.onedrive?.itemId) return false; // anciens rapports : non renvoyés
      if (r.onedrive?.signature === empreinteRapport(r)) return false;
      return !reserveAilleurs(r.onedrive) && disponible(r.id);
    });
    const contrats = clients.filter((c) =>
      c.contrat?.data && (c.contrat.ajouteLe || 0) >= depuis &&
      c.onedriveContrat?.signature !== empreinteContrat(c.contrat) &&
      !reserveAilleurs(c.onedriveContrat) && disponible("contrat-" + c.id)
    );
    if (rapports.length === 0 && contrats.length === 0) return;

    enCours.current = true;
    (async () => {
      for (const r of rapports) {
        const signature = empreinteRapport(r);
        upsertReport({ ...r, onedrive: { ...(r.onedrive || {}), parAppareil: ID_APPAREIL, reserveLe: Date.now() } });
        try {
          const fiche = clients.find((c) => c.nom === r.client);
          const contenu = await genererPdfBase64(buildReportHtml(r, settings, clients));
          const res = await appelerOneDrive("ranger", {
            client: [r.client, fiche?.raisonSociale, fiche ? libelleClient(fiche) : ""].filter(Boolean),
            sous_dossier: "RAPPORTS",
            nom_fichier: `{NOM} ${datePourFichier(r.date)} ${TYPE_POUR_FICHIER[r.type] || "RAPPORT"}.pdf`,
            contenu,
            item_id: r.onedrive?.itemId || undefined,
          });
          upsertReport({ ...r, onedrive: { itemId: res.item_id, chemin: res.chemin, nom: res.nom, signature, envoyeLe: new Date().toISOString() } });
          delete echecs.current[r.id];
        } catch (e) {
          const nb = (echecs.current[r.id]?.nb || 0) + 1;
          echecs.current[r.id] = { nb, prochain: Date.now() + nb * 2 * 60000 };
          upsertReport({ ...r, onedrive: { ...(r.onedrive || {}), parAppareil: null, erreur: String(e?.message || e) } });
        }
      }
      for (const c of contrats) {
        const signature = empreinteContrat(c.contrat);
        upsertClient({ ...c, onedriveContrat: { ...(c.onedriveContrat || {}), parAppareil: ID_APPAREIL, reserveLe: Date.now() } });
        try {
          const extension = (String(c.contrat.nom || "").match(/\.([a-z0-9]{2,5})$/i) || [, "pdf"])[1].toLowerCase();
          const res = await appelerOneDrive("ranger", {
            client: [c.nom, c.raisonSociale, libelleClient(c)].filter(Boolean),
            sous_dossier: "CONTRAT",
            nom_fichier: `{NOM} ${datePourFichier(c.contrat.dateAjout)} CONTRAT.${extension}`,
            contenu: c.contrat.data,
            item_id: c.onedriveContrat?.itemId || undefined,
          });
          upsertClient({ ...c, onedriveContrat: { itemId: res.item_id, chemin: res.chemin, signature, envoyeLe: new Date().toISOString() } });
          delete echecs.current["contrat-" + c.id];
        } catch (e) {
          const nb = (echecs.current["contrat-" + c.id]?.nb || 0) + 1;
          echecs.current["contrat-" + c.id] = { nb, prochain: Date.now() + nb * 2 * 60000 };
          upsertClient({ ...c, onedriveContrat: { ...(c.onedriveContrat || {}), parAppareil: null, erreur: String(e?.message || e) } });
        }
      }
      enCours.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, clients, etat, tic]);

  // Nouvel essai au retour du réseau.
  useEffect(() => {
    const relancer = () => { echecs.current = {}; rafraichir(); };
    window.addEventListener("online", relancer);
    return () => window.removeEventListener("online", relancer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { etat, rafraichir };
}

function OneDriveSection({ etat, onChange }) {
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const [chemin, setChemin] = useState("");

  const executer = async (fn) => {
    setEnCours(true);
    setMessage(null);
    try { await fn(); } catch (e) { setMessage({ type: "erreur", texte: String(e.message || e) }); }
    setEnCours(false);
  };

  const connecter = () => executer(async () => {
    const { url } = await appelerOneDrive("lien", { retour: window.location.origin });
    window.location.href = url;
  });

  const deconnecter = () => executer(async () => {
    await appelerOneDrive("deconnecter");
    setMessage({ type: "ok", texte: "OneDrive est déconnecté : plus aucun document n'y sera rangé." });
    onChange();
  });

  const choisirDossier = () => executer(async () => {
    const res = await appelerOneDrive("dossier", { chemin });
    setMessage({ type: "ok", texte: `Dossier des clients trouvé : ${res.dossier}` });
    onChange();
  });

  return (
    <section className="card">
      <h3>OneDrive</h3>
      <p className="hint">
        Chaque rapport validé est enregistré en PDF dans le dossier OneDrive du client (RAPPORTS), et chaque contrat ajouté
        à une fiche client dans son dossier CONTRAT. Le classement se fait tout seul, depuis le téléphone comme depuis
        l'ordinateur, même s'il est éteint. Les rapports antérieurs à la connexion ne sont pas renvoyés.
      </p>

      {message && (
        <div className={"entretien-annuel-badge " + (message.type === "ok" ? "ok" : "late")}>
          <Icon name={message.type === "ok" ? "check" : "alert"} size={14} /> {message.texte}
        </div>
      )}

      {etat?.connecte ? (
        <>
          <div className="notif-actions">
            <span className="pill pill-ok"><Icon name="check" size={13} /> Connecté{etat.email ? ` : ${etat.email}` : ""}</span>
            <DeleteButton label="Déconnecter" onConfirm={deconnecter} />
          </div>
          {etat.dossier ? (
            <p className="hint onedrive-dossier"><Icon name="check" size={13} /> Dossier des clients : <strong>{etat.dossier}</strong></p>
          ) : (
            <div className="onedrive-chemin">
              <p className="hint alerte"><Icon name="alert" size={13} /> Dossier des clients introuvable automatiquement. Indiquez son emplacement dans OneDrive :</p>
              <div className="onedrive-chemin-ligne">
                <input value={chemin} onChange={(e) => setChemin(e.target.value)} placeholder="Ex : Bureau/RCLIM PYRENEES/CLIENTS" />
                <button className="btn-primary" onClick={choisirDossier} disabled={enCours || !chemin.trim()}>Vérifier</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="notif-actions">
          <button className="btn-primary" onClick={connecter} disabled={enCours || etat === undefined}>
            <Icon name="folder" size={16} /> {enCours ? "Ouverture de Microsoft…" : "Connecter OneDrive"}
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------- Paramètres ---------- */
function Parametres({ settings, setSettings, theme, setTheme, oneDrive }) {
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
          <div className="field-col mt">
            Adresse (rue)
            <AdresseInput
              value={draft.entreprise.adresse}
              onChange={(v) => updateEntreprise({ adresse: v })}
              onSelectAdresse={(p) => updateEntreprise({
                adresse: p.name,
                codePostalVille: [p.postcode, p.city].filter(Boolean).join(" "),
              })}
              placeholder="Ex : 450 Route des Grottes"
            />
          </div>
          <label className="mt">Code postal et ville
            <input value={draft.entreprise.codePostalVille} onChange={(e) => updateEntreprise({ codePostalVille: e.target.value })} placeholder="Ex : 64800 Lestelle-Bétharram" />
          </label>
          <div className="form-grid">
            <label>Téléphone
              <input value={draft.entreprise.telephone} onChange={(e) => updateEntreprise({ telephone: formaterTelephone(e.target.value) })} inputMode="tel" placeholder="05 58 00 00 00" />
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
        <h3>Apparence</h3>
        <p className="hint">
          Le mode sombre repose les yeux en atelier et le soir ; le mode clair reste plus lisible
          en plein soleil. Le choix vaut pour cet appareil seulement.
        </p>
        <div className="theme-choix">
          <button
            type="button"
            className={"theme-option" + (theme === "sombre" ? " actif" : "")}
            onClick={() => setTheme("sombre")}
          >
            Sombre
          </button>
          <button
            type="button"
            className={"theme-option" + (theme === "clair" ? " actif" : "")}
            onClick={() => setTheme("clair")}
          >
            Clair
          </button>
        </div>
      </section>

      <NotificationsSection />
      <GmailSection />
      {oneDrive && <OneDriveSection etat={oneDrive.etat} onChange={oneDrive.rafraichir} />}

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
        <p className="hint">Créez des checklists réutilisables. Elles seront proposées dans les rapports du type choisi — vous pourrez toujours les modifier librement une fois insérées.</p>
        {(draft.checklists || []).length === 0 && <p className="empty">Aucun modèle créé pour le moment.</p>}
        {(draft.checklists || []).map((t) => (
          <div key={t.id} className="card machine-editor-card">
            <ChecklistTemplateEditor template={t} onChange={(next) => updateChecklistTpl(t.id, next)} onRemove={() => removeChecklistTpl(t.id)} />
          </div>
        ))}
        <button type="button" className="btn-ghost small" onClick={addChecklistTpl}><Icon name="plus" size={14} /> Ajouter un modèle de checklist</button>
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
function Rapports({ reports, clients, settings, showForm, setShowForm, reportType, setReportType, onAdd, onUpdate, onValidate, onDelete, onPrint, focusReport, reportPrefill, onPrefillConsomme }) {
  const [filter, setFilter] = useState("tous");
  const [editingReport, setEditingReport] = useState(null);
  const [activePrefillClient, setActivePrefillClient] = useState(null);
  const [prefillTaskId, setPrefillTaskId] = useState(null);
  const [prefillAdresse, setPrefillAdresse] = useState("");
  const [formKey, setFormKey] = useState("new-0");
  const formRef = useRef(null);
  // Un seul rapport déplié à la fois : en ouvrir un referme le précédent.
  const [openReportId, setOpenReportId] = useState(null);
  const filtered = filter === "tous" ? reports : reports.filter((r) => r.type === filter);

  const openNew = () => {
    setEditingReport(null);
    setActivePrefillClient(null);
    setPrefillTaskId(null);
    setPrefillAdresse("");
    setFormKey("new-" + Date.now());
    setShowForm(true);
  };
  const openEdit = (r) => { setEditingReport(r); setActivePrefillClient(null); setPrefillTaskId(null); setPrefillAdresse(""); setReportType(r.type); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingReport(null); setActivePrefillClient(null); setPrefillTaskId(null); setPrefillAdresse(""); };

  // Le formulaire s'ouvre sous la liste des rapports : on descend
  // automatiquement jusqu'à lui pour qu'il ne passe pas inaperçu.
  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showForm, editingReport, reportPrefill]);

  useEffect(() => {
    if (focusReport) {
      setFilter("tous");
      setShowForm(false);
      setOpenReportId(focusReport.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReport]);

  // Une demande venue du planning ouvre le formulaire pré-rempli, puis elle est
  // effacée. Sans cet effacement, elle se rejouait à chaque retour sur l'onglet
  // et rouvrait un rapport vide qu'on n'avait pas demandé.
  useEffect(() => {
    if (!reportPrefill) return;
    setEditingReport(null);
    setActivePrefillClient(reportPrefill.client);
    setPrefillTaskId(reportPrefill.planningTaskId || null);
    setPrefillAdresse(reportPrefill.adresseSite || "");
    setFormKey("new-" + reportPrefill.token);
    setReportType(reportPrefill.reportType);
    setShowForm(true);
    if (onPrefillConsomme) onPrefillConsomme();
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
                {dg.items.map((r) => (
                  <ReportCard
                    key={r.id}
                    r={r}
                    clients={clients}
                    open={openReportId === r.id}
                    onToggle={() => {
                      if (openReportId !== r.id) closeForm();
                      setOpenReportId(openReportId === r.id ? null : r.id);
                    }}
                    onPrint={onPrint}
                    onEdit={openEdit}
                    onValidate={onValidate}
                    onDelete={onDelete}
                    focusReport={focusReport}
                    settings={settings}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
        {filtered.length === 0 && <p className="empty">Aucun rapport pour ce filtre.</p>}
      </div>

      {showForm && (
        <div ref={formRef}>
          <ReportForm
            key={editingReport ? editingReport.id : formKey}
            clients={clients}
            settings={settings}
            reportType={reportType}
            setReportType={setReportType}
            editingReport={editingReport}
            prefillClient={!editingReport ? activePrefillClient : undefined}
            prefillPlanningTaskId={!editingReport ? prefillTaskId : undefined}
            prefillAdresseSite={!editingReport ? prefillAdresse : undefined}
            onCancel={closeForm}
            onSubmit={(r) => { editingReport ? onUpdate(r) : onAdd(r); closeForm(); }}
            onPreview={onPrint}
          />
        </div>
      )}
    </div>
  );
}

function ReportCard({ r, clients, open, onToggle, onPrint, onEdit, onValidate, onDelete, focusReport, settings }) {
  const [viewTab, setViewTab] = useState("details");
  const cardRef = useRef(null);

  // Quand une carte s'ouvre, on la ramène en haut de l'écran : la fermeture de
  // la carte précédente décale la page, et le rapport ouvert se retrouverait
  // sinon hors de vue.
  useEffect(() => {
    if (open && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [open]);

  useEffect(() => {
    if (focusReport && focusReport.id === r.id) {
      cardRef.current && cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReport]);

  return (
    <div className={"card report-card" + (r.valide ? " report-card-valide" : "")} ref={cardRef}>
      <div className="report-card-head" onClick={onToggle}>
        <span className={"pill " + typePillClass(r.type)}>{shortType(r.type)}</span>
        <div className="report-card-title">
          {settings?.technicien?.nom && <div className="report-tech">Technicien : {settings.technicien.nom}</div>}
          <div className="row-title">{nomAffiche(r.client, clients)}</div>
          <div className="row-sub">{r.installation} · {r.date}</div>
        </div>
        {r.valide && <span className="pill pill-ok"><Icon name="check" size={13} /> Validé</span>}
        {r.onedrive?.chemin && r.onedrive.signature === empreinteRapport(r) && (
          <span className="pill pill-onedrive" title={`Rangé dans OneDrive : ${r.onedrive.chemin}`}><Icon name="folder" size={13} /> OneDrive</span>
        )}
        {r.onedrive?.erreur && !(r.onedrive.chemin && r.onedrive.signature === empreinteRapport(r)) && (
          <span className="pill pill-alert" title={r.onedrive.erreur}><Icon name="alert" size={13} /> OneDrive</span>
        )}
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
            <iframe className="report-pdf-preview" srcDoc={buildReportHtml(r, settings, clients)} title="Aperçu PDF du rapport" />
          ) : (
            <>
              {r.type === "mise_en_service" && (
            <>
              {r.intro && <div className="remarque description-view"><strong>Objet</strong><div className="rte-render" dangerouslySetInnerHTML={{ __html: r.intro }} /></div>}
              {r.machines && r.machines.length > 0 && (
                <>
                  <div className="section-title">Matériel installé</div>
                  {r.machines.map((m, i) => <MachineBlock key={i} machine={m} />)}
                </>
              )}
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
              {r.machines && r.machines.length > 0 && (
                <>
                  <div className="section-title">Matériel installé</div>
                  {r.machines.map((m, i) => <MachineBlock key={i} machine={m} />)}
                </>
              )}
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
              {r.machines && r.machines.length > 0 && (
                <>
                  <div className="section-title">Matériel installé</div>
                  {r.machines.map((m, i) => <MachineBlock key={i} machine={m} />)}
                </>
              )}
              <ChecklistsView checklists={normalizeChecklists(r)} tables={r.tables} />
              {r.description && <div className="remarque description-view"><strong>Description</strong><div className="rte-render" dangerouslySetInnerHTML={{ __html: r.description }} /></div>}
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
              {r.pieces && <p><strong>Pièces utilisées :</strong> {r.pieces}</p>}
              <p><strong>Facturable :</strong> {r.facturable ? "Oui" : "Non"}</p>
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
  // Un dépannage peut porter sur n'importe quel type d'installation : on y
  // propose donc tous les modèles de checklist, y compris ceux créés pour les
  // mises en service et les entretiens.
  const tousLesModeles = settings.checklists || [];
  const modeles = reportType === "diagnostic" ? tousLesModeles : tousLesModeles.filter((t) => t.type === reportType);
  const afficherLeType = reportType === "diagnostic";

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
          <div className="table-actions">
            <button type="button" className="btn-ghost small" onClick={() => removeChecklist(cl.id)}>
              Supprimer la checklist
            </button>
          </div>
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
              <option key={t.id} value={t.id}>
                {(t.nom || "Modèle sans nom") + (afficherLeType && t.type !== reportType ? ` (${labelType(t.type)})` : "")}
              </option>
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
              <textarea className="checklist-label-input" rows={2} value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })} placeholder="Intitulé du contrôle" />
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
            <option value="diagnostic">Diagnostic / dépannage</option>
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
  // Un tiret suivi d'un espace en début de ligne démarre une liste à puces,
  // comme dans un traitement de texte. Le tiret lui-même est effacé.
  const puceAutomatique = () => {
    if (document.queryCommandState("insertUnorderedList")) return false;
    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return false;

    const noeud = selection.anchorNode;
    if (!noeud || noeud.nodeType !== 3) return false;

    const avantCurseur = noeud.textContent.slice(0, selection.anchorOffset);
    // Uniquement si la ligne ne contient QUE le tiret jusqu'au curseur.
    if (!/^[-*]$/.test(avantCurseur.trim()) || avantCurseur.trim().length !== avantCurseur.length) return false;

    noeud.textContent = noeud.textContent.slice(selection.anchorOffset);
    const plage = document.createRange();
    plage.setStart(noeud, 0);
    plage.collapse(true);
    selection.removeAllRanges();
    selection.addRange(plage);
    document.execCommand("insertUnorderedList");
    return true;
  };

  const handleKeyDown = (e) => {
    if (e.key === " " && puceAutomatique()) {
      e.preventDefault();
      handleInput();
      updateActiveState();
      return;
    }

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

const CLE_THEME = "techni-pac-theme";

function themeEnregistre() {
  try {
    return localStorage.getItem(CLE_THEME) === "clair" ? "clair" : "sombre";
  } catch (_e) {
    return "sombre";
  }
}

function appliquerTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "clair" ? "clair" : "sombre");
  try {
    localStorage.setItem(CLE_THEME, theme);
  } catch (_e) {
    // Stockage indisponible : le thème s'applique quand même pour cette session.
  }
}

// Appliqué dès le chargement, avant le premier rendu.
appliquerTheme(themeEnregistre());

/* ---------- Préparation des photos ----------
   Les photos prises avec un iPhone sont volumineuses, et souvent au format
   HEIC que la plupart des navigateurs et lecteurs PDF ne savent pas afficher.
   On les redessine donc systématiquement en JPEG redimensionné : le rapport
   reste léger à enregistrer, et la photo s'affiche partout. */
function preparerImage(fichier, maxCote = 1600, qualite = 0.72) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("Impossible de lire ce fichier."));
    lecteur.onload = () => {
      const image = new Image();
      // Format non décodable par le navigateur : on conserve le fichier tel quel
      // plutôt que de perdre la photo.
      image.onerror = () => resolve(lecteur.result);
      image.onload = () => {
        try {
          const facteur = Math.min(1, maxCote / Math.max(image.width, image.height));
          const largeur = Math.max(1, Math.round(image.width * facteur));
          const hauteur = Math.max(1, Math.round(image.height * facteur));
          const canvas = document.createElement("canvas");
          canvas.width = largeur;
          canvas.height = hauteur;
          canvas.getContext("2d").drawImage(image, 0, 0, largeur, hauteur);
          resolve(canvas.toDataURL("image/jpeg", qualite));
        } catch (_e) {
          resolve(lecteur.result);
        }
      };
      image.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

/* ---------- Champ d'adresse avec suggestions ----------
   Propose des adresses au fil de la frappe, à partir de la Base Adresse
   Nationale (service public gratuit, sans clé — celui qu'utilise déjà la carte
   des secteurs). On n'interroge le service qu'à partir de 4 caractères et après
   un court temps d'arrêt dans la frappe, pour ne pas l'appeler à chaque lettre.
   La saisie libre reste toujours possible : les suggestions sont une aide, pas
   une obligation. */
function AdresseInput({ value, onChange, onSelectAdresse, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const saisieUtilisateur = useRef(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    // On ne cherche que lorsque c'est l'utilisateur qui tape, pas lorsque le
    // champ est rempli par l'application (ouverture d'une fiche existante...).
    if (!saisieUtilisateur.current) return;
    const recherche = (value || "").trim();
    if (recherche.length < 4) {
      setSuggestions([]);
      setOuvert(false);
      return;
    }
    const controleur = new AbortController();
    const minuteur = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(recherche)}&limit=5&autocomplete=1`,
          { signal: controleur.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        const liste = (data.features || []).map((f) => f.properties).filter((p) => p && p.label);
        setSuggestions(liste);
        setOuvert(liste.length > 0);
        setActif(-1);
      } catch (_e) {
        // Pas de réseau ou service indisponible : on laisse simplement la saisie libre.
      }
    }, 250);
    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [value]);

  useEffect(() => {
    const fermerSiClicDehors = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener("mousedown", fermerSiClicDehors);
    document.addEventListener("touchstart", fermerSiClicDehors);
    return () => {
      document.removeEventListener("mousedown", fermerSiClicDehors);
      document.removeEventListener("touchstart", fermerSiClicDehors);
    };
  }, []);

  const choisir = (p) => {
    saisieUtilisateur.current = false;
    onChange(p.label);
    if (onSelectAdresse) onSelectAdresse(p);
    setOuvert(false);
    setSuggestions([]);
  };

  const auClavier = (e) => {
    if (!ouvert || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && actif >= 0) {
      e.preventDefault();
      choisir(suggestions[actif]);
    } else if (e.key === "Escape") {
      setOuvert(false);
    }
  };

  return (
    <div className="client-select" ref={wrapRef}>
      <input
        value={value}
        onChange={(e) => { saisieUtilisateur.current = true; onChange(e.target.value); }}
        onKeyDown={auClavier}
        placeholder={placeholder}
        autoComplete="off"
      />
      {ouvert && suggestions.length > 0 && (
        <ul className="client-select-list">
          {suggestions.map((p, i) => (
            <li
              key={p.id || i}
              className={i === actif ? "actif" : ""}
              // onMouseDown plutôt qu'onClick : le choix est pris en compte avant
              // que le champ ne perde le focus et ne referme la liste.
              onMouseDown={(e) => { e.preventDefault(); choisir(p); }}
            >
              <span className="client-select-nom">{p.name}</span>
              <span className="client-select-sub">{[p.postcode, p.city].filter(Boolean).join(" ")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Informations légales d'une entreprise ----------
   Le SIREN porte une clé de contrôle : une faute de frappe ou deux chiffres
   intervertis se détectent sans aucun accès réseau. Et le numéro de TVA
   intracommunautaire français se calcule à partir du SIREN, il n'y a donc
   jamais besoin de le saisir. */
function sirenCleValide(siren) {
  const c = (siren || "").replace(/\D/g, "");
  if (c.length !== 9) return false;
  let somme = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(c[i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    somme += n;
  }
  return somme % 10 === 0;
}

function tvaDepuisSiren(siren) {
  const c = (siren || "").replace(/\D/g, "");
  if (c.length !== 9) return "";
  const cle = (12 + 3 * (Number(c) % 97)) % 97;
  return "FR" + String(cle).padStart(2, "0") + c;
}

// Affichage par groupes de trois chiffres, à la saisie comme à la lecture.
function formaterSiren(valeur) {
  const c = String(valeur || "").replace(/\D/g, "").slice(0, 9);
  return (c.match(/.{1,3}/g) || []).join(" ");
}

// Interroge l'annuaire officiel des entreprises (service public gratuit, sans
// clé). Renvoie une liste normalisée, ou une liste vide si le service est
// indisponible — la saisie libre reste toujours possible.
async function rechercherEntreprises(texte, signal) {
  const q = (texte || "").trim();
  if (q.length < 3) return [];
  const res = await fetch(
    `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=5`,
    { signal }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((e) => {
    const siege = e.siege || {};
    const adresse = [siege.numero_voie, siege.type_voie, siege.libelle_voie]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      nom: e.nom_raison_sociale || e.nom_complet || "",
      siren: e.siren || "",
      adresse: [adresse || siege.adresse || "", siege.code_postal || "", siege.libelle_commune || ""]
        .filter(Boolean)
        .join(" ")
        .trim(),
      ville: [siege.code_postal, siege.libelle_commune].filter(Boolean).join(" "),
      fermee: e.etat_administratif === "C",
    };
  }).filter((e) => e.nom && e.siren);
}

/* ---------- Champ « Raison sociale » avec recherche dans l'annuaire ----------
   Choisir une entreprise dans la liste remplit d'un coup la raison sociale, le
   SIREN et le numéro de TVA : plus rien n'est saisi à la main, donc plus
   d'erreur possible sur les informations légales. */
function EntrepriseInput({ value, onChange, onSelectEntreprise, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const saisieUtilisateur = useRef(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!saisieUtilisateur.current) return;
    const texte = (value || "").trim();
    if (texte.length < 3) {
      setSuggestions([]);
      setOuvert(false);
      return;
    }
    const controleur = new AbortController();
    const minuteur = setTimeout(async () => {
      setRecherche(true);
      try {
        const liste = await rechercherEntreprises(texte, controleur.signal);
        setSuggestions(liste);
        setOuvert(liste.length > 0);
      } catch (_e) {
        // Service indisponible ou hors ligne : on laisse la saisie libre.
      }
      setRecherche(false);
    }, 300);
    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [value]);

  useEffect(() => {
    const fermerSiClicDehors = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener("mousedown", fermerSiClicDehors);
    document.addEventListener("touchstart", fermerSiClicDehors);
    return () => {
      document.removeEventListener("mousedown", fermerSiClicDehors);
      document.removeEventListener("touchstart", fermerSiClicDehors);
    };
  }, []);

  const choisir = (e) => {
    saisieUtilisateur.current = false;
    onSelectEntreprise(e);
    setOuvert(false);
    setSuggestions([]);
  };

  return (
    <div className="client-select" ref={wrapRef}>
      <input
        value={value}
        onChange={(e) => { saisieUtilisateur.current = true; onChange(e.target.value); }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {recherche && <span className="hint">Recherche dans l'annuaire des entreprises...</span>}
      {ouvert && suggestions.length > 0 && (
        <ul className="client-select-list">
          {suggestions.map((e) => (
            <li key={e.siren} onMouseDown={(ev) => { ev.preventDefault(); choisir(e); }}>
              <span className="client-select-nom">
                {e.nom}
                {e.fermee && <span className="pill pill-alert entreprise-fermee">fermée</span>}
              </span>
              <span className="client-select-sub">SIREN {formaterSiren(e.siren)}{e.ville ? " · " + e.ville : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Champ « Client » : menu déroulant avec recherche ----------
   La liste native <datalist> du navigateur se comporte de façon inégale d'un
   navigateur et d'un appareil à l'autre : on gère donc nous-mêmes l'ouverture,
   le filtrage (insensible à la casse et aux accents) et la sélection. La saisie
   libre reste possible, pour les prospects qui ne sont pas encore en fiche. */
function ClientSearchSelect({ clients, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const wrapRef = useRef(null);

  // Pour un client professionnel, on affiche sa raison sociale plutôt que le
  // nom du contact. La valeur réellement enregistrée reste le nom de la fiche,
  // qui sert de lien avec les rapports, les devis et les factures.
  const libelle = libelleClient;
  const libellePourValeur = (v) => {
    const c = clients.find((cl) => cl.nom === v);
    return c ? libelle(c) : (v || "");
  };

  useEffect(() => { setQuery(libellePourValeur(value)); }, [value, clients]);

  useEffect(() => {
    const fermerSiClicDehors = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", fermerSiClicDehors);
    document.addEventListener("touchstart", fermerSiClicDehors);
    return () => {
      document.removeEventListener("mousedown", fermerSiClicDehors);
      document.removeEventListener("touchstart", fermerSiClicDehors);
    };
  }, []);

  const sansAccent = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tries = [...clients].sort((a, b) => libelleClient(a).localeCompare(libelleClient(b), "fr", { sensitivity: "base" }));
  const recherche = sansAccent(query).trim();
  const filtres = recherche
    ? tries.filter((c) => sansAccent(c.nom).includes(recherche) || sansAccent(c.raisonSociale).includes(recherche))
    : tries;

  const choisir = (c) => { setQuery(libelle(c)); onChange(c.nom); setOpen(false); };

  return (
    <div className="client-select" ref={wrapRef}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onClick={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button type="button" className="client-select-arrow" onClick={() => setOpen(!open)} tabIndex={-1} aria-label="Dérouler la liste des clients">
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <ul className="client-select-list">
          {filtres.map((c) => (
            <li key={c.id} onClick={() => choisir(c)}>
              <span className="client-select-nom">{libelle(c)}</span>
              {libelle(c) !== c.nom && <span className="client-select-sub">{c.nom}</span>}
            </li>
          ))}
          {filtres.length === 0 && (
            <li className="client-select-empty">Aucun client ne correspond — le nom saisi sera conservé tel quel.</li>
          )}
        </ul>
      )}
    </div>
  );
}

function ReportForm({ clients, settings, reportType, setReportType, editingReport, prefillClient, prefillPlanningTaskId, prefillAdresseSite, onCancel, onSubmit, onPreview }) {
  const isEditing = !!editingReport;
  // Liste des clients triée alphabétiquement (accents et casse ignorés).
  const clientsTries = [...clients].sort((a, b) =>
    (a.nom || "").localeCompare(b.nom || "", "fr", { sensitivity: "base" })
  );
  // Aucun client présélectionné sur un nouveau rapport : le champ reste vide
  // tant que l'utilisateur n'a pas choisi (ou tapé) un nom.
  const initialClient = editingReport?.client || prefillClient || "";
  const [client, setClient] = useState(initialClient);
  const [installation, setInstallation] = useState(() => {
    if (editingReport?.installation) return editingReport.installation;
    const c = clients.find((cl) => cl.nom === initialClient);
    return c?.machines?.[0]?.type || installTypes[0];
  });
  const [date, setDate] = useState(editingReport?.date || new Date().toLocaleDateString("fr-FR"));
  // Adresse du lieu d'intervention, laissée vide quand elle est identique à
  // celle de la fiche client.
  const [adresseSite, setAdresseSite] = useState(editingReport?.adresseSite || prefillAdresseSite || "");
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
  // Aucune checklist n'est pré-remplie : sur un nouveau rapport, on choisit
  // soi-même le ou les modèles à insérer.
  const [checklists, setChecklists] = useState(() => normalizeChecklists(editingReport));
  const [tables, setTables] = useState(editingReport?.tables || []);
  const [showMachinesSection, setShowMachinesSection] = useState(false);
  // Retient si le matériel affiché provient d'une reprise automatique depuis la
  // fiche client : dans ce cas seulement, changer de client le remplace. Du
  // matériel saisi ou corrigé à la main n'est jamais écrasé.
  const materielRepris = useRef(false);

  // Matériel installé (mise en service et dépannage) — même fonctionnement que
  // dans la fiche client : plusieurs matériels, chacun avec ses groupes
  // extérieurs et unités intérieures. Aucun matériel vide n'est pré-créé : le
  // compteur part de zéro.
  const [machines, setMachines] = useState(() => {
    const existantes = (editingReport?.machines || []).map((m, i) => ({
      id: "m" + i + "_" + Date.now(),
      type: m.type || installTypes[0],
      date: m.date || new Date().toLocaleDateString("fr-FR"),
      exterieur: normalizeUnits(m.exterieur).map(unitePropre),
      interieur: normalizeUnits(m.interieur).map(unitePropre),
    }));
    if (existantes.length > 0) return existantes;

    // Nouveau rapport ouvert avec un client déjà connu (depuis le planning ou
    // la fiche client) : on reprend d'emblée le matériel de sa fiche.
    if (!editingReport && initialClient) {
      const duClient = machinesDepuisFiche(clients.find((cl) => cl.nom === initialClient));
      materielRepris.current = duClient.length > 0;
      return duClient;
    }
    return [];
  });
  const [signatureTech, setSignatureTech] = useState(editingReport?.signatureTech || "");
  const [signatureClient, setSignatureClient] = useState(editingReport?.signatureClient || "");
  const descriptionRef = useRef(editingReport?.description || "");
  const fileRef = useRef();

  // Quand on choisit un client déjà enregistré, on reprend automatiquement le
  // type de son premier matériel installé ET la totalité du matériel de sa
  // fiche — sans écraser la valeur d'un rapport ouvert en modification (d'où le
  // saut du tout premier rendu).
  // Fiche du client sélectionné : sert à reprendre son adresse par défaut et à
  // indiquer, sous le champ, celle qui figurera sur le rapport.
  const ficheClient = clients.find((c) => c.nom === client);

  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) { premierRendu.current = false; return; }
    const c = clients.find((cl) => cl.nom === client);
    const type = c?.machines?.[0]?.type;
    if (type) setInstallation(type);

    setMachines((actuelles) => {
      if (actuelles.length > 0 && !materielRepris.current) return actuelles;
      const duClient = machinesDepuisFiche(c);
      materielRepris.current = duClient.length > 0;
      return duClient;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  useEffect(() => {
    if (isEditing) return;
    setChecklists([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const [photosEnCours, setPhotosEnCours] = useState(false);
  const [photosErreur, setPhotosErreur] = useState(null);

  const handlePhotos = async (e) => {
    const fichiers = Array.from(e.target.files || []);
    // On vide la sélection tout de suite : sans cela, reprendre exactement la
    // même photo ne déclenche aucun événement et semble ne rien faire.
    e.target.value = "";
    if (fichiers.length === 0) return;

    setPhotosEnCours(true);
    setPhotosErreur(null);
    // Traitement une par une : plus lent, mais un iPhone ne sature pas sa
    // mémoire sur une série de photos en pleine résolution.
    for (const fichier of fichiers) {
      try {
        const image = await preparerImage(fichier);
        setPhotos((p) => [...p, image]);
      } catch (err) {
        setPhotosErreur("Une photo n'a pas pu être ajoutée : " + String(err?.message || err));
      }
    }
    setPhotosEnCours(false);
  };

  const retirerPhoto = (index) => setPhotos((p) => p.filter((_, i) => i !== index));

  // Dès que l'utilisateur touche au matériel, il devient le sien : un changement
  // de client ne le remplacera plus.
  const addMachine = () => { materielRepris.current = false; setMachines((list) => [...list, blankMachine()]); };
  const updateMachine = (id, next) => { materielRepris.current = false; setMachines((list) => list.map((m) => (m.id === id ? next : m))); };
  const removeMachine = (id) => { materielRepris.current = false; setMachines((list) => list.filter((m) => m.id !== id)); };
  // On ne conserve que les matériels réellement renseignés.
  const cleanMachines = () =>
    machines
      .filter((m) =>
        m.exterieur.some((u) => u.marque.trim() || u.serie.trim()) ||
        m.interieur.some((u) => u.marque.trim() || u.serie.trim())
      )
      .map(({ id, ...m }) => m);

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
      return { ...base, adresseSite, intro: introRef.current, machines: cleanMachines(), checklists: cleanChecklists(), tables, descriptionLibre: descriptionLibreRef.current, conclusion, remarques, montant, tva, devisAEffectuer };
    } else if (reportType === "entretien") {
      return { ...base, adresseSite, intro: introRef.current, machines: cleanMachines(), checklists: cleanChecklists(), tables, descriptionLibre: descriptionLibreRef.current, conclusion, remarques, montant, tva, devisAEffectuer };
    } else {
      return { ...base, adresseSite, intro: introRef.current, machines: cleanMachines(), description: descriptionRef.current, checklists: cleanChecklists(), tables, pieces, facturable, conclusion, remarques, montant, tva, devisAEffectuer };
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
        <div className="field-col">
          Client
          <ClientSearchSelect
            clients={clients}
            value={client}
            onChange={setClient}
            placeholder="Taper les premières lettres du nom, ou dérouler la liste"
          />
        </div>
        <label>Type d'installation
          <select value={installation} onChange={(e) => setInstallation(e.target.value)}>
            {installTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>Date
          <input type="date" value={frToIso(date)} onChange={(e) => setDate(isoToFr(e.target.value))} />
        </label>

        <div className="field-col grid-full">
          Adresse du site
          <AdresseInput
            value={adresseSite}
            onChange={setAdresseSite}
            placeholder={ficheClient && ficheClient.adresse ? "Laisser vide pour utiliser l'adresse de la fiche client" : "Adresse où s'est déroulée l'intervention"}
          />
          <span className="hint">
            {adresseSite.trim()
              ? "Cette adresse figurera sur le rapport et le PDF, à la place de celle de la fiche client."
              : ficheClient && ficheClient.adresse
              ? `Adresse de la fiche client utilisée : ${ficheClient.adresse}`
              : "Aucune adresse dans la fiche de ce client : indiquez-la ici pour qu'elle figure sur le rapport."}
          </span>
        </div>
      </div>

      {reportType === "mise_en_service" && (
        <>
          <div className="block field-block mb-lg">
            <div className="field-caption">Objet</div>
            <RichTextEditor initialValue={editingReport?.intro || ""} onChange={(html) => { introRef.current = html; }} minHeight={100} />
          </div>

          <div className="block mt">
            <button type="button" className="machine-section-toggle section-toggle-bar" onClick={() => setShowMachinesSection(!showMachinesSection)}>
              <span>Matériel installé ({machines.length})</span>
              <Icon name={showMachinesSection ? "chevronDown" : "chevronRight"} size={18} />
            </button>
            {showMachinesSection && (
              <div className="mt">
                {machines.map((m, i) => (
                  <CollapsibleMachineCard
                    key={m.id}
                    machine={m}
                    index={i}
                    defaultOpen
                    onChange={(next) => updateMachine(m.id, next)}
                    onRemove={() => removeMachine(m.id)}
                    removable
                  />
                ))}
                {machines.length === 0 && <p className="empty">Aucun matériel renseigné.</p>}
                <button type="button" className="btn-ghost small" onClick={addMachine}>
                  <Icon name="plus" size={14} /> Ajouter un matériel
                </button>
              </div>
            )}
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

          <div className="block mt">
            <button type="button" className="machine-section-toggle section-toggle-bar" onClick={() => setShowMachinesSection(!showMachinesSection)}>
              <span>Matériel installé ({machines.length})</span>
              <Icon name={showMachinesSection ? "chevronDown" : "chevronRight"} size={18} />
            </button>
            {showMachinesSection && (
              <div className="mt">
                {machines.map((m, i) => (
                  <CollapsibleMachineCard
                    key={m.id}
                    machine={m}
                    index={i}
                    defaultOpen
                    onChange={(next) => updateMachine(m.id, next)}
                    onRemove={() => removeMachine(m.id)}
                    removable
                  />
                ))}
                {machines.length === 0 && <p className="empty">Aucun matériel renseigné.</p>}
                <button type="button" className="btn-ghost small" onClick={addMachine}>
                  <Icon name="plus" size={14} /> Ajouter un matériel
                </button>
              </div>
            )}
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

          <div className="block mt">
            <button type="button" className="machine-section-toggle section-toggle-bar" onClick={() => setShowMachinesSection(!showMachinesSection)}>
              <span>Matériel installé ({machines.length})</span>
              <Icon name={showMachinesSection ? "chevronDown" : "chevronRight"} size={18} />
            </button>
            {showMachinesSection && (
              <div className="mt">
                {machines.map((m, i) => (
                  <CollapsibleMachineCard
                    key={m.id}
                    machine={m}
                    index={i}
                    defaultOpen
                    onChange={(next) => updateMachine(m.id, next)}
                    onRemove={() => removeMachine(m.id)}
                    removable
                  />
                ))}
                {machines.length === 0 && <p className="empty">Aucun matériel renseigné.</p>}
                <button type="button" className="btn-ghost small" onClick={addMachine}>
                  <Icon name="plus" size={14} /> Ajouter un matériel
                </button>
              </div>
            )}
          </div>

          <div className="block field-block">
            <div className="field-caption">Description</div>
            <RichTextEditor initialValue={editingReport?.description || ""} onChange={(html) => { descriptionRef.current = html; }} minHeight={200} />
          </div>
          <ChecklistsSection checklists={checklists} setChecklists={setChecklists} settings={settings} reportType="diagnostic" />

          <TablesSection tables={tables} checklist={allChecklistItems(checklists)} settings={settings} updateTable={updateTable} removeTable={removeTable} addTable={addTable} insertTemplateTable={insertTemplateTable} />

          <label className="block mt">Conclusion
            <textarea rows={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="Ex : panne résolue, installation remise en service." />
            <span className="hint">Le titre « Conclusion » n'apparaît dans le rapport que si ce champ est rempli.</span>
          </label>

          <label className="block mt">Remarques
            <textarea rows={3} value={remarques} onChange={(e) => setRemarques(e.target.value)} placeholder="Observations, recommandations au client..." />
            <span className="hint">Le titre « Remarques » n'apparaît dans le rapport que si ce champ est rempli.</span>
          </label>

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

          <label className="block">Devis à effectuer pour la réparation
            <textarea rows={2} value={devisAEffectuer} onChange={(e) => setDevisAEffectuer(e.target.value)} placeholder="Ex : remplacement compresseur, prévoir devis ~450 €" />
            <span className="hint">Renseigné, ce champ crée automatiquement une ligne dans l'onglet Devis → « à faire ».</span>
          </label>
        </>
      )}

      <div className="block mt field-block">
        <div className="field-caption">Photos</div>
        <button type="button" className="photo-upload" onClick={() => fileRef.current && fileRef.current.click()} disabled={photosEnCours}>
          <Icon name="photo" /> {photosEnCours ? "Ajout en cours..." : "Ajouter des photos"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handlePhotos} />
        {photosErreur && (
          <div className="entretien-annuel-badge late">
            <Icon name="alert" size={14} /> {photosErreur}
          </div>
        )}
        {photos.length > 0 && (
          <div className="photo-strip">
            {photos.map((src, i) => (
              <div key={i} className="photo-vignette">
                <img src={src} alt={"Photo " + (i + 1)} />
                <button type="button" className="icon-btn" onClick={() => retirerPhoto(i)} title="Retirer cette photo">
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
        <button className="btn-primary" onClick={submit} disabled={!client.trim()} title={!client.trim() ? "Choisissez d'abord un client" : ""}>{isEditing ? "Enregistrer les modifications" : "Enregistrer le rapport"}</button>
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
      {extUnits.some((u) => (u.fluide || "").trim() || (u.quantiteFluide || "").toString().trim()) && (
        <div className="charge-fluide">
          {extUnits.map((u, idx) => {
            const fluide = (u.fluide || "").trim();
            const quantite = (u.quantiteFluide || "").toString().trim();
            if (!fluide && !quantite) return null;
            return (
              <div key={"f" + idx}>
                <strong>Charge en fluide{extUnits.length > 1 ? ` (groupe ${idx + 1})` : ""} :</strong>{" "}
                {[fluide, quantite ? quantite.replace(".", ",") + " kg" : ""].filter(Boolean).join(" — ")}
              </div>
            );
          })}
        </div>
      )}
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
  const [recherche, setRecherche] = useState("");

  // Tri alphabétique sur le libellé réellement affiché — la raison sociale pour
  // un professionnel, le nom sinon. Trier sur le nom du contact donnait une
  // liste qui paraissait en désordre, puisque ce n'est pas ce qu'on lit.
  const clientsTries = [...clients].sort((a, b) =>
    libelleClient(a).localeCompare(libelleClient(b), "fr", { sensitivity: "base" })
  );

  const sansAccent = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const termeRecherche = sansAccent(recherche).trim();
  const clientsAffiches = termeRecherche
    ? clientsTries.filter((c) =>
        [c.nom, c.raisonSociale, c.adresse, c.tel, c.email].some((champ) =>
          sansAccent(champ).includes(termeRecherche)
        )
      )
    : clientsTries;
  const [selected, setSelected] = useState(clients[0]?.id);
  const [editingClient, setEditingClient] = useState(null);
  const [showContract, setShowContract] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showMachines, setShowMachines] = useState(false);
  // La fiche est repliée par défaut : sur téléphone, l'historique reste ainsi
  // accessible sans faire défiler tout le détail du client.
  const [ficheOuverte, setFicheOuverte] = useState(false);
  // Aucun client affiché tant qu'aucun n'est sélectionné (cas d'une création
  // en cours) : on ne retombe donc plus systématiquement sur le premier.
  const client = selected ? clients.find((c) => c.id === selected) : null;

  const formRef = useRef(null);
  const ficheRef = useRef(null);
  const premierAffichage = useRef(true);

  const openNew = () => { setEditingClient(null); setSelected(null); setShowForm(true); };
  const openEdit = (c) => { setEditingClient(c); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingClient(null); };

  useEffect(() => {
    setShowContract(false);
    setFicheOuverte(false);
    setShowMachines(false);
  }, [selected]);

  // La fiche s'affiche sous la liste : on y amène la page automatiquement, pour
  // ne pas avoir à faire défiler à la main sur téléphone. On ne le fait pas au
  // tout premier affichage de l'onglet, qui ne résulte d'aucun clic.
  useEffect(() => {
    if (premierAffichage.current) { premierAffichage.current = false; return; }
    if (selected && !showForm && ficheRef.current) {
      ficheRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="recherche-client">
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un client : nom, raison sociale, ville, téléphone..."
          />
          {recherche && (
            <button type="button" className="icon-btn" onClick={() => setRecherche("")} title="Effacer la recherche">
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
        {termeRecherche && (
          <p className="hint">
            {clientsAffiches.length} client{clientsAffiches.length > 1 ? "s" : ""} sur {clients.length}
          </p>
        )}
        <ul className="list">
          {clientsAffiches.length === 0 && <li className="empty">Aucun client ne correspond à cette recherche.</li>}
          {clientsAffiches.map((c) => (
            <li
              key={c.id}
              className={"row clickable" + (client?.id === c.id ? " selected" : "")}
              onClick={() => { setSelected(c.id); closeForm(); }}
            >
              <div>
                <div className="row-title">
                  {libelleClient(c)}
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
                <div className="row-sub">{c.raisonSociale ? c.nom + " · " : ""}{c.machines.length} matériel(s) installé{c.machines.length > 1 ? "s" : ""}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {client && !showForm && (
        <div ref={ficheRef} className="fiche-ancre">
          <ClientFiche
            client={client}
            reports={reports}
            ouverte={ficheOuverte}
            onToggle={() => setFicheOuverte((v) => !v)}
            showMachines={showMachines}
            setShowMachines={setShowMachines}
            onEdit={() => openEdit(client)}
            onDelete={() => onDelete(client)}
            onShowContract={() => setShowContract(true)}
          />
        </div>
      )}

      {client && (
        <ClientHistory client={client} reports={reports} devisAFaire={devisAFaire} devisEnCours={devisEnCours} facturation={facturation} onOpenReport={onOpenReport} onNavigate={onNavigate} onDeleteFacturation={onDeleteFacturation} />
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

function ClientFiche({ client, reports, ouverte, onToggle, showMachines, setShowMachines, onEdit, onDelete, onShowContract }) {
  const estProfessionnel =
    typeof client.professionnel === "boolean"
      ? client.professionnel
      : !!(client.raisonSociale || client.siren || client.tva);

  return (
    <section className="card">
      <button type="button" className="machine-section-toggle fiche-bandeau" onClick={onToggle}>
        <span>
          <span className="fiche-bandeau-nom">{libelleClient(client)}</span>
          {client.raisonSociale && <span className="fiche-bandeau-contact">{client.nom}</span>}
        </span>
        <Icon name={ouverte ? "chevronDown" : "chevronRight"} size={18} />
      </button>

      {!ouverte && <p className="hint">Touchez le nom pour afficher la fiche complète.</p>}

      {ouverte && (
      <>
      <div className="row-between fiche-actions-row">
        <div />
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
        <div className="fiche-item">
          <div className="fiche-label">Téléphone</div>
          {client.tel
            ? <TelephoneLien numero={client.tel} className="fiche-value" />
            : <div className="fiche-value vide">Non renseigné</div>}
        </div>
        <FicheLigne label="Email" value={client.email} />
        <div className="fiche-item">
          <div className="fiche-label">Adresse</div>
          {client.adresse
            ? <AdresseLien adresse={client.adresse} className="fiche-value" />
            : <div className="fiche-value vide">Non renseigné</div>}
        </div>
        <FicheLigne label="Mois de l'entretien contractuel" value={nomDuMois(client.moisEcheance)} />
        <FicheLigne label="Contrat de maintenance" value={client.contrat ? (client.contrat.nom || "Contrat enregistré") : ""} />
      </div>

      <button type="button" className="machine-section-toggle" onClick={() => setShowMachines(!showMachines)}>
        <h4 className="mt">Matériel installé ({client.machines.length})</h4>
        <Icon name={showMachines ? "chevronDown" : "chevronRight"} size={18} />
      </button>
      {showMachines && client.machines.length === 0 && <p className="empty">Aucun matériel enregistré pour ce client.</p>}
      {showMachines && client.machines.map((m, i) => <MachineBlock key={i} machine={m} />)}
      </>
      )}
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
      <h3>Historique — {libelleClient(client)}</h3>
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
  const handleFile = async (e) => {
    const fichier = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!fichier) return;
    try {
      onChange(await preparerImage(fichier));
    } catch (_err) {
      // Photo illisible : on laisse le champ en l'état plutôt que d'écraser.
    }
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
        <button type="button" className="photo-upload" onClick={() => fileRef.current && fileRef.current.click()}>
          <Icon name="photo" size={16} /> Ajouter une photo
        </button>
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
  const addExt = () => onChange({ ...machine, exterieur: [...extList, unitePropre()] });
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
          <div className="form-grid">
            <label>Fluide frigorigène
              <select
                value={fluides.includes(u.fluide) || !u.fluide ? (u.fluide || "") : "__autre__"}
                onChange={(e) => updateExtAt(idx, { fluide: e.target.value === "__autre__" ? " " : e.target.value })}
              >
                <option value="">Non renseigné</option>
                {fluides.map((f) => <option key={f} value={f}>{f}</option>)}
                <option value="__autre__">Autre...</option>
              </select>
            </label>
            <label>Quantité (kg)
              <input
                type="number" step="0.01" min="0" inputMode="decimal"
                value={u.quantiteFluide || ""}
                onChange={(e) => updateExtAt(idx, { quantiteFluide: e.target.value })}
                placeholder="Ex : 2,45"
              />
            </label>
          </div>
          {u.fluide && !fluides.includes(u.fluide) && (
            <label className="block">Fluide (saisie libre)
              <input value={u.fluide.trim()} onChange={(e) => updateExtAt(idx, { fluide: e.target.value || " " })} placeholder="Ex : R422D" />
            </label>
          )}
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
// Fluides frigorigènes couramment rencontrés en climatisation et pompe à
// chaleur. La liste accélère la saisie sur le terrain ; « Autre » laisse la
// main libre pour un fluide absent de la liste.
const fluides = ["R32", "R410A", "R454B", "R290", "R134a", "R407C", "R1234ze", "R744 (CO2)", "R600a"];

function unitePropre(u) {
  return { marque: "", modele: "", serie: "", photo: "", fluide: "", quantiteFluide: "", ...(u || {}) };
}

function normalizeUnits(u) {
  if (Array.isArray(u)) return u.length > 0 ? u.map(unitePropre) : [unitePropre()];
  if (u && typeof u === "object") return [unitePropre(u)];
  return [unitePropre()];
}

// Convertit le matériel d'une fiche client au format utilisé dans les rapports
// (un identifiant propre à chaque carte, et des unités toujours complètes).
function machinesDepuisFiche(fiche) {
  return (fiche?.machines || []).map((m, i) => ({
    id: "mc" + i + "_" + Date.now(),
    type: m.type || installTypes[0],
    date: m.date || new Date().toLocaleDateString("fr-FR"),
    exterieur: normalizeUnits(m.exterieur).map(unitePropre),
    interieur: normalizeUnits(m.interieur).map(unitePropre),
  }));
}

function blankMachine() {
  return {
    id: "m" + Date.now() + Math.random().toString(16).slice(2),
    type: installTypes[0],
    date: new Date().toLocaleDateString("fr-FR"),
    exterieur: [unitePropre()],
    interieur: [unitePropre()],
  };
}

function ClientForm({ editingClient, onCancel, onSubmit }) {
  const isEditing = !!editingClient;
  const [nom, setNom] = useState(editingClient?.nom || "");
  const [raisonSociale, setRaisonSociale] = useState(editingClient?.raisonSociale || "");
  const [estProfessionnel, setEstProfessionnel] = useState(
    typeof editingClient?.professionnel === "boolean"
      ? editingClient.professionnel
      : !!(editingClient?.raisonSociale || editingClient?.siren || editingClient?.tva)
  );
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
      exterieur: normalizeUnits(m.exterieur).map(unitePropre),
      interieur: normalizeUnits(m.interieur).map(unitePropre),
    }));
    return existing;
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
      setContrat({ nom: file.name, data: base64, dateAjout: new Date().toLocaleDateString("fr-FR"), ajouteLe: Date.now() });
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
      // La case « Professionnel » est enregistrée telle quelle : c'est elle qui
      // décide de la nature de la fiche créée dans Pennylane (société ou
      // particulier), et non la présence d'une raison sociale.
      professionnel: estProfessionnel,
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
            <div className="field-col">
              Raison sociale
              <EntrepriseInput
                value={raisonSociale}
                onChange={setRaisonSociale}
                onSelectEntreprise={(e) => {
                  // Un seul geste renseigne les trois informations légales, et
                  // l'adresse du siège si le champ est encore vide.
                  setRaisonSociale(e.nom);
                  setSiren(formaterSiren(e.siren));
                  setTva(tvaDepuisSiren(e.siren));
                  if (!adresse.trim() && e.adresse) setAdresse(e.adresse);
                }}
                placeholder="Tapez le nom de l'entreprise, la liste se complète..."
              />
              <span className="hint">Choisissez l'entreprise dans la liste : SIREN et TVA seront remplis automatiquement.</span>
            </div>

            <label>SIREN
              <input value={siren} onChange={(e) => setSiren(formaterSiren(e.target.value))} inputMode="numeric" placeholder="Ex : 123 456 789" />
              {/* On n'alerte qu'une fois les neuf chiffres saisis : sinon le
                  message clignoterait pendant toute la frappe. */}
              {siren.replace(/\D/g, "").length === 9 && !sirenCleValide(siren) && (
                <span className="hint alerte">
                  <Icon name="alert" size={12} /> Ce SIREN comporte une erreur : vérifiez les chiffres.
                </span>
              )}
              {siren.trim() && sirenCleValide(siren) && !tva.trim() && (
                <button type="button" className="btn-ghost small mt-xs" onClick={() => setTva(tvaDepuisSiren(siren))}>
                  Calculer le n° de TVA
                </button>
              )}
            </label>

            <label>N° de TVA intracommunautaire
              <input value={tva} onChange={(e) => setTva(e.target.value.toUpperCase())} placeholder="Ex : FR12345678900" />
              {tva.trim() && sirenCleValide(siren) && tva.replace(/\s/g, "").toUpperCase() !== tvaDepuisSiren(siren) && (
                <span className="hint alerte">
                  <Icon name="alert" size={12} /> Ce numéro ne correspond pas au SIREN saisi (attendu : {tvaDepuisSiren(siren)}).
                </span>
              )}
            </label>
          </>
        )}
        <label>Téléphone<input value={tel} onChange={(e) => setTel(formaterTelephone(e.target.value))} inputMode="tel" placeholder="06 00 00 00 00" /></label>
        <div className="field-col">
          Adresse
          <AdresseInput value={adresse} onChange={setAdresse} placeholder="Commencez à taper l'adresse..." />
        </div>
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
          defaultOpen
          onChange={(next) => updateMachine(m.id, next)}
          onRemove={() => removeMachine(m.id)}
          removable
        />
      ))}
      {machines.length === 0 && <p className="empty">Aucun matériel renseigné.</p>}
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
  const dateHeures = {};
  dates.forEach((d) => {
    dateCounts[d] = grouped[d].length;
    dateHeures[d] = grouped[d].reduce((total, t) => total + dureeEnHeures(t.duree), 0);
  });
  // On ouvre toujours le planning sur la journée en cours (et non sur la plus
  // ancienne date programmée). Si l'application reste ouverte au passage de
  // minuit, ou revient au premier plan un autre jour, la sélection bascule
  // automatiquement sur le nouveau jour.
  const [selectedDate, setSelectedDate] = useState(() => toLocalISODate(new Date()));
  const jourAffiche = useRef(toLocalISODate(new Date()));

  useEffect(() => {
    const verifierJour = () => {
      const aujourdhui = toLocalISODate(new Date());
      if (aujourdhui !== jourAffiche.current) {
        jourAffiche.current = aujourdhui;
        setSelectedDate(aujourdhui);
      }
    };
    const timer = setInterval(verifierJour, 60000);
    document.addEventListener("visibilitychange", verifierJour);
    window.addEventListener("focus", verifierJour);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", verifierJour);
      window.removeEventListener("focus", verifierJour);
    };
  }, []);
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

      <MiniCalendar dateCounts={dateCounts} dateHeures={dateHeures} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

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
                    <div className="row-sub">{nomAffiche(p.client, clients)} {p.heure !== "—" && `· ${p.heure}`}{p.duree && ` · ${p.duree}`}</div>
                    {(() => {
                      const fiche = clients.find((c) => c.nom === p.client);
                      const adresseTache = (p.adresse && p.adresse.trim()) || (fiche && fiche.adresse);
                      const telTache = (p.tel && p.tel.trim()) || (fiche && fiche.tel);
                      return (
                        <>
                          {adresseTache ? <AdresseLien adresse={adresseTache} /> : null}
                          {telTache ? <TelephoneLien numero={telTache} /> : null}
                          {p.notes && p.notes.trim() ? <div className="tache-notes">{p.notes}</div> : null}
                        </>
                      );
                    })()}
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
function MiniCalendar({ dateCounts, dateHeures, selectedDate, onSelectDate }) {
  const todayIso = toLocalISODate(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Si le jour sélectionné se trouve dans un autre mois (changement de date
  // automatique, notamment au passage d'un mois à l'autre), on affiche ce mois.
  useEffect(() => {
    if (!selectedDate) return;
    const [a, m] = selectedDate.split("-").map(Number);
    if (!a || !m) return;
    setCursor((c) => (c.year === a && c.month === m - 1 ? c : { year: a, month: m - 1 }));
  }, [selectedDate]);

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
  // La couleur traduit la charge de la journée : le nombre d'interventions,
  // mais aussi le temps qu'elles occupent. Une seule intervention à la journée
  // remplit l'agenda tout autant que quatre interventions courtes.
  const classeCharge = (count, heures) => {
    if (count >= 4 || heures >= HEURES_JOURNEE_PLEINE) return "charge-4";
    if (count === 3) return "charge-3";
    if (count === 2) return "charge-2";
    return "charge-1";
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
          const heures = (dateHeures || {})[iso] || 0;
          const journeePleine = heures >= HEURES_JOURNEE_PLEINE;
          const hasTask = count > 0;
          const isToday = iso === todayIso;
          return (
            <button
              type="button"
              key={iso}
              className={
                "mini-calendar-cell clickable-day" +
                (hasTask ? " has-task " + classeCharge(count, heures) : "") +
                (isJourneeDaikin(day) ? " est-daikin" : "") +
                (isToday ? " is-today" : "") +
                (iso === selectedDate ? " is-selected" : "")
              }
              onClick={() => onSelectDate(iso)}
              title={
                (isJourneeDaikin(day) ? "Journée DAIKIN — " : "") +
                (hasTask
                  ? `${count} intervention${count > 1 ? "s" : ""}${journeePleine ? " — journée complète" : ""} — voir le détail`
                  : "Voir ce jour / ajouter une tâche")
              }
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="mini-calendar-legend">
        <span><span className="mini-calendar-ech charge-1" /> 1</span>
        <span><span className="mini-calendar-ech charge-2" /> 2</span>
        <span><span className="mini-calendar-ech charge-3" /> 3</span>
        <span><span className="mini-calendar-ech charge-4" /> 4+ ou journée pleine</span>
        <span><span className="mini-calendar-ech daikin" /> Mar/Mer (DAIKIN)</span>
      </div>
    </div>
  );
}

function TaskForm({ clients, onCancel, onSubmit, forceCategorie, hideRappelToggle, submitLabel, initialDate, editingTask }) {
  const [titre, setTitre] = useState(editingTask?.titre || "");
  const [client, setClient] = useState(editingTask?.client || "");
  const [date, setDate] = useState(editingTask?.date || initialDate || toLocalISODate(new Date()));
  const [heure, setHeure] = useState(editingTask?.heure && editingTask.heure !== "—" ? editingTask.heure : "08:30");
  const [duree, setDuree] = useState(editingTask?.duree || "1h");
  const [rappel, setRappel] = useState(editingTask ? !!editingTask.rappel : true);
  // Adresse saisie à la main, utilisée uniquement pour les clients qui ne sont
  // pas encore dans le fichier (prospects) : pour les autres, on affiche
  // directement celle de leur fiche.
  const [adresse, setAdresse] = useState(editingTask?.adresse || "");
  // Téléphone saisi à la main, pour un client qui n'est pas encore au fichier.
  const [tel, setTel] = useState(editingTask?.tel || "");
  const [notes, setNotes] = useState(editingTask?.notes || "");

  const clientConnu = clients.find((c) => c.nom === client);
  // L'adresse du site l'emporte toujours ; à défaut, on retombe sur celle de la
  // fiche client.
  const adresseNavigation = (adresse && adresse.trim()) || (clientConnu && clientConnu.adresse) || "";

  const submit = () => {
    if (!titre) return;
    onSubmit({
      id: editingTask?.id || ("p" + Date.now()),
      titre,
      client,
      date,
      heure,
      duree,
      adresse,
      tel,
      notes,
      rappel: hideRappelToggle ? true : rappel,
      fait: editingTask?.fait || false,
      categorie: editingTask?.categorie || forceCategorie || "intervention",
    });
  };

  return (
    <div className="card form-card">
      <div className="form-grid">
        <label>Intitulé<input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex : Entretien annuel" /></label>
        <div className="field-col">
          Client
          <ClientSearchSelect
            clients={clients}
            value={client}
            onChange={setClient}
            placeholder="Rechercher un client existant, ou en taper un nouveau"
          />
          {clientConnu && (
            <span className="hint">
              {clientConnu.adresse ? `Adresse de la fiche : ${clientConnu.adresse}` : "Aucune adresse dans la fiche de ce client."}
            </span>
          )}
        </div>
        <div className="field-col grid-full">
          Adresse du site
          <AdresseInput
            value={adresse}
            onChange={setAdresse}
            placeholder={clientConnu && clientConnu.adresse ? "Laisser vide pour utiliser l'adresse de la fiche client" : "Adresse où se déroule l'intervention"}
          />
          <span className="hint">
            Utile pour un client professionnel chez qui vous intervenez sur le site de son propre client. C'est cette adresse qui sera ouverte dans votre application de navigation.
          </span>
          {adresseNavigation && <AdresseLien adresse={adresseNavigation} />}
        </div>

        {clientConnu ? (
          <div className="field-col">
            Téléphone
            {clientConnu.tel
              ? <TelephoneLien numero={clientConnu.tel} />
              : <span className="hint">Aucun numéro dans la fiche de ce client.</span>}
          </div>
        ) : (
          <label>Téléphone
            <input
              value={tel}
              onChange={(e) => setTel(formaterTelephone(e.target.value))}
              inputMode="tel"
              placeholder="06 00 00 00 00"
            />
            <span className="hint">Ce client n'est pas encore au fichier : notez son numéro ici.</span>
          </label>
        )}

        <label className="grid-full">Notes
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex : code portail 1234, prévoir échelle, intervenir côté cour..."
          />
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
    // À l'intérieur d'un mois, de la plus ancienne à la plus récente : les
    // factures qui traînent le plus remontent ainsi en tête de liste.
    items: [...groups[key].items].sort((a, b) => {
      const da = parseFrDate(a[dateField]);
      const db = parseFrDate(b[dateField]);
      if (!da || !db) return 0;
      return da - db;
    }),
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

/* ---------- Ajout manuel d'un devis ----------
   Les devis arrivent normalement depuis un rapport d'intervention. Ce
   formulaire permet d'en saisir un directement : soit un devis à établir, soit
   un devis déjà envoyé au client et en attente de réponse. */
function DevisForm({ clients, onAjoutAFaire, onAjoutEnCours, onCancel }) {
  const [etat, setEtat] = useState("a_faire");
  const [client, setClient] = useState("");
  const [objet, setObjet] = useState("");
  const [date, setDate] = useState(toLocalISODate(new Date()));
  const [montant, setMontant] = useState("");
  const [statut, setStatut] = useState("bientot");

  const enregistrer = () => {
    if (!client.trim()) return;
    if (etat === "a_faire") {
      onAjoutAFaire({
        id: "df" + Date.now(),
        client,
        origine: objet.trim() || "Devis à établir",
        date: isoToFr(date),
      });
    } else {
      onAjoutEnCours({
        id: "de" + Date.now(),
        client,
        montant: montant.trim() ? `${montant.trim()} €` : "Montant à préciser",
        objet: objet.trim(),
        envoye: isoToFr(date),
        statut,
      });
    }
    onCancel();
  };

  return (
    <div className="card form-card">
      <div className="type-toggle">
        <button className={"toggle-btn" + (etat === "a_faire" ? " active" : "")} onClick={() => setEtat("a_faire")}>
          Devis à faire
        </button>
        <button className={"toggle-btn" + (etat === "en_cours" ? " active" : "")} onClick={() => setEtat("en_cours")}>
          Devis déjà envoyé
        </button>
      </div>

      <div className="form-grid">
        <div className="field-col">
          Client
          <ClientSearchSelect
            clients={clients}
            value={client}
            onChange={setClient}
            placeholder="Taper les premières lettres du nom, ou dérouler la liste"
          />
        </div>
        <label>{etat === "a_faire" ? "Date" : "Date d'envoi"}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {etat === "en_cours" && (
          <>
            <label>Montant (€, facultatif)
              <input type="number" step="0.01" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Ex : 1250" />
            </label>
            <label>Suivi
              <select value={statut} onChange={(e) => setStatut(e.target.value)}>
                <option value="bientot">À relancer bientôt</option>
                <option value="a_relancer">À relancer maintenant</option>
                <option value="relance_faite">Relance déjà faite</option>
              </select>
            </label>
          </>
        )}
        <label className="grid-full">Objet du devis
          <textarea rows={2} value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Ex : remplacement groupe extérieur, ajout d'une unité intérieure..." />
        </label>
      </div>

      <div className="form-actions">
        <button className="btn-ghost" onClick={onCancel}>Annuler</button>
        <button className="btn-primary" onClick={enregistrer} disabled={!client.trim()} title={!client.trim() ? "Choisissez d'abord un client" : ""}>
          Ajouter le devis
        </button>
      </div>
    </div>
  );
}

function Devis({ clients, devisAFaire, devisEnCours, onCreated, onRelance, onValide, onOpenClient, onAjoutAFaire, onAjoutEnCours }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>Devis</h1>
          <p>Devis à réaliser et devis en attente de réponse — cliquez une ligne pour voir le client</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Icon name="plus" size={16} /> Nouveau devis
        </button>
      </header>

      {showForm && (
        <DevisForm
          clients={clients}
          onAjoutAFaire={onAjoutAFaire}
          onAjoutEnCours={onAjoutEnCours}
          onCancel={() => setShowForm(false)}
        />
      )}

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
                  <div className="row-title">{nomAffiche(d.client, clients)}</div>
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
                  <div className="row-title">{nomAffiche(d.client, clients)} · {d.montant}</div>
                  <div className="row-sub">{d.objet ? d.objet + " · " : ""}Envoyé le {d.envoye}</div>
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

// Les montants sont stockés sous forme de texte ("120 €", "1 200,50 €" ou
// "À chiffrer" quand le rapport n'en comportait pas) : on en extrait la valeur
// numérique, et on ignore ce qui n'en contient aucune.
function montantEnNombre(texte) {
  if (!texte) return null;
  const nettoye = String(texte).replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, "");
  const valeur = parseFloat(nettoye);
  return isNaN(valeur) ? null : valeur;
}

function formatEuros(valeur) {
  return valeur.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

/* ---------- Facturation ---------- */
// Date d'une ligne de facturation. On s'appuie d'abord sur le champ prévu pour
// ça ; s'il manque ou n'est pas lisible (lignes créées par d'anciennes versions
// du logiciel), on récupère la date affichée dans le libellé de l'intervention.
function dateFacture(f) {
  const directe = parseFrDate(f.date);
  if (directe) return directe;
  const trouvee = String(f.intervention || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (trouvee) return new Date(Number(trouvee[3]), Number(trouvee[2]) - 1, Number(trouvee[1]));
  return null;
}

// De la plus ancienne à la plus récente ; les lignes sans date exploitable
// ferment la marche plutôt que de se glisser n'importe où.
function trierParDate(liste) {
  return [...liste].sort((a, b) => {
    const da = dateFacture(a);
    const db = dateFacture(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });
}

function Facturation({ clients, facturation, onFacturer, onPayer, onSyncPennylane, onRetryPennylane, onDeleteFacturation, onOpenClient }) {
  const aFacturer = trierParDate(facturation.filter((f) => !f.facture));
  const impayees = trierParDate(facturation.filter((f) => f.facture && !f.payee));
  const payees = trierParDate(facturation.filter((f) => f.facture && f.payee));
  const totalImpayees = impayees.reduce((somme, f) => somme + (montantEnNombre(f.montant) || 0), 0);
  const impayeesSansMontant = impayees.filter((f) => montantEnNombre(f.montant) === null).length;
  const totalPayees = payees.reduce((somme, f) => somme + (montantEnNombre(f.montant) || 0), 0);
  const payeesSansMontant = payees.filter((f) => montantEnNombre(f.montant) === null).length;

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
                <div className="row-title">{nomAffiche(f.client, clients)} · {f.montant}</div>
                <div className="row-sub">
                  {f.intervention}
                  {f.pennylaneStatus === "erreur" && (
                    <span className="pill pill-alert pennylane-error-pill" title={f.pennylaneError}>
                      <Icon name="alert" size={11} /> Échec envoi Pennylane
                    </span>
                  )}
                  {f.pennylaneAvertissement && (
                    <span className="pill pill-todo pennylane-error-pill" title={f.pennylaneAvertissement}>
                      <Icon name="alert" size={11} /> Fiche client non retrouvée
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
                <div className="row-title">{nomAffiche(f.client, clients)} · {f.montant}</div>
                <div className="row-sub">
                  {f.intervention}
                  {f.pennylaneInvoiceId && <span className="pill pill-pennylane">Pennylane</span>}
                  {f.pennylaneStatus === "erreur" && (
                    <span className="pill pill-alert pennylane-error-pill" title={f.pennylaneError}>
                      <Icon name="alert" size={11} /> Correction Pennylane impossible
                    </span>
                  )}
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
        {impayees.length > 0 && (
          <div className="total-ligne">
            <span>Total impayé</span>
            <strong>{formatEuros(totalImpayees)} HT</strong>
            {impayeesSansMontant > 0 && (
              <span className="hint">
                ({impayeesSansMontant} facture{impayeesSansMontant > 1 ? "s" : ""} sans montant, non comptée{impayeesSansMontant > 1 ? "s" : ""})
              </span>
            )}
          </div>
        )}
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
                  <div className="row-title">{nomAffiche(f.client, clients)} · {f.montant}</div>
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
          <div className="total-ligne total-ligne-ok">
            <span>Total encaissé</span>
            <strong>{formatEuros(totalPayees)} HT</strong>
            {payeesSansMontant > 0 && (
              <span className="hint">
                ({payeesSansMontant} facture{payeesSansMontant > 1 ? "s" : ""} sans montant, non comptée{payeesSansMontant > 1 ? "s" : ""})
              </span>
            )}
          </div>
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
  // Titre et tableau sont regroupés dans un bloc insécable : à l'impression,
  // l'ensemble bascule sur la page suivante plutôt que d'être coupé en deux.
  return `<div class="pdf-bloc-insecable">${titre}<table class="pdf-table"><tbody>${t.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
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

// Rend le matériel installé renseigné dans un rapport de mise en service :
// un tableau de références par matériel (marque, modèle, numéro de série).
function machinesToHtml(machines) {
  if (!machines || machines.length === 0) return "";
  const ligne = (label, u) => {
    if (!u.marque && !u.modele && !u.serie) return "";
    return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(u.marque)}</td><td>${escapeHtml(u.modele)}</td><td>${escapeHtml(u.serie)}</td></tr>`;
  };
  let html = `<h3 class="pdf-section-title">Matériel installé</h3>`;
  machines.forEach((m) => {
    const ext = normalizeUnits(m.exterieur);
    const int = normalizeUnits(m.interieur);
    html += `<div class="pdf-bloc-insecable">`;
    html += `<p class="pdf-machine-type"><strong>${escapeHtml(m.type || "")}</strong>${m.date ? ` — installé le ${escapeHtml(m.date)}` : ""}</p>`;
    html += `<table class="pdf-table"><tbody>`;
    html += `<tr><td></td><td><strong>Marque</strong></td><td><strong>Modèle</strong></td><td><strong>N° de série</strong></td></tr>`;
    ext.forEach((u, i) => { html += ligne("Groupe extérieur" + (ext.length > 1 ? " " + (i + 1) : ""), u); });
    int.forEach((u, i) => { html += ligne("Unité intérieure" + (int.length > 1 ? " " + (i + 1) : ""), u); });
    html += `</tbody></table>`;
    ext.forEach((u, i) => {
      const fluide = (u.fluide || "").trim();
      const quantite = (u.quantiteFluide || "").toString().trim();
      if (!fluide && !quantite) return;
      const detail = [fluide, quantite ? quantite.replace(".", ",") + " kg" : ""].filter(Boolean).join(" — ");
      html += `<p class="pdf-charge-fluide"><strong>Charge en fluide${ext.length > 1 ? " (groupe " + (i + 1) + ")" : ""} :</strong> ${escapeHtml(detail)}</p>`;
    });
    html += `</div>`;
  });
  return html;
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


function ConfirmationModal({ titre, children, onConfirmer, onAnnuler, libelleConfirmer }) {
  return (
    <div className="pdf-modal-overlay" onClick={onAnnuler}>
      <div className="pdf-modal-box pdf-modal-box-compact" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-modal-toolbar">
          <span className="pdf-modal-title"><Icon name="alert" size={16} /> {titre}</span>
        </div>
        <div className="confirmation-corps">{children}</div>
        <div className="confirmation-actions">
          <button className="btn-ghost" onClick={onAnnuler}>Ne rien changer</button>
          <button className="btn-primary" onClick={onConfirmer}>{libelleConfirmer || "Confirmer"}</button>
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

function buildReportHtml(report, settings, clients) {
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
  body += `<p><strong>Client :</strong> ${escapeHtml(nomAffiche(report.client, clients))}</p>`;
  const adresseSite = adresseDuRapport(report, clients);
  if (adresseSite) body += `<p><strong>Adresse du site :</strong> ${escapeHtml(adresseSite)}</p>`;
  body += `<p><strong>Date :</strong> ${escapeHtml(report.date)}</p>`;
  body += `<p><strong>Installation :</strong> ${escapeHtml(report.installation)}</p>`;

  if (report.type === "mise_en_service") {
    if (report.intro) body += `<p class="pdf-field-label"><strong>Objet :</strong></p><div class="pdf-description">${report.intro}</div>`;
    body += machinesToHtml(report.machines);
    if (report.descriptionLibre) body += `<p class="pdf-field-label"><strong>Description :</strong></p><div class="pdf-description">${report.descriptionLibre}</div>`;
    body += checklistsToHtml(report);
    if (report.conclusion) body += `<h3 class="pdf-section-title">Conclusion</h3><p class="pdf-texte-libre">${nl2br(report.conclusion)}</p>`;
    if (report.remarques) body += `<h3 class="pdf-section-title">Remarques</h3><p class="pdf-texte-libre">${nl2br(report.remarques)}</p>`;
  } else if (report.type === "entretien") {
    if (report.intro) body += `<p class="pdf-field-label"><strong>Objet :</strong></p><div class="pdf-description">${report.intro}</div>`;
    body += machinesToHtml(report.machines);
    if (report.descriptionLibre) body += `<p class="pdf-field-label"><strong>Description :</strong></p><div class="pdf-description">${report.descriptionLibre}</div>`;
    body += checklistsToHtml(report);
    if (report.conclusion) body += `<h3 class="pdf-section-title">Conclusion</h3><p class="pdf-texte-libre">${nl2br(report.conclusion)}</p>`;
    if (report.remarques) body += `<h3 class="pdf-section-title">Remarques</h3><p class="pdf-texte-libre">${nl2br(report.remarques)}</p>`;
  } else {
    // Le contenu vient de l'éditeur riche interne (gras/italique/souligné), déjà en HTML de confiance.
    if (report.intro) body += `<p class="pdf-field-label"><strong>Objet :</strong></p><div class="pdf-description">${report.intro}</div>`;
    body += machinesToHtml(report.machines);
    if (report.description) body += `<p class="pdf-field-label"><strong>Description :</strong></p><div class="pdf-description">${report.description}</div>`;
    body += checklistsToHtml(report);
    if (report.conclusion) body += `<h3 class="pdf-section-title">Conclusion</h3><p class="pdf-texte-libre">${nl2br(report.conclusion)}</p>`;
    if (report.remarques) body += `<h3 class="pdf-section-title">Remarques</h3><p class="pdf-texte-libre">${nl2br(report.remarques)}</p>`;
    if (report.pieces) body += `<p><strong>Pièces utilisées :</strong> ${escapeHtml(report.pieces)}</p>`;
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
<title>${escapeHtml(labelType(report.type))} — ${escapeHtml(nomAffiche(report.client, clients))}</title>
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
  .pdf-charge-fluide { font-size: 13px; margin: 6px 0 2px; }
  .pdf-machine-type { font-size: 13.5px; margin: 12px 0 -6px; }
  .pdf-section-title { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 700; color: #1B2733; margin: 18px 0 4px; text-decoration: underline; text-underline-offset: 3px; }
  .pdf-texte-libre { font-size: 16px; line-height: 1.55; white-space: pre-wrap; }
  .pdf-table-title { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; color: #1B2733; margin: 16px 0 -4px; text-decoration: underline; text-underline-offset: 3px; }
  /* Rien ne doit être coupé au milieu par un changement de page : un tableau,
     un matériel ou une ligne de checklist bascule entier sur la page suivante,
     et un titre ne reste jamais seul en bas de page. */
  .pdf-bloc-insecable { break-inside: avoid; page-break-inside: avoid; }
  .pdf-table-title, .pdf-checklist-title, .pdf-section-title, .pdf-machine-type, .pdf-field-label {
    break-after: avoid; page-break-after: avoid;
  }
  .pdf-checklist li { break-inside: avoid; page-break-inside: avoid; }
  .pdf-table tr { break-inside: avoid; page-break-inside: avoid; }
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

/* ---------------------------------------------------------------------------
   Thème — toutes les couleurs de l'application passent par ces variables.
   Les valeurs claires sont la référence ; le bloc sombre ne fait que les
   redéfinir, si bien qu'aucune règle plus bas n'a besoin de connaître le thème.
   Le choix est posé sur <html data-theme="..."> et retenu par appareil.
--------------------------------------------------------------------------- */
:root {
  --fond: #EEF2F1;
  --carte: #FFFFFF;
  --fond-doux: #F6F8F7;
  --survol: #EEF1F0;

  --encre: #1B2733;
  --encre-2: #4A5860;
  --encre-3: #6D7A80;
  --encre-4: #8A959A;
  --encre-5: #A2ACAF;

  --trait: #D7DEDD;
  --trait-clair: #EAEDEC;
  --trait-fonce: #C6D0D0;

  --bleu: #2F6FA3;
  --bleu-fonce: #285F8C;
  --bleu-clair: #EAF1F7;
  --bleu-clair-2: #D9E6F0;

  --vert: #3F8F5F;
  --vert-fonce: #357A51;
  --vert-clair: #E2F1E7;

  --rouge: #C0392B;
  --rouge-fonce: #942920;
  --rouge-clair: #FBE3E1;
  --rouge-clair-2: #D9776C;

  --orange: #D9762B;
  --orange-fonce: #B45F1D;
  --orange-clair: #FBEADB;

  --jaune: #D9A62B;
  --jaune-clair: #F7ECD3;
  --violet: #7E57A8;
  --violet-clair: #E9E0F3;
  --daikin-clair: #EDF6FD;

  --charge-1: #B9E0C6;
  --charge-2: #F3DCA4;
  --charge-3: #D3C0EA;
  --charge-4: #F3BEB7;
  --charge-daikin: #CFE6F8;

  --nav: #1B2733;
  --nav-encre: #8FA0A8;
  --nav-encre-clair: #E7ECEB;
  --nav-survol: #263341;

  --inverse: #1B2733;
  --sur-inverse: #FFFFFF;
  --sur-couleur: #FFFFFF;

  --ombre-carte: 0 1px 2px rgba(27,39,51,0.04);
  color-scheme: light;
}

[data-theme="sombre"] {
  --fond: #141B22;
  --carte: #1C252E;
  --fond-doux: #202A34;
  --survol: #27323D;

  --encre: #E7ECEB;
  --encre-2: #C2CCD2;
  --encre-3: #9AA7AE;
  --encre-4: #7A868D;
  --encre-5: #68747B;

  --trait: #2C3842;
  --trait-clair: #242E37;
  --trait-fonce: #3A4752;

  --bleu: #5C9BD1;
  --bleu-fonce: #4B87BB;
  --bleu-clair: #22303D;
  --bleu-clair-2: #2A3B4A;

  --vert: #5FAF7F;
  --vert-fonce: #4E9B6C;
  --vert-clair: #1F3A2B;

  --rouge: #E0695B;
  --rouge-fonce: #C9574A;
  --rouge-clair: #3C2320;
  --rouge-clair-2: #D9776C;

  --orange: #E8873A;
  --orange-fonce: #D1762C;
  --orange-clair: #3A2A1B;

  --jaune: #E0B44F;
  --jaune-clair: #3A3220;
  --violet: #A98BD1;
  --violet-clair: #2E2742;
  --daikin-clair: #27455F;

  --charge-1: #2A6B45;
  --charge-2: #6B5418;
  --charge-3: #463573;
  --charge-4: #6E2E26;
  --charge-daikin: #1E5A85;

  --nav: #0E141A;
  --nav-encre: #96A4AD;
  --nav-encre-clair: #E7ECEB;
  --nav-survol: #1F2A34;

  --inverse: #E7ECEB;
  --sur-inverse: #141B22;
  --sur-couleur: #FFFFFF;

  --ombre-carte: 0 1px 3px rgba(0,0,0,0.3);
  color-scheme: dark;
}

* { box-sizing: border-box; }
.app {
  display: flex;
  min-height: 100vh;
  background: var(--fond);
  font-family: 'Inter', -apple-system, sans-serif;
  color: var(--encre);
}

.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--nav);
  color: var(--nav-encre);
  display: flex;
  flex-direction: column;
  padding: 20px 14px;
}
/* La marque est le premier repère de l'écran : sur une barre sombre elle a
   besoin d'être franchement posée, pas seulement présente. */
.brand {
  display: flex; align-items: center; gap: 11px;
  padding: 4px 4px 16px; margin-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.brand-mark {
  width: 44px; height: 44px; border-radius: 11px; flex-shrink: 0;
  background: linear-gradient(135deg, #3B86C4, #E8873A);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 19px;
  color: #FFFFFF; letter-spacing: 0.5px;
  box-shadow: 0 2px 10px rgba(59,134,196,0.35);
}
.brand-name { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 21px; letter-spacing: 0.6px; line-height: 1.1; color: var(--nav-encre-clair); }
.brand-sub { font-size: 10.5px; color: var(--nav-encre); margin-top: 1px; text-transform: uppercase; letter-spacing: 0.6px; }

nav { display: flex; flex-direction: column; gap: 2px; }
.navbtn {
  display: flex; align-items: center; gap: 10px;
  background: transparent; border: none; color: var(--encre-5);
  padding: 10px 12px; border-radius: 7px; font-size: 14px; font-weight: 500;
  cursor: pointer; text-align: left; transition: background 0.15s, color 0.15s; position: relative;
}
.navbtn:hover { background: var(--nav-survol); color: var(--sur-couleur); }
.navbtn.active { background: var(--bleu); color: var(--sur-couleur); }
.nav-badge { margin-left: auto; background: var(--orange); color: var(--sur-couleur); font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 10px; }
.sidebar-foot { margin-top: auto; font-size: 11px; color: var(--encre-3); padding: 10px 6px 0; }
.logout-link { background: none; border: none; color: var(--nav-encre); font-size: 11px; text-decoration: underline; cursor: pointer; padding: 0; margin-top: 6px; }
.logout-link:hover { color: var(--sur-couleur); }

.app-loading { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--fond); }
.app-loading-box { display: flex; flex-direction: column; align-items: center; gap: 14px; color: var(--encre-3); font-family: 'Inter', sans-serif; font-size: 14px; }
.app-loading-box .brand-mark { width: 48px; height: 48px; font-size: 18px; }

.main { flex: 1; padding: 32px 40px; max-width: 1100px; min-width: 0; }

.mobile-topbar { display: none; }
.mobile-menu-btn, .mobile-close-btn { background: transparent; border: none; color: inherit; cursor: pointer; padding: 4px; display: flex; }
.mobile-close-btn { margin-left: auto; }
.mobile-nav-overlay { display: none; }

.page-head { margin-bottom: 22px; }
.header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.clients-map { width: 100%; height: 480px; border-radius: 10px; margin-top: 12px; z-index: 1; }
.map-geocoding-note { font-size: 12.5px; color: var(--encre-3); font-style: italic; }
.map-warning { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--orange-fonce); margin-top: 10px; }
.map-popup-link { color: var(--bleu); font-weight: 600; }
.map-hover-card { font-size: 12.5px; line-height: 1.4; }
.page-head h1 { font-family: 'Barlow Condensed', sans-serif; font-size: 30px; font-weight: 700; margin: 0 0 4px; letter-spacing: 0.2px; }
.page-head p { margin: 0; color: var(--encre-3); font-size: 14px; }
.row-between { display: flex; justify-content: space-between; align-items: flex-end; }

.gauges { display: flex; gap: 20px; margin-bottom: 26px; flex-wrap: wrap; }
.monthly-recap-grid { display: flex; gap: 16px; flex-wrap: wrap; }
.monthly-recap-item { flex: 1; min-width: 130px; text-align: center; padding: 16px 10px; background: var(--fond-doux); border-radius: 10px; }
.monthly-recap-value { font-family: 'Barlow Condensed', sans-serif; font-size: 34px; font-weight: 700; color: var(--encre); line-height: 1; }
.monthly-recap-label { font-size: 12.5px; color: var(--encre-3); margin-top: 4px; }
.jauge { background: var(--carte); border: 1px solid var(--trait); border-radius: 12px; padding: 14px 20px 16px; flex: 1; min-width: 140px; text-align: center; }
.jauge-clickable { cursor: pointer; transition: border-color 0.15s, transform 0.1s; }
.jauge-clickable:hover { border-color: var(--bleu); }
.jauge-clickable:active { transform: scale(0.98); }
.jauge-val { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 700; margin-top: -6px; }
.jauge-label { font-size: 12.5px; color: var(--encre-3); margin-top: 2px; }
.jauge-piste { stroke: var(--trait-fonce); }
.jauge-aiguille { stroke: var(--encre); }
.jauge-pivot { fill: var(--encre); }
.jauge-grad-debut { stop-color: var(--bleu); }
.jauge-grad-fin { stop-color: var(--orange); }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

.card { background: var(--carte); border: 1px solid var(--trait); border-radius: 12px; padding: 20px 22px; margin-bottom: 20px; }
.card h3 { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 600; margin: 0 0 14px; }
.card h4 { font-size: 13px; font-weight: 600; margin: 0 0 8px; color: var(--encre-2); text-transform: uppercase; letter-spacing: 0.4px; }
.total-ligne { display: flex; align-items: baseline; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--trait-clair); font-size: 14px; color: var(--encre-2); }
.total-ligne strong { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; color: var(--rouge); }
.total-ligne-ok strong { color: var(--vert); }
.month-group { margin-bottom: 18px; }
.month-group:last-child { margin-bottom: 0; }
.month-heading { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 600; color: var(--bleu); margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1px solid var(--trait-clair); text-transform: none; letter-spacing: 0; }
.report-month-group { margin-bottom: 28px; }
.report-month-title { font-family: 'Barlow Condensed', sans-serif; font-size: 24px; font-weight: 700; color: var(--encre); margin: 0 0 14px; padding-bottom: 6px; border-bottom: 2px solid var(--encre); }
.report-day-group { margin-bottom: 16px; }
.report-day-title { font-size: 13px; font-weight: 600; color: var(--encre-3); text-transform: capitalize; margin: 0 0 8px; }
.mt { margin-top: 18px; }

.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.row { display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-radius: 8px; }
.row.clickable { cursor: pointer; }
.row.clickable:hover { background: var(--fond-doux); }
.row.selected { background: var(--bleu-clair); }
.row.done .row-title { text-decoration: line-through; color: var(--encre-4); }
.row-title { font-size: 14.5px; font-weight: 600; }
.report-tech { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: var(--bleu); margin-bottom: 3px; }
.form-technicien { margin-bottom: 14px; }
.row-sub { font-size: 12.5px; color: var(--encre-3); margin-top: 1px; }
.grow { flex: 1; }

.pill { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; padding: 4px 9px; border-radius: 20px; border: none; white-space: nowrap; }
.pill-cold { background: var(--bleu-clair); color: var(--bleu); }
.pill-warm { background: var(--orange-clair); color: var(--orange-fonce); }
.pill-ok { background: var(--vert-clair); color: var(--vert); }
.pill-alert { background: var(--rouge-clair); color: var(--rouge); }
.pill-todo { background: var(--orange-clair); color: var(--orange-fonce); }
.hint.alerte { display: inline-flex; align-items: center; gap: 5px; color: var(--rouge); font-weight: 500; }
.hint.alerte svg { flex-shrink: 0; }
.mt-xs { margin-top: 5px; }
.entreprise-fermee { margin-left: 8px; font-size: 10.5px; }
.pill-pennylane { background: var(--bleu-clair); color: var(--bleu); font-size: 11px; margin-left: 8px; padding: 2px 8px; }
.pennylane-error-pill { margin-left: 8px; font-size: 11px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px; cursor: help; }
.row-actions { display: flex; align-items: center; gap: 8px; }
.row-delete-hover { margin-left: auto; opacity: 0; transition: opacity 0.15s ease; flex-shrink: 0; }
.row:hover .row-delete-hover { opacity: 1; }
.pill-muted { background: var(--fond-doux); color: var(--encre-4); }
.pill-clickable { cursor: pointer; }

.check-circle {
  width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--trait-fonce); background: var(--carte);
  display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; color: white;
}
.check-circle.checked { background: var(--vert); border-color: var(--vert); }
.check-circle.small { width: 20px; height: 20px; }

.btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--bleu); color: var(--sur-couleur); border: none; padding: 10px 16px;
  border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-primary:hover { background: var(--bleu-fonce); }
.btn-primary:disabled { background: var(--trait-fonce); cursor: not-allowed; }
.btn-primary.small { padding: 6px 12px; font-size: 12.5px; margin-top: 8px; margin-right: 8px; }
.report-card-valide { border-left: 3px solid var(--vert); }
.btn-ghost { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: 1px solid var(--trait); padding: 9px 15px; border-radius: 8px; font-size: 14px; cursor: pointer; color: var(--encre-2); }
.btn-ghost.small { padding: 6px 12px; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; margin-right: 8px; }
.btn-small { background: var(--inverse); color: var(--sur-inverse); border: none; padding: 7px 12px; border-radius: 7px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.devis-actions { display: flex; align-items: center; gap: 8px; }
.btn-valide { background: var(--vert); }
.btn-valide:hover { background: var(--vert-fonce); }
.icon-btn { background: transparent; border: none; color: var(--rouge-fonce); cursor: pointer; padding: 6px; flex-shrink: 0; }

.mini-calendar { margin-bottom: 20px; max-width: 520px; padding: 18px 20px; }
.mini-calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.mini-calendar-header .icon-btn { color: var(--bleu); padding: 3px; }
.mini-calendar-title { font-family: 'Barlow Condensed', sans-serif; font-weight: 600; font-size: 18px; color: var(--encre); text-transform: capitalize; }
.mini-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.mini-calendar-weekdays { margin-bottom: 2px; }
.mini-calendar-weekday { text-align: center; font-size: 11.5px; font-weight: 600; color: var(--encre-4); text-transform: uppercase; padding: 4px 0; }
.mini-calendar-cell { position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border: none; background: transparent; border-radius: 8px; font-size: 15px; color: var(--encre-2); cursor: default; }
.mini-calendar-cell.clickable-day { cursor: pointer; }
.mini-calendar-cell.clickable-day:hover { background: var(--survol); }
.mini-calendar-cell.empty { visibility: hidden; }
.mini-calendar-cell.is-today { font-weight: 700; color: var(--encre); box-shadow: inset 0 0 0 1.5px var(--bleu); }

/* Calendrier — la charge de la journée monte depuis le bas de la case, la
   journée DAIKIN descend depuis le haut : les deux se superposent sans se
   gêner. La journée consultée garde ses dégradés et reçoit un liseré, pour
   que sa charge reste lisible. */
.mini-calendar-cell.has-task { cursor: pointer; color: var(--encre); font-weight: 600; overflow: hidden; }
.mini-calendar-cell.charge-1 { background-image: linear-gradient(to top, var(--charge-1) 0%, transparent 92%); }
.mini-calendar-cell.charge-2 { background-image: linear-gradient(to top, var(--charge-2) 0%, transparent 92%); }
.mini-calendar-cell.charge-3 { background-image: linear-gradient(to top, var(--charge-3) 0%, transparent 92%); }
.mini-calendar-cell.charge-4 { background-image: linear-gradient(to top, var(--charge-4) 0%, transparent 92%); }

.mini-calendar-cell.est-daikin { background-image: linear-gradient(to bottom, var(--charge-daikin) 0%, transparent 70%); }
.mini-calendar-cell.est-daikin.charge-1 { background-image: linear-gradient(to top, var(--charge-1) 0%, transparent 92%), linear-gradient(to bottom, var(--charge-daikin) 0%, transparent 70%); }
.mini-calendar-cell.est-daikin.charge-2 { background-image: linear-gradient(to top, var(--charge-2) 0%, transparent 92%), linear-gradient(to bottom, var(--charge-daikin) 0%, transparent 70%); }
.mini-calendar-cell.est-daikin.charge-3 { background-image: linear-gradient(to top, var(--charge-3) 0%, transparent 92%), linear-gradient(to bottom, var(--charge-daikin) 0%, transparent 70%); }
.mini-calendar-cell.est-daikin.charge-4 { background-image: linear-gradient(to top, var(--charge-4) 0%, transparent 92%), linear-gradient(to bottom, var(--charge-daikin) 0%, transparent 70%); }

.mini-calendar-cell.clickable-day:hover { background-color: var(--survol); }
.mini-calendar-cell.is-selected { box-shadow: inset 0 0 0 2.5px var(--bleu); color: var(--encre); font-weight: 700; }

.mini-calendar-ech { width: 15px; height: 11px; border-radius: 3px; display: inline-block; border: 1px solid var(--trait); }
.mini-calendar-ech.charge-1 { background: var(--charge-1); }
.mini-calendar-ech.charge-2 { background: var(--charge-2); }
.mini-calendar-ech.charge-3 { background: var(--charge-3); }
.mini-calendar-ech.charge-4 { background: var(--charge-4); }
.mini-calendar-ech.daikin { background: var(--charge-daikin); }

.mini-calendar-legend { display: flex; gap: 14px; justify-content: center; margin-top: 14px; font-size: 11.5px; color: var(--encre-3); flex-wrap: wrap; }
.mini-calendar-legend span { display: inline-flex; align-items: center; gap: 4px; }
.planning-day-flash { animation: planningFlash 1.4s ease; }
@keyframes planningFlash {
  0% { box-shadow: 0 0 0 3px var(--bleu); }
  100% { box-shadow: 0 0 0 0px transparent; }
}

.filters { display: flex; gap: 8px; margin-bottom: 16px; }
.filter-btn { background: var(--carte); border: 1px solid var(--trait); padding: 7px 13px; border-radius: 20px; font-size: 13px; cursor: pointer; color: var(--encre-2); }
.filter-btn.active { background: var(--inverse); color: var(--sur-inverse); border-color: var(--inverse); }

.report-card, .fiche-ancre { scroll-margin-top: 14px; }
.report-card-head { display: flex; align-items: center; gap: 12px; cursor: pointer; }
.report-card-title { flex: 1; }
.chevron { font-size: 20px; color: var(--encre-4); width: 20px; text-align: center; }
.report-card-body { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--trait-clair); }
.report-card-actions { display: flex; justify-content: flex-end; margin-bottom: 10px; }
.report-view-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--trait-clair); margin-bottom: 16px; }
.report-view-tab { background: transparent; border: none; border-bottom: 2px solid transparent; padding: 8px 4px; margin-right: 18px; font-size: 13.5px; font-weight: 600; color: var(--encre-3); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.report-view-tab.active { color: var(--bleu); border-bottom-color: var(--bleu); }
.report-pdf-preview { width: 100%; height: 720px; border: 1px solid var(--trait-clair); border-radius: 8px; background: var(--carte); }
.remarque { font-size: 13.5px; color: var(--encre-2); line-height: 1.5; background: var(--fond-doux); padding: 10px 12px; border-radius: 8px; }
.rte-render strong { font-weight: 700; }
.rte-render u { text-decoration: underline; }
.rte-render em { font-style: italic; }

.section-title { font-size: 13.5px; font-weight: 700; color: var(--encre); margin: 14px 0 4px; text-decoration: underline; text-underline-offset: 3px; }
.texte-libre { white-space: pre-wrap; }
.mini-table-block { margin-bottom: 12px; }
.mini-table-title { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 600; color: var(--bleu); margin-bottom: 3px; text-decoration: underline; text-underline-offset: 3px; }
.mini-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px; }
.mini-table td, .mini-table th { padding: 6px 8px; border-bottom: 1px solid var(--survol); text-align: left; }
.mini-table td:first-child, .mini-table th:first-child { color: var(--encre-3); }
.mini-table th { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--encre-4); }

.machine-block { margin-bottom: 16px; padding: 12px; border: 1px solid var(--trait-clair); border-radius: 8px; }
.section-toggle-bar { background: var(--fond-doux); border: 1px solid var(--trait); border-radius: 8px; padding: 11px 14px; font-size: 13.5px; font-weight: 600; }
.section-toggle-bar:hover { border-color: var(--bleu); color: var(--bleu); }
.machine-section-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; background: transparent; border: none; padding: 0; cursor: pointer; color: var(--encre); }
.machine-title { font-size: 13.5px; font-weight: 600; margin-bottom: 6px; color: var(--encre); }
.machine-date { font-weight: 400; color: var(--encre-3); }
.machine-editor-card { background: var(--fond-doux); border-color: var(--trait); margin-bottom: 12px; }
.machine-editor-card .machine-section-toggle { font-size: 14px; font-weight: 600; }
.machine-editor-card .machine-editor { margin-top: 14px; }
.unit-block { padding: 12px; background: var(--carte); border: 1px solid var(--trait-clair); border-radius: 8px; margin-bottom: 10px; }

.recherche-client { position: relative; display: flex; align-items: center; margin-bottom: 10px; }
.recherche-client input { width: 100%; padding-right: 36px; }
.recherche-client .icon-btn { position: absolute; right: 4px; color: var(--encre-3); }
.client-detail-actions { display: flex; gap: 8px; }
.fiche-bandeau { gap: 12px; }
.fiche-bandeau-nom { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 600; color: var(--encre); }
.fiche-bandeau-contact { display: block; font-size: 13px; font-weight: 400; color: var(--encre-3); margin-top: 1px; }
.fiche-actions-row { margin-top: 12px; }
.fiche-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px 22px; margin: 14px 0 4px; }
.fiche-item { display: flex; flex-direction: column; gap: 2px; padding-bottom: 8px; border-bottom: 1px solid var(--survol); }
.fiche-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: var(--encre-4); }
.fiche-value { font-size: 14px; color: var(--encre); word-break: break-word; }
.fiche-value.vide { color: var(--encre-5); font-style: italic; }
.client-raison-sociale { font-size: 13px; color: var(--encre-3); margin-top: 2px; }
.entretien-annuel-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 8px; margin: 10px 0; }
.entretien-annuel-badge.ok { background: var(--vert-clair); color: var(--vert-fonce); }
.entretien-annuel-badge.todo { background: var(--orange-clair); color: var(--orange-fonce); }
.entretien-annuel-badge.neutral { background: var(--survol); color: var(--encre-3); }
.entretien-annuel-badge.late { background: var(--rouge-clair); color: var(--rouge); }
.contrat-dot.late { background: var(--rouge); }
.contrat-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 8px; vertical-align: middle; }
.contrat-dot.ok { background: var(--vert); }
.contrat-dot.todo { background: var(--orange); }
.contrat-dot.neutral { background: var(--encre-5); }
.btn-contrat { border-color: var(--bleu); color: var(--bleu); }
.btn-danger { border-color: var(--rouge-clair-2); color: var(--rouge); }
.btn-danger:hover { background: var(--rouge-clair); }
.delete-confirm-group { display: inline-flex; gap: 6px; align-items: center; }
.btn-danger-solid { background: var(--rouge); color: var(--sur-couleur); border: none; }
.btn-danger-solid:hover { background: var(--rouge-fonce); }
.contract-box { background: var(--fond-doux); border: 1px solid var(--trait); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
.contract-templates { display: flex; gap: 8px; flex-wrap: wrap; }
.contract-templates-group { display: flex; flex-direction: column; gap: 6px; }
.contract-templates-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: var(--encre-4); }
.btn-b2b { border-color: var(--orange); color: var(--orange-fonce); }
.btn-b2b:hover { background: var(--orange-clair); }
.contract-import { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.contract-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--vert); background: var(--vert-clair); padding: 5px 10px; border-radius: 20px; }
.contract-view-link { background: none; border: none; color: var(--bleu); text-decoration: underline; font-size: 12.5px; cursor: pointer; padding: 0; margin-left: 4px; }
.charge-fluide { font-size: 12.5px; color: var(--encre-2); margin: 6px 0 2px; display: flex; flex-direction: column; gap: 2px; }
.charge-fluide strong { color: var(--encre); }
.machine-photos { display: flex; gap: 16px; margin-top: 10px; flex-wrap: wrap; }
.machine-photo-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.machine-photo-item img { width: 110px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid var(--trait); }
.machine-photo-item span { font-size: 11px; color: var(--encre-3); }

.single-photo-field { margin-bottom: 16px; }
.single-photo-preview { position: relative; display: inline-block; }
.single-photo-preview img { width: 140px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid var(--trait); display: block; }
.single-photo-preview .icon-btn { position: absolute; top: 4px; right: 4px; background: rgba(255,255,255,0.9); border-radius: 50%; padding: 4px; }

.checklist-view { margin: 0 0 12px; display: flex; flex-direction: column; gap: 8px; }
.cl-row { display: flex; align-items: flex-start; gap: 10px; }
.check-dot { width: 18px; height: 18px; border-radius: 50%; background: var(--vert); color: var(--sur-couleur); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
.cl-row.ko .check-dot { background: var(--trait); }
.cl-label { font-size: 13.5px; font-weight: 700; }
.cl-detail { font-size: 12.5px; color: var(--encre-3); margin-top: 1px; white-space: pre-wrap; }
.print-detail { white-space: pre-wrap; font-size: 12.5px; margin: 2px 0 4px 0; }
.table-position { margin-bottom: 10px; }
.table-position select { width: auto; min-width: 220px; }

.checklist-group-title { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 600; color: var(--bleu); margin: 6px 0 2px; text-decoration: underline; text-underline-offset: 3px; }
.checklist-block { background: var(--fond-doux); border: 1px solid var(--trait); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.checklist-block-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.checklist-block-title { flex: 1; font-weight: 600; font-size: 13.5px; }
.checklist-edit { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; margin-bottom: 8px; }
.checklist-row { display: flex; align-items: center; gap: 8px; }
.checklist-status-select { width: auto; min-width: 100px; flex-shrink: 0; font-weight: 600; font-size: 12.5px; padding: 6px 8px; border-radius: 6px; }
.checklist-inputs { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.checklist-inputs input, .checklist-inputs textarea { width: 100%; }
.checklist-label-input { font-weight: 600; line-height: 1.4; min-height: 46px; }

.table-editor { margin-bottom: 14px; padding: 12px; background: var(--fond-doux); border-radius: 8px; }
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

.rte { border: 1px solid var(--trait); border-radius: 8px; overflow: hidden; background: var(--carte); }
.rte-toolbar { display: flex; align-items: center; gap: 2px; padding: 6px 8px; background: var(--fond-doux); border-bottom: 1px solid var(--trait-clair); }
.rte-toolbar button { min-width: 28px; width: 28px; height: 28px; border: none; background: var(--carte); border-radius: 5px; cursor: pointer; font-size: 13px; color: var(--encre); border: 1px solid var(--trait); }
.rte-toolbar button:hover { background: var(--bleu-clair); border-color: var(--bleu); }
.rte-toolbar button.active { border-color: var(--bleu); background: var(--bleu-clair); color: var(--bleu); box-shadow: inset 0 0 0 1px var(--bleu); }
.rte-sep { width: 1px; height: 20px; background: var(--trait); margin: 0 4px; }
.rte-content { padding: 10px 12px; font-size: 14px; line-height: 1.5; outline: none; }
.rte-content:empty:before { content: attr(data-placeholder); color: var(--encre-5); }
.rte-content ul, .rte-render ul, .pdf-description ul { margin: 4px 0 4px 20px; padding: 0; }
.rte-content ul ul, .rte-render ul ul, .pdf-description ul ul { list-style-type: circle; }
.rte-content ul ul ul, .rte-render ul ul ul, .pdf-description ul ul ul { list-style-type: square; }

.field-block { display: flex; flex-direction: column; gap: 5px; }
.field-caption { font-size: 12.5px; font-weight: 600; color: var(--encre-2); }
.mb-lg { margin-bottom: 30px; }

.photo-strip { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.photo-strip img { width: 84px; height: 84px; object-fit: cover; border-radius: 8px; border: 1px solid var(--trait); }

.devis-note { display: flex; gap: 10px; background: var(--orange-clair); color: var(--orange-fonce); padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-top: 8px; }
.devis-note svg { flex-shrink: 0; margin-top: 2px; }

.hint-inline { font-weight: 400; font-size: 12px; opacity: 0.8; }

.signatures-edit { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 4px; }
.signature-block { display: flex; flex-direction: column; gap: 6px; }
.signature-label { font-size: 12.5px; font-weight: 600; color: var(--encre-2); }
.signature-canvas { border: 1.5px dashed var(--trait-fonce); border-radius: 8px; background: #FFFFFF; touch-action: none; cursor: crosshair; width: 260px; height: 100px; }

.signatures-view { display: flex; gap: 30px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--trait-clair); flex-wrap: wrap; }
.sig-col { flex: 1; min-width: 180px; }
.sig-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: var(--encre-4); margin-bottom: 6px; }
.sig-img { max-width: 220px; max-height: 90px; border: 1px solid var(--trait); border-radius: 6px; background: #FFFFFF; }
.sig-empty { font-size: 12.5px; color: var(--encre-5); font-style: italic; }

.print-signatures { display: flex; gap: 40px; margin-top: 30px; }
.sig-img-print { max-width: 200px; max-height: 80px; display: block; margin-top: 4px; }

.form-card { border: 1px solid var(--bleu); background: var(--fond-doux); }
.type-toggle { display: flex; gap: 8px; margin-bottom: 18px; }
.toggle-btn { flex: 1; background: var(--carte); border: 1px solid var(--trait); padding: 9px; border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 500; }
.toggle-btn.active { background: var(--bleu); color: var(--sur-couleur); border-color: var(--bleu); }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.form-grid.three { grid-template-columns: 1fr 1fr 1fr; }
label { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--encre-2); }
.block { margin-bottom: 14px; }
input, select, textarea {
  font-family: inherit; font-size: 14px; font-weight: 400; color: var(--encre);
  border: 1px solid var(--trait); border-radius: 7px; padding: 9px 10px; background: var(--carte);
}
textarea { resize: vertical; }
.description-textarea { min-height: 110px; resize: vertical; }
.description-view p { white-space: pre-wrap; margin: 4px 0 0; }
.grid-full { grid-column: 1 / -1; }
.field-col { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--encre-2); }
.tache-notes { font-size: 12.5px; color: var(--encre-2); background: var(--fond-doux); border-radius: 6px; padding: 6px 8px; margin-top: 4px; white-space: pre-wrap; }
.telephone-lien { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 500; color: var(--bleu); text-decoration: none; margin-top: 2px; }
.telephone-lien span { text-decoration: underline; text-underline-offset: 2px; }
.telephone-lien:hover { color: var(--bleu-fonce); }
.telephone-lien svg { flex-shrink: 0; }
.fiche-value.telephone-lien { font-size: 14px; }
.adresse-lien { display: inline-flex; align-items: flex-start; gap: 5px; font-size: 12.5px; font-weight: 500; color: var(--bleu); text-decoration: none; margin-top: 2px; }
.adresse-lien span { text-decoration: underline; text-underline-offset: 2px; }
.adresse-lien:hover { color: var(--bleu-fonce); }
.adresse-lien svg { flex-shrink: 0; margin-top: 1px; }
.fiche-value.adresse-lien { font-size: 14px; }
.client-select { position: relative; display: flex; flex-direction: column; }
.client-select input { width: 100%; padding-right: 34px; }
.client-select-arrow { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: var(--encre-3); cursor: pointer; padding: 4px; display: flex; }
.client-select-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50; list-style: none; margin: 0; padding: 4px; background: var(--carte); border: 1px solid var(--trait); border-radius: 8px; box-shadow: 0 6px 20px rgba(27,39,51,0.14); max-height: 260px; overflow-y: auto; }
.client-select-list li { display: flex; flex-direction: column; gap: 1px; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-weight: 400; }
.client-select-list li:hover, .client-select-list li.actif { background: var(--bleu-clair); }
.client-select-nom { font-size: 14px; font-weight: 600; color: var(--encre); }
.client-select-sub { font-size: 12px; color: var(--encre-3); }
.client-select-empty { font-size: 12.5px; color: var(--encre-4); font-style: italic; cursor: default; }
.client-select-empty:hover { background: transparent; }
.check-inline { flex-direction: row; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 14px; }
.check-inline input { width: auto; }
.hint { font-size: 11.5px; font-weight: 400; color: var(--encre-4); margin-top: 2px; }

.photo-upload {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  border: 1.5px dashed var(--trait-fonce); border-radius: 8px; padding: 14px; cursor: pointer;
  font-size: 13px; color: var(--encre-3); background: var(--carte); width: 100%; font-family: inherit;
}
.photo-upload:disabled { opacity: 0.6; cursor: default; }
.photo-vignette { position: relative; display: inline-block; }
.photo-vignette .icon-btn { position: absolute; top: 2px; right: 2px; background: rgba(255,255,255,0.92); border-radius: 50%; padding: 3px; }
.photo-upload:hover { border-color: var(--bleu); color: var(--bleu); }

.theme-choix { display: flex; gap: 8px; margin-top: 10px; }
.theme-option {
  font-family: inherit; font-size: 13px; font-weight: 500;
  padding: 9px 18px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--trait); background: var(--carte); color: var(--encre-3);
}
.theme-option:hover { border-color: var(--bleu); color: var(--bleu); }
.theme-option.actif { background: var(--inverse); border-color: var(--inverse); color: var(--sur-inverse); font-weight: 600; }
.notif-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }

.detail-line { font-size: 13.5px; color: var(--encre-2); margin-bottom: 3px; }
.empty { font-size: 13px; color: var(--encre-4); font-style: italic; }

.pdf-modal-overlay {
  position: fixed; inset: 0; background: rgba(27, 39, 51, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 24px;
}
.pdf-modal-box {
  background: var(--carte); border-radius: 12px; width: 100%; max-width: 900px; height: 90vh;
  display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.25);
}
.pdf-modal-box-compact { height: auto; max-width: 460px; }
.pdf-modal-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--trait); flex-shrink: 0; }
.pdf-modal-title { display: inline-flex; align-items: center; gap: 8px; font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 600; color: var(--encre); }
.pdf-modal-actions { display: flex; gap: 8px; }
.pdf-modal-iframe { flex: 1; border: none; width: 100%; background: var(--fond); }
.pdf-modal-fallback { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--encre-3); background: var(--carte); padding: 32px 28px; text-align: center; }
.pdf-modal-fallback p { font-size: 14px; max-width: 360px; margin: 0; color: var(--encre); font-weight: 600; }
.pdf-modal-hint { font-size: 12.5px !important; font-weight: 400 !important; color: var(--encre-3) !important; }
.pdf-modal-fallback-actions { display: flex; gap: 10px; margin-top: 8px; }
.confirmation-corps { padding: 18px 20px 4px; font-size: 14px; line-height: 1.55; color: var(--encre); }
.confirmation-corps p { margin: 0 0 12px; }
.confirmation-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 6px 20px 20px; flex-wrap: wrap; }

.print-only { display: none; }
.print-letterhead { margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid var(--encre); font-size: 12.5px; color: var(--encre-2); }
.print-company-name { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; color: var(--encre); margin-bottom: 2px; }
.print-checklist { padding-left: 18px; }
@media print {
  /* Le papier est blanc : on repasse en valeurs claires pour l'impression,
     quel que soit le thème affiché à l'écran. */
  :root, [data-theme="sombre"] {
    --fond: #FFFFFF;
    --carte: #FFFFFF;
    --fond-doux: #F6F8F7;
    --encre: #1B2733;
    --encre-2: #4A5860;
    --encre-3: #6D7A80;
    --encre-4: #8A959A;
    --encre-5: #A2ACAF;
    --trait: #D7DEDD;
    --trait-clair: #EAEDEC;
    --trait-fonce: #C6D0D0;
    --bleu: #2F6FA3;
    --vert: #3F8F5F;
    --rouge: #C0392B;
    --orange: #D9762B;
    --jaune: #D9A62B;
    --violet: #7E57A8;
  }
  body * { visibility: hidden; }
  .print-only, .print-only * { visibility: visible; }
  .print-only { position: absolute; left: 0; top: 0; width: 100%; display: block; padding: 20px; font-family: 'Inter', sans-serif; }
  .print-only h1 { font-family: 'Barlow Condensed', sans-serif; }
}

/* ---------- Assistant IA ---------- */
.assistant { display: flex; flex-direction: column; min-height: calc(100vh - 64px); }
.assistant-head-actions { display: flex; flex-wrap: wrap; align-items: center; }
.assistant-head-actions .btn-ghost.small { margin-top: 0; }
.assistant-fil { flex: 1; display: flex; flex-direction: column; gap: 10px; padding-bottom: 12px; }
.assistant-accueil p { margin: 0 0 14px; color: var(--encre-2); font-size: 14px; line-height: 1.5; }
.assistant-suggestions { display: flex; flex-wrap: wrap; gap: 8px; }
.assistant-suggestion { background: var(--bleu-clair); color: var(--bleu-fonce); border: 1px solid var(--bleu-clair-2); border-radius: 18px; padding: 8px 14px; font-size: 13.5px; cursor: pointer; text-align: left; }
.assistant-suggestion:hover { background: var(--bleu-clair-2); }
.assistant-bulle { max-width: 82%; padding: 11px 14px; border-radius: 14px; font-size: 14.5px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
.bulle-moi { align-self: flex-end; background: var(--bleu); color: #fff; border-bottom-right-radius: 4px; }
.bulle-assistant { align-self: flex-start; background: var(--carte); color: var(--encre); border: 1px solid var(--trait); border-bottom-left-radius: 4px; }
.bulle-erreur { background: var(--rouge-clair); color: var(--rouge-fonce); border-color: var(--rouge-clair-2); }
.pill-onedrive { background: var(--bleu-clair); color: var(--bleu-fonce); }
.onedrive-dossier { margin-top: 12px; line-height: 1.6; }
.onedrive-dossier svg { color: var(--vert); vertical-align: -2px; margin-right: 4px; }
.onedrive-dossier strong { color: var(--encre-2); word-break: break-word; }
.onedrive-chemin { margin-top: 12px; }
.onedrive-chemin-ligne { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.onedrive-chemin-ligne input { flex: 1; min-width: 220px; }
.assistant-action-apercu { margin-top: 8px; padding: 10px 12px; background: var(--carte); border: 1px solid var(--trait); border-radius: 8px; font-size: 13.5px; line-height: 1.5; color: var(--encre-2); white-space: pre-wrap; max-height: 240px; overflow-y: auto; }
.fournisseur-infos { min-width: 0; flex: 1; }
.fournisseur-contact { font-weight: 400; color: var(--encre-3); }
.fournisseur-liens { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 6px; }
.fournisseur-notes { margin-top: 4px; font-style: italic; }
.fournisseur-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.fournisseur-actions .btn-ghost.small { margin: 0; }
.bulle-ecouter { display: flex; align-items: center; gap: 5px; margin-top: 8px; padding: 4px 10px; border-radius: 14px; border: 1px solid var(--trait); background: var(--fond-doux); color: var(--encre-3); font-size: 12px; cursor: pointer; }
.bulle-ecouter:hover { color: var(--bleu); border-color: var(--bleu-clair-2); }
.bulle-icone { display: inline-flex; vertical-align: -2px; margin-right: 6px; }
.assistant-attente { display: inline-flex; gap: 5px; padding: 14px 16px; }
.assistant-attente span { width: 7px; height: 7px; border-radius: 50%; background: var(--encre-4); animation: assistantPoint 1.2s infinite ease-in-out; }
.assistant-attente span:nth-child(2) { animation-delay: 0.15s; }
.assistant-attente span:nth-child(3) { animation-delay: 0.3s; }
@keyframes assistantPoint { 0%, 80%, 100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
.assistant-actions { margin-bottom: 0; border-color: var(--vert); background: var(--vert-clair); padding: 14px 16px; }
.assistant-actions-titre { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vert-fonce); margin-bottom: 6px; }
.assistant-action { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-top: 1px solid var(--trait-clair); }
.assistant-action:first-of-type { border-top: none; }
.assistant-action-texte { font-size: 14px; color: var(--encre); }
.assistant-action-boutons { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.assistant-action-boutons .btn-ghost.small { margin: 0; background: var(--carte); }
.assistant-action-boutons .btn-small { display: inline-flex; align-items: center; gap: 4px; }
.assistant-tout-valider { margin-top: 8px; width: 100%; justify-content: center; }
.assistant-saisie { position: sticky; bottom: 0; background: var(--fond); padding: 10px 0 calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid var(--trait-clair); }
.assistant-info-micro { margin: 0 0 6px; color: var(--orange-fonce); }
.assistant-saisie-ligne { display: flex; align-items: flex-end; gap: 8px; }
.assistant-saisie-ligne textarea { flex: 1; resize: none; min-height: 46px; max-height: 140px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--trait); background: var(--carte); color: var(--encre); font: inherit; font-size: 15px; }
.assistant-micro, .assistant-envoyer { width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%; border: none; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.assistant-micro { background: var(--bleu); color: #fff; }
.assistant-micro.en-ecoute { background: var(--rouge); animation: assistantPulse 1.4s infinite; }
@keyframes assistantPulse { 0% { box-shadow: 0 0 0 0 rgba(192, 57, 43, 0.45); } 70% { box-shadow: 0 0 0 12px rgba(192, 57, 43, 0); } 100% { box-shadow: 0 0 0 0 rgba(192, 57, 43, 0); } }
.assistant-envoyer { background: var(--carte); color: var(--bleu); border: 1px solid var(--trait); }
.assistant-micro:disabled, .assistant-envoyer:disabled { opacity: 0.45; cursor: default; }
@media (max-width: 780px) { .app .main { padding-bottom: 100px; } }
/* Mode vocal de l'assistant */
.vocal { display: flex; flex-direction: column; gap: 18px; }
.vocal-zone { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 28px 12px 8px; min-height: 52vh; justify-content: center; }
.vocal-etat { font-family: 'Barlow Condensed', sans-serif; font-size: 26px; font-weight: 600; color: var(--encre); letter-spacing: 0.2px; }
.vocal-etat-ecoute { color: var(--rouge); }
.vocal-etat-attente { color: var(--orange-fonce); }
.vocal-texte { min-height: 48px; max-width: 520px; margin: 8px 0 26px; font-size: 15px; line-height: 1.45; color: var(--encre-3); font-style: italic; }
.vocal-bouton { position: relative; width: 148px; height: 148px; border-radius: 50%; border: none; background: var(--bleu); color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 10px 30px rgba(47, 111, 163, 0.35); transition: background 0.2s, transform 0.15s; -webkit-tap-highlight-color: transparent; }
.vocal-bouton:active { transform: scale(0.96); }
.vocal-bouton:disabled { cursor: default; }
.vocal-bouton svg { position: relative; z-index: 1; }
.vocal-onde { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; }
.vocal-bouton-ecoute { background: var(--rouge); box-shadow: 0 10px 30px rgba(192, 57, 43, 0.35); }
.vocal-bouton-ecoute .vocal-onde { animation: vocalEcoute 1.4s infinite; }
@keyframes vocalEcoute { 0% { box-shadow: 0 0 0 0 rgba(192, 57, 43, 0.5); } 70% { box-shadow: 0 0 0 28px rgba(192, 57, 43, 0); } 100% { box-shadow: 0 0 0 0 rgba(192, 57, 43, 0); } }
.vocal-bouton-reflexion { background: var(--bleu-fonce); }
.vocal-bouton-reflexion .vocal-onde { inset: -10px; border: 4px solid transparent; border-top-color: var(--bleu); border-right-color: var(--bleu-clair-2); animation: vocalTourne 1s linear infinite; }
@keyframes vocalTourne { to { transform: rotate(360deg); } }
.vocal-bouton-parole .vocal-onde { animation: vocalParole 1.1s ease-in-out infinite; }
@keyframes vocalParole { 0%, 100% { box-shadow: 0 0 0 6px rgba(47, 111, 163, 0.25), 0 0 0 14px rgba(47, 111, 163, 0.12); } 50% { box-shadow: 0 0 0 12px rgba(47, 111, 163, 0.3), 0 0 0 26px rgba(47, 111, 163, 0.1); } }
.vocal-bouton-attente { background: var(--orange); box-shadow: 0 10px 30px rgba(217, 118, 43, 0.35); }
.vocal-bouton-attente .vocal-onde { animation: vocalAttente 1.6s infinite; }
@keyframes vocalAttente { 0%, 100% { box-shadow: 0 0 0 0 rgba(217, 118, 43, 0.5); } 50% { box-shadow: 0 0 0 18px rgba(217, 118, 43, 0); } }
.vocal-sous-bouton { margin-top: 26px; min-height: 24px; }
.vocal-lien { background: none; border: none; color: var(--bleu); font-size: 14px; cursor: pointer; padding: 6px 10px; text-decoration: underline; text-underline-offset: 3px; }
.vocal-info { margin-top: 12px; font-size: 13px; color: var(--orange-fonce); }
.vocal-erreur { margin-top: 14px; max-width: 520px; display: flex; gap: 6px; align-items: flex-start; text-align: left; background: var(--rouge-clair); color: var(--rouge-fonce); border: 1px solid var(--rouge-clair-2); border-radius: 10px; padding: 10px 12px; font-size: 13.5px; line-height: 1.45; }
.vocal-erreur svg { flex-shrink: 0; margin-top: 2px; }
.vocal-reponse-ecrite { margin-top: 16px; max-width: 520px; background: var(--carte); border: 1px solid var(--trait); border-radius: 12px; padding: 12px 14px; font-size: 14.5px; line-height: 1.5; text-align: left; white-space: pre-wrap; }
@media (prefers-reduced-motion: reduce) { .vocal-onde { animation: none !important; } }
.micro-flottant { position: fixed; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom)); z-index: 55; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; pointer-events: none; }
.micro-flottant-btn { pointer-events: auto; width: 60px; height: 60px; border-radius: 50%; border: none; background: var(--bleu); color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 18px rgba(27, 39, 51, 0.28); }
.micro-flottant-btn:hover { background: var(--bleu-fonce); }
.micro-flottant-btn.en-ecoute { background: var(--rouge); animation: assistantPulse 1.4s infinite; }
.micro-flottant-bulle { pointer-events: auto; max-width: min(300px, calc(100vw - 36px)); background: var(--carte); color: var(--encre); border: 1px solid var(--trait); border-radius: 14px; border-bottom-right-radius: 4px; padding: 10px 14px; font-size: 14px; line-height: 1.45; box-shadow: 0 6px 18px rgba(27, 39, 51, 0.16); }
@media (max-width: 780px) {
  .assistant { min-height: calc(100vh - 120px); }
  .assistant-bulle { max-width: 90%; }
  .assistant-action { flex-direction: column; align-items: stretch; }
  .assistant-action-boutons { justify-content: flex-end; }
  .assistant-head-actions { width: 100%; justify-content: space-between; }
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
  /* La barre du haut étant fixe sur mobile, on laisse la place nécessaire
     au-dessus de la carte que l'on fait remonter. */
  .report-card, .fiche-ancre { scroll-margin-top: calc(70px + env(safe-area-inset-top, 0px)); }
  /* Sur téléphone, le calendrier occupe toute la largeur : les cases restent
     assez grandes pour être visées au doigt. */
  .mini-calendar { max-width: 100%; }

  /* Checklists : sur un écran étroit, l'intitulé et le détail prennent toute
     la largeur, sous la ligne « Fait / Non fait », pour rester lisibles. */
  .checklist-row { flex-wrap: wrap; align-items: center; }
  .checklist-status-select { order: 1; }
  .checklist-row > .icon-btn { order: 2; margin-left: auto; }
  .checklist-inputs { order: 3; flex-basis: 100%; width: 100%; }
  .checklist-label-input { min-height: 62px; }

  /* Tableaux : en saisie, chaque cellule passe sur toute la largeur de l'écran
     (une ligne du tableau = un petit bloc), au lieu de colonnes écrasées. */
  .editable-table, .editable-table tbody, .editable-table tr, .editable-table td { display: block; width: 100%; }
  .editable-table { overflow: visible; }
  .editable-table tr { background: var(--carte); border: 1px solid var(--trait); border-radius: 8px; padding: 6px; margin-bottom: 8px; }
  .editable-table td { padding: 3px; }
  .editable-table .table-row-actions { width: 100%; text-align: right; }

  /* À l'affichage du rapport, le texte des tableaux revient à la ligne au lieu
     d'obliger à faire défiler horizontalement. */
  .mini-table-block .mini-table { display: table; width: 100%; table-layout: fixed; overflow: visible; }
  .mini-table-block .mini-table td { word-break: break-word; white-space: normal; }
  .mobile-topbar {
    display: flex; align-items: center; gap: 12px;
    position: sticky; top: 0; z-index: 30;
    background: var(--nav); color: var(--nav-encre-clair);
    /* Marges de sécurité : sur iPhone (encoche / Dynamic Island) et en mode
       application installée, la barre de statut recouvre sinon le bouton menu. */
    padding: calc(12px + env(safe-area-inset-top, 0px)) calc(16px + env(safe-area-inset-right, 0px)) 12px calc(16px + env(safe-area-inset-left, 0px));
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
    padding-top: calc(20px + env(safe-area-inset-top, 0px));
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    padding-left: calc(14px + env(safe-area-inset-left, 0px));
    overflow-y: auto;
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar .mobile-close-btn { display: flex; }
  .sidebar .brand { position: relative; }

  .main {
    max-width: 100%;
    padding: 18px calc(14px + env(safe-area-inset-right, 0px)) calc(90px + env(safe-area-inset-bottom, 0px)) calc(14px + env(safe-area-inset-left, 0px));
  }

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
