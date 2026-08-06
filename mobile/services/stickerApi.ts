import { API_URL, authFetch } from "./api";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Remove background from an image using the backend AI service (rembg/U²-Net).
 *
 * Flow:
 *   1. App sends image (file or URL) to backend
 *   2. Backend forwards to bg-remover microservice
 *   3. AI model removes background
 *   4. Image is resized to 512×512, converted to WebP
 *   5. Returns local file URI of the transparent sticker
 *
 * @param imageSource - Local file URI or remote URL of the image
 * @param token - Auth token for the API
 * @returns Local file URI of the processed WebP sticker with transparent background
 */
export async function removeBackground(
  imageSource: string,
  token: string
): Promise<string> {
  const stickerDir = `${FileSystem.documentDirectory}stickers/`;
  const dirInfo = await FileSystem.getInfoAsync(stickerDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(stickerDir, { intermediates: true });
  }

  const outputFilename = `sticker_nobg_${Date.now()}.webp`;
  const outputPath = `${stickerDir}${outputFilename}`;

  // If the source is a remote URL, use the URL-based endpoint (avoids downloading twice)
  if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
    const response = await fetch(`${API_URL}/stickers/remove-bg-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url: imageSource }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "Unknown error");
      throw new Error(`Background removal failed: ${errBody}`);
    }

    // Convert response blob to base64 and save
    const blob = await response.blob();
    const reader = new FileReader();
    const base64Data = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip the data:image/webp;base64, prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    await FileSystem.writeAsStringAsync(outputPath, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return outputPath;
  }

  // For local files, upload via multipart
  const uploadResult = await FileSystem.uploadAsync(
    `${API_URL}/stickers/remove-bg`,
    imageSource,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "image",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Background removal failed: ${uploadResult.body}`);
  }

  // The response body is the WebP binary — save as base64
  // FileSystem.uploadAsync returns body as string, but we need the binary
  // Instead, we download the result using a temp approach
  // For uploadAsync, we need to re-download — alternatively use fetch with FormData

  // Fallback: use fetch with FormData for local files
  const fileInfo = await FileSystem.getInfoAsync(imageSource);
  if (!fileInfo.exists) {
    throw new Error("Source image file not found");
  }

  const formData = new FormData();
  const uriParts = imageSource.split(".");
  const fileType = uriParts[uriParts.length - 1] || "jpg";

  formData.append("image", {
    uri: imageSource,
    name: `upload.${fileType}`,
    type: `image/${fileType === "jpg" ? "jpeg" : fileType}`,
  } as any);

  const fetchResponse = await fetch(`${API_URL}/stickers/remove-bg`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!fetchResponse.ok) {
    const errBody = await fetchResponse.text().catch(() => "Unknown error");
    throw new Error(`Background removal failed: ${errBody}`);
  }

  const blob = await fetchResponse.blob();
  const reader = new FileReader();
  const base64Data = await new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  await FileSystem.writeAsStringAsync(outputPath, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return outputPath;
}
