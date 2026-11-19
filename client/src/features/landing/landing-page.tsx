"use client";

import {
  ArrowRight,
  BarChart3,
  Check,
  Diamond,
  Grid2X2,
  Mail,
  Menu,
  Network,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ApplicationModal from "./application-modal";
import { ContactModal, LoginModal } from "./contact-login-modals";
import styles from "./landing-page.module.css";

const faqs = [
  {
    question: "Who can apply for a Ricoz franchise?",
    answer:
      "Entrepreneurs, business owners and professionals looking to start or expand a service-based business can apply. Prior industry experience is beneficial but not mandatory.",
  },
  {
    question: "What support does Ricoz provide?",
    answer:
      "Ricoz provides end-to-end support including technology platform access, lead generation, operational training, marketing materials, brand resources, and a dedicated partner success team.",
  },
  {
    question: "Is training provided before launch?",
    answer:
      "Yes. Every partner receives structured onboarding, practical operational training and ongoing learning resources before launch and throughout their journey.",
  },
  {
    question: "How do customer leads reach franchise partners?",
    answer:
      "Customer enquiries are managed through the Ricoz platform and shared with the right franchise partners, who can track every opportunity and follow-up in one place.",
  },
  {
    question: "Can I operate multiple service categories?",
    answer:
      "Yes. Partners can explore multiple service categories based on local demand, their interests and the opportunities available in their territory.",
  },
  {
    question: "How long does the onboarding process take?",
    answer:
      "The timeline depends on your location and selected service categories. Our team guides you through each step, from the initial conversation to launch.",
  },
];

const reasons = [
  {
    icon: <Sparkles aria-hidden="true" />,
    title: "Centralized Lead Generation",
    description:
      "Receive customer inquiries through a unified platform and focus on converting opportunities into successful projects.",
  },
  {
    icon: <Network aria-hidden="true" />,
    title: "Complete Operational Support",
    description:
      "Get assistance with business operations, workflows and service delivery so you can run your franchise with confidence.",
  },
  {
    icon: <Grid2X2 aria-hidden="true" />,
    title: "Technology-Powered Platform",
    description:
      "Manage leads, projects, teams, finances and performance from a single business dashboard.",
  },
  {
    icon: <Mail aria-hidden="true" />,
    title: "Training & Business Development",
    description:
      "Access structured onboarding, operational guidance and continuous learning resources designed for franchise growth.",
  },
  {
    icon: <Diamond aria-hidden="true" />,
    title: "Marketing & Brand Support",
    description:
      "Leverage centralized marketing initiatives, promotional campaigns and brand assets to strengthen your local presence.",
  },
  {
    icon: <UsersRound aria-hidden="true" />,
    title: "Dedicated Partner Success Team",
    description:
      "Our support teams work alongside you to resolve challenges, improve performance and help your business scale efficiently.",
  },
];

const platformFeatures = [
  {
    icon: <Grid2X2 aria-hidden="true" />,
    title: "Lead & Opportunity Management",
    description:
      "Track customer inquiries, manage follow-ups and convert opportunities into successful projects from a single workspace.",
  },
  {
    icon: <Grid2X2 aria-hidden="true" />,
    title: "Operations & Project Control",
    description:
      "Monitor ongoing projects, assign resources, track progress and ensure smooth service delivery across every stage.",
  },
  {
    icon: <BarChart3 aria-hidden="true" />,
    title: "Performance & Business Insights",
    description:
      "Access real-time reports, revenue tracking and business analytics to make informed decisions and drive sustainable growth.",
  },
];

function Brand() {
  return (
    <a className={styles.brand} href="#home" aria-label="Ricoz home">
      <span className={styles.brandMark}>rZ</span>
      <span>Ricoz</span>
    </a>
  );
}

function Dashboard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.dashboard} ${compact ? styles.dashboardCompact : ""}`}>
      <div className={styles.browserBar}>
        <i />
        <i />
        <i />
      </div>
      <div className={styles.dashTopbar}>
        <div className={styles.dashIdentity}>
          <span className={styles.dashLogo}>R</span>
          <span>
            <b>RICOZ</b>
            <small>Franchise Portal</small>
          </span>
        </div>
        <span className={styles.territory}>Mumbai West</span>
        <div className={styles.dashUser}>
          <span className={styles.dashSearch}>Search...</span>
          <span className={styles.avatar}>AK</span>
          <span>
            <b>Amit Kumar</b>
            <small>Franchise Admin</small>
          </span>
        </div>
      </div>
      <div className={styles.dashBody}>
        <aside className={styles.dashSidebar}>
          <b className={styles.sideActive}>Dashboard</b>
          <small>OPERATIONS</small>
          <span>Request Queue</span>
          <span>Assignment Center</span>
          <span>Live Jobs</span>
          <small>WORKFORCE</small>
          <span>Employees</span>
          <span>IT Tasks</span>
          <small>FINANCE</small>
          <span>Finance Dashboard</span>
        </aside>
        <div className={styles.dashMain}>
          <h3>Dashboard</h3>
          <p>Welcome back, Amit! Here&apos;s your IT operations overview</p>
          <div className={styles.dashMetrics}>
            <div><span className={styles.metricIcon}>↗</span><b>₹7,82,500</b><small>Monthly Revenue</small><em>+24% from last month</em></div>
            <div><span className={`${styles.metricIcon} ${styles.metricGreen}`}><Check /></span><b>156</b><small>Tickets Resolved</small><em>87.2% resolution rate</em></div>
            <div><span className={`${styles.metricIcon} ${styles.metricOrange}`}>◷</span><b>23</b><small>Open Tickets</small><em className={styles.orangeText}>5 critical</em></div>
            <div><span className={`${styles.metricIcon} ${styles.metricBlue}`}><ShieldCheck /></span><b>94.5%</b><small>SLA Compliance</small><em className={styles.blueText}>Avg. response: 48 min</em></div>
          </div>
          <div className={styles.dashPanels}>
            <div className={styles.dashPanel}>
              <b>Active Work by Category</b>
              <div className={styles.categoryRow}>
                <span>34<small>IT Support</small></span>
                <span>18<small>Network & Infra</small></span>
                <span>12<small>Cloud Services</small></span>
                <span>8<small>Cybersecurity</small></span>
              </div>
            </div>
            <div className={styles.dashPanel}>
              <b>Recent Tickets</b>
              <p>Server Maintenance — TechCorp <em>In Progress</em></p>
              <p>VPN Setup &amp; Configuration <em className={styles.greenText}>Completed</em></p>
              <p>Data Recovery — Infosys <em className={styles.orangeText}>Pending</em></p>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.laptopBase} />
    </div>
  );
}

function Metrics({ expanded = false }: { expanded?: boolean }) {
  const metrics = [
    ["20+", "Business Categories", expanded ? "Choose from a diverse range of service sectors designed to meet evolving customer demands." : ""],
    ["100%", "Operational Support", expanded ? "Access dedicated assistance, processes and resources to help your business run smoothly." : ""],
    ["Pan India", "Expansion Vision", expanded ? "Be part of a growing network focused on creating opportunities across cities and regions." : ""],
    ["Dedicated", "Partner Success Team", expanded ? "Receive ongoing guidance from specialists committed to helping franchise partners succeed." : ""],
  ];

  return (
    <div className={`${styles.metrics} ${expanded ? styles.metricsExpanded : ""}`}>
      {metrics.map(([number, label, description]) => (
        <div className={styles.metric} key={label}>
          <b>{number}</b>
          <strong>{label}</strong>
          {description && <p>{description}</p>}
        </div>
      ))}
    </div>
  );
}

function OfficeIllustration() {
  return (
    <div className={styles.officeScene} role="img" aria-label="A bright office meeting room with a project planning board">
      <div className={styles.officeWindow}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.officeBrick} />
      <div className={styles.whiteboard}>
        <div className={styles.boardHeader}>PROJECT ROADMAP</div>
        <div className={styles.boardGrid}>
          <b>PLAN</b><b>BUILD</b><b>GROW</b>
          <i /><i /><i />
          <i /><i /><i />
        </div>
        <div className={styles.boardNote}>Ideas into action</div>
      </div>
      <div className={styles.officePlant}><i /><i /><i /><i /><b /></div>
    </div>
  );
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"application" | "contact" | "login" | null>(null);
  const [rememberedLoginEmail, setRememberedLoginEmail] = useState("");

  function openApplication() {
    setMenuOpen(false);
    setActiveDialog("application");
  }

  function openContact() {
    setMenuOpen(false);
    setActiveDialog("contact");
  }

  function openLogin() {
    setMenuOpen(false);
    try {
      setRememberedLoginEmail(window.localStorage.getItem("ricozRememberedEmail") ?? "");
    } catch {
      setRememberedLoginEmail("");
      toast.warning("This browser could not access your remembered email address.");
    }
    setActiveDialog("login");
  }

  return (
    <main className={styles.page} id="home">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <button
            className={styles.menuButton}
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
          <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`} aria-label="Main navigation">
            <button className={styles.buttonSecondary} type="button" onClick={openContact}>Get in Touch</button>
            <button className={styles.buttonPrimary} type="button" onClick={openApplication}>Become a Franchise Partner</button>
            <span className={styles.navDivider} />
            <button className={styles.buttonOutline} type="button" onClick={openLogin}>Franchise Login</button>
          </nav>
        </div>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrowPill}>INDIA&apos;S NEXT GENERATION FRANCHISE ECOSYSTEM</span>
        <h1>Building a business shouldn&apos;t mean<br className={styles.desktopBreak} /> starting alone. <span>Join ours.</span></h1>
        <p className={styles.heroCopy}>
          Build your business with the backing of a complete ecosystem. From technology and operations to training, marketing and ongoing support, <b>Ricoz</b> helps you focus on growth while we help simplify the journey.
        </p>
        <div className={styles.heroActions}>
          <button className={styles.buttonSecondary} type="button" onClick={openContact}>Get in Touch</button>
          <button className={styles.buttonPrimary} type="button" onClick={openApplication}>Become a Franchise Partner</button>
        </div>
        <div className={styles.heroDashboard}><Dashboard /></div>
      </section>

      <section className={styles.statsIntro}>
        <p>Join a franchise ecosystem built to help entrepreneurs succeed at every stage of their journey.</p>
        <Metrics />
      </section>

      <section className={styles.whySection}>
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>WHY RICOZ</span>
          <h2>Everything You Need To Build A Successful Franchise Business</h2>
          <p>Launch, manage and grow your business with a complete ecosystem designed for modern entrepreneurs. From technology and training to marketing and operational support, Ricoz helps you succeed at every stage.</p>
        </div>
        <div className={styles.reasonGrid}>
          {reasons.map((reason) => (
            <article className={styles.reason} key={reason.title}>
              <span className={styles.iconCircle}>{reason.icon}</span>
              <h3>{reason.title}</h3>
              <p>{reason.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.testimonial}>
        <blockquote>&quot;The right support can change everything. Ricoz gave us the foundation to build and grow with confidence.&quot;</blockquote>
        <div className={styles.testimonialAvatar}>👤</div>
        <b>Franchise Partner</b>
        <span>Ricoz Network</span>
      </section>

      <section className={styles.platformSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>FRANCHISE PLATFORM</span>
          <h2>One Platform. Complete Franchise Management.</h2>
          <p>Manage leads, projects, finances, operations and performance from a centralized dashboard designed to help franchise partners run and grow their business with confidence.</p>
        </div>
        <div className={styles.platformArt}>
          <div className={styles.phoneMock}>
            <div className={styles.phoneNotch} />
            <b>Dashboard</b>
            <span>Welcome back, Amit!</span>
            <div className={styles.phoneStat}>₹7,82,500 <small>Monthly Revenue</small></div>
            <div className={styles.phoneStat}>156 <small>Tickets Resolved</small></div>
            <div className={styles.phoneMiniChart}><i /><i /><i /><i /><i /><i /><i /></div>
          </div>
          <Dashboard compact />
        </div>
        <div className={styles.platformFeatures}>
          {platformFeatures.map((feature) => (
            <article className={styles.platformFeature} key={feature.title}>
              <span className={styles.iconCircle}>{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <a href="#contact">Learn more <ArrowRight aria-hidden="true" /></a>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.sectionHeading}>
          <h2>Frequently asked questions</h2>
          <p>Everything you need to know about becoming a Ricoz franchise partner and growing your business with confidence.</p>
        </div>
        <div className={styles.faqList}>
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <article className={styles.faqItem} key={faq.question}>
                <button
                  type="button"
                  className={styles.faqQuestion}
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                >
                  <span>{faq.question}</span>
                  <span className={styles.faqToggle}>{isOpen ? <span>−</span> : <Plus aria-hidden="true" />}</span>
                </button>
                {isOpen && <p className={styles.faqAnswer}>{faq.answer}</p>}
              </article>
            );
          })}
        </div>
        <div className={styles.helpCard}>
          <div className={styles.peopleIcons}><span>👤</span><span>👤</span><span>👤</span></div>
          <h3>Still have questions?</h3>
          <p>Our franchise team is here to help you understand the opportunity, investment requirements and growth potential.</p>
          <button className={styles.buttonPrimary} type="button" onClick={openContact}>Speak With Our Team</button>
        </div>
      </section>

      <section className={styles.growthSection} id="about">
        <div className={styles.growthInner}>
          <div className={styles.growthCopy}>
            <span className={styles.eyebrow}>GROW WITH CONFIDENCE</span>
            <h2>Build A Business Backed By Experience, Technology And Support</h2>
            <p>Join a franchise ecosystem designed to help entrepreneurs launch faster, operate smarter and grow sustainably with the right systems, guidance and business infrastructure.</p>
            <Metrics expanded />
          </div>
          <OfficeIllustration />
        </div>
        <div className={styles.bottomCta} id="contact">
          <h2>Build Your Business With Ricoz</h2>
          <p>Apply today and discover how Ricoz can help you build a scalable business backed by technology, training and operational support.</p>
          <div className={styles.heroActions}>
            <button className={styles.buttonSecondary} type="button" onClick={openContact}>Schedule A Consultation</button>
            <button className={styles.buttonPrimary} type="button" onClick={openApplication}>Become A Franchise Partner</button>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerColumns}>
            <div className={styles.footerAbout}>
              <Brand />
              <p>Empowering entrepreneurs with technology, operational support and business opportunities through a modern franchise ecosystem.</p>
              <a href="https://maps.google.com/?q=Andheri+East+Mumbai"><span>📍</span> E-Wing, 301, Tandice69, Prakashwadi Road, Near Gundawali Metro Station, Andheri East, Mumbai – 400069</a>
              <a href="tel:+917050062084"><Phone aria-hidden="true" /> +91 70500 62084</a>
              <div className={styles.socials} aria-label="Social media">
                <a href="#contact" aria-label="Facebook">f</a><a href="#contact" aria-label="Instagram">◎</a><a href="#contact" aria-label="LinkedIn">in</a><a href="#contact" aria-label="WhatsApp">●</a><a href="#contact" aria-label="YouTube">▶</a><a href="#contact" aria-label="X">X</a>
              </div>
            </div>
            <FooterLinks links={["Become A Franchise Partner", "Business Models", "Franchise Benefits", "Application Process", "Partner Support", "Territory Availability"]} onApplyClick={openApplication} />
            <FooterLinks links={["About Ricoz", "Contact Us", "Careers", "Blogs", "FAQs"]} onContactClick={openContact} />
            <FooterLinks links={["Privacy Policy", "Terms & Conditions", "Refund Policy", "Cookie Policy", "Franchise Agreement"]} />
          </div>
          <form
            className={styles.subscribe}
            onSubmit={(event) => {
              event.preventDefault();
              toast.info("Newsletter signup is not available yet. Please contact our team directly.");
            }}
          >
            <h3>Stay Updated</h3>
            <p>Get franchise updates, business insights and growth opportunities delivered to your inbox.</p>
            <div className={styles.subscribeInput}>
              <input type="email" aria-label="Email address" placeholder="Enter your email" required />
              <button className={styles.buttonPrimary} type="submit">Subscribe</button>
            </div>
          </form>
          <div className={styles.footerBottom}>
            <div><b>Our Presence</b><span>Mumbai</span><span>Delhi</span><span>Kolkata</span><span>Nagpur</span><span>Navi Mumbai</span></div>
            <p>© 2021 FirstRicoz Private Limited. All rights reserved.</p>
          </div>
        </div>
      </footer>
      {activeDialog === "application" && <ApplicationModal onClose={() => setActiveDialog(null)} />}
      {activeDialog === "contact" && <ContactModal onClose={() => setActiveDialog(null)} />}
      {activeDialog === "login" && <LoginModal initialEmail={rememberedLoginEmail} onClose={() => setActiveDialog(null)} />}
    </main>
  );
}

function FooterLinks({
  links,
  onApplyClick,
  onContactClick,
}: {
  links: string[];
  onApplyClick?: () => void;
  onContactClick?: () => void;
}) {
  return (
    <div className={styles.footerLinks}>
      {links.map((link) => {
        if (link === "Become A Franchise Partner") {
          return <button className={styles.footerLinkButton} type="button" key={link} onClick={onApplyClick}>{link}</button>;
        }
        if (link === "Contact Us" && onContactClick) {
          return <button className={styles.footerLinkButton} type="button" key={link} onClick={onContactClick}>{link}</button>;
        }
        return <a href="#contact" key={link}>{link}</a>;
      })}
    </div>
  );
}
