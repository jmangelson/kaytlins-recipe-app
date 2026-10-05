import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { CameraPermissionError } from '@/features/recipes/recipe-photo';

/** Long edge sent for reading: sharp enough for small print, small to upload. */
const SCAN_EDGE = 1400;
const JPEG_QUALITY = 0.6;

/** One page of a recipe, ready to send. */
export type ScanPage = { uri: string; base64: string };

async function prepare(asset: ImagePicker.ImagePickerAsset): Promise<ScanPage | null> {
  const landscape = (asset.width ?? 0) > (asset.height ?? 0);
  const image = await ImageManipulator.manipulate(asset.uri)
    .resize(landscape ? { width: SCAN_EDGE } : { height: SCAN_EDGE })
    .renderAsync();
  const saved = await image.saveAsync({
    base64: true,
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });
  return saved.base64 ? { uri: saved.uri, base64: saved.base64 } : null;
}

/**
 * Takes one page with the camera, or chooses up to `limit` from the gallery
 * (no cropping, so the whole page is read). Resolves [] if she cancels.
 */
export async function pickScanPages(
  source: 'camera' | 'library',
  limit: number
): Promise<ScanPage[]> {
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new CameraPermissionError();
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      orderedSelection: true,
    });
  }
  if (result.canceled || !result.assets?.length) return [];
  const pages = await Promise.all(result.assets.slice(0, limit).map(prepare));
  return pages.filter((p): p is ScanPage => p !== null);
}
