import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createPageUrl } from "../lib/pages";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export default function Signup() {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setPending(true);

    const { data, error: signupError, needsEmailConfirmation } = await signup(cleanEmail, password);

    setPending(false);

    if (signupError) {
      setError(signupError.message || "Unable to create account. Please try again.");
      return;
    }

    // If Supabase requires email verification, there may be no active session yet.
    if (needsEmailConfirmation || (!data?.session && data?.user)) {
      navigate(createPageUrl("Login"), {
        replace: true,
        state: {
          signupSuccess:
            "Account created. Please check your email and confirm your account before logging in.",
        },
      });
      return;
    }

    // Session created immediately (email confirmation not required)
    navigate(createPageUrl("Home"), { replace: true });
  }

  return (
    <div className="container">
      <div className="section">
        <div className="sectionHead">
          <h2 className="h2">Create account</h2>
          <p className="p">Sign up to start shopping.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid3"
          style={{ gridTemplateColumns: "1fr", maxWidth: "420px" }}
        >
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <input
            className="input"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />

          <button
            className="btnGhost"
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-pressed={showPassword}
          >
            {showPassword ? "Hide password" : "Show password"}
          </button>

          {error ? <p className="p">{error}</p> : null}

          <button
            className="btn"
            type="button"
            onClick={() => setError("Forgot password is available after account creation.")}
          >
            Forgot password?
          </button>

          <div className="row" style={{ justifyContent: "flex-start" }}>
            <button className="btnPrimary" type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create account"}
            </button>

            <Link className="btn" to={createPageUrl("Login")}>
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}