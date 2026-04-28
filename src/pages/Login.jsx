import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createPageUrl } from "../lib/pages";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = location.state?.from?.pathname || createPageUrl("Home");
  const fromSearch = location.state?.from?.search || "";

  const notice = useMemo(() => {
    return location.state?.signupSuccess || "";
  }, [location.state]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setPending(true);

    const { error: loginError } = await login(cleanEmail, password);

    setPending(false);

    if (loginError) {
      const rawMessage = loginError.message || "Unable to sign in. Please try again.";
      const lower = rawMessage.toLowerCase();

      if (lower.includes("email not confirmed")) {
        setError("Your email is not confirmed yet. Please check your inbox and verify your email, then try again.");
        return;
      }

      setError(rawMessage);
      return;
    }

    navigate(`${fromPath}${fromSearch}`, { replace: true });
  }

  return (
    <div className="container">
      <div className="section">
        <div className="sectionHead">
          <h2 className="h2">Login</h2>
          <p className="p">Sign in to continue shopping.</p>
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
            autoComplete="current-password"
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

          {notice ? <p className="p">{notice}</p> : null}
          {error ? <p className="p">{error}</p> : null}

          <button
            className="btn"
            type="button"
            onClick={() => setError("Forgot password is not set up yet. We can add Supabase password reset next.")}
          >
            Forgot password?
          </button>

          <div className="row" style={{ justifyContent: "flex-start" }}>
            <button className="btnPrimary" type="submit" disabled={pending}>
              {pending ? "Signing in..." : "Login"}
            </button>

            <Link className="btn" to={createPageUrl("Signup")}>
              Create account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}