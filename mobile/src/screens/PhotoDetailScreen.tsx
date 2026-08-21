import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAssetUri } from '../hooks/useAssetUri';
import { useSimilarPhotos } from '../hooks/useSimilarPhotos';
import { updateCaption, updateTags } from '../api/photos';
import { getErrorMessage } from '../api/client';
import { TagChip } from '../components/TagChip';
import { SimilarPhotosRow } from '../components/SimilarPhotosRow';
import { colors, spacing, typography } from '../theme';
import type { Photo } from '../api/types';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoDetail'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1.2;

export function PhotoDetailScreen({ route, navigation }: Props) {
  const { photo, photoList } = route.params;
  const photos = useMemo(
    () => (photoList && photoList.length > 0 ? photoList : [photo]),
    [photoList, photo]
  );
  const initialIndex = useMemo(() => {
    const index = photos.findIndex((p) => p.id === photo.id);
    return index >= 0 ? index : 0;
  }, [photos, photo]);

  const setTitleForIndex = useCallback(
    (index: number) => {
      navigation.setOptions({ title: photos.length > 1 ? `${index + 1} of ${photos.length}` : 'Photo' });
    },
    [navigation, photos.length]
  );

  useEffect(() => {
    setTitleForIndex(initialIndex);
    // only on mount: subsequent index changes are driven by scroll, not this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setTitleForIndex(index);
    },
    [setTitleForIndex]
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Photo> | null | undefined, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  const handleDismiss = useCallback(() => navigation.goBack(), [navigation]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Photo>) => (
      <PhotoDetailPage photo={item} navigation={navigation} onDismiss={handleDismiss} />
    ),
    [navigation, handleDismiss]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      />
    </SafeAreaView>
  );
}

type PageProps = {
  photo: Photo;
  navigation: Props['navigation'];
  onDismiss: () => void;
};

function PhotoDetailPage({ photo, navigation, onDismiss }: PageProps) {
  const localUri = useAssetUri(photo.asset_id);
  const { photos: similarPhotos, loadState: similarLoadState, refresh: refreshSimilar } = useSimilarPhotos(photo.id);

  const [caption, setCaption] = useState(photo.caption ?? '');
  const [isSavingCaption, setIsSavingCaption] = useState(false);

  const [tags, setTags] = useState(photo.tags);
  const [newTag, setNewTag] = useState('');
  const [isSavingTag, setIsSavingTag] = useState(false);

  const translateY = useRef(new Animated.Value(0)).current;

  // swipe-down-to-dismiss is scoped to the image itself so it never fights
  // the caption/tag ScrollView or the text inputs below it.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(onDismiss);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const handleSaveCaption = async () => {
    setIsSavingCaption(true);
    try {
      const result = await updateCaption(photo.id, caption);
      setCaption(result.caption);
    } catch (err) {
      Alert.alert('Couldn’t save caption', getErrorMessage(err, 'Please try again.'));
    } finally {
      setIsSavingCaption(false);
    }
  };

  const handleAddTag = async () => {
    const tag = newTag.trim();
    if (!tag || isSavingTag) return;
    setIsSavingTag(true);
    try {
      const result = await updateTags(photo.id, { tags_to_insert: [tag] });
      setTags(result.tags);
      setNewTag('');
    } catch (err) {
      Alert.alert('Couldn’t add tag', getErrorMessage(err, 'Please try again.'));
    } finally {
      setIsSavingTag(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (isSavingTag) return;
    setIsSavingTag(true);
    try {
      const result = await updateTags(photo.id, { tags_to_remove: [tag] });
      setTags(result.tags);
    } catch (err) {
      Alert.alert('Couldn’t remove tag', getErrorMessage(err, 'Please try again.'));
    } finally {
      setIsSavingTag(false);
    }
  };

  return (
    <View style={styles.page}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.imageContainer, { transform: [{ translateY }] }]}
      >
        {localUri ? (
          <Image source={{ uri: localUri }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
      </Animated.View>

      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Caption</Text>
          <TextInput
            style={styles.captionInput}
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption…"
            placeholderTextColor={colors.textSecondary}
            maxLength={200}
            multiline
            accessibilityLabel="Photo caption"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save caption"
            style={[styles.saveButton, isSavingCaption && styles.saveButtonDisabled]}
            disabled={isSavingCaption || caption === (photo.caption ?? '')}
            onPress={handleSaveCaption}
          >
            <Text style={styles.saveButtonText}>{isSavingCaption ? 'Saving…' : 'Save Caption'}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <TagChip key={tag} label={tag} onRemove={() => handleRemoveTag(tag)} />
            ))}
          </View>
          <View style={styles.addTagRow}>
            <TextInput
              style={styles.tagInput}
              value={newTag}
              onChangeText={setNewTag}
              placeholder="Add a tag…"
              placeholderTextColor={colors.textSecondary}
              maxLength={30}
              autoCapitalize="none"
              onSubmitEditing={handleAddTag}
              accessibilityLabel="New tag"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add tag"
              style={[styles.saveButton, (!newTag.trim() || isSavingTag) && styles.saveButtonDisabled]}
              disabled={!newTag.trim() || isSavingTag}
              onPress={handleAddTag}
            >
              <Text style={styles.saveButtonText}>Add</Text>
            </Pressable>
          </View>
        </View>

        <SimilarPhotosRow
          photos={similarPhotos}
          loadState={similarLoadState}
          onRetry={refreshSimilar}
          onPressPhoto={(similarPhoto) =>
            navigation.push('PhotoDetail', { photo: similarPhoto, photoList: similarPhotos })
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: colors.surface,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  captionInput: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    padding: spacing.sm,
    minHeight: 44,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  addTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tagInput: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    padding: spacing.sm,
    flex: 1,
  },
});
