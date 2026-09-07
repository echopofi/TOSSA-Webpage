const cloudinary = require('cloudinary').v2;
const config = require('../config');

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Extract the Cloudinary public_id from a full image URL.
 * Handles both: https://res.cloudinary.com/{cloud}/image/upload/v123/sets/abc.jpg
 *           and: https://res.cloudinary.com/{cloud}/image/upload/sets/abc.jpg
 * Returns "sets/abc" (delivery-style id, no extension) for uploader.destroy().
 */
function publicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.\w+$/);
  return match ? match[1] : null;
}

/**
 * Delete a single Cloudinary image by its stored secure_url. Best-effort: a
 * failure is logged (never thrown) so the caller can decide how to proceed —
 * the DB record is still the source of truth for orphaned-asset handling.
 */
async function deleteImage(imageUrl) {
  const publicId = publicIdFromUrl(imageUrl);
  if (!publicId) {
    console.warn(`[cloudinary] skipping delete — no public_id parsed from "${imageUrl}"`);
    return null;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result && result.result === 'ok') {
      console.log(`[cloudinary] destroyed ${publicId}`);
    } else if (result && (result.result === 'not found' || result.error)) {
      // "not found" means the asset was already gone — treat as success.
      console.log(`[cloudinary] destroy ${publicId} -> ${JSON.stringify(result)}`);
    }
    return result;
  } catch (err) {
    console.error(`[cloudinary] destroy failed for ${publicId}: ${err && err.message}`);
    return null;
  }
}

module.exports = { cloudinary, deleteImage, publicIdFromUrl };