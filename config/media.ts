/**
 * Photography slots. While `src` is undefined the site shows its illustrated scene, so nothing looks unfinished.
 * To use a real photograph: save it in /public/images (e.g. hero.jpg, ideally under 400 KB) and set `src: "/images/hero.jpg"`.
 * Use only photos the programme has the rights to, and update `alt` to describe the real image.
 */
export interface MediaSlot { src?: string; alt: string }
export const MEDIA = {
  hero: { src: undefined, alt: "Young agripreneur inspecting a maize field at sunrise" } as MediaSlot,
  mentors: { src: undefined, alt: "A mentor advising a young agripreneur" } as MediaSlot,
};
