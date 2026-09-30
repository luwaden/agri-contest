/**
 * Photography slots. Every path below currently points to a labelled DUMMY image in /public/images.
 * To use real photos, overwrite the file with the same name (see public/images/README.md).
 * Set `src` to undefined to fall back to the illustrated scene.
 *
 * hero + cta: left undefined on purpose so the animated, wind-blown field scene shows.
 * To use a photo instead, set them to "/images/hero.jpg" and "/images/cta.jpg" (dummy files already exist).
 */
export interface MediaSlot { src?: string; alt: string }
export type MediaKey = "hero" | "story" | "cta" | "kaduna" | "niger" | "nasarawa" | "gallery1" | "gallery2" | "gallery3";

export const MEDIA: Record<MediaKey, MediaSlot> = {
  hero: { src: undefined /* "/images/hero.jpg" */, alt: "Young agripreneur inspecting a maize field at sunrise" },
  story: { src: "/images/story.jpg", alt: "Smallholder farmers and young entrepreneurs at a processing hub" },
  cta: { src: undefined /* "/images/cta.jpg" */, alt: "Rice fields at harvest" },
  kaduna: { src: "/images/kaduna.jpg", alt: "Farmland in Kaduna State" },
  niger: { src: "/images/niger.jpg", alt: "Rice fields in Niger State" },
  nasarawa: { src: "/images/nasarawa.jpg", alt: "Soybean farm in Nasarawa State" },
  gallery1: { src: "/images/gallery-1.jpg", alt: "Farmers bringing produce to market" },
  gallery2: { src: "/images/gallery-2.jpg", alt: "A crop processing hub" },
  gallery3: { src: "/images/gallery-3.jpg", alt: "Young entrepreneurs at a training session" },
};
