export const ITEM_SPRITE_FRAME_SIZE = 64;
export const ITEM_SPRITE_TEXTURE_INDEX = 2;

const ITEM_ICON_FRAMES: Readonly<Record<string, number>> = {
  "source-view": 0,
  "memory-view": 1,
  "ascii-lens": 2,
  "int-lens": 3,
  "memory-legend": 4,
};

export function itemIconFrame(itemId: string): number | undefined {
  return ITEM_ICON_FRAMES[itemId];
}
