import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="container">
      <div className="hero">
        <h1>AI Agricultural Subsidy Verification</h1>
        <p>
          Automated, evidence-based, explainable subsidy approval. Sentinel-2 satellite
          verification, SHAP-explainable ML, immutable audit trail, and automated DBT — all
          in under 10 minutes per application.
        </p>
        <Link to="/register" className="btn btn-primary">Get Started</Link>
        <span style={{ marginLeft: 12 }}>
          <Link to="/login" className="btn btn-secondary">Login</Link>
        </span>
      </div>

      <div className="grid-3">
        <div className="card">
          <h3>🛰️ Satellite Verification</h3>
          <p className="muted">NDVI from Sentinel-2 imagery confirms cultivated area against the declared parcel.</p>
        </div>
        <div className="card">
          <h3>🧠 Explainable AI</h3>
          <p className="muted">Every decision carries top-3 SHAP contributions with for/against direction.</p>
        </div>
        <div className="card">
          <h3>🔒 Immutable Audit</h3>
          <p className="muted">Insert-only MongoDB audit log captures every state transition, signed and timestamped.</p>
        </div>
      </div>
    </div>
  );
}
