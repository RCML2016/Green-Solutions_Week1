/**
 * Navigation config — split into MARKETING (public visitors) and APP (logged-in).
 *
 * MARKETING_NAV → horizontal top navbar for logged-out visitors.
 * APP_NAV       → 8-item application nav for logged-in users.
 *                 Role-filtered via `visibleAppItems(user)`.
 *
 * Technician / Performance Engineer / Client Viewer land on their own workspace
 * page and see ONLY that page in the sidebar (per user's spec).
 */
import {
  Home, LayoutDashboard, Bell, Wrench, ClipboardList, Users, MessageSquare,
  Layers, Cpu, Workflow, Mail, UserPlus, ShieldCheck, Briefcase, Activity,
  LineChart, Eye, Info, PhoneCall, Sparkles, Package,
} from "lucide-react";

export const ROLES = {
  executive:            { label: "Executive",            icon: Briefcase },
  asset_manager:        { label: "Asset Manager",        icon: Activity },
  om_manager:           { label: "O&M Manager",          icon: Wrench },
  technician:           { label: "Field Technician",     icon: Wrench },
  performance_engineer: { label: "Performance Engineer", icon: LineChart },
  client_viewer:        { label: "Client Viewer",        icon: Eye },
  admin:                { label: "Administrator",        icon: ShieldCheck },
};

export const LANDING = {
  executive: "/overview",
  asset_manager: "/dashboard",
  om_manager: "/operations",
  technician: "/my-work",
  performance_engineer: "/performance",
  client_viewer: "/client-portal",
  admin: "/admin",
  user: "/overview",
  owner: "/dashboard",
  compliance: "/reports",
};

/** Public / marketing navigation — visible in the top bar for logged-out users. */
export const MARKETING_NAV = [
  { to: "/",             label: "Home",         icon: Home,     end: true },
  { to: "/platform",     label: "Platform",     icon: Layers },
  { to: "/solutions",    label: "Solutions",    icon: Cpu },
  { to: "/how-it-works", label: "How It Works", icon: Workflow },
  { to: "/about",        label: "About",        icon: Info },
  { to: "/contact",      label: "Contact",      icon: MessageSquare },
];

/**
 * Application navigation — the 8 canonical items after login.
 * Each item's `allow` list determines which roles see it.
 * Admin is a super-role and always sees everything.
 */
export const APP_NAV = [
  { to: "/overview",     label: "Overview",         icon: Briefcase,       allow: ["executive", "asset_manager", "om_manager"] },
  { to: "/dashboard",    label: "Portfolio",        icon: LayoutDashboard, allow: ["executive", "asset_manager", "om_manager", "performance_engineer"] },
  { to: "/assets",       label: "Assets",           icon: Package,         allow: ["asset_manager", "om_manager", "performance_engineer"] },
  { to: "/ai",           label: "AI Intelligence",  icon: Sparkles,        allow: ["executive", "asset_manager", "om_manager", "performance_engineer", "technician"] },
  { to: "/operations",   label: "Operations",       icon: Activity,        allow: ["om_manager", "asset_manager"] },
  { to: "/work-orders",  label: "Work Orders",      icon: Wrench,          allow: ["om_manager", "technician", "asset_manager"] },
  { to: "/reports",      label: "Reports",          icon: Mail,            allow: ["executive", "asset_manager", "om_manager"] },
  { to: "/admin",        label: "Administration",   icon: ShieldCheck,     allow: [] },  // admin only via super-role
];

/**
 * Solo-workspace roles: they see ONLY their own landing page in the sidebar.
 * Everything else is hidden from their nav (walled-garden UX).
 */
const SOLO_NAV = {
  technician:           [{ to: "/my-work",        label: "My Work",           icon: ClipboardList }],
  performance_engineer: [{ to: "/performance",    label: "Performance",       icon: LineChart }],
  client_viewer:        [{ to: "/client-portal",  label: "Client Portal",     icon: Eye }],
};

/** Returns the app nav items visible to the current user, role-filtered. */
export function visibleAppItems(user) {
  if (!user) return [];
  if (user.role === "admin") return APP_NAV;                     // super-role sees all 8
  if (SOLO_NAV[user.role]) return SOLO_NAV[user.role];           // walled garden
  return APP_NAV.filter((it) => it.allow?.includes(user.role));
}

export function landingFor(role) {
  return LANDING[role] || "/dashboard";
}
