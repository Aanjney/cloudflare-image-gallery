import { imagePath, type ImageVariant } from '../domain/imageVariants';

export const imageUrl = imagePath;

export function imageSrcset(id: string, variants: ImageVariant[]): string {
  return variants.map((variant) => `${imageUrl(id, variant)} ${variant.width}w`).join(', ');
}

export function mediaUrl(id: string): string {
  return `/media/${id}`;
}

export function thumbUrl(id: string, variant: ImageVariant): string {
  return imageUrl(id, variant);
}
