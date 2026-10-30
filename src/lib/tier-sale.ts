type TierSaleState = {
  is_active: boolean;
  archived_at: string | null;
  member_count: number;
  prices: { price: number; is_enabled: boolean }[];
};

export const hasTierPrice = (prices: { price: number }[]) =>
  prices.some((p) => Number.isFinite(p.price) && p.price >= 0);

export const isSellableTier = (tier: TierSaleState) =>
  tier.is_active && !tier.archived_at && tier.prices.some((p) => p.is_enabled && hasTierPrice([p]));

export const needsSaleConfirmation = (tier: Pick<TierSaleState, "member_count">, active: boolean) =>
  !active && tier.member_count > 0;