/**
 * Couleurs des series comparees (points 1 a 4 des series temporelles et des
 * profils verticaux).
 *
 * Elles etaient dupliquees dans les deux composants de trace, et les PUCES qui
 * les rappellent dans le formulaire portaient encore d'autres valeurs
 * (`var(--cyan-accent)`, `#22c55e`) : depuis que les jetons du theme clair ont
 * ete assombris, la puce « Point 1 » n'avait donc plus la couleur de sa
 * courbe. Une seule liste, lue par le trace ET par les puces.
 */
export const SERIES_COLORS = ['#38bdf8', '#e05a2b', '#a855f7', '#4ade80'];
