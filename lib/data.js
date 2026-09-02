import {
  Monitor,
  Server,
  Database,
  Wrench,
  Github,
  Linkedin,
  Twitter,
  Instagram,
} from "lucide-react";

export const socials = [
  { label: "GitHub", href: "https://github.com/ahmad-cs50x/", Icon: Github },
  { label: "LinkedIn", href: "https://linkedin.com/in/ahmadcs50x", Icon: Linkedin },
  { label: "Instagram", href: "https://instagram.com/ahmad_cs50x", Icon: Instagram },
];

export const marqueeItems = [
  "React",
  "Next js",
  "Node js",
  "Express js",
  "Tailwind CSS",
  "Three js",
  "TypeScript",
  "MongoDB",
  "Figma",
  "Python",
  "Django",
  "fastapi",
  "PostgreSQL",
  "Supabase",
  "Docker",
  "GIT hub",
  "GIT bash",
];

export const skillGroups = [
  {
    Icon: Monitor,
    title: "Frontend Engineering",
    blurb: "Pixel-perfect, blazing-fast interfaces",
    skills: [
      { name: "React", level: 95 },
      { name: "Next JS", level: 92 },
      { name: "TypeScript", level: 88 },
      { name: "Tailwind CSS", level: 94 },
      { name: "Three JS / R3F", level: 85 },
    ],
  },
  {
    Icon: Server,
    title: "Backend Engineering",
    blurb: "Scalable APIs & Realtime Systems",
    skills: [
      { name: "Node JS / Python ", level: 93 },
      { name: "Express JS / Django", level: 91 },
      { name: "REST & GraphQL", level: 89 },
      { name: "WebSockets / Socket.io", level: 87 },
      { name: "Auth & Security", level: 86 },
    ],
  },
  {
    Icon: Database,
    title: "Database & Cloud",
    blurb: "Data modeled for scale",
    skills: [
      { name: "MongoDB", level: 90 },
      { name: "PostgreSQL", level: 86 },
      { name: "Redis", level: 82 },
      { name: "Docker", level: 84 },
      { name: "AWS / Vercel / Netlify", level: 78 },
    ],
  },
  {
    Icon: Wrench,
    title: "Tools & Workflow",
    blurb: "Ship with speed and confidence",
    skills: [
      { name: "Git / GitHub Actions", level: 95 },
      { name: "Testing (Jest, Cypress)", level: 83 },
      { name: "Figma / Framer", level: 80 },
      { name: "Agile / Scrum", level: 88 },
      { name: "Linux / Bash", level: 81 },
    ],
  },
];

export const projects = [
  {
    title: "Virtual Store",
    description:
      "A Full-Stack E-commerce store that is specially build to make people life easy to buy tech items form home and recive at thier door step.",
    tags: ["Next JS", "Express JS", "MongoDb", "Stripe"],
    gradient: "from-violet-600 via-purple-600 to-indigo-700",
    demo: "#",
    repo: "#",
  },
  {
    title: "Saltiam",
    description:
      "A Full-Stack SaaS platform specially build for Exporting Pure Himaliyan Salt in more then 20 all over the World.",
    tags: ["Next JS", "Stripe", "MongoDB", "Auth JS"],
    gradient: "from-cyan-500 via-sky-600 to-blue-700",
    demo: "#",
    repo: "#",
  },
  {
    title: "Buy Me A Chai",
    description:
      "A platform where content creator can register themselves and set goals, raise funds, and get their own personalized donation page link.",
    tags: ["React", "Node JS", "MongoDb", "Auth JS"],
    gradient: "from-fuchsia-600 via-pink-600 to-rose-600",
    demo: "#",
    repo: "#",
  },
  {
    title: "Url Shortner",
    description:
      "A specialized free tool built for URL shortening. You can shorten your long URL into a small one and share it with your friends and family.",
    tags: ["Node Js", "Next JS", "MongoDB"],
    gradient: "from-emerald-500 via-teal-600 to-cyan-700",
    demo: "#",
    repo: "#",
  },
  {
    title: "Veltra",
    description:
      "An animated travel website prototype where user can book from Car to Private Jet in 100+ countries that enhance your travel experience.",
    tags: ["Figma"],
    gradient: "from-indigo-500 via-blue-600 to-violet-700",
    demo: "https://www.figma.com/proto/o2ZWUifOl0MGw7TTm86mQk/Traveling-Website?page-id=5003%3A4469&node-id=5761-39185&scaling=scale-down-width&content-scaling=fixed&t=JSvSy68RiRyGZkAS-1",
    repo: "#",
  },
  {
    title: "Linktree Clone",
    description:
      "A Good tool for content creators to manage there lagre bulkey socail media link into a single page. This is a clone of linktree.",
    tags: ["Next JS", "Auth JS", "Express JS", "MongoDB"],
    gradient: "from-amber-500 via-orange-600 to-red-600",
    demo: "#",
    repo: "#",
  },
  {
    title: "Spotify Clone",
    description:
      "A spotify clone where u make your own music playlist, control volume, play next and previous songs, upload form your device, add to favorites.",
    tags: ["Next JS", "Tailwind CSS", "Local Storage"],
    gradient: "from-indigo-500 via-blue-600 to-violet-700",
    demo: "#",
    repo: "#",
  },
  {
    title: "Netflix Clone",
    description:
      "A Netflix (movie streaming website clone) free to access no charges.",
    tags: ["Next JS", "Tailwind CSS", "React"],
    gradient: "from-indigo-500 via-blue-600 to-violet-700",
    demo: "#",
    repo: "#",
  },
];

export const experience = [
  {
    role: "Senior Full-Stack Developer",
    company: "Freelance",
    period: "2025 — Present",
    description:
      "Now as a Freelancer I love to solve people problems, make automation for them, make webapps for them to helps them to grows thier bussinesses, help them to earn money without headache of presecnce there. I love to teach new developer from the up and down of the market and how to make happy clients.",
    tags: ["Next.js", "Node.js", "AWS", "MongoDB"],
  },
  {
    role: "Full-Stack Developer",
    company: "Freelance",
    period: "2025 ",
    description:
      "Shipped 15+ client products end-to-end, including a Full Stack E-commerce platform processing $2M+ GMV. And delevired the project in 25% less time and mentored two junior developers.",
    tags: ["React", "Express JS", "MongoDB", "Docker"],
  },
  {
    role: "Frontend Developer",
    company: "Freelance",
    period: "2024 — 2025",
    description:
      "Delivered responsive marketing sites and web apps. Raised average Lighthouse performance scores to 92+ and collaborated closely with designers on award-winning campaign experiences.",
    tags: ["JavaScript", "React", "Next JS", "Figma"],
  },
];
