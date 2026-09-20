'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Users,
  Users2,
  CheckSquare,
  FileText,
  LogOut,
  FolderKanban,
  Server,
  Boxes,
  Shield,
  Settings,
  ChevronUp,
  KeyRound,
  BookOpen,
  Network,
  Stamp,
  Cloud,
  FileKey,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { NotificationBell } from '@/components/features/notification-bell';
import { useAuthStore } from '@/stores/auth';
import { usePermissionsStore } from '@/stores/permissions';
import { projectsApi } from '@/lib/api';
import { hasCertPerm } from '@/lib/utils/certificates';

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { permissionsCache, fetchPermissions } = usePermissionsStore();

  const [projectName, setProjectName] = useState<string | null>(null);

  // Fetch permissions when projectId changes
  useEffect(() => {
    if (projectId && !permissionsCache[projectId]) {
      fetchPermissions(projectId);
    }
  }, [projectId, permissionsCache, fetchPermissions]);

  // Fetch project name when projectId changes
  useEffect(() => {
    if (projectId) {
      projectsApi.get(projectId).then((project) => {
        setProjectName(project.name);
      }).catch(() => {
        setProjectName(null);
      });
    } else {
      setProjectName(null);
    }
  }, [projectId]);

  const permissions = projectId ? permissionsCache[projectId] : null;

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const mainNavItems = [
    { href: '/projects', icon: FolderKanban, label: 'Projects' },
    { href: '/clients', icon: Shield, label: 'Clients' },
    { href: '/api-docs', icon: BookOpen, label: 'API Docs' },
  ];

  // Admin-only navigation items (system-level)
  const isOwner = user?.role === 'owner';
  const adminNavItems = isOwner
    ? [
        { href: '/users', icon: Users2, label: 'Users' },
        { href: '/teams', icon: Users, label: 'Teams' },
        { href: '/sso', icon: Shield, label: 'SSO' },
        { href: '/certificates', icon: ShieldCheck, label: 'All Certificates' },
        { href: '/certificate-issuers', icon: Stamp, label: 'Certificate Issuers' },
        { href: '/dns-credentials', icon: Cloud, label: 'DNS Credentials' },
        { href: '/settings', icon: Settings, label: 'Settings' },
      ]
    : [];

  // Build project nav items based on permissions - grouped by category
  type NavItem = { href: string; icon: typeof Globe; label: string };

  const resourcesNavItems: NavItem[] = [];
  const administrationNavItems: NavItem[] = [];
  const approvalsNavItems: NavItem[] = [];

  if (projectId && permissions) {
    // === RESOURCES GROUP ===
    // Topology hidden for now — page + components retained at /projects/[projectId]/topology
    // for future re-enable once general-mode signals are reworked.
    // resourcesNavItems.push({ href: `/projects/${projectId}/topology`, icon: Network, label: 'Topology' });
    // Domains - visible to all team members
    resourcesNavItems.push({ href: `/projects/${projectId}/domains`, icon: Globe, label: 'Domains' });

    // Certificates - only for members with certificate.view permission
    if (hasCertPerm(permissions, 'certificate.view')) {
      resourcesNavItems.push({ href: `/projects/${projectId}/certificates`, icon: FileKey, label: 'Certificates' });
    }

    // Domain Templates - only for Owner/Project Admin
    if (permissions.canManageDomainTemplates) {
      resourcesNavItems.push({ href: `/projects/${projectId}/domain-templates`, icon: Server, label: 'Domain Templates' });
    }

    // Namespaces - only for Owner/Project Admin (can manage domains = can manage namespaces)
    if (permissions.canManageDomains) {
      resourcesNavItems.push({ href: `/projects/${projectId}/namespaces`, icon: Boxes, label: 'Namespaces' });
    }

    // === ADMINISTRATION GROUP ===
    // Teams - only for Owner/Project Admin
    if (permissions.canManageTeams) {
      administrationNavItems.push({ href: `/projects/${projectId}/teams`, icon: Users, label: 'Teams' });
      administrationNavItems.push({ href: `/projects/${projectId}/presets`, icon: KeyRound, label: 'Permission Presets' });
    }

    // Audit Log - only for Owner/Project Admin
    if (permissions.canViewAudit) {
      administrationNavItems.push({ href: `/projects/${projectId}/audit`, icon: FileText, label: 'Audit Log' });
    }

    // Settings - only for Owner/Project Admin
    if (permissions.isOwner || permissions.isProjectAdmin) {
      administrationNavItems.push({ href: `/projects/${projectId}/settings`, icon: Settings, label: 'Settings' });
    }

    // === APPROVALS GROUP ===
    // Approvals - visible to all project members (unified page for routes + clients)
    approvalsNavItems.push({ href: `/projects/${projectId}/approvals`, icon: CheckSquare, label: 'Approvals' });

  } else if (projectId) {
    // Show loading state with only domains visible (safest default)
    // Topology hidden for now (see note above).
    // resourcesNavItems.push({ href: `/projects/${projectId}/topology`, icon: Network, label: 'Topology' });
    resourcesNavItems.push({ href: `/projects/${projectId}/domains`, icon: Globe, label: 'Domains' });
  }

  const renderNavGroup = (title: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    return (
      <>
        <div className="pt-3 pb-1">
          <p className="px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {title}
          </p>
        </div>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn('sidebar-link', isActive(item.href) && 'active')}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </>
    );
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <Link href="/projects" className="flex items-center gap-2">
          <Image src="/favicon-32x32.png" alt="FastGateway" width={24} height={24} />
          <span className="text-lg font-semibold text-gray-900">FastGateway</span>
        </Link>
        <NotificationBell />
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn('sidebar-link', isActive(item.href) && 'active')}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}

        {adminNavItems.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Admin
              </p>
            </div>
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn('sidebar-link', isActive(item.href) && 'active')}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </>
        )}

        {projectId && (
          <>
            <div className="pt-4 pb-2">
              <Link href="/projects" className="block px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600">
                Project: {projectName || 'Loading...'}
              </Link>
            </div>

            {renderNavGroup('Resources', resourcesNavItems)}
            {renderNavGroup('Administration', administrationNavItems)}
            {renderNavGroup('Approvals', approvalsNavItems)}
          </>
        )}
      </nav>

      <UserMenu user={user} logout={logout} />
    </aside>
  );
}

function UserMenu({ user, logout }: { user: { username: string; role: string } | null; logout: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="p-4 border-t border-gray-200 relative" ref={menuRef}>
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
          <Link
            href="/profile"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Profile Settings
          </Link>
          <hr className="my-1 border-gray-200" />
          <button
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}

      {/* User info button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-medium text-primary-700">
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p>
          <p className="text-xs text-gray-500 truncate">{user?.role}</p>
        </div>
        <ChevronUp className={cn("h-4 w-4 text-gray-400 transition-transform", !isOpen && "rotate-180")} />
      </button>
    </div>
  );
}
