import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Longest edge of stored recipe photos; ~600 px keeps them around 60 KB. */
const PHOTO_WIDTH = 600;
const JPEG_QUALITY = 0.65;

export class CameraPermissionError extends Error {
  constructor() {
    super('Camera access is off. Turn it on in Android settings to take a photo.');
  }
}

/**
 * Lets her take or choose a photo, crops it to 4:3, and returns it as a small
 * base64 JPEG ready to store. Resolves null if she cancels.
 */
export async function pickRecipePhoto(source: 'camera' | 'library'): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 1,
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new CameraPermissionError();
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  if (result.canceled || !result.assets?.length) return null;

  const image = await ImageManipulator.manipulate(result.assets[0].uri)
    .resize({ width: PHOTO_WIDTH })
    .renderAsync();
  const saved = await image.saveAsync({
    base64: true,
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });
  return saved.base64 ?? null;
}
