import { validateAndFormatAddress } from '@orb-labs/orby-core';

import { colors } from './emojiAvatarBackgroundColors';

const avatars = [
  { color: colors[0], emoji: '🌶' },
  { color: colors[1], emoji: '🤑' },
  { color: colors[2], emoji: '🐙' },
  { color: colors[3], emoji: '🫐' },
  { color: colors[4], emoji: '🐳' },
  { color: colors[0], emoji: '🤶' },
  { color: colors[5], emoji: '🌲' },
  { color: colors[6], emoji: '🌞' },
  { color: colors[7], emoji: '🐒' },
  { color: colors[8], emoji: '🐵' },
  { color: colors[9], emoji: '🦊' },
  { color: colors[10], emoji: '🐼' },
  { color: colors[11], emoji: '🦄' },
  { color: colors[12], emoji: '🐷' },
  { color: colors[13], emoji: '🐧' },
  { color: colors[8], emoji: '🦩' },
  { color: colors[14], emoji: '👽' },
  { color: colors[0], emoji: '🎈' },
  { color: colors[8], emoji: '🍉' },
  { color: colors[1], emoji: '🎉' },
  { color: colors[15], emoji: '🐲' },
  { color: colors[16], emoji: '🌎' },
  { color: colors[17], emoji: '🍊' },
  { color: colors[18], emoji: '🐭' },
  { color: colors[19], emoji: '🍣' },
  { color: colors[1], emoji: '🐥' },
  { color: colors[20], emoji: '👾' },
  { color: colors[15], emoji: '🥦' },
  { color: colors[0], emoji: '👹' },
  { color: colors[17], emoji: '🙀' },
  { color: colors[4], emoji: '⛱' },
  { color: colors[21], emoji: '⛵️' },
  { color: colors[17], emoji: '🥳' },
  { color: colors[8], emoji: '🤯' },
  { color: colors[22], emoji: '🤠' },
] as const;

function hashCode(text: string) {
  let hash = 0;
  if (text.length === 0) return hash;
  for (let i = 0; i < text.length; i++) {
    const chr = text.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash;
}

export function emojiAvatarForAddress(address?: string) {
  const resolvedAddress = typeof address === 'string' ? address : '';
  const avatarIndex = Math.abs(
    hashCode(validateAndFormatAddress(resolvedAddress)) % avatars.length,
  );
  return avatars[avatarIndex ?? 0];
}
