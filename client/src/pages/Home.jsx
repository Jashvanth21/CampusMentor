import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../styles/home.css";

const BrainIcon = () => (
  <svg viewBox="0 0 24 24" className="feature-icon__svg" aria-hidden="true">
    <path
      d="M10 5.5a3.5 3.5 0 0 0-6 2.5v.5a3 3 0 0 0 1 5.82V15a3.5 3.5 0 0 0 5.9 2.54"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 5.5a3.5 3.5 0 0 1 6 2.5v.5a3 3 0 0 1-1 5.82V15a3.5 3.5 0 0 1-5.9 2.54"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.5 9.5c.6-.67 1.45-1 2.5-1s1.9.33 2.5 1M9.5 14.5c.6.67 1.45 1 2.5 1s1.9-.33 2.5-1M12 4v16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AnalyticsIcon = () => (
  <svg viewBox="0 0 24 24" className="feature-icon__svg" aria-hidden="true">
    <path
      d="M4 19h16M7 16V9m5 7V5m5 11v-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m6.5 9.5 4-3 3.5 2 4-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlacementIcon = () => (
  <svg viewBox="0 0 24 24" className="feature-icon__svg" aria-hidden="true">
    <path
      d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="m9.2 12.3 1.8 1.8 3.8-4.1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 5V3m0 18v-2m7-7h2M3 12h2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const features = [
  {
    title: "AI Career Guidance",
    text: "Get smart role recommendations and learning roadmaps based on your strengths.",
    icon: <BrainIcon />
  },
  {
    title: "Smart Performance Analytics",
    text: "Track your test performance with clear insights across subjects and coding progress.",
    icon: <AnalyticsIcon />
  },
  {
    title: "Placement Eligibility Tracking",
    text: "Understand where you stand for placement drives and what to improve next.",
    icon: <PlacementIcon />
  }
];

const Home = () => {
  return (
    <div className="home-page">
      <Navbar />

      <section className="hero-section">
        <div className="hero-content">
          <h1>AI-Powered Career & Placement Guidance System</h1>
          <p>
            CampusMentor helps students prepare for placements using mock tests, advanced analytics,
            and AI-powered mentoring. Get personalized guidance, track your progress, and land your
            dream job.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="cta-btn cta-filled">
              LOGIN
            </Link>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-inner">
          <h2>Why Choose CampusMentor?</h2>
          <div className="feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
