import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login.jsx";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = chargement, null = déconnecté

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#6D7A80" }}>
        Chargement...
      </div>
    );
  }

  if (!session) return <Login />;

  return children;
}
