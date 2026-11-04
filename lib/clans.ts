/** Клановая система: роли, права и бонусы за состав. */

export const CLAN_CREATE_COST = 500;
export const CLAN_NAME_MIN = 3;
export const CLAN_NAME_MAX = 32;
export const CLAN_TAG_MIN = 2;
export const CLAN_TAG_MAX = 6;
export const CLAN_DESC_MAX = 280;
export const CLAN_MAX_MEMBERS_CAP = 50;

export const CLAN_ROLES = [
  "leader",
  "co_leader",
  "officer",
  "treasurer",
  "recruiter",
  "veteran",
  "member",
  "recruit",
] as const;

export type ClanRole = (typeof CLAN_ROLES)[number];

export const CLAN_ROLE_META: Record<
  ClanRole,
  { ru: string; en: string; hintRu: string; hintEn: string; weight: number; color: string }
> = {
  leader: {
    ru: "Лидер",
    en: "Leader",
    hintRu: "Полный доступ: настройки, роли, казна, роспуск.",
    hintEn: "Full access: settings, roles, treasury, disband.",
    weight: 100,
    color: "#facc15",
  },
  co_leader: {
    ru: "Соруководитель",
    en: "Co-leader",
    hintRu: "Ведёт клан вместе с лидером, кроме роспуска и передачи власти.",
    hintEn: "Runs the clan with the leader, except disband and ownership transfer.",
    weight: 80,
    color: "#c084fc",
  },
  officer: {
    ru: "Офицер",
    en: "Officer",
    hintRu: "Заявки, приглашения и кик участников ниже по рангу.",
    hintEn: "Applications, invites and kicking lower-ranked members.",
    weight: 60,
    color: "#60a5fa",
  },
  treasurer: {
    ru: "Казначей",
    en: "Treasurer",
    hintRu: "Следит за казной и выводит средства на нужды клана.",
    hintEn: "Manages the treasury and withdraws funds for clan needs.",
    weight: 55,
    color: "#34d399",
  },
  recruiter: {
    ru: "Рекрутер",
    en: "Recruiter",
    hintRu: "Приглашает игроков и рассматривает заявки.",
    hintEn: "Invites players and reviews applications.",
    weight: 50,
    color: "#22d3ee",
  },
  veteran: {
    ru: "Ветеран",
    en: "Veteran",
    hintRu: "Опытный участник с особым бейджем в профиле.",
    hintEn: "An experienced member with a special profile badge.",
    weight: 40,
    color: "#fb923c",
  },
  member: {
    ru: "Участник",
    en: "Member",
    hintRu: "Полноправный участник клана.",
    hintEn: "A full clan member.",
    weight: 20,
    color: "#a1a1aa",
  },
  recruit: {
    ru: "Новобранец",
    en: "Recruit",
    hintRu: "Стартовый ранг: доступ к чату и казне, без управления.",
    hintEn: "Starting rank: chat and treasury access, no management.",
    weight: 10,
    color: "#71717a",
  },
};

export type ClanPermission =
  | "manage_settings"
  | "manage_roles"
  | "kick"
  | "review_applications"
  | "invite"
  | "treasury_withdraw"
  | "disband"
  | "transfer"
  | "chat";

const ROLE_PERMISSIONS: Record<ClanRole, ClanPermission[]> = {
  leader: [
    "manage_settings",
    "manage_roles",
    "kick",
    "review_applications",
    "invite",
    "treasury_withdraw",
    "disband",
    "transfer",
    "chat",
  ],
  co_leader: [
    "manage_settings",
    "manage_roles",
    "kick",
    "review_applications",
    "invite",
    "treasury_withdraw",
    "chat",
  ],
  officer: ["kick", "review_applications", "invite", "chat"],
  treasurer: ["treasury_withdraw", "chat"],
  recruiter: ["review_applications", "invite", "chat"],
  veteran: ["chat"],
  member: ["chat"],
  recruit: ["chat"],
};

export function isClanRole(value: unknown): value is ClanRole {
  return typeof value === "string" && (CLAN_ROLES as readonly string[]).includes(value);
}

export function roleWeight(role: string | null | undefined): number {
  return isClanRole(role) ? CLAN_ROLE_META[role].weight : 0;
}

export function can(role: string | null | undefined, permission: ClanPermission): boolean {
  if (!isClanRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: string | null | undefined): ClanPermission[] {
  if (!isClanRole(role)) return [];
  return [...ROLE_PERMISSIONS[role]];
}

export function canManageRole(actorRole: string | null | undefined, targetRole: string): boolean {
  if (!can(actorRole, "manage_roles")) return false;
  return roleWeight(actorRole) > roleWeight(targetRole);
}

export function clanRoleLabel(role: string | null | undefined, lang: "ru" | "en"): string {
  if (!isClanRole(role)) return lang === "en" ? "Member" : "Участник";
  return lang === "en" ? CLAN_ROLE_META[role].en : CLAN_ROLE_META[role].ru;
}

export function clanRoleColor(role: string | null | undefined): string {
  return isClanRole(role) ? CLAN_ROLE_META[role].color : "#a1a1aa";
}

/** Уровень клана растёт от общего XP: 100 XP за первый, дальше всё дороже. */
export function clanLevel(xp: number): number {
  const value = Math.max(0, Math.floor(Number(xp) || 0));
  return Math.max(1, Math.floor(Math.sqrt(value / 100)) + 1);
}

/** Сколько XP нужно суммарно для уровня. */
export function clanXpForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(Number(level) || 1));
  return (safe - 1) ** 2 * 100;
}

/** Лимит участников зависит от уровня и не превышает 50. */
export function clanMaxMembers(level: number): number {
  const safe = Math.max(1, Math.floor(Number(level) || 1));
  return Math.min(CLAN_MAX_MEMBERS_CAP, 10 + safe * 2);
}

/**
 * Бонус к ежедневным SC за состав клана.
 * Учитывает количество участников и разнообразие ролей.
 */
export function clanBonusPercent(memberCount: number, roleCount: number): number {
  const members = Math.max(0, Math.floor(Number(memberCount) || 0));
  if (members < 3) return 0;

  const sizeBonus = members >= 20 ? 15 : members >= 12 ? 10 : members >= 6 ? 6 : 3;
  const roles = Math.max(0, Math.floor(Number(roleCount) || 0));
  const diversityBonus = roles >= 5 ? 5 : roles >= 4 ? 3 : roles >= 3 ? 2 : 0;

  return Math.min(20, sizeBonus + diversityBonus);
}

export function clanBonusLabel(percent: number): string {
  return `+${Math.max(0, Math.floor(Number(percent) || 0))}%`;
}

/** XP за действия, которые идут в общий прогресс клана. */
export const CLAN_XP = {
  dailyReward: 5,
  purchase: 10,
  review: 15,
  clanMessage: 1,
} as const;

export function normalizeClanName(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, CLAN_NAME_MAX);
}

export function normalizeClanTag(value: unknown): string {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CLAN_TAG_MAX);
}

export function normalizeClanDescription(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, CLAN_DESC_MAX);
}

export function normalizeClanEmblem(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "🛡️";
  // Не даём превратить эмблему в длинный текст.
  return [...raw].slice(0, 2).join("");
}

export function normalizeClanColor(value: unknown): string {
  const raw = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : "#a78bfa";
}

export function isValidClanName(value: string): boolean {
  return value.length >= CLAN_NAME_MIN && value.length <= CLAN_NAME_MAX && /^[\p{L}\p{N} _.-]+$/u.test(value);
}

export function isValidClanTag(value: string): boolean {
  return value.length >= CLAN_TAG_MIN && value.length <= CLAN_TAG_MAX && /^[A-Z0-9]+$/.test(value);
}
