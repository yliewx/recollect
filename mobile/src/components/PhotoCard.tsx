import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import type * as MediaLibrary from 'expo-media-library/legacy';
import { colors } from '../theme';

type Props = {
  asset: MediaLibrary.Asset;
  size: number;
  // when defined, renders a selection checkmark and makes the card pressable (picker mode)
  selected?: boolean;
  onPress?: () => void;
};

export function PhotoCard({ asset, size, selected, onPress }: Props) {
  const content = (
    <View style={{ width: size, height: size }}>
      <Image
        source={asset.uri}
        accessibilityLabel={`Photo ${asset.filename}`}
        style={{ width: size, height: size }}
        contentFit="cover"
      />
      {selected !== undefined && (
        <View style={[styles.checkCircle, selected && styles.checkCircleSelected]} />
      )}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selected ? `Deselect photo ${asset.filename}` : `Select photo ${asset.filename}`}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  checkCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  checkCircleSelected: {
    backgroundColor: colors.accent,
  },
});
