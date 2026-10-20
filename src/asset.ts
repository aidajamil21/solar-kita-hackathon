/** Resolve a file in /public against the deploy base path (e.g. /solar-kita-hackathon/ on GitHub Pages). */
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '')
