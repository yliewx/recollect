import type { Photo } from '../api/types';

export type RootStackParamList = {
  Library: undefined;
  Import: undefined;
  // photoList is the sibling set to swipe through (defaults to just `photo`
  // when absent, e.g. a future deep link into a single photo).
  PhotoDetail: { photo: Photo; photoList?: Photo[] };
};
