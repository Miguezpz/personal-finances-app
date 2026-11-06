/**
 * Decorative mark of an account: its bank's logo tile (public/logos, see domain/institutions.ts),
 * a monogram on the brand color when the bank has no logo file, or the generic icon of its kind
 * when the bank is unknown. Always next to the account's name (aria-hidden), never replaces it.
 * A plain <img> on purpose: static SVG tiles need no optimization and cost no JS.
 */
import { ACCOUNT_KIND_ICONS } from "@/components/icons/domain-icons";
import { institutionOf, monogramOf } from "@/domain/institutions";
import type { Account } from "@/domain/types";
import { cn } from "@/lib/utils";

interface Props {
  account: Pick<Account, "kind" | "institution" | "name">;
  /** Size utilities, e.g. "size-4" (default) or "size-6". */
  className?: string;
}

export function AccountMark({ account, className }: Props) {
  const size = className ?? "size-4";
  const institution = institutionOf(account);

  if (!institution) {
    const Icon = ACCOUNT_KIND_ICONS[account.kind];
    return <Icon aria-hidden="true" focusable="false" className={cn("shrink-0", size)} />;
  }

  const tile = cn("shrink-0 rounded-[22%] ring-1 ring-border", size);
  if (institution.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/logos/${institution.slug}.svg`}
        alt=""
        aria-hidden="true"
        width={64}
        height={64}
        decoding="async"
        data-institution={institution.slug}
        className={tile}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      data-institution={institution.slug}
      className={tile}
    >
      <rect width="64" height="64" rx="14" fill={institution.color} />
      <text
        x="32"
        y="33"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize="28"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#FFFFFF"
      >
        {monogramOf(institution)}
      </text>
    </svg>
  );
}
