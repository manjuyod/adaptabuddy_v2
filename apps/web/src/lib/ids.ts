import type { EntityId } from "@adaptabuddy/contracts";

const NUMERIC_ID_PATTERN = /^\d+$/;

export const toLookupId = (id: EntityId): string | number => {
  if (typeof id === "number") {
    return id;
  }
  if (NUMERIC_ID_PATTERN.test(id)) {
    return Number(id);
  }
  return id;
};

export const toLookupIds = (ids: EntityId[]): Array<string | number> => {
  return ids.map(toLookupId);
};

export const toStringId = (id: EntityId): string => String(id);
