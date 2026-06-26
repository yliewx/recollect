import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { useAssetUri } from '../hooks/useAssetUri';
import type { Photo } from '../api/types';
import { colors } from '../theme';

type Props = {
  photo: Photo;
  size: number;
  onPress?: () => void;
};

export function SyncedPhotoCard({ photo, size, onPress }: Props) {
  const localUri = useAssetUri(photo.asset_id);

  const content = !localUri ? (
    <View style={{ width: size, height: size, backgroundColor: colors.surface }} />
  ) : (
    <Image
      source={localUri}
      accessibilityLabel={photo.caption ? `Photo: ${photo.caption}` : 'Photo'}
      style={{ width: size, height: size }}
      contentFit="cover"
    />
  );

  if (!onPress) return content;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="View photo" onPress={onPress}>
      {content}
    </Pressable>
  );
}
