import { FormEvent, useState } from "react";
import { Building2, LoaderCircle, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";

type AuthScreenProps = { configurationError: string | null };

export default function AuthScreen({ configurationError }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || configurationError) return;

    setError(null);
    setSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark"><Building2 size={20} /></span>
          <span>Loadlink</span>
        </div>
        <div className="auth-intro">
          <span className="auth-icon"><ShieldCheck size={20} /></span>
          <h1>Welcome back</h1>
          <p>Sign in securely to access the messaging inbox.</p>
        </div>
        {configurationError && <div className="auth-alert error" role="alert">{configurationError}</div>}
        {error && <div className="auth-alert error" role="alert">{error}</div>}
        <form className="auth-form" onSubmit={submit}>
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="auth-submit" type="submit" disabled={submitting || Boolean(configurationError)}>
            {submitting && <LoaderCircle size={17} className="spin" />}
            Sign in
          </button>
        </form>
        <p className="auth-footnote">Accounts must be provisioned by an administrator. SignalWire credentials are never requested or stored in this browser.</p>
      </section>
    </main>
  );
}
