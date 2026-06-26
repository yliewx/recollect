import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAssetUri } from '../hooks/useAssetUri';
import { updateCaption, updateTags } from '../api/photos';
import { getErrorMessage } from '../api/client';
import { TagChip } from '../components/TagChip';
import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoDetail'>;

export function PhotoDetailScreen({ route }: Props) {
  const { photo } = route.params;
  const localUri = useAssetUri(photo.asset_id);

  const [caption, setCaption] = useState(photo.caption ?? '');
  const [isSavingCaption, setIsSavingCaption] = useState(false);

  const [tags, setTags] = useState(photo.tags);
  const [newTag, setNewTag] = useState('');
  const [isSavingTag, setIsSavingTag] = useState(false);

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
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.imageContainer}>
        {localUri ? (
          <Image source={{ uri: localUri }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
      </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
