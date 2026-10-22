import { useEffect, useRef, useState } from "react";
import "./App.css";

function Icon({ name, size = 20 }) {
  const paths = {
    activity: <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    image: <><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
    info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" /></>,
    leaf: <><path d="M11 20A7 7 0 0 1 4 13c0-6 8-9 16-9 0 8-3 16-9 16Z" /><path d="M8 16c2-2 5-4 9-6" /></>,
    lock: <><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
    scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2M3 17v2a2 2 0 0 0 2 2h2m10 0h2a2 2 0 0 0 2-2v-2M7 12h10" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11" /><path d="m9 12 2 2 4-4" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5m5-5v12" /></>,
    warning: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function getErrorMessage(response, payload) {
  if (payload?.detail) return payload.detail;
  if (response.status === 413) return "This image is too large to upload. Try a smaller photo.";
  return "We couldn't identify this image. Please try again.";
}

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    const controller = new AbortController();
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/health", { signal: controller.signal });
        if (!response.ok) throw new Error("Health check failed");
        const health = await response.json();
        setApiStatus(health.status === "ok" ? "online" : "offline");
      } catch (healthError) {
        if (healthError.name !== "AbortError") setApiStatus("offline");
      }
    };

    checkHealth();
    const intervalId = window.setInterval(checkHealth, 30000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  const selectFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      setError("Choose an image file, such as a JPG, PNG, or WEBP.");
      return;
    }
    setPreview(URL.createObjectURL(selectedFile));
    setFile(selectedFile);
    setResult(null);
    setError("");
  };

  const handleFileInput = (event) => {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  const clearSelection = () => {
    setFile(null);
    setPreview("");
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const identifyMedicine = async () => {
    if (!file || loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/identify", { method: "POST", body });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getErrorMessage(response, payload));
      setResult(payload);
    } catch (requestError) {
      setError(
        requestError.message === "Failed to fetch"
          ? "The medicine service isn't reachable. Check that the backend is running, then try again."
          : requestError.message,
      );
    } finally {
      setLoading(false);
    }
  };

  const hasResult = Boolean(result);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="MediVision AI home">
          <span className="brand-mark"><Icon name="activity" size={21} /></span>
          <span className="brand-name">MediVision<span>AI</span></span>
        </a>
        <nav className="topbar-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#safety">Safety first</a>
        </nav>
        <div className={`service-status status-${apiStatus}`} role="status">
          <span className="status-dot" />
          {apiStatus === "checking" ? "Connecting" : apiStatus === "online" ? "System ready" : "Service offline"}
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> SMARTER MEDICINE RECOGNITION</p>
            <h1>Know what&apos;s<br />in your <span>medicine.</span></h1>
            <p className="hero-description">
              A clearer picture starts here. Scan a medicine pack to discover what it is
              and explore helpful information from our medicine guide.
            </p>
            <div className="hero-proof">
              <span><Icon name="shield" size={16} /> Private &amp; secure</span>
              <span className="proof-divider" />
              <span><Icon name="leaf" size={16} /> Information you can understand</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-card art-card-back"><span className="art-pill" /><span className="art-lines" /></div>
            <div className="art-card art-card-front">
              <span className="art-emblem"><Icon name="activity" size={34} /></span>
              <span className="art-title">MEDICINE</span>
              <span className="art-subtitle">CARE, MADE CLEAR</span>
              <span className="art-capsules"><i /><i /><i /><i /></span>
            </div>
            <span className="art-spark spark-one">✳</span>
            <span className="art-spark spark-two">✳</span>
          </div>
        </section>

        <section className="workspace" aria-label="Medicine identification">
          <div className="workspace-heading">
            <div>
              <p className="section-kicker">YOUR PERSONAL MEDICINE GUIDE</p>
              <h2>Start with a photo</h2>
            </div>
            <span className="step-count"><span>01</span> / 02</span>
          </div>

          <div className="workspace-grid">
            <section className="upload-panel">
              <div className="panel-heading">
                <div className="panel-icon"><Icon name="image" size={19} /></div>
                <div>
                  <h3>Upload a medicine photo</h3>
                  <p>For best results, capture the name on the package.</p>
                </div>
              </div>

              <input
                ref={inputRef}
                className="visually-hidden"
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                aria-label="Choose a medicine image"
              />
              <div
                className={`dropzone${isDragging ? " is-dragging" : ""}${preview ? " has-preview" : ""}`}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
                }}
                onDrop={handleDrop}
              >
                {preview ? (
                  <>
                    <img className="image-preview" src={preview} alt="Selected medicine package" />
                    <button className="remove-image" type="button" onClick={clearSelection} aria-label="Remove selected image">
                      <Icon name="close" size={17} />
                    </button>
                    <div className="preview-label"><Icon name="check" size={15} /> Photo ready to scan</div>
                  </>
                ) : (
                  <div className="dropzone-content">
                    <div className="upload-icon"><Icon name="upload" size={23} /></div>
                    <p className="drop-title">Drop your photo here</p>
                    <p className="drop-or">or</p>
                    <button className="browse-button" type="button" onClick={() => inputRef.current?.click()}>
                      Browse files <Icon name="chevron" size={16} />
                    </button>
                    <p className="file-hint">JPG, PNG or WEBP</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="error-message" role="alert">
                  <Icon name="warning" size={17} /> <span>{error}</span>
                </div>
              )}

              <button
                className="identify-button"
                type="button"
                onClick={identifyMedicine}
                disabled={!file || loading}
              >
                {loading ? (
                  <><span className="spinner" /> Analyzing your photo…</>
                ) : (
                  <>Identify medicine <Icon name="arrow" size={18} /></>
                )}
              </button>
              <p className="privacy-note"><Icon name="lock" size={14} /> Your photo is used only to identify this medicine.</p>
            </section>

            <section className={`results-panel${hasResult ? " has-result" : ""}`} aria-live="polite" aria-busy={loading}>
              <div className="results-topline">
                <span className="results-label"><span className="results-label-dot" /> IDENTIFICATION</span>
                <div className="results-actions">
                  {result?.found && <span className="match-score">{result.match_score}% match</span>}
                  {(file || result) && (
                    <button
                      className="new-scan-button"
                      type="button"
                      onClick={clearSelection}
                      disabled={loading}
                    >
                      <Icon name="scan" size={15} /> New scan
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="empty-state loading-state">
                  <div className="scan-animation"><Icon name="scan" size={30} /></div>
                  <h3>Taking a closer look</h3>
                  <p>Our AI is reading the label and matching it with your local medicine list.</p>
                  <div className="loading-steps"><span className="active">Reading label</span><i /><span>Finding a match</span></div>
                </div>
              ) : result?.found ? (
                <div className="medicine-result">
                  <span className="category-tag">{result.category || "Medicine"}</span>
                  <h3 className="result-medicine-name">{result.name}</h3>
                  <div className="result-divider" />
                  {result.brands?.length > 0 && (
                    <div className="medicine-info-card brands-card">
                      <span className="medicine-info-icon"><Icon name="activity" size={18} /></span>
                      <div>
                        <span className="medicine-info-label">BRANDS</span>
                        <div className="brand-chips">
                          {result.brands.map((brand) => <span className="brand-chip" key={brand}>{brand}</span>)}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="uses-card">
                    <span className="uses-card-icon"><Icon name="leaf" size={20} /></span>
                    <div>
                      <span className="uses-card-label">COMMON USES</span>
                      <p>{result.uses || "Uses information is not available for this medicine in the local CSV."}</p>
                    </div>
                  </div>
                  <div className="medicine-info-card effects-card">
                    <span className="medicine-info-icon effects-icon"><Icon name="info" size={18} /></span>
                    <div>
                      <span className="medicine-info-label">POSSIBLE SIDE EFFECTS</span>
                      <p>{result.side_effects || "Side-effect information is not available for this medicine in the local CSV."}</p>
                    </div>
                  </div>
                  {result.extra_information && (
                    <details className="extra-information">
                      <summary>
                        <span className="extra-information-icon"><Icon name="file" size={16} /></span>
                        <span className="extra-information-title">Additional information</span>
                        <Icon name="chevron" size={16} />
                      </summary>
                      <p>{result.extra_information}</p>
                    </details>
                  )}
                  {result.text_read && (
                    <details className="text-read">
                      <summary><Icon name="file" size={15} /> Text read from your photo</summary>
                      <p>{result.text_read}</p>
                    </details>
                  )}
                  <div className="medical-disclaimer"><Icon name="info" size={16} /><p>{result.disclaimer || "For information only. Always follow a doctor's or pharmacist's advice."}</p></div>
                </div>
              ) : result ? (
                <div className="empty-state not-found-state">
                  <div className="empty-icon"><Icon name="scan" size={27} /></div>
                  <h3>We couldn&apos;t find a match</h3>
                  <p>{result.text_read ? `We read “${result.text_read}”, but couldn't match it to a medicine in your local list.` : "We couldn't read a medicine name in this photo."} Try a clear, well-lit photo with the label facing forward.</p>
                  <button className="try-again-button" type="button" onClick={clearSelection}>Try another photo <Icon name="arrow" size={16} /></button>
                  <div className="medical-disclaimer"><Icon name="info" size={16} /><p>{result.disclaimer || "For information only. Always follow a doctor's or pharmacist's advice."}</p></div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><Icon name="scan" size={27} /></div>
                  <h3>Your results will appear here</h3>
                  <p>Upload a clear photo of your medicine packaging and we&apos;ll look for a match.</p>
                  <div className="result-placeholder">
                    <span><i /> Medicine name</span><span><i /> Common uses</span><span><i /> Important information</span>
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>

        <section id="how-it-works" className="how-section">
          <div className="how-heading">
            <p className="section-kicker">SIMPLE BY DESIGN</p>
            <h2>From photo to clarity</h2>
          </div>
          <div className="how-steps">
            <article className="how-step"><span className="how-number">01</span><div className="how-icon"><Icon name="upload" size={20} /></div><h3>Share a photo</h3><p>Upload a clear image of the medicine box, bottle, or strip.</p></article>
            <span className="step-connector"><Icon name="chevron" size={18} /></span>
            <article className="how-step"><span className="how-number">02</span><div className="how-icon"><Icon name="scan" size={20} /></div><h3>We identify it</h3><p>AI reads the label and checks the name against your local medicine list.</p></article>
            <span className="step-connector"><Icon name="chevron" size={18} /></span>
            <article className="how-step"><span className="how-number">03</span><div className="how-icon"><Icon name="file" size={20} /></div><h3>Explore details</h3><p>See the medicine name, brands, uses, and possible side effects.</p></article>
          </div>
        </section>

        <section id="safety" className="safety-banner">
          <span className="safety-icon"><Icon name="shield" size={22} /></span>
          <div><h3>Helpful information, not a diagnosis.</h3><p>MediVision AI does not replace professional medical advice. Always check with your doctor or pharmacist before taking or changing medication.</p></div>
          <Icon name="arrow" size={18} />
        </section>
      </main>

      <footer className="footer">
        <a className="brand footer-brand" href="#top"><span className="brand-mark"><Icon name="activity" size={18} /></span><span className="brand-name">MediVision<span>AI</span></span></a>
        <p>Made to make medicine information a little clearer.</p>
        <span className="footer-note"><Icon name="info" size={14} /> Always consult a healthcare professional</span>
      </footer>
    </div>
  );
}
