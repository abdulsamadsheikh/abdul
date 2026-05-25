import { Mail } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 mb-8 px-4 text-center text-white/30 text-[11px] tracking-wide">
      <div className="max-w-md mx-auto flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-white/40">
          <img src="/logo.png" alt="" className="w-4 h-4 rounded-full opacity-60" />
          <span>© {year} Abdulsamad Sheikh</span>
        </div>
        <p className="text-white/30">
          sliter litt psykisk. vurderer å ikke velge kaffe imorgen. for mer, sjekk ut{" "}
          <a
            href="https://sheikh.as"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            sheikh.as
          </a>
        </p>

        <div className="flex items-center gap-4 pt-1">
          <SocialLink
            href="https://linkedin.com/in/abdulsamadsheikh"
            label="LinkedIn"
            icon={<LinkedInIcon />}
          >
            LinkedIn
          </SocialLink>
          <span className="text-white/15">·</span>
          <SocialLink
            href="https://github.com/abdulsamadsheikh"
            label="GitHub"
            icon={<GitHubIcon />}
          >
            GitHub
          </SocialLink>
          <span className="text-white/15">·</span>
          <SocialLink
            href="mailto:abdulsamad@sheikh.as"
            label="Email"
            icon={<Mail className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            abdulsamad (at) sheikh.as
          </SocialLink>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  icon,
  children,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const isExternal = href.startsWith("http");
  return (
    <a
      href={href}
      aria-label={label}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors"
    >
      {icon}
      <span>{children}</span>
    </a>
  );
}

// Inline brand SVGs (Simple Icons paths) — lucide deprecated their brand icons.
function LinkedInIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.778 13.019H3.555V9h3.56v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
