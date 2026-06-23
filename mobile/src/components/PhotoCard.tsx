import { Image } from 'expo-image';
import type * as MediaLibrary from 'expo-media-library/legacy';

type Props = {
  asset: MediaLibrary.Asset;
  size: number;
};

export function PhotoCard({ asset, size }: Props) {
  return (
    <Image
      source={asset.uri}
      accessibilityLabel={`Photo ${asset.filename}`}
      style={{ width: size, height: size }}
      contentFit="cover"
    />
  );
}
