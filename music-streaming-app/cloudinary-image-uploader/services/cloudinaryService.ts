import type { CloudinaryUploadResponse } from '../types';

// ===================================================================================
// IMPORTANT: CONFIGURE YOUR CLOUDINARY DETAILS HERE
// ===================================================================================

// 1. CLOUD NAME
// This is correctly set to your Cloud Name.
const CLOUDINARY_CLOUD_NAME = 'dg5yvg79b';

// 2. UPLOAD PRESET (FINAL STEP!)
// You need to replace the placeholder below with your *Unsigned* Upload Preset name.
//
// HOW TO CREATE ONE:
//   - In your Cloudinary Account, go to: Settings (gear icon) -> Upload tab.
//   - Scroll down to "Upload presets", and click "Add upload preset".
//   - Change "Signing Mode" from "Signed" to "Unsigned". This is critical.
//   - Save the preset.
//   - Copy the "Upload preset name" from your list of presets.
//   - Paste that name below, replacing 'YOUR_UNSIGNED_PRESET_NAME'.
// Fix: Explicitly type CLOUDINARY_UPLOAD_PRESET as a string to resolve the type error on line 28.
const CLOUDINARY_UPLOAD_PRESET: string = 'Imagestore'; // <--- PASTE YOUR PRESET NAME HERE

// ===================================================================================

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export const uploadImage = async (file: File): Promise<CloudinaryUploadResponse> => {
  if (CLOUDINARY_UPLOAD_PRESET === 'YOUR_UNSIGNED_PRESET_NAME') {
    throw new Error('Please configure your Cloudinary Upload Preset in services/cloudinaryService.ts before uploading.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    // Cloudinary often provides useful error messages in the response body
    const errorMessage = data?.error?.message || `HTTP error! status: ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as CloudinaryUploadResponse;
};