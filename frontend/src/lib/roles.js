/**
 * Role-based navigation config.
 *
 * `nav` — array of nav sections rendered in the sidebar.
 *         Each item is only shown if the user's role is in its `allow` list.
 *         Admin sees everything (super-role).
 *
 * `landing` — default landing route per role, used for post-login redirect.
 */
import {
  Home, LayoutDashboard, Bell, Wrench, ClipboardList, Users, MessageSquare,
  Layers, Cpu, Workflow, Mail, UserPlus, ShieldCheck, Briefcase, Activity,
} from "lucide-react";

export const ROLES = {
  executive:     { label: "Executive",       icon: Briefcase },
  asset_manager: { label: "Asset Manager",   icon: Activity },
  om_manager:    { label: "O&M Manager",     icon: Wrench },
  technician:    { label: "Field Technician", icon: Wrench },
  admin:         { label: "Administrator",   icon: ShieldCheck },
};

export const LANDING = {
  executive: "/overview",
  asset_manager: "/dashboard",
  om_manager: "/operations",
  technician: "/my-work",
  admin: "/admin",
  // legacy fallbacks
  user: "/overview",
  owner: "/dashboard",
  compliance: "/reports",
};

// Section headers preserved; links ordered Monitor → Diagnose → Optimize within each section.
export const NAV = [
  // PUBLIC / MARKETING — always visible
  { section: "PLATFORM", public: true, items: [
    { to: "/",             label: "Overview",     icon: Home },
    { to: "/platform",     label: "Platform",     icon: Layers },
    { to: "/solutions",    label: "Solutions",    icon: Cpu },
    { to: "/how-it-works", label: "How It Works", icon: Workflow },
  ]},

  // OPERATIONS — role-gated
  { section: "OPERATIONS", items: [
    // MONITOR
    { to: "/overview",   label: "Executive Overview", icon: Briefcase,
      allow: ["executive", "asset_manager", "om_manager", "admin"] },
    { to: "/dashboard",  label: "Live Dashboard",     icon: LayoutDashboard,
      allow: ["executive", "asset_manager", "om_manager", "admin"] },
    { to: "/operations", label: "Operations Center",  icon: Activity,
      allow: ["om_manager", "asset_manager", "admin"] },
    { to: "/my-work",    label: "My Work",            icon: ClipboardList,
      allow: ["technician", "om_manager", "admin"] },

    // DIAGNOSE
    { to: "/alerts",  label: "Alert Center", icon: Bell,
      allow: ["asset_manager", "om_manager", "technician", "admin"] },

    // OPTIMIZE
    { to: "/reports", label: "Report Scheduler", icon: Mail,
      allow: ["executive", "asset_manager", "om_manager", "admin"] },
    { to: "/team",    label: "Team",              icon: UserPlus,
      allow: ["admin"] },
    { to: "/admin",   label: "Administration",    icon: ShieldCheck,
      allow: ["admin"] },
  ]},

  { section: "COMPANY", public: true, items: [
    { to: "/about",   label: "About",   icon: Users },
    { to: "/contact", label: "Contact", icon: MessageSquare },
  ]},
];

/** Returns visible items for a section given the current user. */
export function visibleItems(section, user) {
  return section.items.filter((it) => {
    if (section.public) return true;
    if (!user) return false;
    if (user.role === "admin") return true; // admin sees everything
    if (!it.allow) return true;
    return it.allow.includes(user.role);
  });
}

export function landingFor(role) {
  return LANDING[role] || "/dashboard";
}
