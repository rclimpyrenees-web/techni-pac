import React, { useState } from "react";
import { supabase, setRememberMe } from "./supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    // Le choix doit être enregistré AVANT la connexion : c'est lui qui détermine
    // dans quel espace de stockage (localStorage ou sessionStorage) la session
    // sera écrite au moment où Supabase la reçoit.
    setRememberMe(remember);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError("Email ou mot de passe incorrect.");
  };

  return (
    <div className="login-screen">
      <style>{loginCss}</style>
      <form className="login-box" onSubmit={submit}>
        <div className="login-brand">
          <div className="login-brand-mark">TP</div>
          <div>
            <div className="login-brand-name">TECHNI-PAC</div>
            <div className="login-brand-sub">Poste de gestion</div>
          </div>
        </div>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label className="login-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Rester connecté sur cet appareil
        </label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? "Connexion..." : "Se connecter"}</button>
      </form>
    </div>
  );
}

const loginCss = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600&display=swap');
.login-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #EEF2F1; font-family: 'Inter', sans-serif; }
.login-box { background: #fff; border: 1px solid #D7DEDD; border-radius: 12px; padding: 32px; width: 100%; max-width: 340px; display: flex; flex-direction: column; gap: 14px; }
.login-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.login-brand-mark { width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #2F6FA3, #D9762B); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 15px; color: white; }
.login-brand-name { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 18px; color: #1B2733; }
.login-brand-sub { font-size: 11px; color: #6D7A80; }
.login-box label { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: #4A5860; }
.login-box input { font-size: 14px; border: 1px solid #D7DEDD; border-radius: 7px; padding: 9px 10px; font-family: inherit; }
.login-remember { flex-direction: row !important; align-items: center; gap: 8px !important; font-weight: 500 !important; cursor: pointer; margin-top: -2px; }
.login-remember input { width: auto; }
.login-box button { margin-top: 6px; background: #2F6FA3; color: #fff; border: none; padding: 11px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.login-box button:disabled { opacity: 0.6; cursor: default; }
.login-error { font-size: 12.5px; color: #B33128; background: #FBE3E1; padding: 8px 10px; border-radius: 7px; }
`;
