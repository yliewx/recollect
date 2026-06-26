import type { Photo } from '../api/types';

export type RootStackParamList = {
  Library: undefined;
  Import: undefined;
  PhotoDetail: { photo: Photo };
};
